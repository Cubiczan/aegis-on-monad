// Reset the aegis-engine to a clean state, then warm it up so the recording
// opens on a live-looking desk (feed entries, ledger depth, anchors).
import { io } from 'socket.io-client'

const s = io('http://localhost:3003', { path: '/', transports: ['websocket'], forceNew: true })
s.on('connect', () => {
  console.log('[prep] connected — resetting engine')
  s.emit('reset')
  setTimeout(() => { console.log('[prep] reset done, warming desk for ~30s'); s.disconnect() }, 900)
})
s.on('connect_error', (e: Error) => { console.error('[prep] connect failed:', e.message); process.exit(1) })
setTimeout(() => process.exit(0), 5000)
