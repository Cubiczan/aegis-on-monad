'use client'

// Sentinel tab — watcher swarm, exploit drills, autonomous breaker timeline.

import { useState } from 'react'
import type { AegisApi } from '@/lib/aegis/useAegis'
import { DRILL_SCENARIOS } from '@/lib/aegis/types'
import { Panel, Stat, StatusDot, usd } from './primitives'

const SEV_STYLE: Record<string, string> = {
  LOW: 'text-zinc-300 border-zinc-600/50 bg-zinc-700/20',
  MEDIUM: 'text-amber-300 border-amber-500/40 bg-amber-500/10',
  HIGH: 'text-orange-300 border-orange-500/40 bg-orange-500/10',
  CRITICAL: 'text-red-300 border-red-500/50 bg-red-500/15',
}

const PHASE_STYLE: Record<string, string> = {
  INJECT: 'border-zinc-600/60 text-zinc-300',
  DETECT: 'border-orange-500/60 text-orange-300',
  OSINT: 'border-cyan-500/60 text-cyan-300',
  CONSENSUS: 'border-violet-500/60 text-violet-300',
  PAUSE: 'border-red-500/70 text-red-300',
  LEDGER: 'border-yellow-500/60 text-yellow-300',
  STAND_DOWN: 'border-emerald-500/60 text-emerald-300',
}

