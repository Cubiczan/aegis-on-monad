// Passive probe: observe ticks, no drill.
import { io } from 'socket.io-client'
const socket = io('http://localhost:3003', { transports: ['websocket', 'polling'] })
let first: any = null
socket.on('state', (s: any) => {
  if (!first) { first = s; console.log('start block', s.desk.blockHeight, 'tick', s.desk.tick, 'paused', s.desk.paused, 'running', s.desk.running, 'ledger', s.ledgerHead.count) }
})
setTimeout(() => {
  socket.once('state', (s: any) => {
    console.log('end   block', s.desk.blockHeight, 'tick', s.desk.tick, 'paused', s.desk.paused, 'ledger', s.ledgerHead.count)
    console.log('proposals:', s.proposals.length, '| feed tail:', s.feed.slice(-3).map((f: any) => f.channel + ':' + f.text.slice(0, 60)))
    process.exit(0)
  })
}, 6000)
