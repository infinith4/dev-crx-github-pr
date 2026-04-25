# Chrome Extension DevContainer 環境構築計画

## Context

プロジェクト `dev-crx-github-pr` は GitHub PR レビュー用 Chrome 拡張機能の開発プロジェクト。
現在の DevContainer は Node.js 22 + Python 3.12 の汎用設定のみで、Chrome 拡張機能開発に必要な以下が不足している：
- Chromium ブラウザ（拡張機能テスト用）
- Chrome Extension 型定義・ビルドツール
- VS Code 拡張機能開発向け Extension
- Playwright による E2E テスト環境

## 変更ファイル

### 1. `.devcontainer/Dockerfile`
Chromium + Xvfb（ヘッドレスディスプレイ）を追加

```dockerfile
FROM mcr.microsoft.com/devcontainers/base:ubuntu-24.04

RUN apt-get update && apt-get install -y \
    chromium-browser \
    xvfb \
    x11-utils \
    fonts-liberation \
    libasound2t64 \
    && rm -rf /var/lib/apt/lists/*

ENV CHROMIUM_FLAGS="--no-sandbox --disable-dev-shm-usage"
```

### 2. `.devcontainer/docker-compose.yml`
Chromium 実行に必要な shared memory と capabilities を追加

```yaml
services:
  devcontainer:
    build:
      context: ..
      dockerfile: .devcontainer/Dockerfile
    volumes:
      - ..:/workspaces/dev-crx-github-pr:cached
    command: sleep infinity
    shm_size: '2gb'
    cap_add:
      - SYS_ADMIN
```

### 3. `.devcontainer/devcontainer.json`
Chrome Extension 開発向け VS Code Extension を追加

追加 Extensions:
- `ms-playwright.playwright` — E2E テスト（Chrome Extension テスト対応）
- `ms-vscode.vscode-typescript-next` — TypeScript 最新サポート
- `wix.vscode-import-cost` — バンドルサイズ確認

追加 settings:
- `typescript.tsdk` をワークスペースに向ける
- `editor.formatOnSave: true`

### 4. `.devcontainer/postCreate.sh`
Chrome Extension 開発ツールを追加インストール

```bash
# 追加分
npm install -g web-ext typescript

# Playwright（Chromium のみ）
pip install --user playwright
python -m playwright install chromium --with-deps
```

`web-ext` = Chrome/Firefox Extension のビルド・リント・テスト CLI  
`typescript` = tsc コマンドをグローバルで使用可能に

## 検証方法

1. DevContainer をリビルドして起動
2. ターミナルで以下を確認：
   ```bash
   chromium-browser --version   # Chromium が起動できる
   tsc --version                # TypeScript コンパイラ
   web-ext --version            # web-ext ツール
   python -m playwright install --list  # Chromium が入っている
   ```
3. `frontend/` に Chrome Extension の `manifest.json` を作成して `web-ext lint` が通ること
