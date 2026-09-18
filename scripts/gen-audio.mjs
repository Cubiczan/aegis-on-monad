// Generates media/bed.wav — a subtle dark-ambient drone bed for the demo video.
// Layered detuned sines (A-minor pad: A2/E3/A3/E4) with slow amplitude LFOs,
// normalized low, so it sits under the UI narration-free footage.
import { writeFileSync } from 'node:fs'

const SR = 44100
const DUR = Number(process.argv[2] ?? 190)
const N = Math.floor(SR * DUR)

// partials: [freq, amp, detuneCents]
const layers = [
  [110.0, 0.50, 0], [110.0, 0.28, 7],
  [164.81, 0.36, 0], [164.81, 0.20, -6],
  [220.0, 0.24, 4],
  [329.63, 0.12, -3],
  [440.0, 0.05, 5],
]
const lfo = (t, rate, phase = 0) => 0.72 + 0.28 * Math.sin(2 * Math.PI * rate * t + phase)

const buf = Buffer.alloc(N * 4) // stereo 16-bit
for (let i = 0; i < N; i++) {
  const t = i / SR
  // slow swell across the whole video
  const master = 0.55 + 0.45 * Math.min(1, t / 6) * Math.min(1, (DUR - t) / 8)
  let l = 0, r = 0
  layers.forEach(([f, a, cents], k) => {
    const freq = f * Math.pow(2, cents / 1200)
    const amp = a * lfo(t, 0.031 + k * 0.007, k * 1.7)
    l += amp * Math.sin(2 * Math.PI * freq * t)
    r += amp * Math.sin(2 * Math.PI * freq * 1.0012 * t + 0.6) // slight stereo detune
  })
  // very slow sub pulse for momentum
  const pulse = 1 + 0.10 * Math.sin(2 * Math.PI * 0.5 * t)
  let ls = Math.max(-1, Math.min(1, l * master * pulse * 0.34))
  let rs = Math.max(-1, Math.min(1, r * master * pulse * 0.34))
  // gentle soft-clip
  ls = Math.tanh(ls * 1.4); rs = Math.tanh(rs * 1.4)
  buf.writeInt16LE(Math.round(ls * 32767 * 0.72), i * 4)
  buf.writeInt16LE(Math.round(rs * 32767 * 0.72), i * 4 + 2)
}

// WAV header (PCM 16-bit stereo)
const header = Buffer.alloc(44)
header.write('RIFF', 0); header.writeUInt32LE(36 + buf.length, 4); header.write('WAVE', 8)
header.write('fmt ', 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20)
header.writeUInt16LE(2, 22); header.writeUInt32LE(SR, 24); header.writeUInt32LE(SR * 4, 28)
header.writeUInt16LE(4, 32); header.writeUInt16LE(16, 34)
header.write('data', 36); header.writeUInt32LE(buf.length, 40)
writeFileSync('/home/z/my-project/media/bed.wav', Buffer.concat([header, buf]))
console.log(`bed.wav written: ${DUR}s stereo ${SR}Hz`)
