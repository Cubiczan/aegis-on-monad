'use client'

// Aegis on Monad — the trust layer for AI agents that move capital.
// Single-page control room: Overview / Desk / Gate / Ledger / Sentinel / Registry / Contracts.

import { useState } from 'react'
import { useAegis } from '@/lib/aegis/useAegis'
import { OverviewTab } from '@/components/aegis/OverviewTab'
import { DeskTab } from '@/components/aegis/DeskTab'
import { GateTab } from '@/components/aegis/GateTab'
import { LedgerTab } from '@/components/aegis/LedgerTab'
import { SentinelTab } from '@/components/aegis/SentinelTab'
import { RegistryTab } from '@/components/aegis/RegistryTab'
import { ContractsTab } from '@/components/aegis/ContractsTab'
import { PortfolioTab } from '@/components/aegis/PortfolioTab'

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'desk', label: 'Trading Desk' },
  { id: 'gate', label: 'Policy Gate' },
  { id: 'treasury', label: 'Treasury · Zerion' },
  { id: 'ledger', label: 'Proof Ledger' },
  { id: 'sentinel', label: 'Sentinel' },
  { id: 'registry', label: 'Registry' },
  { id: 'contracts', label: 'Contracts' },
] as const

type TabId = (typeof TABS)[number]['id']

export default function Home() {
  const api = useAegis()
  const [tab, setTab] = useState<TabId>('overview')
  const s = api.snap

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100">
      {/* Header + status strip */}
      <header className="sticky top-0 z-40 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-md border border-violet-500/50 bg-violet-500/15 font-mono text-[13px] font-bold text-violet-300">Æ</div>
            <div>
              <div className="font-mono text-[14px] font-semibold tracking-tight text-zinc-50">AEGIS <span className="text-violet-400">on Monad</span></div>
              <div className="text-[10px] uppercase tracking-widest text-zinc-500">trust layer for capital-moving agents</div>
            </div>
          </div>

          <div className="order-3 flex w-full gap-1 overflow-x-auto pb-1 sm:order-2 sm:w-auto sm:pb-0 md:order-2 lg:ml-4">
            {TABS.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`whitespace-nowrap rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors ${tab === t.id ? 'bg-zinc-800 text-zinc-50' : 'text-zinc-500 hover:text-zinc-300'}`}>
                {t.label}
                {t.id === 'sentinel' && s?.desk.paused && <span className="ml-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-red-500 align-middle" />}
                {t.id === 'gate' && s && s.hitl.some((h) => h.status === 'PENDING') && <span className="ml-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400 align-middle" />}
              </button>
            ))}
          </div>

          <div className="order-2 ml-auto flex items-center gap-3 font-mono text-[10px] text-zinc-500 sm:order-3">
            <span className={`flex items-center gap-1.5 ${api.connected ? (api.mode === 'live' ? 'text-emerald-400' : 'text-violet-300') : 'text-red-400'}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${api.connected ? (api.mode === 'live' ? 'bg-emerald-400' : 'bg-violet-400') : 'bg-red-400'}`} />
              {api.connected ? (api.mode === 'live' ? 'ENGINE LIVE' : 'LOCAL DEMO') : 'CONNECTING…'}
            </span>
            {s && (
              <span className="hidden sm:inline">block {s.desk.blockHeight.toLocaleString()}</span>
            )}
          </div>
        </div>

        {/* live trust strip */}
        {s && (
          <div className="border-t border-zinc-800/70 bg-zinc-900/40">
            <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-5 gap-y-1 px-4 py-1.5 font-mono text-[10px] sm:px-6">
              <span className={s.desk.paused ? 'text-red-400' : 'text-emerald-400'}>breaker: {s.desk.paused ? 'LOCKED' : 'OPEN'}</span>
              <span className="text-zinc-500">gate: fail-closed CHP v1.0</span>
              <span className="text-zinc-500">ledger #{s.ledgerHead.seq}</span>
              <span className="text-amber-400/90">anchors: {s.anchors.length}</span>
              <span className="text-zinc-500">council LLM: {s.stats.councilLlm} · heuristic: {s.stats.councilHeuristic}</span>
              <span className="text-emerald-400/90">stopped: ${Math.round(s.stats.exploitsStoppedUSD).toLocaleString()}</span>
              {(s.zerion.live || s.zerion.source === 'static-snapshot') && s.zerion.portfolio && (
                <span className={s.zerion.source === 'static-snapshot' ? 'text-amber-400/90' : 'text-teal-400'}>
                  zerion {s.zerion.source === 'static-snapshot' ? 'SNAPSHOT' : 'LIVE'}: {s.zerion.portfolio.address.startsWith('0x') ? `${s.zerion.portfolio.address.slice(0, 6)}…${s.zerion.portfolio.address.slice(-4)}` : s.zerion.portfolio.address} · ${Math.round(s.zerion.portfolio.totalUSD).toLocaleString()} NAV
                </span>
              )}
              <span className="hidden text-zinc-600 md:inline">{s.desk.rpcLabel}</span>
            </div>
          </div>
        )}
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-5 sm:px-6">
        {!s ? (
          <div className="flex h-[60vh] flex-col items-center justify-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-violet-400" />
            <div className="font-mono text-[12px] text-zinc-500">
              {api.mode === 'local' ? 'engine service unreachable — running the browser-local demo engine…' : 'linking to aegis-engine on :3003…'}
            </div>
          </div>
        ) : (
          <>
            {tab === 'overview' && <OverviewTab api={api} />}
            {tab === 'desk' && <DeskTab api={api} />}
            {tab === 'gate' && <GateTab api={api} />}
            {tab === 'treasury' && <PortfolioTab api={api} />}
            {tab === 'ledger' && <LedgerTab api={api} />}
            {tab === 'sentinel' && <SentinelTab api={api} />}
            {tab === 'registry' && <RegistryTab api={api} />}
            {tab === 'contracts' && <ContractsTab />}
          </>
        )}
      </main>

      <footer className="mt-auto border-t border-zinc-800 bg-zinc-950">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-3 text-[11px] text-zinc-600 sm:px-6">
          <span>Aegis on Monad · Metropolis Track 4 — Trust, Identity &amp; AI Infrastructure · working prototype, {new Date().getFullYear()}</span>
          <span className="font-mono">ERC-8004 registry · CHP v1.0 gate · HMAC proof chain · autonomous breaker</span>
        </div>
      </footer>
    </div>
  )
}
