'use client'

// React hook wiring the UI to the aegis-engine realtime bus.

import { useEffect, useRef, useState, useCallback } from 'react'
import { io as socketIO } from 'socket.io-client'
import type { AegisSnapshot, Agent, DrillScenarioId, GateConfig, VerifyReport } from './types'

type Socket = ReturnType<typeof socketIO>

export interface AegisApi {
  snap: AegisSnapshot | null
  connected: boolean
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
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    const socket = socketIO('/?XTransformPort=3003', {
      transports: ['websocket', 'polling'],
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: 12,
      reconnectionDelay: 1200,
      timeout: 10000,
    })
    socketRef.current = socket
    socket.on('connect', () => setConnected(true))
    socket.on('disconnect', () => setConnected(false))
    socket.on('state', (s: AegisSnapshot) => setSnap(s))
    return () => { socket.disconnect() }
  }, [])

  const emit = useCallback((event: string, ...args: unknown[]) => {
    socketRef.current?.emit(event, ...args)
  }, [])

  return {
    snap,
    connected,
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
