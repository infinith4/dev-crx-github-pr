---
name: release-crx
description: Chrome Extension リリースエージェント。GitHub PR Comment Tools の新バージョンをリリースする作業を最初から最後まで案内する。バージョン番号の整合チェック、リリース前チェックリストの検証、package.json と manifest.json のバージョンバンプ、git タグ作成と push、GitHub Actions ワークフローの監視、Chrome Web Store 審査状況の確認、問題が起きたときのロールバック手順を網羅する。キーワード: リリース, release, Chrome Extension, CRX, publish, バージョンアップ, version bump, タグ, tag, Chrome Web Store, CWS, 審査, 公開.
---

# Chrome Extension リリースエージェント

このスキルは `GitHub PR Comment Tools` (Chrome Extension) を新しいバージョンとして Chrome Web Store に公開するための一連の作業を案内する。ドキュメントの詳細は `docs/release/chrome-extension.md` を参照すること。

## ステップ概要

```
1. 現状確認     → テスト・ビルドが通るかを検証
2. バージョンバンプ → package.json と manifest.json を同じ値に更新
3. リリース前チェック → 公開して問題ないか全項目を確認
4. コミット＆タグ → 変更をコミットして vX.Y.Z タグを push
5. ワークフロー監視 → GitHub Actions の実行を確認
6. 公開後確認   → Chrome Developer Dashboard と smoke test
```

---

## ステップ 1: 現状確認

まず現在の状態が正常かを確認する。これをスキップすると後で壊れた状態でタグを打つことになるため、必ず実行する。

```bash
# バージョン整合確認
node scripts/check-version.mjs

# テスト実行
npm test

# ビルド確認
npm run build
```

失敗した場合は先に修正してから次へ進む。

---

## ステップ 2: バージョンバンプ

ユーザーが新しいバージョン番号を指定していない場合は確認する（例: `0.1.0 → 0.2.0`）。

Chrome Web Store はバージョンが前回より大きい値でないとアップロードを拒否するため、現在公開済みのバージョンより必ず大きい値にする。

`package.json` と `manifest.json` の **両方** を同じ値に更新する。どちらか片方だけ更新すると CI が失敗するため必ず両方更新する。

```json
// package.json
"version": "X.Y.Z"

// manifest.json
"version": "X.Y.Z"
```

更新後に整合チェックを再実行する:

```bash
node scripts/check-version.mjs
```

---

## ステップ 3: リリース前チェックリスト

**タグ作成前に全項目を確認する。**

```
[ ] package.json と manifest.json の version が一致している
[ ] 現在の Chrome Web Store 公開バージョンより大きい version になっている
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
# → release/github-pr-comment-tools-X.Y.Z.zip が生成される
```

---

## ステップ 4: コミット＆タグ push

```bash
# バージョン変更をコミット
git add package.json manifest.json
git commit -m "chore: release vX.Y.Z"

# タグ作成（v プレフィックスが必須）
git tag vX.Y.Z

# main と タグを push（この push が GitHub Actions をトリガーする）
git push origin main
git push origin vX.Y.Z
```

タグは `v*.*.*` 形式でなければ GitHub Actions がトリガーされない。

---

## ステップ 5: GitHub Actions ワークフロー監視

タグ push 後、`release-chrome-extension` ワークフローが自動実行される。

```bash
# 最新の実行状況を確認
gh run list --workflow=release-chrome-extension.yml --limit 5

# 特定の実行の詳細を確認
gh run view <run-id>

# リアルタイムでログを追う
gh run watch <run-id>
```

ワークフローが成功すると:
- ZIP アーティファクトが GitHub Actions に保存される
- **GitHub Release が draft 状態で作成される**（公開はユーザーが手動で行う）
- Chrome Web Store の Secrets が設定されている場合は審査提出まで自動実行される

ワークフローが失敗した場合は [ロールバック](#ロールバック) を参照する。

---

## ステップ 6: 公開後確認

**GitHub Release の公開（draft → published）**:
1. GitHub の Releases ページを開く
2. draft 状態のリリースを確認・編集する
3. "Publish release" をクリックして公開する

**Chrome Web Store の確認**:
1. [Chrome Developer Dashboard](https://chrome.google.com/webstore/developer/dashboard) を開く
2. 対象 extension の status を確認する（`Pending review` になっていれば提出成功）
3. publisher account の review notification email が有効になっているか確認する

**審査通過後の smoke test**:
- Chrome Web Store からインストールして GitHub PR 上で動作確認する
- 特に隠れたコメントの展開、スレッドの解決・未解決操作が正常に動作するかを確認する

---

## ロールバック

Chrome Web Store は審査ベースのため即時ロールバックはできない。状況に応じて対応する。

### 審査中にキャンセルしたい場合

```bash
# API で提出を取り消す（Secrets が設定されている場合）
curl -X POST \
  -H "Authorization: Bearer <access_token>" \
  "https://chromewebstore.googleapis.com/v2/publishers/${CWS_PUBLISHER_ID}/items/${CWS_EXTENSION_ID}:cancelSubmission"
```

または Chrome Developer Dashboard から手動でキャンセルする。

### 公開済みバージョンに問題がある場合

1. 古いバージョン番号には戻せないため、修正版をより大きいバージョンで作成して再提出する
2. 影響が大きい場合は Dashboard で distribution を一時停止する（設定 → Visibility → Private）

### タグを誤って push した場合

```bash
# ローカルとリモートのタグを削除する
git tag -d vX.Y.Z
git push origin --delete vX.Y.Z
```

GitHub Actions がすでに実行開始していれば `gh run cancel <run-id>` でキャンセルする。

---

## 初回セットアップ（未実施の場合）

Chrome Web Store の自動公開には GitHub Secrets の設定が必要。詳細は `docs/release/chrome-extension.md` のセクション 3〜4 を参照する。

必要な Secrets:
| Secret | 用途 |
|---|---|
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | OIDC 認証 |
| `GCP_SERVICE_ACCOUNT` | 公開権限を持つ service account |
| `CWS_PUBLISHER_ID` | Chrome Web Store publisher ID |
| `CWS_EXTENSION_ID` | Extension item ID |

Secrets が未設定の場合でも GitHub Release の ZIP 作成まで自動実行される。CWS アップロードは手動で行う。
