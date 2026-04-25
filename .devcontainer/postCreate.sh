#!/usr/bin/env bash
set -euo pipefail

npm config set prefix "$HOME/.npm-global"
npm install -g eslint prettier @openai/codex web-ext typescript

pip install --user ruff black playwright
python -m playwright install chromium --with-deps

mkdir -p "$HOME/bin"

echo 'export PATH="$PATH:$HOME/.npm-global/bin:$HOME/.local/bin:$HOME/.dotnet/tools:$HOME/bin"' >>"$HOME/.bashrc"
