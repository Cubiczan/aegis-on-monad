#!/usr/bin/env bash
# Push Aegis on Monad to two GitHub accounts.
# Usage:
#   ./scripts/push-to-github.sh <user1> <token1> <user2> <token2> [repo-name]
#
# Tokens need: classic PAT with `repo` scope, OR fine-grained PAT with
# Administration: read+write (to create the repo) + Contents: read+write.
# Fine-grained tokens cannot create repos unless "Administration" write is granted;
# if repo creation fails, create each repo manually on github.com/new, then rerun.
set -euo pipefail

U1="${1:?github username 1}"; T1="${2:?token for $U1}"
U2="${3:?github username 2}"; T2="${4:?token for $U2}"
REPO="${5:-aegis-on-monad}"
ORIGIN_DIR="$(cd "$(dirname "$0")/.." && pwd)"

cd "$ORIGIN_DIR"

for pair in "$U1:$T1" "$U2:$T2"; do
  user="${pair%%:*}"; token="${pair#*:}"
  echo "==> Account: $user"
  # create repo if it doesn't exist
  code=$(curl -s -o /tmp/gh_create.json -w "%{http_code}" -X POST \
    -H "Authorization: Bearer $token" -H "Accept: application/vnd.github+json" \
    https://api.github.com/user/repos \
    -d "{\"name\":\"$REPO\",\"description\":\"Aegis on Monad — the trust layer for AI agents that move capital (Metropolis Track 4)\",\"private\":false,\"has_issues\":true,\"has_wiki\":false}")
  if [ "$code" = "201" ]; then echo "    created github.com/$user/$REPO"
  elif [ "$code" = "422" ]; then echo "    repo already exists — pushing into it"
  else echo "    create failed (HTTP $code): $(head -c 200 /tmp/gh_create.json)"; fi

  git remote remove "gh-$user" 2>/dev/null || true
  git remote add "gh-$user" "https://x-access-token:$token@github.com/$user/$REPO.git"
  git push -u "gh-$user" main --force
  echo "    pushed → https://github.com/$user/$REPO"
done

# strip tokens from remotes afterwards (hygiene)
for pair in "$U1:$T1" "$U2:$T2"; do
  user="${pair%%:*}"
  git remote set-url "gh-$user" "https://github.com/$user/$REPO.git" 2>/dev/null || true
done
echo "Done. Remotes left token-free."
