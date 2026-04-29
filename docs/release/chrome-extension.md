# Chrome Extension リリース手順

このドキュメントは `GitHub PR Comment Tools` の Chrome Extension リリース方法を定義する。
通常リリースは GitHub Actions と Chrome Web Store API で自動化し、手作業は初期設定、ストア掲載情報の更新、審査対応に限定する。

## 1. 現在の前提

- Extension 形式: Chrome Extension Manifest V3
- Manifest: `manifest.json`
- ビルドコマンド: `npm run build`
- テストコマンド: `npm test`
- ビルド成果物: `dist/`
- Chrome Web Store にアップロードする ZIP の構成:
  - ZIP ルートに `manifest.json`
  - ZIP ルートに `dist/**`
- バージョンの整合条件:
  - `package.json` の `version`
  - `manifest.json` の `version`
  - 上記 2 つが一致していること

現在の `scripts/build.mjs` は `dist/` の生成だけを行うため、リリース ZIP 作成時に `manifest.json` と `dist/**` を明示的に梱包する。

## 2. リリース方針

通常リリースは次の流れで行う。

1. 変更を `main` にマージする。
2. `package.json` と `manifest.json` のバージョンを同じ値に上げる。
3. `vX.Y.Z` 形式の Git タグを作成して push する。
4. GitHub Actions がテスト、ビルド、ZIP 作成、Chrome Web Store へのアップロード、審査提出を実行する。
5. Chrome Web Store の審査完了を待つ。
6. 既存の公開範囲と公開設定に従って公開される。

推奨トリガー:

- 本番リリース: `v*.*.*` のタグ push
- 手動再実行: `workflow_dispatch`

## 3. 初回のみ必要な Chrome Web Store 設定

自動公開を有効にする前に、次を一度だけ実施する。

1. Chrome Web Store developer account を登録または確認する。
2. 公開に使う Google Account で 2 段階認証を有効化する。
3. 初回リリース用に Chrome Web Store の item を作成する。
4. 必要に応じて、初回 ZIP は Chrome Developer Dashboard から手動アップロードする。
5. Dashboard で次のタブを入力する。
   - Store Listing
   - Privacy
   - Distribution
   - Test Instructions
6. 次の値を控える。
   - Publisher ID
   - Extension item ID
7. Google Cloud project で Chrome Web Store API を有効化する。
8. CI 公開用の Google Cloud service account を作成する。
9. Chrome Web Store Developer Dashboard の Account section に service account email を追加する。

CI/CD では Chrome Web Store API V2 の service account 認証を優先する。人間の OAuth 操作をリリース時に要求しないため、自動化に向いている。

## 4. GitHub Secrets

推奨は GitHub OIDC と Google Cloud Workload Identity Federation の組み合わせ。GitHub に長期有効な service account JSON key を保存せずに済む。

必要な secrets:

| Secret | 用途 |
| --- | --- |
| `CWS_PUBLISHER_ID` | Chrome Web Store publisher ID |
| `CWS_EXTENSION_ID` | Chrome Web Store extension item ID |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | Workload Identity Provider resource name |
| `GCP_SERVICE_ACCOUNT` | 公開権限を持つ service account email |

OIDC を使えない場合の fallback:

| Secret | 用途 |
| --- | --- |
| `GCP_SERVICE_ACCOUNT_JSON` | Service account JSON key。可能な限り使用しない |

access token、refresh token、service account key はリポジトリにコミットしない。

## 5. ローカルでの ZIP 作成

ローカルで同じリリース ZIP を作る場合は次を実行する。

```powershell
npm ci
npm test
npm run build

$version = node -p "require('./package.json').version"
$manifestVersion = node -p "require('./manifest.json').version"
if ($version -ne $manifestVersion) {
  throw "package.json version ($version) does not match manifest.json version ($manifestVersion)"
}

Remove-Item -Recurse -Force release -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force release/package | Out-Null
Copy-Item manifest.json release/package/manifest.json
Copy-Item -Recurse dist release/package/dist
Get-ChildItem release/package/dist -Filter *.map -Recurse | Remove-Item -Force

Push-Location release/package
Compress-Archive `
  -Path manifest.json, dist `
  -DestinationPath "../github-pr-comment-tools-$version.zip" `
  -Force
Pop-Location
```

手動リリースが必要な場合:

1. Chrome Developer Dashboard を開く。
2. 対象 extension item を選択する。
3. `release/github-pr-comment-tools-X.Y.Z.zip` をアップロードする。
4. Submit for review を実行する。

## 6. 推奨 GitHub Actions Workflow

自動公開を有効にする場合は `.github/workflows/release-chrome-extension.yml` として追加する。

```yaml
name: Release Chrome Extension

on:
  push:
    tags:
      - 'v*.*.*'
  workflow_dispatch:

