// Aegis — Zerion live portfolio client (SERVER-SIDE ONLY).
// Talks to the Zerion v1 REST API with HTTP Basic auth (base64(api_key:)).
// The key lives in env (ZERION_API_KEY) and never crosses the wire to the UI:
// the browser only ever sees normalized portfolio data emitted by the engine.
//
// Zerion notes learned from live probing:
//   - Auth scheme MUST be "Authorization: Basic base64(<key>:)" — Bearer is rejected.
//   - /wallets/{id}/positions requires a trailing slash (301 otherwise).
//   - Position value/quantity are flat numbers; quantity.float is human units.
//   - chain id comes from relationships.chain.data.id ("monad", "ethereum", ...).
//   - Monad mainnet is a first-class Zerion chain.

import type { ZerionPortfolio, ZerionPosition } from './types'

const API = 'https://api.zerion.io/v1'

// ------------------------------------------------------------- key handling

let fsTried = false
let fsKey: string | undefined

/** Env first; fall back to parsing the project-root .env so the engine works
 *  no matter which directory bun was started from. */
export function zerionKey(): string | undefined {
  if (process.env.ZERION_API_KEY) return process.env.ZERION_API_KEY
  if (fsTried) return fsKey
  fsTried = true
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('node:fs') as typeof import('node:fs')
    for (const p of ['/home/z/my-project/.env', '../../.env', '../../../.env', './.env']) {
      try {
        const txt = fs.readFileSync(p, 'utf8')
        const m = txt.match(/^\s*ZERION_API_KEY\s*=\s*"?([A-Za-z0-9_-]+)"?\s*$/m)
        if (m) { fsKey = m[1]; return fsKey }
      } catch { /* try next path */ }
    }
  } catch { /* no fs access — fine */ }
  return fsKey
}

// ------------------------------------------------------------- fetch core

export class ZerionError extends Error {
  constructor(public status: number | string, message: string) {
    super(message)
    this.name = 'ZerionError'
  }
}

async function zerionFetch<T>(path: string, timeoutMs = 12_000): Promise<T> {
  const key = zerionKey()
  if (!key) throw new ZerionError('NO_KEY', 'ZERION_API_KEY is not set')
  const auth = Buffer.from(`${key}:`).toString('base64')

  const attempt = async (): Promise<T> => {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), timeoutMs)
    try {
      const res = await fetch(`${API}${path}`, {
        headers: { Authorization: `Basic ${auth}`, accept: 'application/json' },
        signal: ctrl.signal,
      })
      if (res.status === 429) throw new ZerionError(429, 'Zerion rate limit (429) — retry shortly')
      if (res.status === 401) throw new ZerionError(401, 'Zerion rejected the API key (401) — rotate key?')
      if (!res.ok) throw new ZerionError(res.status, `Zerion HTTP ${res.status}`)
      return (await res.json()) as T
    } finally {
      clearTimeout(timer)
    }
  }

  try {
    return await attempt()
  } catch (e) {
    // One forgiving retry on transient failures (429 / 5xx / network blips).
    const retriable = e instanceof ZerionError
      ? (e.status === 429 || (typeof e.status === 'number' && e.status >= 500))
      : true
    if (!retriable) throw e
    await new Promise((r) => setTimeout(r, 700))
    return attempt()
  }
}

// ------------------------------------------------------------- normalization

interface RawPortfolio {
  data?: { attributes?: {
    positions_distribution_by_type?: Record<string, number>
    positions_distribution_by_chain?: Record<string, number>
    total?: { sum?: number; positions?: number }
    changes?: { absolute_1d?: number; percent_1d?: number }
    changes_absolute?: Record<string, number>
    changes_percent?: Record<string, number>
  } }
  errors?: unknown
}

interface RawPositions {
  data?: {
    attributes?: {
      quantity?: { float?: number } | null
      value?: number | null
      price?: number | null
      changes?: { percent_1d?: number | null } | null
      position_type?: string
      fungible_info?: {
        name?: string
        symbol?: string
        icon?: { url?: string } | null
        flags?: { verified?: boolean }
      }
    }
    relationships?: { chain?: { data?: { id?: string } } }
  }[]
}

const CHAIN_LABEL: Record<string, string> = {
  ethereum: 'Ethereum', monad: 'Monad', base: 'Base', arbitrum: 'Arbitrum',
  optimism: 'Optimism', polygon: 'Polygon', 'binance-smart-chain': 'BNB Chain',
  'polygon-zkevm': 'Polygon zkEVM', 'zksync-era': 'zkSync Era', solana: 'Solana',
}

export function chainLabel(id: string): string {
  return CHAIN_LABEL[id] ?? id.replace(/-/g, ' ').toUpperCase()
}

