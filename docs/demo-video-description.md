# Demo video — description kit

One source of truth for the 3-minute demo (`media/demo/aegis-demo.mp4`, 3:05, 1920×1080).
Chapters match the README key-frame gallery (`docs/video-frames/`) beat for beat; timestamps
verified frame-by-frame against the encode.

## Chapter map (master)

| Start | Chapter | Beat |
|---|---|---|
| 0:00 | Cold open | "AI agents move capital. Who guards the treasury?" |
| 0:12 | Control-room overview | Four layers, one product |
| 0:32 | Trading desk | Signals → council → gate → broadcast, live feed |
| 0:52 | Policy Gate | CHP v1.0 kernel, ten fail-closed rules |
| 1:12 | Treasury · Zerion | Live wallet import recalibrates the caps |
| 1:32 | Proof Ledger | HMAC-chained decisions, anchors sealed on Monad |
| 1:42 | Sentinel drills | Autonomous breaker: drain pause, benign stand-down, prompt injection |
| 2:25 | VERIFY CHAIN | Full proof chain recomputed in the browser |
| 2:40 | Registry | Live ERC-8004 agent identity + reputation |
| 2:52 | Contracts | AegisRegistry · AegisAnchor · AegisBreaker (Solidity) |
| 3:00 | Closing | "Ship agents you can prove." |

## YouTube — paste into the video description

```text
ÆGIS on Monad — the trust layer for AI agents that move capital (Metropolis Hackathon · Track 4).

A working prototype on Monad: ERC-8004 agent identity, a fail-closed CHP policy gate on every
capital-moving action, an HMAC-chained proof ledger anchored on Monad, and an autonomous
circuit breaker that locks the desk faster than a human can react.

🔴 Live demo (no setup, no keys): https://preview-c-6aad749e-14810412-7397ac081f6b.space-z.ai/
⭐ Source + README: https://github.com/Cubiczan/aegis-on-monad

Chapters
0:00 Cold open — who guards the treasury?
0:12 Control-room overview — four layers, one product
0:32 Trading desk — signals → council → gate → broadcast
0:52 Policy Gate — CHP v1.0, ten fail-closed rules
1:12 Treasury · Zerion — live wallet import recalibrates the caps
1:32 Proof Ledger — HMAC chain, anchors sealed on Monad
1:42 Sentinel drills — autonomous breaker pauses the desk
2:25 VERIFY CHAIN — the whole proof chain, recomputed in-browser
2:40 Registry — live ERC-8004 agent identity + reputation
2:52 Contracts — the actual Solidity, ready for Monad mainnet
3:00 Ship agents you can prove.

Stack: Next.js 16 · React 19 · socket.io engine · Zerion API · public Monad RPC — 100% open source.
```

## Vercel — paste into Project Settings → Description

```text
Trust layer for capital-moving AI agents — ERC-8004 identity, fail-closed CHP gate, HMAC proof ledger anchored on Monad, autonomous sentinel circuit breaker. Live multi-agent trading desk demo. Video chapters: 0:00 cold open · 0:12 overview · 0:32 desk · 0:52 gate · 1:12 Zerion · 1:32 ledger · 1:42 sentinel · 2:25 verify chain · 2:40 registry · 2:52 contracts · 3:00 close.
```

## GitHub Release (tag `demo`)

The release body on both repos carries the same chapter list (applied via API — see
`scripts/release-chapters.sh`). Keep the three in sync when the video is re-cut.
