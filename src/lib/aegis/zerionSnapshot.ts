// Aegis — static Zerion portfolio snapshot (PUBLIC on-chain data, fetched
// 2026-09-18T19:47:07.239Z via Zerion v1 for 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045).
// Bundled so the browser-local demo engine can render the Treasury tab and
// derive a demo CHP envelope when the engine service is not connected
// (e.g. Vercel serverless deployment). NOT live data — the live path is
// Zerion API via the engine (local dev) or /api/zerion (serverless proxy).
// Regenerate: bun scripts/gen-zerion-snapshot.ts

import type { ZerionPortfolio } from './types'

export const ZERION_SNAPSHOT: ZerionPortfolio = {
  "address": "0xd8da6bf26964af9d7eed9e03e53415d37aa96045",
  "totalUSD": 1137340,
  "byType": {
    "wallet": 1137340.1098411847,
    "locked": 0.052810600000000006
  },
  "byChain": [
    {
      "id": "ethereum",
      "usd": 1045559.9078320487
    },
    {
      "id": "robinhood",
      "usd": 52436.13605615984
    },
    {
      "id": "binance-smart-chain",
      "usd": 18368.2910449252
    },
    {
      "id": "base",
      "usd": 16219.129641872034
    },
    {
      "id": "zora",
      "usd": 1434.1977468910966
    },
    {
      "id": "arbitrum",
      "usd": 1071.50297129548
    },
    {
      "id": "optimism",
      "usd": 718.0393233429303
    },
    {
      "id": "polygon",
      "usd": 686.4783407321943
    },
    {
      "id": "scroll",
      "usd": 187.5427532913871
    },
    {
      "id": "okbchain",
      "usd": 166.2377576363773
    },
    {
      "id": "world",
      "usd": 163.82553128045797
    },
    {
      "id": "unichain",
      "usd": 152.95705362049335
    },
    {
      "id": "polygon-zkevm",
      "usd": 56.57312964371999
    },
    {
      "id": "zksync-era",
      "usd": 44.16994776924798
    },
    {
      "id": "linea",
      "usd": 23.118117601633664
    },
    {
      "id": "xdai",
      "usd": 11.561991532596505
    },
    {
      "id": "avalanche",
      "usd": 6.2487453774375465
    },
    {
      "id": "megaeth",
      "usd": 5.719789919749999
    },
    {
      "id": "soneium",
      "usd": 5.626980069058001
    },
    {
      "id": "aurora",
      "usd": 5.169497609929288
    },
    {
      "id": "plasma",
      "usd": 3.1054207971965173
    },
    {
      "id": "blast",
      "usd": 3.017630537745686
    },
    {
      "id": "abstract",
      "usd": 2.5743129135619376
    },
    {
      "id": "gravity-alpha",
      "usd": 2.209533410014077
    },
    {
      "id": "monad",
      "usd": 1.3484590213439023
    },
    {
      "id": "fantom",
      "usd": 1.2368900871559914
    },
    {
      "id": "tempo",
      "usd": 1.199783199264
    },
    {
      "id": "ape",
      "usd": 0.655019143721275
    },
    {
      "id": "hyperevm",
      "usd": 0.5843657936859556
    },
    {
      "id": "berachain",
      "usd": 0.4390394019591735
    },
    {
      "id": "ink",
      "usd": 0.4104175779
    },
    {
      "id": "mantle",
      "usd": 0.22224772649330846
    },
    {
      "id": "celo",
      "usd": 0.1976036681636028
    },
    {
      "id": "somnia",
      "usd": 0.19059345540000003
    },
    {
      "id": "katana",
      "usd": 0.026669353000000003
    }
  ],
  "positions": [
    {
      "symbol": "WHITE",
      "name": "WhiteRock (Wormhole)",
      "qty": 10000000000,
      "value": 371835,
      "price": 0.000037183533000000004,
      "chain": "ethereum",
      "verified": false,
      "icon": "https://cdn.zerion.io/206cf76b-7787-4823-9628-7cb262cbf2d0.png",
      "change1d": -0.29
    },
    {
      "symbol": "VITALIK",
      "name": "THE OG BULL",
      "qty": 900000000,
      "value": 300560,
      "price": 0.00033395563847050285,
      "chain": "ethereum",
      "verified": false,
      "icon": "https://cdn.zerion.io/60202bb3-5843-4083-bba1-713a7310beac.png",
      "change1d": 7.73
    },
    {
      "symbol": "MOODENG",
      "name": "MOO DENG",
      "qty": 30002309255.96883,
      "value": 129686,
      "price": 0.000004322547610000001,
      "chain": "ethereum",
      "verified": false,
      "icon": "https://cdn.zerion.io/7f90e3b4-d7ca-4680-b156-4f6760bc663a.png",
      "change1d": 11.19
    },
    {
      "symbol": "KNC",
      "name": "Kyber Network Crystal",
      "qty": 700008.531374,
      "value": 102567,
      "price": 0.1465230097,
      "chain": "ethereum",
      "verified": true,
      "icon": "https://cdn.zerion.io/0xdd974d5c2e2928dea5f71b9825b8b646686bd200.png",
      "change1d": 9.54
    },
    {
      "symbol": "4Stock",
      "name": "4Stock",
      "qty": 29846234.261947,
      "value": 51590,
      "price": 0.0017285310803118192,
      "chain": "robinhood",
      "verified": false,
      "change1d": 7.73
    },
    {
      "symbol": "ETH",
      "name": "Ethereum",
      "qty": 6.712598,
      "value": 17693,
      "price": 2635.79,
      "chain": "ethereum",
      "verified": true,
      "icon": "https://cdn.zerion.io/eth.png",
      "change1d": 7.67
    },
    {
      "symbol": "VITALIK",
      "name": "V GOD",
      "qty": 252414000000,
      "value": 15964,
      "price": 6.324443935124736e-8,
      "chain": "ethereum",
      "verified": false,
      "change1d": 7.6
    },
    {
      "symbol": "CATE",
      "name": "Catecoin",
      "qty": 100000000000000,
      "value": 15587,
      "price": 1.5586941298277023e-10,
      "chain": "ethereum",
      "verified": false,
      "change1d": 44.68
    },
    {
      "symbol": "FOLD",
      "name": "Interfold",
      "qty": 240000,
      "value": 15044,
      "price": 0.06268458010000001,
      "chain": "ethereum",
      "verified": false,
      "icon": "https://cdn.zerion.io/d100942c-86a9-4db4-b86c-14eded675379.png",
      "change1d": 3.21
    },
    {
      "symbol": "MOONKIN",
      "name": "Moonkin",
      "qty": 21065354666.37805,
      "value": 14188,
      "price": 6.735069388586471e-7,
      "chain": "ethereum",
      "verified": false,
      "icon": "https://cdn.zerion.io/d030ab7f-9d48-4cfb-ba6d-fbedbfe0da1c.png",
      "change1d": -4.79
    },
    {
      "symbol": "MarsVOLS",
      "name": " MarsVolunteer",
      "qty": 100000000010000,
      "value": 11920,
      "price": 1.1919992993118861e-10,
      "chain": "binance-smart-chain",
      "verified": false,
      "change1d": 8.38
    },
    {
      "symbol": "ETH",
      "name": "Ethereum",
      "qty": 3.12877,
      "value": 8247,
      "price": 2635.79,
      "chain": "base",
      "verified": true,
      "icon": "https://cdn.zerion.io/eth.png",
      "change1d": 7.67
    },
    {
      "symbol": "VROOM",
      "name": "VROOM",
      "qty": 1051347823.557054,
      "value": 8188,
      "price": 0.000007787959991405376,
      "chain": "ethereum",
      "verified": false,
      "change1d": 7.66
    },
    {
      "symbol": "CATE",
      "name": "Tsutsuji the Cate",
      "qty": 30002848,
      "value": 7744,
      "price": 0.00025811173588,
      "chain": "ethereum",
      "verified": false,
      "icon": "https://cdn.zerion.io/34985ce8-214b-4647-811d-c6398106b46a.png",
      "change1d": -43.79
    },
    {
      "symbol": "ENS",
      "name": "Ethereum Name Service",
      "qty": 1144.036076,
      "value": 7184,
      "price": 6.2793723232,
      "chain": "ethereum",
      "verified": true,
      "icon": "https://cdn.zerion.io/0xc18360217d8f7ab5e7c516566761ea12ce7f9d72.png",
      "change1d": 10.5
    },
    {
      "symbol": "OMG",
      "name": "OMG Network",
      "qty": 123647.030429,
      "value": 5726,
      "price": 0.046308002800000005,
      "chain": "ethereum",
      "verified": true,
      "icon": "https://cdn.zerion.io/0xd26114cd6ee289accf82350c8d8487fedb8a0c07.png",
      "change1d": 3.37
    },
    {
      "symbol": "WETH",
      "name": "Wrapped Ether",
      "qty": 1.461898,
      "value": 3860,
      "price": 2640.4593394172,
      "chain": "ethereum",
      "verified": true,
      "icon": "https://cdn.zerion.io/0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2.png",
      "change1d": 7.82
    },
    {
      "symbol": "SKBDI",
      "name": "Skibidi Toilet",
      "qty": 21034500000,
      "value": 3778,
      "price": 1.7960599974655784e-7,
      "chain": "ethereum",
      "verified": false,
      "change1d": 7.74
    },
    {
      "symbol": "DEGEN",
      "name": "DEGEN",
      "qty": 3000574.185147,
      "value": 3372,
      "price": 0.00112385445701,
      "chain": "base",
      "verified": true,
      "icon": "https://cdn.zerion.io/d590ac9c-6971-42db-b900-0bd057033ae0.png",
      "change1d": 12.04
    },
    {
      "symbol": "MEH",
      "name": "Meh",
      "qty": 167146371,
      "value": 3334,
      "price": 0.00001994712972769336,
      "chain": "ethereum",
      "verified": false,
      "icon": "https://cdn.zerion.io/6751b09b-5a21-4020-8a5b-64c442e2f25c.png",
      "change1d": 7.7
    },
    {
      "symbol": "IAG",
      "name": "IAGON",
      "qty": 150039.999661,
      "value": 3161,
      "price": 0.0210706687,
      "chain": "ethereum",
      "verified": false,
      "icon": "https://cdn.zerion.io/0x40eb746dee876ac1e78697b7ca85142d178a1fc8.png",
      "change1d": 10.92
    },
    {
      "symbol": "CUFFED",
      "name": "Golden Handcuffs",
      "qty": 50000100,
      "value": 3141,
      "price": 0.00006282515088952018,
      "chain": "base",
      "verified": false,
      "change1d": 7.95
    },
    {
      "symbol": "CATE",
      "name": "CateCoin",
      "qty": 32500665303.82593,
      "value": 2937,
      "price": 9.035893660000001e-8,
      "chain": "ethereum",
      "verified": false,
      "icon": "https://cdn.zerion.io/7c3389af-4ae6-4419-8556-856944f9a2cd.png",
      "change1d": -20.44
    },
    {
      "symbol": "VNDC",
      "name": "VNDC",
      "qty": 80000000,
      "value": 2842,
      "price": 0.00003552741536,
      "chain": "ethereum",
      "verified": false,
      "change1d": 7.73
    }
  ],
  "changes": {
    "absolute": {
      "1d": 53280.46121097925
    },
    "percent": {
      "1d": 4.914901009618297
    }
  },
  "fetchedAt": 1789760827239,
  "latencyMs": 6294,
  "stale": true
}
