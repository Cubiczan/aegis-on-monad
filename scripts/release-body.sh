#!/usr/bin/env bash
# Fetch current release description for tag `demo` from both repos.
set -euo pipefail
cd /home/z/my-project
for remote in cubiczan icohangar-ops; do
  url=$(git config --get "remote.${remote}.url")
  token=$(echo "$url" | sed -E 's|https://x-access-token:([^@]+)@.*|\1|')
  owner=$(echo "$url" | sed -E 's|.*/([^/]+)/[^/]+\.git$|\1|')
  echo "=== ${owner}/aegis-on-monad ==="
  curl -s -H "Authorization: Bearer $token" -H "Accept: application/vnd.github+json" \
    "https://api.github.com/repos/${owner}/aegis-on-monad/releases/tags/demo" \
    | python3 -c "import json,sys; d=json.load(sys.stdin); print('name:', d.get('name')); print('--- body ---'); print(d.get('body','')[:2000])"
  echo
done