export function SentinelTab({ api }: { api: AegisApi }) {
  const s = api.snap
  const [busy, setBusy] = useState<string | null>(null)
  if (!s) return null
  const drill = s.sentinel.lastDrill
  const alerts = s.sentinel.alerts

  const fire = (id: string) => {
    setBusy(id)
    api.runDrill(id as never, () => setBusy(null))
  }

  return (
    <div className="space-y-4">
      {s.desk.paused && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-500/50 bg-red-950/40 px-4 py-3">
          <div>
            <div className="font-mono text-sm font-semibold text-red-300">BREAKER: LOCKED — autonomous pause is holding</div>
            <div className="text-[12px] text-red-200/70">{s.desk.pausedReason} · paused {s.desk.pausedAt ? `${Math.max(0, Math.round((Date.now() - s.desk.pausedAt) / 1000))}s ago` : ''}</div>
          </div>
          <button onClick={api.resume} className="rounded-md border border-amber-500/50 bg-amber-500/15 px-3 py-1.5 font-mono text-[12px] text-amber-300 hover:bg-amber-500/25">
            HUMAN KEY · RESUME
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Watchers online" value={`${s.sentinel.watchers.filter((w) => w.status === 'ONLINE').length}/4`} tone="ok" sub="every proposal scored in-band" />
        <Stat label="Exploit $ stopped" value={usd(s.stats.exploitsStoppedUSD)} tone="ok" sub="blocked pre-broadcast" />
        <Stat label="Drills run" value={s.sentinel.drills.length} sub={`${s.sentinel.drills.filter((d) => d.outcome === 'PAUSED').length} pauses · ${s.sentinel.drills.filter((d) => d.outcome === 'FALSE_POSITIVE_CLEARED').length} stand-downs`} />
        <Stat label="False positives held" value="0" tone="ok" sub="OSINT cross-check discipline" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1.25fr]">
        <div className="space-y-4">
          <Panel title="Exploit drills" right={<span className="font-mono text-[10px] text-zinc-500">inject · detect · verify · pause</span>}>
            <div className="space-y-2.5">
              {DRILL_SCENARIOS.map((sc) => (
                <div key={sc.id} className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[13px] font-medium text-zinc-200">{sc.label}</div>
                      <p className="mt-1 text-[11.5px] leading-5 text-zinc-500">{sc.description}</p>
                    </div>
                    <button onClick={() => fire(sc.id)} disabled={!!busy}
                      className={`shrink-0 rounded-md px-3 py-1.5 font-mono text-[11px] ${sc.expectPause ? 'border border-red-500/50 bg-red-500/15 text-red-300 hover:bg-red-500/25' : 'border border-cyan-500/50 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20'} disabled:opacity-40`}>
                      {busy === sc.id ? 'RUNNING…' : 'RUN'}
                    </button>
                  </div>
                  <div className="mt-1.5 font-mono text-[10px] uppercase tracking-wider text-zinc-600">
                    expected: {sc.expectPause ? 'autonomous pause' : 'false-positive stand-down'}
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Watcher swarm" right={<span className="font-mono text-[10px] text-zinc-500">consensus 2-of-3 + OSINT</span>}>
            <ul className="space-y-2">
              {s.sentinel.watchers.map((w) => (
                <li key={w.id} className="flex items-start gap-2.5 rounded border border-zinc-800 bg-zinc-900/40 px-3 py-2">
                  <span className="mt-1"><StatusDot ok firing={w.firing} /></span>
                  <div className="min-w-0">
                    <div className="font-mono text-[12px] text-zinc-200">{w.name} <span className="text-zinc-500">· {w.id}</span>
                      {w.firing && <span className="ml-2 rounded bg-red-500/20 px-1.5 py-0.5 text-[9px] text-red-300">FIRING</span>}
                    </div>
                    <div className="text-[11px] text-zinc-500">{w.description}</div>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel title="Drill timeline" right={drill ? <span className={`rounded border px-2 py-0.5 font-mono text-[10px] ${drill.outcome === 'PAUSED' ? 'border-red-500/50 bg-red-500/15 text-red-300' : drill.outcome === 'FALSE_POSITIVE_CLEARED' ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300' : 'border-zinc-700 text-zinc-400'}`}>{drill.outcome.replace(/_/g, ' ')}</span> : null}>
            {!drill ? (
              <div className="py-10 text-center text-[12px] text-zinc-600">Run a drill to watch detect → OSINT → consensus → pause with real latencies.</div>
            ) : (
              <div className="space-y-2">
                <div className="font-mono text-[11px] text-zinc-400">{drill.label} · {new Date(drill.startedAt).toLocaleTimeString('en-US', { hour12: false })}
                  {drill.pauseLatencyMs ? <span className="ml-2 text-red-300">pause landed +{drill.pauseLatencyMs}ms</span> : null}
                </div>
                <ol className="space-y-0">
                  {drill.steps.map((st, i) => (
                    <li key={i} className={`ml-3 border-l-2 pl-4 pb-3 ${PHASE_STYLE[st.phase] ?? 'border-zinc-700'}`}>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] font-semibold uppercase">{st.phase}</span>
                        {st.latencyMs !== undefined && <span className="font-mono text-[10px] text-zinc-600">+{st.latencyMs}ms</span>}
                      </div>
                      <div className="text-[12px] leading-5 text-zinc-400">{st.detail}</div>
                    </li>
                  ))}
                </ol>
                {drill.blockedValueUSD > 0 && (
                  <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-[12px] text-emerald-300">
                    {usd(drill.blockedValueUSD)} of hostile notional never reached the mempool — gate blocked it while the sentinel verified.
                  </div>
                )}
              </div>
            )}
          </Panel>

          <Panel title="Sentinel alerts" right={<span className="font-mono text-[10px] text-zinc-500">retained for audit</span>}>
            <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
              {alerts.map((a) => (
                <div key={a.id} className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded border px-1.5 py-0.5 font-mono text-[9px] ${SEV_STYLE[a.severity]}`}>{a.severity}</span>
                    <span className="font-mono text-[11px] text-zinc-300">{a.shape}</span>
                    <span className="font-mono text-[10px] text-zinc-600">{a.watcher}</span>
                    <span className={`ml-auto rounded px-1.5 py-0.5 font-mono text-[9px] ${a.osint.result === 'CONFIRMED' ? 'bg-red-500/15 text-red-300' : a.osint.result === 'FALSE_POSITIVE' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-zinc-800 text-zinc-500'}`}>
                      OSINT: {a.osint.result.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="mt-1 text-[11.5px] leading-5 text-zinc-400">{a.detail}</div>
                  {a.osint.note && <div className="mt-0.5 text-[11px] italic text-zinc-600">OSINT — {a.osint.note}</div>}
                </div>
              ))}
              {!alerts.length && <div className="py-8 text-center text-[12px] text-zinc-600">No alerts yet. The watchers are quiet.</div>}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  )
}
