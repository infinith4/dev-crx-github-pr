# バージョン不一致の修正とリリース手順

## 問題の概要

`node scripts/check-version.mjs` が失敗している原因は、`package.json` のバージョン（`0.2.0`）と `manifest.json` のバージョン（`0.1.0`）が一致していないためです。

---

## 修正手順

### ステップ 1: manifest.json のバージョンを更新する

`manifest.json` を開き、`version` フィールドを `0.1.0` から `0.2.0` に変更します。

**変更前:**
```json
{
  "version": "0.1.0",
  ...
}
```

**変更後:**
```json
{
  "version": "0.2.0",
  ...
}
```

### ステップ 2: バージョン整合チェックを再実行する

```bash
node scripts/check-version.mjs
```

`package.json` と `manifest.json` の両方が `0.2.0` になっていれば、チェックが通ります。

### ステップ 3: ビルドを実行する

```bash
npm run build
```

エラーがないことを確認します。

### ステップ 4: テストを実行する

```bash
npm test
```

全テストがパスすることを確認します。

### ステップ 5: 変更をコミットする

```bash
git add manifest.json
git commit -m "chore: bump manifest.json version to 0.2.0"
```

### ステップ 6: Git タグを作成して push する

GitHub Actions のリリースワークフロー（`.github/workflows/release-chrome-extension.yml`）は `v*.*.*` タグによってトリガーされます。

```bash
git tag v0.2.0
git push origin develop
git push origin v0.2.0
```

### ステップ 7: GitHub Actions ワークフローを確認する

GitHub リポジトリの **Actions** タブを開き、`release-chrome-extension` ワークフローが正常に起動・完了することを確認します。

---

## 注意事項

- `manifest.json` の `version` フィールドは Chrome Web Store のバージョン管理に直接使われます。`package.json` と必ず一致させてください。
- リリース前に `npm run build` と `npm test` が両方通ることを確認するのがベストプラクティスです。
- タグは `develop` ブランチへの push 後に作成してください。ワークフローのトリガー条件を確認し、対象ブランチが正しいかチェックしてください。

---

## まとめ

| ステップ | 内容 |
|----------|------|
| 1 | `manifest.json` の `version` を `0.2.0` に修正 |
| 2 | `node scripts/check-version.mjs` でバージョン整合チェック |
| 3 | `npm run build` でビルド確認 |
| 4 | `npm test` でテスト確認 |
| 5 | `git commit` で変更を保存 |
| 6 | `git tag v0.2.0` + `git push origin v0.2.0` でリリーストリガー |
| 7 | GitHub Actions でワークフロー完了を確認 |
