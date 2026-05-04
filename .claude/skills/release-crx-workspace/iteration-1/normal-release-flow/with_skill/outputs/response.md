# GitHub PR Comment Tools v0.2.0 リリース手順

現在 v0.1.0 から v0.2.0 へのリリース手順を案内します。テストが全部通っている状態とのことなので、ステップ 1 の確認から始めましょう。

---

## ステップ 1: 現状確認

まずバージョン整合・テスト・ビルドが正常であることを確認します。

```bash
# バージョン整合確認（package.json と manifest.json が一致しているか）
node scripts/check-version.mjs

# テスト実行（全部通ることを再確認）
npm test

# ビルド確認
npm run build
```

いずれかが失敗した場合は先に修正してから次のステップへ進んでください。

---

## ステップ 2: バージョンバンプ（v0.1.0 → v0.2.0）

`package.json` と `manifest.json` の **両方** を `0.2.0` に更新します。片方だけ更新すると CI が失敗するため、必ず両方更新してください。

**package.json の変更箇所:**

```json
{
  "version": "0.2.0"
}
```

**manifest.json の変更箇所:**

```json
{
  "version": "0.2.0"
}
```

更新後、整合チェックを再実行して両ファイルが一致していることを確認します:

```bash
node scripts/check-version.mjs
```

---

## ステップ 3: リリース前チェックリスト

タグ作成前に全項目を確認してください。

```
[ ] package.json の version が "0.2.0" になっている
[ ] manifest.json の version が "0.2.0" になっている
[ ] 両ファイルのバージョンが一致している（node scripts/check-version.mjs で確認済み）
[ ] 現在の Chrome Web Store 公開バージョン (0.1.0) より大きい値になっている
[ ] npm test が通る
[ ] npm run build が通る
[ ] ZIP に manifest.json と dist/** が含まれる（source map は除外）
[ ] manifest.json の permissions 変更をレビュー済み（新しいパーミッションがある場合は審査に時間がかかる）
[ ] Store listing・privacy declarations・screenshots・icons・test instructions が最新
[ ] .env や credentials など機密ファイルがコミットに含まれていない
```

ローカルで ZIP を確認したい場合:

```bash
npm run package:extension
# → release/github-pr-comment-tools-0.2.0.zip が生成される
```

---

## ステップ 4: コミット＆タグ push

> **注意:** 現在のブランチが `develop` です。`main` ブランチにマージ済みの状態で以下を実行してください。

```bash
# バージョン変更をコミット
git add package.json manifest.json
git commit -m "chore: release v0.2.0"

# タグ作成（v プレフィックスが必須）
git tag v0.2.0

# main とタグを push（この push が GitHub Actions をトリガーする）
git push origin main
git push origin v0.2.0
```

タグは `v*.*.*` 形式でなければ `release-chrome-extension` ワークフローがトリガーされません。

---

## ステップ 5: GitHub Actions ワークフロー監視

タグ push 後、`release-chrome-extension` ワークフローが自動実行されます。

```bash
# 最新の実行状況を確認
gh run list --workflow=release-chrome-extension.yml --limit 5

# 特定の実行の詳細を確認
gh run view <run-id>

# リアルタイムでログを追う
gh run watch <run-id>
```

ワークフローが成功すると:
- ZIP アーティファクトが GitHub Actions に保存されます
- **GitHub Release が draft 状態で作成されます**（公開はユーザーが手動で行います）
- Chrome Web Store の Secrets が設定されていないため、CWS へのアップロードはスキップされます

> **現在の状態について:** Chrome Web Store の Secrets（`GCP_WORKLOAD_IDENTITY_PROVIDER`、`GCP_SERVICE_ACCOUNT`、`CWS_PUBLISHER_ID`、`CWS_EXTENSION_ID`）が未設定のため、CWS への自動アップロード・審査提出はスキップされます。GitHub Release の draft 作成まで自動実行されます。

---

## ステップ 6: 公開後確認

### GitHub Release の公開（draft → published）

1. GitHub の Releases ページ（`https://github.com/infinith4/dev-crx-github-pr/releases`）を開く
2. draft 状態の `v0.2.0` リリースを確認・リリースノートを編集する
3. "Publish release" をクリックして公開する

### Chrome Web Store への手動アップロード（Secrets 未設定のため）

現在 CWS の Secrets が未設定のため、Chrome Web Store へのアップロードは手動で行います:

1. GitHub Actions のアーティファクトから `chrome-extension-package`（`github-pr-comment-tools-0.2.0.zip`）をダウンロードする
2. [Chrome Developer Dashboard](https://chrome.google.com/webstore/developer/dashboard) を開く
3. 対象 extension item を選択する
4. ZIP をアップロードして "Submit for review" を実行する

### 審査通過後の smoke test

- Chrome Web Store からインストールして GitHub PR 上で動作確認する
- 特に隠れたコメントの展開、スレッドの解決・未解決操作が正常に動作するかを確認する

---

## 問題が発生した場合のロールバック

### タグを誤って push した場合

```bash
# ローカルとリモートのタグを削除する
git tag -d v0.2.0
git push origin --delete v0.2.0

# GitHub Actions がすでに実行開始していればキャンセル
gh run cancel <run-id>
```

### 審査中にキャンセルしたい場合

Chrome Developer Dashboard から手動でキャンセルするか、Secrets 設定後は API で取り消せます。

### 公開済みバージョンに問題がある場合

古いバージョン番号には戻せないため、修正版をより大きいバージョン（例: `v0.2.1`）で作成して再提出してください。
影響が大きい場合は Dashboard で distribution を一時停止（Settings → Visibility → Private）してください。

---

## Chrome Web Store 自動公開の有効化（今後の対応）

CWS への自動公開を有効にするには、以下の GitHub Secrets の設定が必要です。詳細は `docs/release/chrome-extension.md` のセクション 3〜4 を参照してください。

| Secret | 用途 |
|---|---|
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | OIDC 認証 |
| `GCP_SERVICE_ACCOUNT` | 公開権限を持つ service account |
| `CWS_PUBLISHER_ID` | Chrome Web Store publisher ID |
| `CWS_EXTENSION_ID` | Extension item ID |
