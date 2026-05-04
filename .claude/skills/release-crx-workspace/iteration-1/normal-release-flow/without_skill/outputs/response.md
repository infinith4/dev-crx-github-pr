# GitHub PR Comment Tools v0.2.0 リリース手順

現在 v0.1.0 から v0.2.0 へバージョンアップするための手順を説明します。

---

## 前提確認

- ブランチ: `develop`（または作業ブランチ）
- テスト: 全件通過済み
- Chrome Web Store シークレット: 未設定（GitHub Release の Draft 作成まで自動化）

---

## ステップ 1: バージョン番号を更新する

`package.json` と `manifest.json` の両方を `0.2.0` に書き換えます。

### package.json

```json
{
  "name": "github-pr-comment-tools",
  "version": "0.2.0",
  ...
}
```

### manifest.json

```json
{
  "manifest_version": 3,
  "name": "GitHub PR Comment Tools",
  "version": "0.2.0",
  ...
}
```

> **注意:** 両ファイルのバージョンが一致しないと、GitHub Actions の `Validate versions` ステップが失敗します。

---

## ステップ 2: バージョン整合チェックを実行する

```bash
node scripts/check-version.mjs
```

成功時の出力:

```
Version check passed: 0.2.0
```

---

## ステップ 3: テストとビルドをローカルで確認する

```bash
npm test
npm run build
```

両方が正常終了することを確認してください。

---

## ステップ 4: リリース ZIP をローカルで確認する（任意）

```bash
npm run package:extension
```

`release/github-pr-comment-tools-0.2.0.zip` が生成されます。内容を確認して問題がないことを確かめてください。

---

## ステップ 5: 変更をコミットする

```bash
git add package.json manifest.json
git commit -m "chore: bump version to 0.2.0"
```

---

## ステップ 6: `main` ブランチにマージする

`develop` ブランチで作業している場合は、`main` へ PR を作成してマージします。

```bash
# GitHub 上で PR を作成してマージ、または以下のコマンドで直接マージ
git checkout main
git merge develop
git push origin main
```

> **重要:** GitHub Actions のワークフローはタグ push で起動します。タグは `main` ブランチから切ることを推奨します。

---

## ステップ 7: バージョンタグを作成して push する

```bash
git tag v0.2.0
git push origin v0.2.0
```

このタグ push により、`.github/workflows/release-chrome-extension.yml` が自動的にトリガーされます。

---

## ステップ 8: GitHub Actions の実行を確認する

GitHub リポジトリの **Actions** タブを開き、`Release Chrome Extension` ワークフローの進捗を確認します。

ワークフローが実行するステップ:

1. `npm ci` — 依存関係インストール
2. `npm test` — テスト実行
3. `npm run build` — ビルド
4. `Validate versions` — `package.json`・`manifest.json`・タグのバージョン整合チェック
5. `Package extension` — ZIP 作成
6. `Verify ZIP contents` — ZIP 内容確認
7. `Upload artifact` — ビルド成果物をアーティファクトとして保存
8. `Create GitHub Release` — **Draft** として GitHub Release を作成

---

## ステップ 9: GitHub Release を公開する

ワークフロー成功後、GitHub の **Releases** ページに `v0.2.0` の **Draft** リリースが作成されます。

1. Draft リリースを開く
2. リリースノートを編集（新機能・変更点・バグ修正を記載）
3. **Publish release** ボタンをクリックして公開する

---

## Chrome Web Store への提出（現在は手動）

Chrome Web Store シークレット（`GCP_WORKLOAD_IDENTITY_PROVIDER` 等）が未設定のため、自動提出はスキップされます。手動で提出する場合は以下の手順に従います。

1. [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole/) にアクセス
2. 対象の拡張機能を選択
3. ワークフローのアーティファクト、または `npm run package:extension` で生成した ZIP をアップロード
4. ストア情報（スクリーンショット・説明文等）を更新
5. **審査のために送信** をクリック

---

## トラブルシューティング

### バージョン不一致エラー

```
Error: package.json (0.2.0) and manifest.json (0.1.0) versions differ
```

→ `manifest.json` のバージョンを `0.2.0` に更新してから、タグを付け直してください。

```bash
git tag -d v0.2.0
git push origin :refs/tags/v0.2.0
# manifest.json を修正後
git add manifest.json
git commit -m "fix: update manifest.json version to 0.2.0"
git tag v0.2.0
git push origin v0.2.0
```

### タグとバージョンの不一致エラー

```
Error: package.json (0.2.0) and tag (0.1.0) versions differ
```

→ タグ名が `v0.2.0` になっているか確認してください。

---

## まとめ（チェックリスト）

- [ ] `package.json` のバージョンを `0.2.0` に更新
- [ ] `manifest.json` のバージョンを `0.2.0` に更新
- [ ] `node scripts/check-version.mjs` でバージョン整合確認
- [ ] `npm test` でテスト通過確認
- [ ] `npm run build` でビルド成功確認
- [ ] 変更をコミット
- [ ] `main` ブランチにマージ
- [ ] `git tag v0.2.0 && git push origin v0.2.0` でタグ push
- [ ] GitHub Actions ワークフローの成功を確認
- [ ] GitHub Release の Draft を確認・公開
- [ ] Chrome Web Store へ手動提出（必要な場合）
