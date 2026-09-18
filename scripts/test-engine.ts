// Smoke test for aegis-engine: connect, observe ticks, run a drill, verify ledger.
import { io } from 'socket.io-client'

const socket = io('http://localhost:3003', { transports: ['websocket', 'polling'], timeout: 8000 })
let lastSeq = 0

socket.on('connect', () => {
  console.log('connected', socket.id)
})
socket.on('state', (s: any) => {
  lastSeq = s?.ledgerHead?.seq ?? lastSeq
  if (process.env.VERBOSE) {
    console.log('tick', s.desk.tick, 'block', s.desk.blockHeight, 'agents', s.agents.length,
      'ledger', s.ledgerHead.count, 'anchors', s.anchors.length, 'feed0:', s.feed.at(-1)?.text?.slice(0, 90))
  }
})
socket.on('connect_error', (e: Error) => console.error('connect_error', e.message))

setTimeout(() => {
  socket.emit('drill:run', { scenario: 'drain' }, (r: any) => console.log('drill ack:', JSON.stringify(r).slice(0, 120)))
}, 1500)

setTimeout(() => {
  socket.emit('ledger:verify', (r: any) => console.log('verify:', JSON.stringify(r).slice(0, 200)))
}, 5000)

setTimeout(() => {
  socket.emit('state:get')
  setTimeout(() => {
    socket.emit('ledger:verify', () => {})
    setTimeout(async () => {
      const snap: any = await new Promise((res) => socket.once('state', res))
      console.log('FINAL ledger entries:', snap.ledgerHead.count, 'lastSeq observed:', lastSeq)
      console.log('kinds:', snap.ledger.map((e: any) => e.kind).join(','))
      console.log('paused:', snap.desk.paused, '| stats:', JSON.stringify(snap.stats))
      console.log('feed tail:')
      snap.feed.slice(-6).forEach((f: any) => console.log(' ', f.channel, '|', f.level, '|', f.text.slice(0, 110)))
      process.exit(0)
    }, 3000)
  }, 300)
}, 6500)

setTimeout(() => { console.error('timeout'); process.exit(1) }, 20000)
