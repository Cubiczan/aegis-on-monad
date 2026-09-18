// LLM Council — three seats (BULL / BEAR / RISK) review large or borderline
// proposals. Primary path: z-ai-web-dev-sdk chat completion with strict JSON
// output. Fallback: deterministic heuristic quorum so the demo never stalls.

import ZAI from 'z-ai-web-dev-sdk'
import type { CouncilSeat, CouncilVerdict, GateConfig, MarketToken, TradeProposal } from './types'
import { heuristicCouncil, type CouncilContext } from './council.shared'

export { heuristicCouncil } from './council.shared'
export type { CouncilContext } from './council.shared'

const TIMEOUT_MS = 9000

function buildPrompt(p: TradeProposal, ctx: CouncilContext): string {
  const tok = ctx.tokens.find((t) => t.symbol === p.token)
  const hist = tok ? tok.history.slice(-12).map((x) => x.toFixed(4)).join(', ') : 'n/a'
  return `You are the Aegis LLM council reviewing ONE capital-moving proposal from an autonomous trading agent on Monad.

PROPOSAL
agent: ${p.agentName}
action: ${p.side} ${p.token}
notional: $${Math.round(p.notionalUSD).toLocaleString()}
confidence: ${(p.confidence * 100).toFixed(0)}%
rationale: ${p.rationale}

CONTEXT
${p.token} recent prices: ${hist}
portfolio value: $${Math.round(ctx.portfolioValueUSD).toLocaleString()}
daily notional so far: $${Math.round(ctx.dailyNotionalUSD).toLocaleString()} of $${Math.round(ctx.config.dailyCapUSD).toLocaleString()}
policy: per-trade cap $${Math.round(ctx.config.perTradeCapUSD).toLocaleString()}, concentration max ${(ctx.config.concentrationMaxPct * 100).toFixed(0)}%, confidence floor ${(ctx.config.confidenceFloor * 100).toFixed(0)}%

Respond with ONLY a JSON object, no prose, exactly this shape:
{"seats":[{"seat":"BULL","vote":"APPROVE|REJECT","note":"<12 words max>"},{"seat":"BEAR","vote":"APPROVE|REJECT","note":"<12 words max>"},{"seat":"RISK","vote":"APPROVE|REJECT","note":"<12 words max>"}]}
Quorum is 2-of-3 APPROVE. Judge risk vs reward only; do not invent facts.`
}

function parseSeats(raw: string): CouncilSeat[] | null {
  const m = raw.match(/\{[\s\S]*\}/)
  if (!m) return null
  try {
    const parsed = JSON.parse(m[0]) as { seats?: CouncilSeat[] }
    if (!Array.isArray(parsed.seats) || parsed.seats.length !== 3) return null
    const seats: CouncilSeat[] = []
    for (const s of parsed.seats) {
      if (s.seat !== 'BULL' && s.seat !== 'BEAR' && s.seat !== 'RISK') return null
      const vote = String(s.vote).toUpperCase()
      if (vote !== 'APPROVE' && vote !== 'REJECT') return null
      seats.push({ seat: s.seat, vote, note: String(s.note ?? '').slice(0, 90) })
    }
    return seats
  } catch {
    return null
  }
}

export async function llmCouncil(p: TradeProposal, ctx: CouncilContext): Promise<CouncilVerdict> {
  const started = Date.now()
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const zai = await ZAI.create()
    const run = zai.chat.completions.create({
      messages: [
        { role: 'assistant', content: 'You are a disciplined trading council. Output strict JSON only.' },
        { role: 'user', content: buildPrompt(p, ctx) },
      ],
      thinking: { type: 'disabled' },
    })
    // Settle-aware timeout: always cleared so the losing branch never rejects unhandled.
    const timeout = new Promise<never>((_, rej) => {
      timer = setTimeout(() => rej(new Error('council timeout')), TIMEOUT_MS)
    })
    let completion: Awaited<typeof run>
    try {
      completion = await Promise.race([run, timeout])
    } finally {
      if (timer) clearTimeout(timer)
    }
    const raw = completion.choices?.[0]?.message?.content ?? ''
    const seats = parseSeats(raw)
    if (!seats) return heuristicCouncil(p, ctx)
    const approves = seats.filter((s) => s.vote === 'APPROVE').length
    return {
      proposalId: p.id,
      seats,
      verdict: approves >= 2 ? 'APPROVE' : 'REJECT',
      mode: 'llm',
      latencyMs: Date.now() - started,
    }
  } catch {
    return heuristicCouncil(p, ctx)
  }
}
