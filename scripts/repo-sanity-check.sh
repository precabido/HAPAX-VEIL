#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if command -v git >/dev/null 2>&1 && git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  FILE_LIST_CMD=(git ls-files)
else
  FILE_LIST_CMD=(find . -type f)
fi

mapfile -t tracked_files < <("${FILE_LIST_CMD[@]}")

for path in "${tracked_files[@]}"; do
  clean="${path#./}"

  case "$clean" in
    .env|.env.*)
      if [[ "$clean" != ".env.example" ]]; then
        echo "[FAIL] Forbidden tracked env file: $clean"
        exit 1
      fi
      ;;
    node_modules/*|*/node_modules/*|.next/*|*/.next/*|dist/*|*/dist/*|backups/*|logs/*|storage/*|secrets/*|__MACOSX/*|.DS_Store|*/.DS_Store)
      echo "[FAIL] Forbidden tracked path: $clean"
      exit 1
      ;;
  esac
done

secret_regex='(AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{35}|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|-----BEGIN (RSA|EC|OPENSSH|PRIVATE) KEY-----|sk_(live|test)_[A-Za-z0-9]{16,}|(POSTGRES|MYSQL|MONGO|REDIS|JWT|SESSION|API|ACCESS|SECRET|TOKEN|PASSWORD|PASSWD|PRIVATE_KEY)[A-Z0-9_]*=.{8,})'

if rg -n --hidden -S \
  --glob '!.env.example' \
  --glob '!LICENSE' \
  --glob '!docs/**' \
  --glob '!*.md' \
  "$secret_regex" .; then
  echo "[FAIL] Potential secret-like material detected. Review the matches above."
  exit 1
fi

echo "[OK] No forbidden tracked paths or obvious secret patterns were found."
