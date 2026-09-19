#!/usr/bin/env bash
# Append the video chapter list to the GitHub release body (tag `demo`) on both repos.
# Idempotent: skips repos whose body already contains the chapter block.
set -euo pipefail
cd /home/z/my-project

CHAPTERS='
---
**Video chapters**

`0:00` Cold open — who guards the treasury? · `0:12` Control-room overview · `0:32` Trading desk · `0:52` Policy Gate (CHP v1.0) · `1:12` Treasury · Zerion live import · `1:32` Proof Ledger · `1:42` Sentinel drills — autonomous breaker · `2:25` VERIFY CHAIN · `2:40` Registry (ERC-8004) · `2:52` Contracts · `3:00` Ship agents you can prove.

Chapter map source of truth: `docs/demo-video-description.md` — matches the README key-frame gallery.'

for remote in cubiczan icohangar-ops; do
  url=$(git config --get "remote.${remote}.url")
  token=$(echo "$url" | sed -E 's|https://x-access-token:([^@]+)@.*|\1|')
  owner=$(echo "$url" | sed -E 's|.*/([^/]+)/[^/]+\.git$|\1|')
  repo="${owner}/aegis-on-monad"

  body=$(curl -s -H "Authorization: Bearer $token" -H "Accept: application/vnd.github+json" \
    "https://api.github.com/repos/${repo}/releases/tags/demo" \
    | python3 -c "import json,sys; print(json.load(sys.stdin).get('body',''))")

  if echo "$body" | rg -q "Video chapters"; then
    echo "[$repo] chapters already present — skipped"
    continue
  fi

  release_id=$(curl -s -H "Authorization: Bearer $token" -H "Accept: application/vnd.github+json" \
    "https://api.github.com/repos/${repo}/releases/tags/demo" \
    | python3 -c "import json,sys; print(json.load(sys.stdin)['id'])")

  python3 - "$repo" "$release_id" "$token" "$body$CHAPTERS" <<'PY'
import json, sys, urllib.request
repo, rel_id, token, body = sys.argv[1:5]
req = urllib.request.Request(
    f"https://api.github.com/repos/{repo}/releases/{rel_id}",
    data=json.dumps({"body": body}).encode(),
    headers={"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json"},
    method="PATCH",
)
with urllib.request.urlopen(req) as r:
    print(f"[{repo}] release body updated — HTTP {r.status}")
PY
done
