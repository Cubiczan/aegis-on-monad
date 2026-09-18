// E2E test: connect to aegis-engine, load live Zerion portfolio, dump result.
import { io } from 'socket.io-client'

const socket = io('http://localhost:3003/', { transports: ['websocket'], path: '/' })
const done = (code: number) => { setTimeout(() => process.exit(code), 300) }

socket.on('connect', () => {
  console.log('connected', socket.id)
  socket.emit('zerion:load', { address: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045' }, (r: any) => {
    console.log('ACK:', JSON.stringify(r))
  })
})

socket.on('state', (s: any) => {
  const z = s.zerion
  if (!z?.live) return
  console.log('ZERION status: live=%s address=%s positions=%d', z.live, z.address, z.positionsFetched)
  console.log('NAV: $%s chains=%d', Math.round(z.portfolio.totalUSD).toLocaleString(), z.portfolio.byChain.length)
  console.log('top5:', z.portfolio.positions.slice(0, 5).map((p: any) => `${p.symbol}($${Math.round(p.value)})@${p.chain}`).join(' '))
  console.log('monad exposure:', z.portfolio.byChain.find((c: any) => c.id === 'monad'))
  console.log('caps: per_trade=%s daily=%s council>%s liveCaps=%s',
    s.config.perTradeCapUSD, s.config.dailyCapUSD, s.config.councilAboveUSD, s.config.liveCaps)
  const zerionFeed = s.feed.filter((f: any) => f.channel === 'zerion').slice(-6)
  zerionFeed.forEach((f: any) => console.log('FEED[%s]:', f.level, f.text))
  done(0)
})

setTimeout(() => { console.error('TIMEOUT — no live state received'); done(1) }, 25000)
