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

1. [Chrome Web Store developer account](https://developer.chrome.com/docs/webstore?hl=ja) を登録または確認する。
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

### 3.1 パーミッション申請理由（Privacy タブ）

Chrome Web Store Developer Dashboard の **Privacy** タブにある「権限の正当な理由」欄に入力する文言。  
コピペして使用する。

プライバシーポリシーページ（Store Listing タブの「プライバシーポリシーの URL」欄に入力する）:

```
https://infinith4.github.io/dev-crx-github-pr/privacy-policy.html
```

ページのソース: `site/privacy-policy.html`  
デプロイ: `main` ブランチへの push 時に `.github/workflows/deploy-pages.yml` が自動実行される。  
初回のみ GitHub リポジトリの Settings → Pages → Source を **GitHub Actions** に設定する。

#### `storage`

> **日本語**
>
> 拡張機能の設定（コメント自動展開のオン/オフ、resolve/unresolve 操作の有効化、解決済み・旧バージョンスレッドの表示設定、GitHub Enterprise ホスト一覧）と、resolve/unresolve 操作に必要な GitHub Personal Access Token を `chrome.storage.local` に保存するために使用します。storage がなければページを開くたびに設定がリセットされ、トークンの再入力が必要になります。

> **English**
>
> Used to persist user preferences (comment auto-expansion toggle, resolve/unresolve controls, display settings for resolved and outdated threads, GitHub Enterprise host list) and the GitHub Personal Access Token required for resolve/unresolve operations in `chrome.storage.local`. Without storage, settings would reset on every page load and the token would need to be re-entered each time.

#### `host_permissions: https://github.com/*`

> **日本語**
>
> Content Script が GitHub の Pull Request ページ（`https://github.com/*/*/pull/*`）の DOM を読み取り、折りたたまれたレビューコメントを展開するために必要です。また、Background Service Worker が GitHub GraphQL API を呼び出してレビュースレッドを resolve/unresolve するために必要です。アクセスは github.com 上の PR ページと GitHub API に限定され、それ以外のホストへの通信は行いません。

> **English**
>
> Required for the content script to read the DOM on GitHub Pull Request pages (`https://github.com/*/*/pull/*`) and expand collapsed review comments. Also required for the background service worker to call the GitHub GraphQL API to resolve and unresolve review threads. Access is limited to github.com PR pages and the GitHub API; no other hosts are contacted.

#### リモートコード（Remote code）

申請フォームの「リモートコードを使用していますか？」には **いいえ** と回答する。

すべての JS は `npm run build` 時に `dist/` へバンドル済みで、外部 CDN・`eval()`・動的リモートインポートは使用していない。  
Manifest V3 のデフォルト CSP により、リモートコードの実行はブロックされる。

## 4. GitHub Secrets

推奨は GitHub OIDC と [Google Cloud Workload Identity](https://console.cloud.google.com/iam-admin/workload-identity-pools?hl=ja&orgonly=true&project=dev-crx-github-pr&supportedpurview=organizationId) Federation の組み合わせ。GitHub に長期有効な service account JSON key を保存せずに済む。

必要な secrets:

| Secret                           | 用途                                     |
| -------------------------------- | ---------------------------------------- |
| `CWS_PUBLISHER_ID`               | Chrome Web Store publisher ID            |
| `CWS_EXTENSION_ID`               | Chrome Web Store extension item ID       |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | Workload Identity Provider resource name |
| `GCP_SERVICE_ACCOUNT`            | 公開権限を持つ service account email     |

OIDC を使えない場合の fallback:

| Secret                     | 用途                                           |
| -------------------------- | ---------------------------------------------- |
| `GCP_SERVICE_ACCOUNT_JSON` | Service account JSON key。可能な限り使用しない |

access token、refresh token、service account key はリポジトリにコミットしない。

### 4.1 Google Cloud Workload Identity Federation 設定

ここでは GitHub Actions から Chrome Web Store API を呼ぶために、GitHub OIDC で Google Cloud service account を impersonate する。
service account key は作成しない。

前提値:

| 変数                    | 例                                                                     | 説明                          |
| ----------------------- | ---------------------------------------------------------------------- | ----------------------------- |
| `PROJECT_ID`            | `dev-crx-github-pr`                                                    | Google Cloud project ID       |
| `PROJECT_NUMBER`        | `000000000000`                                                         | Google Cloud project number   |
| `REPO`                  | `infinith4/dev-crx-github-pr`                                          | GitHub repository full name   |
| `POOL_ID`               | `github-actions`                                                       | Workload Identity Pool ID     |
| `PROVIDER_ID`           | `github`                                                               | Workload Identity Provider ID |
| `SERVICE_ACCOUNT_ID`    | `chrome-web-store-publisher`                                           | Service account ID            |
| `SERVICE_ACCOUNT_EMAIL` | `chrome-web-store-publisher@dev-crx-github-pr.iam.gserviceaccount.com` | Service account email         |

Google Cloud CLI で設定する場合:

devcontainer を使う場合は `.devcontainer/Dockerfile` で `google-cloud-cli` をインストールする。
`gcloud: command not found` になる場合は、VS Code で `Dev Containers: Rebuild Container` を実行してからやり直す。

devcontainer 外で実行する場合は、Google Cloud CLI をインストールしてから進める。

```bash
gcloud auth login
PROJECT_ID="dev-crx-github-pr"
PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format="value(projectNumber)")"
REPO="infinith4/dev-crx-github-pr"
POOL_ID="github-actions"
PROVIDER_ID="github"
SERVICE_ACCOUNT_ID="chrome-web-store-publisher"
SERVICE_ACCOUNT_EMAIL="${SERVICE_ACCOUNT_ID}@${PROJECT_ID}.iam.gserviceaccount.com"

gcloud config set project "$PROJECT_ID"
gcloud services enable \
  chromewebstore.googleapis.com \
  iamcredentials.googleapis.com

gcloud iam service-accounts create "$SERVICE_ACCOUNT_ID" \
  --display-name="Chrome Web Store Publisher"
```

Chrome Web Store Developer Dashboard の Account section で、作成した `SERVICE_ACCOUNT_EMAIL` を追加する。
Chrome Web Store API の権限は Dashboard 側で publisher に紐づくため、この用途では service account に Google Cloud project role を追加しない。

Workload Identity Pool を作成する。

```bash
gcloud iam workload-identity-pools create "$POOL_ID" \
  --project="$PROJECT_ID" \
  --location="global" \
  --display-name="GitHub Actions"
```

GitHub OIDC provider を作成する。
`attribute-condition` は対象 repository だけに制限する。

```bash
gcloud iam workload-identity-pools providers create-oidc "$PROVIDER_ID" \
  --project="$PROJECT_ID" \
  --location="global" \
  --workload-identity-pool="$POOL_ID" \
  --display-name="GitHub Actions OIDC" \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository,attribute.repository_owner=assertion.repository_owner,attribute.ref=assertion.ref" \
  --attribute-condition="assertion.repository == '${REPO}'"
```

GitHub Actions から service account を impersonate できるようにする。

```bash
WORKLOAD_IDENTITY_POOL_NAME="projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_ID}"

gcloud iam service-accounts add-iam-policy-binding "$SERVICE_ACCOUNT_EMAIL" \
  --project="$PROJECT_ID" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/${WORKLOAD_IDENTITY_POOL_NAME}/attribute.repository/${REPO}"
```

GitHub Secrets に登録する `GCP_WORKLOAD_IDENTITY_PROVIDER` の値を取得する。

```bash
gcloud iam workload-identity-pools providers describe "$PROVIDER_ID" \
  --project="$PROJECT_ID" \
  --location="global" \
  --workload-identity-pool="$POOL_ID" \
  --format="value(name)"
```

出力例:

```text
projects/000000000000/locations/global/workloadIdentityPools/github-actions/providers/github
```

`.env.local` に設定する値:

```dotenv
GCP_WORKLOAD_IDENTITY_PROVIDER=projects/000000000000/locations/global/workloadIdentityPools/github-actions/providers/github
GCP_SERVICE_ACCOUNT=chrome-web-store-publisher@dev-crx-github-pr.iam.gserviceaccount.com
```

GitHub Actions workflow では、job に `permissions.id-token: write` を付け、`google-github-actions/auth` に上記 2 つを渡す。
このドキュメントの workflow 例では次の step が該当する。

```yaml
- id: auth
  uses: google-github-actions/auth@v2
  with:
    token_format: access_token
    workload_identity_provider: ${{ secrets.GCP_WORKLOAD_IDENTITY_PROVIDER }}
    service_account: ${{ secrets.GCP_SERVICE_ACCOUNT }}
    access_token_scopes: https://www.googleapis.com/auth/chromewebstore
```

反映には数分かかることがある。設定直後に `PERMISSION_DENIED` が出る場合は、5 分程度待ってから workflow を再実行する。

### 4.2 Secrets 登録 script

GitHub CLI が使える環境では、次の script で repository secrets を登録できる。

GitHub CLI が未インストールの場合は先にインストールして認証する。

```powershell
winget install --id GitHub.cli
gh auth login
```

`winget` が使えない場合は https://cli.github.com/ からインストールする。
インストール直後に `gh` が見つからない場合は、新しい PowerShell を開き直す。

```powershell
.\scripts\push-github-secrets.ps1
```

script は既定で `.env.local` から値を読む。`.env.local` は `.gitignore` 対象のため、実値をコミットしない。

`.env.local` の例:

```dotenv
CWS_PUBLISHER_ID=your-publisher-id
CWS_EXTENSION_ID=your-extension-id
GCP_WORKLOAD_IDENTITY_PROVIDER=projects/000000000000/locations/global/workloadIdentityPools/pool/providers/provider
GCP_SERVICE_ACCOUNT=chrome-web-store-publisher@your-project.iam.gserviceaccount.com
```

事前確認だけ行う場合:

```powershell
.\scripts\push-github-secrets.ps1 -DryRun
```

対象 repository を明示する場合:

```powershell
.\scripts\push-github-secrets.ps1 -Repo infinith4/dev-crx-github-pr
```

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
      - "v*.*.*"
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
          node-version: "22"
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
- Google Cloud Workload Identity Federation for deployment pipelines:
  https://cloud.google.com/iam/docs/workload-identity-federation-with-deployment-pipelines
- google-github-actions/auth:
  https://github.com/google-github-actions/auth
