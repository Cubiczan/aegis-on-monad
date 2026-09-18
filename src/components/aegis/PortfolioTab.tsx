'use client'

// Treasury tab — live Zerion portfolio wired into the risk engine.
// Shows the real on-chain treasury the CHP caps are derived from.

import { useEffect, useState } from 'react'
import type { AegisApi } from '@/lib/aegis/useAegis'
import type { ZerionPosition } from '@/lib/aegis/types'
import { Panel, Stat, usd } from './primitives'

const DEFAULTS = [
  { label: 'vitalik.eth', addr: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045' },
]

function ago(ts: number): string {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000))
  return s < 60 ? `${s}s ago` : `${Math.round(s / 60)}m ago`
}

function Chg({ v }: { v?: number }) {
  if (v === undefined || v === null || !Number.isFinite(v)) return <span className="text-zinc-600">—</span>
  // Zerion returns percent values already in percentage points (4.79 = +4.79%).
  const pctStr = `${v > 0 ? '+' : ''}${v.toFixed(1)}%`
  return <span className={v > 0.05 ? 'text-emerald-400' : v < -0.05 ? 'text-red-400' : 'text-zinc-500'}>{pctStr}</span>
}

function ChainBars({ byChain, total }: { byChain: { id: string; usd: number }[]; total: number }) {
  const top = byChain.slice(0, 9)
  const rest = byChain.slice(9).reduce((s, c) => s + c.usd, 0)
  const rows = rest > 0 ? [...top, { id: '__rest', usd: rest }] : top
  return (
    <div className="space-y-1.5">
      {rows.map((c) => {
        const share = total > 0 ? c.usd / total : 0
        const isMonad = c.id === 'monad'
        const isRest = c.id === '__rest'
        return (
          <div key={c.id} className="flex items-center gap-2">
            <span className={`w-28 shrink-0 truncate text-right font-mono text-[11px] ${isMonad ? 'text-violet-300' : 'text-zinc-500'}`}>
              {isRest ? `${byChain.length - 9} other chains` : c.id}
            </span>
            <div className="h-3.5 flex-1 overflow-hidden rounded-sm bg-zinc-800/60">
              <div
                className={`h-full rounded-sm ${isMonad ? 'bg-violet-500/80' : 'bg-teal-500/40'}`}
                style={{ width: `${Math.max(share * 100, 0.5)}%` }}
              />
            </div>
            <span className="w-24 shrink-0 text-right font-mono text-[11px] text-zinc-400">
              {usd(c.usd)} <span className="text-zinc-600">({(share * 100).toFixed(1)}%)</span>
            </span>
          </div>
        )
      })}
      {!byChain.length && <div className="text-[12px] text-zinc-600">No chain distribution returned.</div>}
    </div>
  )
}

