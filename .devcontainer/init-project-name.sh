#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 引数があればそれを使う。なければ git リポジトリのルートディレクトリ名を使う
NEW_NAME="${1:-$(basename "$(git -C "${SCRIPT_DIR}" rev-parse --show-toplevel)")}"
OLD_NAME="dev-crx-github-pr"

if [ "${NEW_NAME}" = "${OLD_NAME}" ]; then
  echo "Already set to: ${NEW_NAME}"
  exit 0
fi

sed -i'' "s/${OLD_NAME}/${NEW_NAME}/g" \
  "${SCRIPT_DIR}/devcontainer.json" \
  "${SCRIPT_DIR}/docker-compose.yml"

echo "Renamed: ${OLD_NAME} → ${NEW_NAME}"
