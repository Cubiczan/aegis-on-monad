// Serverless Zerion proxy — lets the browser-local demo engine fetch LIVE
// portfolios even when the socket.io engine service isn't deployed (Vercel).
// The API key stays server-side (ZERION_API_KEY env); the browser only ever
// receives normalized portfolio JSON.

import { NextRequest, NextResponse } from 'next/server'
import { getZerionPortfolioCached, ZerionError, validateWallet } from '@/lib/aegis/zerion'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get('address') ?? ''
  const addr = validateWallet(address)
  if (!addr) {
    return NextResponse.json({ ok: false, error: 'Not a valid 0x address or ENS name' }, { status: 400 })
  }
  try {
    const portfolio = await getZerionPortfolioCached(addr)
    return NextResponse.json({ ok: true, portfolio })
  } catch (e) {
    const msg = e instanceof ZerionError
      ? e.message
      : 'Zerion fetch failed — is ZERION_API_KEY configured on this deployment?'
    return NextResponse.json({ ok: false, error: msg }, { status: 502 })
  }
}
