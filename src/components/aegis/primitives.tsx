'use client'

// Shared primitives for the Aegis UI — verdict badges, hash text, panels.

import type { ReactNode } from 'react'
import type { FeedItem, GateVerdict } from '@/lib/aegis/types'

export function VerdictBadge({ v, small }: { v: GateVerdict; small?: boolean }) {
  const cls: Record<GateVerdict, string> = {
    PASS: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40',
    HITL_REQUIRED: 'bg-amber-500/15 text-amber-400 border-amber-500/40',
    BLOCKED: 'bg-red-500/15 text-red-400 border-red-500/40',
    LOCKED: 'bg-red-600/25 text-red-300 border-red-500/60 animate-pulse',
  }
  return (
    <span className={`inline-flex items-center rounded border font-mono ${small ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs'} ${cls[v]}`}>
      {v}
    </span>
  )
}

export function StatusDot({ ok, firing }: { ok: boolean; firing?: boolean }) {
  return (
    <span className={`inline-block h-2 w-2 rounded-full ${firing ? 'bg-red-400 animate-ping' : ok ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
  )
}

export function Mono({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`font-mono ${className}`}>{children}</span>
}

export function Hash({ h, len = 14 }: { h: string; len?: number }) {
  if (!h) return <span className="font-mono text-zinc-500">—</span>
  return <span className="font-mono text-[11px] text-zinc-400">{h.startsWith('0x') ? h.slice(0, len) + '…' : h}</span>
}

export function Panel({ title, right, children, className = '' }: { title: ReactNode; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg border border-zinc-800 bg-zinc-900/60 ${className}`}>
      <header className="flex items-center justify-between border-b border-zinc-800 px-4 py-2.5">
        <h3 className="text-[13px] font-semibold uppercase tracking-wider text-zinc-300">{title}</h3>
        {right}
      </header>
      <div className="p-4">{children}</div>
    </section>
  )
}

export function Stat({ label, value, sub, tone = 'default' }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'default' | 'ok' | 'warn' | 'bad' }) {
  const toneCls = tone === 'ok' ? 'text-emerald-400' : tone === 'warn' ? 'text-amber-400' : tone === 'bad' ? 'text-red-400' : 'text-zinc-100'
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2.5">
      <div className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">{label}</div>
      <div className={`mt-0.5 font-mono text-lg leading-6 ${toneCls}`}>{value}</div>
      {sub ? <div className="mt-0.5 text-[11px] text-zinc-500">{sub}</div> : null}
    </div>
  )
}

const channelColor: Record<FeedItem['channel'], string> = {
  signal: 'text-sky-400', council: 'text-violet-400', gate: 'text-emerald-400', sim: 'text-cyan-400',
  broadcast: 'text-emerald-300', ledger: 'text-yellow-400', anchor: 'text-amber-300',
  sentinel: 'text-red-400', registry: 'text-fuchsia-400', hitl: 'text-orange-400',
  system: 'text-zinc-400', zerion: 'text-teal-400',
}

export function FeedLine({ f }: { f: FeedItem }) {
  const time = new Date(f.ts).toLocaleTimeString('en-US', { hour12: false })
  const lvl = f.level === 'alert' ? 'text-red-300' : f.level === 'warn' ? 'text-amber-300' : f.level === 'ok' ? 'text-emerald-300' : 'text-zinc-300'
  return (
    <div className="flex gap-2 border-b border-zinc-800/60 px-3 py-1.5 last:border-0">
      <span className="shrink-0 font-mono text-[10px] text-zinc-600">{time}</span>
      <span className={`shrink-0 font-mono text-[10px] uppercase ${channelColor[f.channel]}`}>{f.channel}</span>
      <span className={`min-w-0 break-words text-[12px] leading-5 ${lvl}`}>{f.text}</span>
    </div>
  )
}

export function pct(n: number): string {
  return `${(n * 100).toFixed(0)}%`
}

export function usd(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`
}