const looksLikeAddress = (s: string) => /^0x[a-fA-F0-9]{40}$/.test(s.trim())
const looksLikeEns = (s: string) => /^[a-zA-Z0-9-_]{3,}\.(eth|xyz|crypto|box)$/.test(s.trim())

export function validateWallet(input: string): string | null {
  const s = input.trim()
  if (looksLikeAddress(s)) return s.toLowerCase()
  if (looksLikeEns(s)) return s.toLowerCase()
  return null
}

// ------------------------------------------------------------- public API

export async function fetchZerionPortfolio(address: string, maxPositions = 48): Promise<ZerionPortfolio> {
  const started = Date.now()
  const addr = validateWallet(address)
  if (!addr) throw new ZerionError('BAD_INPUT', 'Not a valid 0x address or ENS name')

  const enc = encodeURIComponent(addr)
  const [pf, ps] = await Promise.all([
    zerionFetch<RawPortfolio>(`/wallets/${enc}/portfolio/?currency=usd`),
    zerionFetch<RawPositions>(
      `/wallets/${enc}/positions/?filter%5Bpositions%5D=only_simple&currency=usd&sort%5Bvalue%5D=-1&page%5Bsize%5D=${maxPositions}&include=chain`,
    ),
  ])

  const a = pf.data?.attributes
  if (!a) throw new ZerionError('EMPTY', 'Zerion returned no portfolio attributes (wrong address?)')

  // Zerion nests changes as flat keys {absolute_1d, percent_1d}; normalize to maps.
  const ch = a.changes ?? {}
  const chAbs = a.changes_absolute ?? {}
  const chPct = a.changes_percent ?? {}
  if (typeof ch.percent_1d === 'number') chPct['1d'] = ch.percent_1d
  if (typeof ch.absolute_1d === 'number') chAbs['1d'] = ch.absolute_1d

  const positions: ZerionPosition[] = (ps.data ?? [])
    .map((p) => {
      const at = p.attributes ?? {}
      const fi = at.fungible_info ?? {}
      return {
        symbol: fi.symbol ?? '?',
        name: fi.name ?? fi.symbol ?? 'Unknown',
        qty: at.quantity?.float ?? 0,
        value: at.value ?? 0,
        price: at.price ?? 0,
        chain: p.relationships?.chain?.data?.id ?? 'unknown',
        verified: fi.flags?.verified ?? false,
        icon: fi.icon?.url,
        change1d: at.changes?.percent_1d ?? undefined,
      } as ZerionPosition
    })
    .filter((p) => p.value > 0.01)
    .sort((x, y) => y.value - x.value)
    // Zerion ignores page[size] and can return thousands of dust positions;
    // keep only the meaningful tail for storage + broadcast size sanity.
    .slice(0, Math.min(maxPositions, 100))

  const totalUSD = a.total?.positions
    ?? a.total?.sum
    ?? Object.values(a.positions_distribution_by_chain ?? {}).reduce((s, v) => s + (v || 0), 0)

  const byChain = Object.entries(a.positions_distribution_by_chain ?? {})
    .map(([id, usd]) => ({ id, usd: usd || 0 }))
    .filter((c) => c.usd > 0.01)
    .sort((x, y) => y.usd - x.usd)

  const byType: Record<string, number> = {}
  for (const [k, v] of Object.entries(a.positions_distribution_by_type ?? {})) {
    if (v > 0.01) byType[k] = v
  }

  return {
    address: addr,
    totalUSD,
    byType,
    byChain,
    positions,
    changes: { absolute: chAbs, percent: chPct },
    fetchedAt: Date.now(),
    latencyMs: Date.now() - started,
    stale: false,
  }
}

// ------------------------------------------------------------- memo cache
// Zerion free/dev tiers are rate-limited; a short TTL keeps the demo honest
// while surviving rapid UI re-loads and multiple browser tabs.

interface CacheSlot { at: number; promise: Promise<ZerionPortfolio> }
const CACHE_TTL = 45_000
const cache = new Map<string, CacheSlot>()

export function getZerionPortfolioCached(address: string): Promise<ZerionPortfolio> {
  const addr = validateWallet(address)
  if (!addr) return Promise.reject(new ZerionError('BAD_INPUT', 'Not a valid 0x address or ENS name'))
  const hit = cache.get(addr)
  const now = Date.now()
  if (hit && now - hit.at < CACHE_TTL) return hit.promise
  const promise = fetchZerionPortfolio(addr)
  cache.set(addr, { at: now, promise })
  promise.catch(() => cache.delete(addr)) // don't pin failures
  return promise
}
