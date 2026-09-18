// Focused test: force LLM council engagement + HITL flow.
import { io } from 'socket.io-client'

const socket = io('http://localhost:3003', { transports: ['websocket', 'polling'], timeout: 8000 })

socket.on('connect', () => {
  socket.emit('reset')
  setTimeout(() => socket.emit('gate:config', { patch: { councilAboveUSD: 4000, confidenceFloor: 0.45 } }, () => {}), 400)
})

let councils: string[] = []
socket.on('state', (s: any) => {
  const c = s.proposals?.filter((p: any) => p.council).map((p: any) => `${p.council.mode}:${p.council.verdict}`) ?? []
  if (c.length) councils = c
})

setTimeout(() => {
  socket.emit('state:get')
  setTimeout(() => {
    socket.once('state', (s: any) => {
      console.log('councils seen:', councils.length ? councils.join(' | ') : 'NONE')
      console.log('stats:', JSON.stringify(s.stats))
      console.log('kinds:', s.ledger.map((e: any) => e.kind).filter((k: string) => k === 'COUNCIL').length, 'COUNCIL entries')
      console.log('hitl pending:', s.hitl.filter((h: any) => h.status === 'PENDING').length)
      process.exit(0)
    })
  }, 500)
}, 14000)

setTimeout(() => { console.error('timeout'); process.exit(1) }, 20000)
