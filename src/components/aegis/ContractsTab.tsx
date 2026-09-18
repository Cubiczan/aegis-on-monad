'use client'

// Contracts tab — the Monad-native Solidity layer the demo models.

import { useState } from 'react'
import { ERC8004_REGISTRY, AEGIS_ANCHOR, AEGIS_BREAKER } from '@/lib/aegis/contracts'
import { Panel } from './primitives'

const FILES = [
  { name: 'AegisRegistry.sol', tag: 'ERC-8004 identity', code: ERC8004_REGISTRY, note: 'Onchain agent identities: name, domain, capability hash, stake, reputation, breaker-controlled freeze. Registration and freeze events are what the off-chain gate reads at R1.' },
  { name: 'AegisAnchor.sol', tag: 'proof anchoring', code: AEGIS_ANCHOR, note: 'Batches of decision-hash roots committed onchain, one SSTORE per batch. isAnchored(root) lets anyone re-verify the off-chain HMAC ledger against the chain without trusting our server.' },
  { name: 'AegisBreaker.sol', tag: 'circuit breaker', code: AEGIS_BREAKER, note: '2-of-3 watcher consensus pauses the desk autonomously; the human key is required to resume. Fail-closed: watchers can always stop the world, never silently restart it.' },
]

export function ContractsTab() {
  const [active, setActive] = useState(0)
  const [copied, setCopied] = useState(false)
  const file = FILES[active]

  const copy = async () => {
    try { await navigator.clipboard.writeText(file.code); setCopied(true); setTimeout(() => setCopied(false), 1200) } catch { /* clipboard unavailable */ }
  }

  return (
    <div className="space-y-4">
      <Panel title="Monad-native contracts" right={<span className="font-mono text-[10px] text-zinc-500">solidity ^0.8.24 · testnet deployment plan W1</span>}>
        <p className="max-w-4xl text-[13px] leading-6 text-zinc-400">
          The demo runs the same governance kernel against a deterministic chain simulator so every pipeline stage is
          visible in real time. These are the contracts that layer becomes in production on Monad: identity (ERC-8004),
          per-decision proof anchoring, and the autonomous breaker. Monad&apos;s ~1s blocks and low fees make per-batch
          anchoring and breaker governance effectively real-time — the property that makes a policy gate viable in-flight.
        </p>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
        <div className="space-y-2">
          {FILES.map((f, i) => (
            <button key={f.name} onClick={() => setActive(i)}
              className={`block w-full rounded-lg border px-3 py-2.5 text-left transition-colors ${active === i ? 'border-violet-500/50 bg-violet-500/10' : 'border-zinc-800 bg-zinc-900/40 hover:border-zinc-700'}`}>
              <div className="font-mono text-[12px] text-zinc-200">{f.name}</div>
              <div className={`mt-0.5 font-mono text-[10px] uppercase tracking-wider ${active === i ? 'text-violet-300' : 'text-zinc-500'}`}>{f.tag}</div>
            </button>
          ))}
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 text-[11px] leading-5 text-zinc-500">
            Deployed via Foundry (<span className="font-mono">forge create</span>) against the public Monad testnet RPC.
            The verifier script recomputes HMAC chains off-chain and asserts roots with <span className="font-mono">isAnchored()</span>.
          </div>
        </div>

        <Panel title={file.name} right={
          <button onClick={copy} className="rounded border border-zinc-700 px-2 py-0.5 font-mono text-[10px] text-zinc-400 hover:text-zinc-200">
            {copied ? 'COPIED ✓' : 'COPY'}
          </button>
        }>
          <p className="mb-3 text-[12px] leading-5 text-zinc-500">{file.note}</p>
          <pre className="max-h-[32rem] overflow-auto rounded-lg border border-zinc-800 bg-zinc-950 p-4 font-mono text-[11px] leading-5 text-zinc-300">
            <code>{file.code}</code>
          </pre>
        </Panel>
      </div>
    </div>
  )
}
