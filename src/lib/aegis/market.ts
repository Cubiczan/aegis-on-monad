// Simulated market microstructure for the demo desk.
// Random-walk prices with token-specific volatility; USDC pinned to the peg.

import type { MarketToken } from './types'

const SEED: Omit<MarketToken, 'history'>[] = [
  { symbol: 'MON', name: 'Monad (native)', price: 3.42, allowlisted: true, vol: 0.004 },
  { symbol: 'WETH', name: 'Wrapped Ether', price: 3120.5, allowlisted: true, vol: 0.003 },
  { symbol: 'WBTC', name: 'Wrapped Bitcoin', price: 91540.0, allowlisted: true, vol: 0.002 },
  { symbol: 'USDC', name: 'USD Coin', price: 1.0, allowlisted: true, vol: 0.0002 },
  { symbol: 'MEME', name: 'Memecoin (unallowlisted)', price: 0.00042, allowlisted: false, vol: 0.02 },
]

const HISTORY_LEN = 120

export function seedTokens(): MarketToken[] {
  return SEED.map((t) => ({
    ...t,
    history: Array.from({ length: HISTORY_LEN }, (_, i) => t.price * (1 + Math.sin(i / 9) * t.vol * 3 + (Math.random() - 0.5) * t.vol * 2)),
  }))
}

export function tickTokens(tokens: MarketToken[]): MarketToken[] {
  return tokens.map((t) => {
    if (t.symbol === 'USDC') {
      const mean = 1.0
      const next = t.price + (mean - t.price) * 0.2 + (Math.random() - 0.5) * t.vol
      return push(t, Math.max(0.999, Math.min(1.001, next)))
    }
    const drift = (Math.random() - 0.5) * 2 * t.vol
    const shock = Math.random() < 0.03 ? (Math.random() - 0.5) * t.vol * 6 : 0
    return push(t, Math.max(t.price * 0.5, t.price * (1 + drift + shock)))
  })
}

function push(t: MarketToken, price: number): MarketToken {
  const history = [...t.history.slice(-(HISTORY_LEN - 1)), price]
  return { ...t, price, history }
}

export function tokenPrice(tokens: MarketToken[], symbol: string): number {
  return tokens.find((t) => t.symbol === symbol)?.price ?? 0
}
