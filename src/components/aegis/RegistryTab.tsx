'use client'

// Registry tab — ERC-8004 agent identity: register, pause, freeze, reputation.

import { useState } from 'react'
import type { AegisApi } from '@/lib/aegis/useAegis'
import { Panel, Stat, StatusDot } from './primitives'

const ROLE_STYLE: Record<string, string> = {
  signal: 'text-sky-300 border-sky-500/40 bg-sky-500/10',
  executor: 'text-emerald-300 border-emerald-500/40 bg-emerald-500/10',
  council: 'text-violet-300 border-violet-500/40 bg-violet-500/10',
  sentinel: 'text-red-300 border-red-500/40 bg-red-500/10',
  rogue: 'text-red-300 border-red-500/60 bg-red-500/20',
}

export function RegistryTab({ api }: { api: AegisApi }) {
  const s = api.snap
  const [name, setName] = useState('')
  const [domain, setDomain] = useState('')
  const [caps, setCaps] = useState('')
  if (!s) return null

  const submit = () => {
    if (!name.trim() || !domain.trim()) return
    api.registerAgent(name.trim(), domain.trim(), caps.split(',').map((c) => c.trim()).filter(Boolean))
    setName(''); setDomain(''); setCaps('')
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Registered agents" value={s.agents.length} sub="ERC-8004 identities" />
        <Stat label="Active" value={s.agents.filter((a) => a.status === 'ACTIVE').length} tone="ok" />
        <Stat label="Frozen by sentinel" value={s.agents.filter((a) => a.status === 'FROZEN').length} tone={s.agents.some((a) => a.status === 'FROZEN') ? 'bad' : 'default'} />
        <Stat label="Avg reputation" value={(s.agents.reduce((a, x) => a + x.reputation, 0) / s.agents.length).toFixed(1)} sub="accrues from ledger history" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1.4fr]">
        <Panel title="Register agent" right={<span className="font-mono text-[10px] text-zinc-500">AegisRegistry.register()</span>}>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block font-mono text-[11px] text-zinc-400">name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. basis-arb-v2"
                className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-[12px] text-zinc-200 placeholder:text-zinc-600 focus:border-violet-500/60 focus:outline-none" />
            </div>
            <div>
              <label className="mb-1 block font-mono text-[11px] text-zinc-400">domain</label>
              <input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="aegis://dreamdesk/basis-arb"
                className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-[12px] text-zinc-200 placeholder:text-zinc-600 focus:border-violet-500/60 focus:outline-none" />
            </div>
            <div>
              <label className="mb-1 block font-mono text-[11px] text-zinc-400">capabilities (comma-separated)</label>
              <input value={caps} onChange={(e) => setCaps(e.target.value)} placeholder="spot, delta-neutral"
                className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-[12px] text-zinc-200 placeholder:text-zinc-600 focus:border-violet-500/60 focus:outline-none" />
            </div>
            <button onClick={submit} disabled={!name.trim() || !domain.trim()}
              className="w-full rounded-md border border-violet-500/50 bg-violet-500/20 px-3 py-2 font-mono text-[12px] text-violet-200 hover:bg-violet-500/30 disabled:opacity-40">
              REGISTER ON MONAD
            </button>
            <p className="text-[11px] leading-5 text-zinc-600">
              Registration journalls a REGISTRY entry into the HMAC ledger. New agents start at a neutral reputation
              and a low trust weight — the gate treats unproven identities more carefully, and the sentinel treats
              new-agent + large-size + unallowlisted-asset as a drain signature.
            </p>
          </div>
        </Panel>

        <Panel title="Registry" right={<span className="font-mono text-[10px] text-zinc-500">{s.desk.chainId} · monad testnet (sim)</span>}>
          <div className="max-h-[32rem] space-y-2 overflow-y-auto pr-1">
            {s.agents.map((a) => (
              <div key={a.id} className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="mt-0.5"><StatusDot ok={a.status === 'ACTIVE'} /></span>
                  <span className="font-mono text-[13px] text-zinc-100">#{a.seq} {a.name}</span>
                  <span className={`rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase ${ROLE_STYLE[a.role] ?? ''}`}>{a.role}</span>
                  <span className={`ml-auto rounded px-1.5 py-0.5 font-mono text-[9px] ${a.status === 'ACTIVE' ? 'bg-emerald-500/15 text-emerald-300' : a.status === 'FROZEN' ? 'bg-red-500/20 text-red-300' : 'bg-zinc-700/50 text-zinc-400'}`}>
                    {a.status}
                  </span>
                </div>
                <div className="mt-1 font-mono text-[10px] text-zinc-500">
                  {a.domain} · {a.id.slice(0, 14)}… · reg. block {a.block.toLocaleString()} · stake {a.stakeMON} MON
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="h-1.5 w-36 overflow-hidden rounded bg-zinc-800">
                    <div className={`h-full ${a.reputation > 60 ? 'bg-emerald-500' : a.reputation > 30 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${a.reputation}%` }} />
                  </div>
                  <span className="font-mono text-[10px] text-zinc-400">rep {a.reputation.toFixed(1)}</span>
                  <span className="font-mono text-[10px] text-zinc-600">{a.capabilities.join(' · ')}</span>
                  <div className="ml-auto flex gap-1.5">
                    {a.status === 'ACTIVE' ? (
                      <button onClick={() => api.setAgentStatus(a.id, 'PAUSED')}
                        className="rounded border border-amber-500/40 px-2 py-0.5 font-mono text-[10px] text-amber-300 hover:bg-amber-500/15">PAUSE</button>
                    ) : a.status === 'PAUSED' ? (
                      <button onClick={() => api.setAgentStatus(a.id, 'ACTIVE')}
                        className="rounded border border-emerald-500/40 px-2 py-0.5 font-mono text-[10px] text-emerald-300 hover:bg-emerald-500/15">RESUME</button>
                    ) : (
                      <button onClick={() => api.setAgentStatus(a.id, 'ACTIVE')}
                        className="rounded border border-red-500/40 px-2 py-0.5 font-mono text-[10px] text-red-300 hover:bg-red-500/15">UNFREEZE</button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  )
}
