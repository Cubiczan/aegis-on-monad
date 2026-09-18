'use client'

// React hook wiring the UI to the aegis-engine realtime bus.
//
// Two transports:
//   LIVE  — socket.io to the engine mini-service (:3003 via the gateway).
//   LOCAL — browser-side demo engine (localEngine.ts) when the service is
//           unreachable (e.g. Vercel serverless deployment). Same event names,
//           same snapshot shape, heuristic council instead of LLM.
// api.mode tells the UI which one is active so the header can badge it.

import { useEffect, useRef, useState, useCallback } from 'react'
import { io as socketIO } from 'socket.io-client'
import type { AegisSnapshot, Agent, DrillScenarioId, GateConfig, VerifyReport } from './types'
import { startLocalEngine, type LocalBus } from './localEngine'

type Socket = ReturnType<typeof socketIO>

export interface AegisApi {
  snap: AegisSnapshot | null
  connected: boolean
  mode: 'live' | 'local'
  verify: (cb: (r: VerifyReport) => void) => void
  runDrill: (scenario: DrillScenarioId, cb?: (r: { ok: boolean; error?: string }) => void) => void
  resume: () => void
  deskStart: () => void
  deskStop: () => void
  setSpeed: (s: 'SLOW' | 'NORMAL' | 'FAST') => void
  patchConfig: (patch: Partial<GateConfig>) => void
  registerAgent: (name: string, domain: string, capabilities: string[]) => void
  setAgentStatus: (id: string, status: Agent['status']) => void
  resolveHitl: (id: string, approve: boolean) => void
  loadPortfolio: (address: string, cb?: (r: { ok: boolean; error?: string; positions?: number; nav?: number }) => void) => void
  reset: () => void
}

export function useAegis(): AegisApi {
  const [snap, setSnap] = useState<AegisSnapshot | null>(null)
  const [connected, setConnected] = useState(false)
  const [mode, setMode] = useState<'live' | 'local'>('live')
  const socketRef = useRef<Socket | null>(null)
  const localRef = useRef<LocalBus | null>(null)

  useEffect(() => {
    let disposed = false
    let errors = 0

    const goLocal = () => {
      if (disposed || localRef.current) return
      try { socketRef.current?.disconnect() } catch { /* already gone */ }
      const bus = startLocalEngine((s) => setSnap(s))
      localRef.current = bus
      setMode('local')
      setConnected(true)
    }

    const socket = socketIO('/?XTransformPort=3003', {
      transports: ['websocket', 'polling'],
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: 12,
      reconnectionDelay: 1200,
      timeout: 6000,
    })
    socketRef.current = socket

    socket.on('connect', () => {
      if (localRef.current) return // already fell back — ignore late live connect
      setMode('live')
      setConnected(true)
    })
    socket.on('disconnect', () => { if (!localRef.current) setConnected(false) })
    socket.on('state', (s: AegisSnapshot) => { if (!localRef.current) setSnap(s) })
    socket.on('connect_error', () => {
      errors++
      // Two failed handshakes (≈3–7s) mean no engine behind this deployment.
      if (errors >= 2) goLocal()
    })
    // Hard backstop in case neither connect nor connect_error fires (hanging proxy).
    const backstop = setTimeout(() => { if (!socket.connected) goLocal() }, 8000)

    return () => {
      disposed = true
      clearTimeout(backstop)
      socket.disconnect()
      localRef.current?.disconnect()
      localRef.current = null
    }
  }, [])

  const emit = useCallback((event: string, ...args: unknown[]) => {
    if (localRef.current) localRef.current.emit(event, ...args)
    else socketRef.current?.emit(event, ...args)
  }, [])

  return {
    snap,
    connected,
    mode,
    verify: (cb) => emit('ledger:verify', cb),
    runDrill: (scenario, cb) => emit('drill:run', { scenario }, cb),
    resume: () => emit('breaker:resume'),
    deskStart: () => emit('desk:start'),
    deskStop: () => emit('desk:stop'),
    setSpeed: (s) => emit('desk:speed', s),
    patchConfig: (patch) => emit('gate:config', { patch }),
    registerAgent: (name, domain, capabilities) => emit('agent:register', { name, domain, capabilities }),
    setAgentStatus: (id, status) => emit('agent:status', { id, status }),
    resolveHitl: (id, approve) => emit('hitl:resolve', { id, approve }),
    loadPortfolio: (address, cb) => emit('zerion:load', { address }, cb),
    reset: () => emit('reset'),
  }
}
