// Aegis Gate — CHP v1.0 policy engine. Fail-closed: every rule that cannot be
// evaluated cleanly resolves against the caller. Outcomes:
//   PASS          -> cleared to simulate + broadcast
//   HITL_REQUIRED -> human-in-the-loop must decide
//   BLOCKED       -> policy violation, never broadcasts
//   LOCKED        -> sentinel circuit breaker active, nothing moves

import type {
  Agent, GateCheck, GateConfig, GateEvaluation, GateVerdict, TradeProposal,
} from './types'

export interface GateContext {
  deskPaused: boolean
  pausedReason?: string
  dailyNotionalUSD: number
  agent?: Agent
  agentRecentCount: number            // proposals by this agent in the last 60s
  positionValueUSD: number            // current value of position in target token
  portfolioValueUSD: number           // treasury + positions at market
  councilApproved?: boolean           // council verdict for this proposal (if required)
  councilPending?: boolean
  allowlist: string[]
}

export const CHP_VERSION = 'CHP v1.0 — fail-closed policy kernel'

export function evaluateGate(
  p: TradeProposal,
  cfg: GateConfig,
  ctx: GateContext,
): GateEvaluation {
  const checks: GateCheck[] = []
  let verdict: GateVerdict = 'PASS'
  let reason = 'All policy checks passed'

  const fail = (v: GateVerdict, r: string) => {
    verdict = v
    reason = r
  }

  // R0 — Circuit breaker: when the sentinel has locked the desk, nothing moves.
  if (ctx.deskPaused) {
    checks.push({ rule: 'circuit_breaker', label: 'Sentinel breaker', passed: false, detail: `Desk LOCKED: ${ctx.pausedReason ?? 'sentinel pause'}` })
    fail('LOCKED', `Circuit breaker engaged — ${ctx.pausedReason ?? 'sentinel pause'}`)
    return finalize(checks, verdict, reason)
  }
  checks.push({ rule: 'circuit_breaker', label: 'Sentinel breaker', passed: true, detail: 'Desk operational — breaker disengaged' })

  // R1 — Identity: agent must be registered under the ERC-8004 registry and ACTIVE.
  const agent = ctx.agent
  if (!agent) {
    checks.push({ rule: 'identity', label: 'ERC-8004 identity', passed: false, detail: `Agent ${p.agentId} not found in registry` })
    fail('BLOCKED', 'Unregistered agent — identity check failed')
    return finalize(checks, verdict, reason)
  }
  if (agent.status === 'FROZEN') {
    checks.push({ rule: 'identity', label: 'ERC-8004 identity', passed: false, detail: `Agent ${agent.name} FROZEN by sentinel` })
    fail('BLOCKED', `Agent ${agent.name} is frozen (sentinel order)`)
    return finalize(checks, verdict, reason)
  }
  if (agent.status !== 'ACTIVE') {
    checks.push({ rule: 'identity', label: 'ERC-8004 identity', passed: false, detail: `Agent status ${agent.status}` })
    fail('BLOCKED', `Agent ${agent.name} is ${agent.status.toLowerCase()}`)
    return finalize(checks, verdict, reason)
  }
  checks.push({ rule: 'identity', label: 'ERC-8004 identity', passed: true, detail: `#${agent.seq} ${agent.name} · rep ${agent.reputation.toFixed(1)} · ACTIVE` })

  // R2 — Token allowlist.
  const allowed = ctx.allowlist.includes(p.token)
  checks.push({ rule: 'allowlist', label: 'Asset allowlist', passed: allowed, detail: allowed ? `${p.token} is allowlisted` : `${p.token} NOT on allowlist (${cfg.allowlist.join(', ')})` })
  if (!allowed) {
    fail('BLOCKED', `Asset ${p.token} is not allowlisted`)
    return finalize(checks, verdict, reason)
  }

  // R3 — Per-trade cap: above cap is not a hard block, it escalates to a human.
  const overCap = p.notionalUSD > cfg.perTradeCapUSD
  checks.push({ rule: 'per_trade_cap', label: 'Per-trade cap', passed: !overCap, detail: `$${fmt(p.notionalUSD)} vs cap $${fmt(cfg.perTradeCapUSD)}` })
  if (overCap) {
    fail('HITL_REQUIRED', `Notional $${fmt(p.notionalUSD)} exceeds per-trade cap $${fmt(cfg.perTradeCapUSD)} — human sign-off required`)
    return finalize(checks, verdict, reason)
  }

  // R4 — Daily notional cap.
  const dailySum = ctx.dailyNotionalUSD + p.notionalUSD
  const dailyOk = dailySum <= cfg.dailyCapUSD
  checks.push({ rule: 'daily_cap', label: 'Daily notional cap', passed: dailyOk, detail: `Running $${fmt(ctx.dailyNotionalUSD)} + $${fmt(p.notionalUSD)} = $${fmt(dailySum)} vs $${fmt(cfg.dailyCapUSD)}` })
  if (!dailyOk) {
    fail('BLOCKED', `Daily notional cap exceeded ($${fmt(dailySum)} > $${fmt(cfg.dailyCapUSD)})`)
    return finalize(checks, verdict, reason)
  }

  // R5 — Velocity: proposals per minute per agent.
  const velOk = ctx.agentRecentCount <= cfg.velocityMaxPerMin
  checks.push({ rule: 'velocity', label: 'Velocity limit', passed: velOk, detail: `${ctx.agentRecentCount} broadcasts in last 60s vs max ${cfg.velocityMaxPerMin}` })
  if (!velOk) {
    fail('BLOCKED', `Velocity breach: ${ctx.agentRecentCount} tx/60s from ${agent.name} (max ${cfg.velocityMaxPerMin})`)
    return finalize(checks, verdict, reason)
  }

  // R6 — Confidence floor.
  const confOk = p.confidence >= cfg.confidenceFloor
  checks.push({ rule: 'confidence_floor', label: 'Confidence floor', passed: confOk, detail: `${(p.confidence * 100).toFixed(0)}% vs floor ${(cfg.confidenceFloor * 100).toFixed(0)}%` })
  if (!confOk) {
    fail('BLOCKED', `Confidence ${(p.confidence * 100).toFixed(0)}% below floor ${(cfg.confidenceFloor * 100).toFixed(0)}%`)
    return finalize(checks, verdict, reason)
  }

  // R7 — Concentration: post-trade exposure to one asset vs portfolio.
  const postExposure = (ctx.positionValueUSD + (p.side === 'BUY' ? p.notionalUSD : 0)) / Math.max(ctx.portfolioValueUSD, 1)
  const concOk = postExposure <= cfg.concentrationMaxPct
  checks.push({ rule: 'concentration', label: 'Concentration limit', passed: concOk, detail: `Post-trade ${p.token} exposure ${(postExposure * 100).toFixed(1)}% vs max ${(cfg.concentrationMaxPct * 100).toFixed(0)}%` })
  if (!concOk) {
    fail('HITL_REQUIRED', `Post-trade concentration ${(postExposure * 100).toFixed(1)}% exceeds ${(cfg.concentrationMaxPct * 100).toFixed(0)}% — human sign-off required`)
    return finalize(checks, verdict, reason)
  }

  // R8 — LLM council: large trades need a recorded council verdict.
  if (p.notionalUSD > cfg.councilAboveUSD) {
    if (ctx.councilPending) {
      checks.push({ rule: 'council', label: 'LLM council', passed: null, detail: 'Awaiting council quorum' })
      fail('HITL_REQUIRED', 'Council review in flight')
      return finalize(checks, verdict, reason)
    }
    const ok = ctx.councilApproved === true
    checks.push({ rule: 'council', label: 'LLM council', passed: ok, detail: ok ? 'Council quorum APPROVE recorded in ledger' : 'Council quorum REJECT recorded in ledger' })
    if (!ok) {
      fail('BLOCKED', 'LLM council voted REJECT')
      return finalize(checks, verdict, reason)
    }
  } else {
    checks.push({ rule: 'council', label: 'LLM council', passed: true, detail: `Notional below council threshold $${fmt(cfg.councilAboveUSD)} — deterministic gates sufficient` })
  }

  // R9 — Pre-broadcast simulation (Anvil fork / eth_call state-override pre-flight).
  if (cfg.simulationRequired) {
    checks.push({ rule: 'simulation', label: 'Pre-broadcast sim', passed: null, detail: 'Queued: Anvil fork simulation before broadcast' })
  } else {
    checks.push({ rule: 'simulation', label: 'Pre-broadcast sim', passed: true, detail: 'Simulation bypassed by config (not recommended)' })
  }

  return finalize(checks, verdict, reason)
}

function finalize(checks: GateCheck[], verdict: GateVerdict, reason: string): GateEvaluation {
  // Fail-closed: any check that was never resolved to true/null with a failing
  // verdict already returned above. This finalizer just stamps the outcome.
  return { verdict, checks, reason }
}

export function fmt(n: number): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: 0 })
}
