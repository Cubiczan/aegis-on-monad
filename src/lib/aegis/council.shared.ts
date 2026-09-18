// LLM council — shared heuristic seat logic. Imported by BOTH the server
// council.ts (z-ai SDK path with heuristic fallback) and the browser-local
// demo engine (heuristic-only, no SDK on the client). Kept dependency-free.

import type { CouncilSeat, CouncilVerdict, GateConfig, MarketToken, TradeProposal } from './types'

export interface CouncilContext {
  config: GateConfig
  tokens: MarketToken[]
  portfolioValueUSD: number
  dailyNotionalUSD: number
}

export function heuristicCouncil(p: TradeProposal, ctx: CouncilContext): CouncilVerdict {
  const tok = ctx.tokens.find((t) => t.symbol === p.token)
  const h = tok?.history.slice(-14) ?? []
  const momentum = h.length > 4 ? (h[h.length - 1] - h[0]) / Math.max(h[0], 1e-9) : 0
  const seats: CouncilSeat[] = [
    {
      seat: 'BULL',
      vote: (p.side === 'BUY' ? momentum > -0.004 : momentum > 0.004) ? 'APPROVE' : 'REJECT',
      note: p.side === 'BUY' ? 'Trend supports entry' : 'Distribution signal consistent',
    },
    {
      seat: 'BEAR',
      vote: Math.abs(momentum) < 0.03 ? 'APPROVE' : 'REJECT',
      note: Math.abs(momentum) < 0.03 ? 'No overextension detected' : 'Move looks exhausted; adverse entry',
    },
    {
      seat: 'RISK',
      vote: p.confidence >= ctx.config.confidenceFloor && p.notionalUSD <= ctx.config.perTradeCapUSD
        ? 'APPROVE' : 'REJECT',
      note: p.confidence >= ctx.config.confidenceFloor ? 'Within policy bounds' : 'Below confidence floor',
    },
  ]
  const approves = seats.filter((s) => s.vote === 'APPROVE').length
  return {
    proposalId: p.id,
    seats,
    verdict: approves >= 2 ? 'APPROVE' : 'REJECT',
    mode: 'heuristic',
    latencyMs: 0,
  }
}