jobs:
  release:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: npm

      - run: npm ci

      - run: npm test

      - run: npm run build

      - name: Validate versions
        run: |
          PACKAGE_VERSION=$(node -p "require('./package.json').version")
          MANIFEST_VERSION=$(node -p "require('./manifest.json').version")
          TAG_VERSION="${GITHUB_REF_NAME#v}"

          test "$PACKAGE_VERSION" = "$MANIFEST_VERSION"
          test "$PACKAGE_VERSION" = "$TAG_VERSION"

      - name: Package extension
        run: |
          VERSION=$(node -p "require('./package.json').version")
          rm -rf release
          mkdir -p release/package
          cp manifest.json release/package/manifest.json
          cp -R dist release/package/dist
          find release/package/dist -name '*.map' -type f -delete
          (cd release/package && zip -r "../github-pr-comment-tools-${VERSION}.zip" manifest.json dist)
          echo "ZIP_PATH=release/github-pr-comment-tools-${VERSION}.zip" >> "$GITHUB_ENV"

      - uses: actions/upload-artifact@v4
        with:
          name: chrome-extension-package
          path: ${{ env.ZIP_PATH }}

      - id: auth
        uses: google-github-actions/auth@v2
        with:
          token_format: access_token
          workload_identity_provider: ${{ secrets.GCP_WORKLOAD_IDENTITY_PROVIDER }}
          service_account: ${{ secrets.GCP_SERVICE_ACCOUNT }}
          access_token_scopes: https://www.googleapis.com/auth/chromewebstore

      - name: Upload package to Chrome Web Store
        run: |
          curl -f \
            -H "Authorization: Bearer ${{ steps.auth.outputs.access_token }}" \
            -X POST \
            -T "$ZIP_PATH" \
            "https://chromewebstore.googleapis.com/upload/v2/publishers/${{ secrets.CWS_PUBLISHER_ID }}/items/${{ secrets.CWS_EXTENSION_ID }}:upload"

      - name: Submit for review and publish
        run: |
          curl -f \
            -H "Authorization: Bearer ${{ steps.auth.outputs.access_token }}" \
            -X POST \
            "https://chromewebstore.googleapis.com/v2/publishers/${{ secrets.CWS_PUBLISHER_ID }}/items/${{ secrets.CWS_EXTENSION_ID }}:publish"
```

補足:

- `manifest.json` の version を上げていない場合、`upload` は失敗する。
- `publish` はアップロード済み item を審査に提出する。
- 公開範囲は Chrome Web Store の既存 visibility settings に従う。
- Dashboard で visibility settings を手動変更した場合は、一度手動 publish してから API publish に戻す。

## 7. リリース前後チェックリスト

タグ作成前:

- `package.json` と `manifest.json` の version が一致している。
- 公開済み Web Store version より大きい version になっている。
- `npm test` が通る。
- `npm run build` が通る。
- ZIP ルートに `manifest.json` と `dist/**` が含まれる。
- `manifest.json` の permissions 変更をレビュー済み。
- Store listing、privacy declarations、screenshots、icons、test instructions が最新。
- source map と内部向けファイルは意図しない限り含めない。

審査提出後:

- Chrome Developer Dashboard で item status を確認する。
- publisher account の review notification email が有効になっていることを確認する。
- reject された場合は修正し、version を上げて再リリースする。
- publish 後、Chrome Web Store からインストールして GitHub PR 上で smoke test する。

## 8. 取り消しとロールバック

Chrome Web Store は審査ベースのため、公開済み version の即時 rollback はできない前提で扱う。

対応方針:

- 審査中なら Dashboard または API の `cancelSubmission` で提出を取り消す。
- 公開済み version に問題がある場合は、修正版をより大きい version で作成して再提出する。
- 影響が大きい場合は、修正版の審査中に Dashboard で distribution を停止する。

古い version number の再利用はしない。Chrome Web Store の更新には version bump が必要。

## 9. 今後追加するとよい自動化

リリース作業をさらに減らすため、次を追加する。

1. リリース ZIP を作成する `scripts/package-extension.mjs`。
2. `npm run package:extension`。
3. `.github/workflows/release-chrome-extension.yml`。
4. `package.json` と `manifest.json` の version 不一致を検出する CI check。
5. permissions 変更と test 結果を含む GitHub Release draft 生成。

## 10. 参考

- Chrome Web Store publishing guide:
  https://developer.chrome.com/docs/webstore/publish/
- Chrome Web Store API V2 guide:
  https://developer.chrome.com/docs/webstore/using-api
- Chrome Web Store API service account guide:
  https://developer.chrome.com/docs/webstore/service-accounts
- Chrome extension distribution options:
  https://developer.chrome.com/docs/extensions/how-to/distribute