function PositionRow({ p }: { p: ZerionPosition }) {
  return (
    <tr className="border-b border-zinc-800/60 last:border-0">
      <td className="py-1.5 pl-3 pr-2">
        <div className="flex items-center gap-2">
          {p.icon && (
            <img src={p.icon} alt="" referrerPolicy="no-referrer" className="h-5 w-5 rounded-full bg-zinc-800" />
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[12px] text-zinc-100">{p.symbol}</span>
              {p.chain === 'monad' && <span className="rounded bg-violet-500/20 px-1 font-mono text-[9px] text-violet-300">MONAD</span>}
              {p.verified && <span title="Zerion-verified token" className="text-[9px] text-emerald-400">✓</span>}
            </div>
            <div className="max-w-[180px] truncate text-[10px] text-zinc-600">{p.name}</div>
          </div>
        </div>
      </td>
      <td className="px-2 py-1.5 text-right font-mono text-[11px] text-zinc-400">{p.qty >= 1000 ? p.qty.toLocaleString('en-US', { maximumFractionDigits: 0 }) : p.qty.toLocaleString('en-US', { maximumFractionDigits: 4 })}</td>
      <td className="px-2 py-1.5 text-right font-mono text-[11px] text-zinc-200">{usd(p.value)}</td>
      <td className="px-2 py-1.5 text-right font-mono text-[11px] text-zinc-500">{p.price > 0 ? `$${p.price < 0.01 ? p.price.toPrecision(3) : p.price.toFixed(2)}` : '—'}</td>
      <td className="px-2 py-1.5 text-right font-mono text-[11px]"><Chg v={p.change1d} /></td>
      <td className="py-1.5 pl-2 pr-3 text-right">
        <span className={`rounded px-1.5 py-0.5 font-mono text-[9px] uppercase ${p.chain === 'monad' ? 'bg-violet-500/15 text-violet-300' : 'bg-zinc-800 text-zinc-500'}`}>{p.chain}</span>
      </td>
    </tr>
  )
}

export function PortfolioTab({ api }: { api: AegisApi }) {
  const s = api.snap
  const [addr, setAddr] = useState(DEFAULTS[0].addr)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)
  const [nowTick, setNowTick] = useState(0)

  // Re-render every 5s so "fetched Xs ago" stays fresh.
  useEffect(() => {
    const t = setInterval(() => setNowTick((n) => n + 1), 5000)
    return () => clearInterval(t)
  }, [])

  if (!s) return null
  const z = s.zerion
  const pf = z.portfolio
  void nowTick

  const load = (a?: string) => {
    const target = a ?? addr
    if (a) setAddr(a)
    setBusy(true)
    setErr(null)
    api.loadPortfolio(target, (r) => {
      setBusy(false)
      if (!r.ok) setErr(r.error ?? 'fetch failed')
    })
  }

  return (
    <div className="space-y-4">
      {/* loader bar */}
      <Panel
        title="Live treasury import — Zerion API"
        right={
          <span className={`flex items-center gap-1.5 font-mono text-[10px] ${z.live ? 'text-teal-400' : z.enabled ? 'text-amber-400' : 'text-red-400'}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${z.live ? 'animate-pulse bg-teal-400' : z.enabled ? 'bg-amber-400' : 'bg-red-400'}`} />
            {z.live ? 'LIVE · api.zerion.io' : z.enabled ? 'KEY SET · not yet fetched' : 'NO API KEY'}
          </span>
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={addr}
            onChange={(e) => setAddr(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') load() }}
            spellCheck={false}
            placeholder="0x… or name.eth"
            className="min-w-[260px] flex-1 rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-[12px] text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-violet-500/60"
          />
          <button
            onClick={() => load()}
            disabled={busy || !z.enabled}
            className="rounded-md border border-teal-500/50 bg-teal-500/15 px-4 py-2 font-mono text-[12px] text-teal-300 transition-colors hover:bg-teal-500/25 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? 'FETCHING…' : 'LOAD LIVE PORTFOLIO'}
          </button>
          {DEFAULTS.map((d) => (
            <button key={d.addr} onClick={() => load(d.addr)} disabled={busy}
              className="rounded-md border border-zinc-700 bg-zinc-800/60 px-3 py-2 font-mono text-[11px] text-zinc-400 hover:text-zinc-200 disabled:opacity-40">
              {d.label}
            </button>
          ))}
        </div>
        {err && <div className="mt-2 rounded-md border border-red-500/40 bg-red-950/20 px-3 py-2 font-mono text-[11px] text-red-300">{err}</div>}
        {!z.enabled && (
          <div className="mt-2 rounded-md border border-amber-500/30 bg-amber-950/10 px-3 py-2 font-mono text-[11px] leading-5 text-amber-300/90">
            Server-side ZERION_API_KEY missing — add it to <span className="text-amber-200">.env</span> and restart the engine.
            Until then the gate runs on desk-local NAV (mirror mode).
          </div>
        )}
        <div className="mt-2 text-[11px] leading-5 text-zinc-600">
          Any wallet — ENS or 0x — is pulled live from Zerion v1 (Basic auth, key stays server-side).
          The imported NAV recalibrates the CHP risk envelope below, so the gate&apos;s dollar caps always scale with the real treasury the agents are spending from.
        </div>
      </Panel>

      {z.lastError && !err && (
        <div className="rounded-lg border border-red-500/30 bg-red-950/10 px-4 py-2 font-mono text-[11px] text-red-300">last engine fetch error: {z.lastError}</div>
      )}

      {!pf ? (
        <Panel title="Treasury">
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <div className="font-mono text-[13px] text-zinc-400">No live portfolio loaded yet</div>
            <div className="max-w-md text-[12px] leading-5 text-zinc-600">
              Load a wallet above to anchor the desk on real on-chain holdings. Zerion returns positions across every supported chain — including Monad, the desk&apos;s native chain — and the risk engine immediately starts deriving caps from the imported NAV.
            </div>
          </div>
        </Panel>
      ) : (
        <>
          {/* headline stats */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <Stat
              label="Live NAV"
              value={usd(pf.totalUSD)}
              tone="ok"
              sub={`fetched ${ago(pf.fetchedAt)} · ${pf.latencyMs}ms${nowTick % 2 ? '' : ''}`}
            />
            <Stat label="1d change" value={<Chg v={pf.changes.percent?.['1d']} />} sub={pf.changes.absolute?.['1d'] !== undefined ? `${pf.changes.absolute['1d'] > 0 ? '+' : ''}${usd(pf.changes.absolute['1d'])} · 1d` : 'Zerion exposes 1d window'} />
            <Stat
              label="Top chain"
              value={<span className="text-[15px]">{pf.byChain[0]?.id.replace(/-/g, ' ') ?? '—'}</span>}
              sub={pf.byChain[0] && pf.totalUSD > 0 ? `${usd(pf.byChain[0].usd)} · ${((pf.byChain[0].usd / pf.totalUSD) * 100).toFixed(1)}% of NAV` : '—'}
            />
            <Stat
              label="Monad exposure"
              value={(() => {
                const m = pf.byChain.find((c) => c.id === 'monad')
                return m ? usd(m.usd) : <span className="text-zinc-600">$0</span>
              })()}
              sub={(() => {
                const m = pf.byChain.find((c) => c.id === 'monad')
                return m && pf.totalUSD > 0 ? `${((m.usd / pf.totalUSD) * 100).toFixed(2)}% of NAV · desk native chain` : 'no native-chain position'
              })()}
            />
            <Stat label="Wallet" value={<span className="text-[13px]">{pf.address.startsWith('0x') ? `${pf.address.slice(0, 8)}…${pf.address.slice(-6)}` : pf.address}</span>} sub={`${pf.byChain.length} chains · ${pf.positions.length} positions`} />
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
            <Panel title="Positions" right={<span className="font-mono text-[10px] text-zinc-500">Zerion · USD · sorted by value</span>}>
              <div className="-m-4 overflow-x-auto">
                <table className="w-full min-w-[560px]">
                  <thead>
                    <tr className="border-b border-zinc-800 text-left font-mono text-[10px] uppercase tracking-wider text-zinc-600">
                      <th className="py-2 pl-3 pr-2 font-medium">Asset</th>
                      <th className="px-2 py-2 text-right font-medium">Quantity</th>
                      <th className="px-2 py-2 text-right font-medium">Value</th>
                      <th className="px-2 py-2 text-right font-medium">Price</th>
                      <th className="px-2 py-2 text-right font-medium">24h</th>
                      <th className="py-2 pl-2 pr-3 text-right font-medium">Chain</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(showAll ? pf.positions : pf.positions.slice(0, 10)).map((p, i) => <PositionRow key={`${p.symbol}-${p.chain}-${i}`} p={p} />)}
                  </tbody>
                </table>
              </div>
              {pf.positions.length > 10 && (
                <div className="mt-3 border-t border-zinc-800 pt-2 text-center">
                  <button onClick={() => setShowAll((v) => !v)} className="font-mono text-[11px] text-violet-400 hover:text-violet-300">
                    {showAll ? '− show top 10' : `+ show all ${pf.positions.length} positions`}
                  </button>
                </div>
              )}
              {!pf.positions.length && <div className="py-6 text-center text-[12px] text-zinc-600">No displayable positions returned for this wallet.</div>}
            </Panel>

            <div className="space-y-4">
              <Panel title="Chain distribution" right={<span className="font-mono text-[10px] text-zinc-500">exposure map</span>}>
                <ChainBars byChain={pf.byChain} total={pf.totalUSD} />
                <div className="mt-3 border-t border-zinc-800 pt-2 text-[11px] leading-5 text-zinc-600">
                  Monad is highlighted: the desk broadcasts on Monad, so native-chain exposure is what the sentinel watches first.
                </div>
              </Panel>

              <Panel
                title="CHP envelope · derived from live NAV"
                right={
                  <button
                    onClick={() => api.patchConfig({ liveCaps: !s.config.liveCaps })}
                    className={`rounded border px-2 py-0.5 font-mono text-[10px] ${s.config.liveCaps ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300' : 'border-zinc-700 bg-zinc-800 text-zinc-500'}`}
                  >
                    live_caps: {String(s.config.liveCaps)}
                  </button>
                }
              >
                <div className="space-y-1.5 font-mono text-[12px]">
                  <div className="flex justify-between"><span className="text-zinc-500">per_trade_cap <span className="text-zinc-700">= 2% NAV</span></span><span className="text-zinc-100">{usd(s.config.perTradeCapUSD)}</span></div>
                  <div className="flex justify-between"><span className="text-zinc-500">council_above <span className="text-zinc-700">= 1% NAV</span></span><span className="text-zinc-100">{usd(s.config.councilAboveUSD)}</span></div>
                  <div className="flex justify-between"><span className="text-zinc-500">daily_cap <span className="text-zinc-700">= 8% NAV</span></span><span className="text-zinc-100">{usd(s.config.dailyCapUSD)}</span></div>
                  <div className="flex justify-between border-t border-zinc-800 pt-1.5"><span className="text-zinc-500">NAV basis</span><span className="text-teal-300">{usd(pf.totalUSD)}</span></div>
                </div>
                <div className="mt-3 text-[11px] leading-5 text-zinc-600">
                  With <span className="font-mono text-zinc-400">live_caps</span> on, every successful Zerion import rewrites these caps (feed: <span className="font-mono text-teal-400/80">zerion</span> channel). Manual slider edits on the Gate tab still apply afterwards. Turn it off to freeze the envelope.
                </div>
              </Panel>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
