# バージョン不一致の修正とリリース手順

## 状況の確認

`node scripts/check-version.mjs` が失敗したのは、`package.json` のバージョン (`0.2.0`) と `manifest.json` のバージョン (`0.1.0`) が一致していないためです。Chrome Extension のリリースでは **両ファイルのバージョンを必ず一致させる** 必要があります。

---

## 修正手順

### ステップ 1: manifest.json のバージョンを修正する

`manifest.json` の `version` フィールドを `package.json` に合わせて `0.2.0` に更新します。

```json
// manifest.json（変更箇所）
"version": "0.2.0"
```

`package.json` 側はすでに `0.2.0` になっているため、変更不要です。

### ステップ 2: バージョン整合チェックを再実行する

```bash
node scripts/check-version.mjs
```

`package.json` と `manifest.json` のバージョンが一致していれば、このコマンドは成功します。

### ステップ 3: テストとビルドを確認する

```bash
npm test
npm run build
```

両方が通ることを確認してから次へ進みます。

---

## リリース前チェックリスト

タグ作成前に以下を全て確認してください。

- [ ] `package.json` と `manifest.json` の `version` が両方とも `0.2.0` で一致している
- [ ] Chrome Web Store で現在公開中のバージョン（`0.1.0`）より大きい値になっている（OK: `0.2.0 > 0.1.0`）
- [ ] `npm test` が通る
- [ ] `npm run build` が通る
- [ ] ZIP に `manifest.json` と `dist/**` が含まれる（source map は除外）
- [ ] `manifest.json` の `permissions` に変更があればレビュー済み
- [ ] `.env` や credentials などの機密ファイルがコミットに含まれていない

ローカルで ZIP の中身を確認したい場合:

```bash
npm run package:extension
# → release/github-pr-comment-tools-0.2.0.zip が生成される
```

---

## コミット・タグ作成・Push

チェックリストが全て完了したら、以下の順で実行します。

```bash
# バージョン変更をステージング・コミット
git add package.json manifest.json
git commit -m "chore: release v0.2.0"

# タグ作成（v プレフィックスが必須）
git tag v0.2.0

# main ブランチとタグを push（この push が GitHub Actions をトリガーする）
git push origin main
git push origin v0.2.0
```

> **注意:** タグは `v*.*.*` 形式でなければ `.github/workflows/release-chrome-extension.yml` がトリガーされません。

---

## GitHub Actions ワークフローの確認

タグ push 後、`release-chrome-extension` ワークフローが自動実行されます。

```bash
# 実行状況を確認
gh run list --workflow=release-chrome-extension.yml --limit 5

# リアルタイムでログを追う
gh run watch <run-id>
```

ワークフローが成功すると:
- ZIP アーティファクトが GitHub Actions に保存される
- GitHub Release が **draft 状態** で作成される（公開は手動）
- Chrome Web Store の Secrets が設定済みであれば審査提出まで自動実行される

---

## 公開後の確認

1. GitHub の Releases ページで draft リリースを確認・編集し、"Publish release" をクリックして公開する
2. [Chrome Developer Dashboard](https://chrome.google.com/webstore/developer/dashboard) を開き、ステータスが `Pending review` になっていることを確認する
3. 審査通過後、Chrome Web Store からインストールして GitHub PR 上での動作（隠れたコメントの展開、スレッドの解決・未解決操作など）を smoke test する

---

## まとめ

今回の問題は `manifest.json` のバージョンを `0.1.0` から `0.2.0` に更新し忘れたことが原因です。修正は1行だけですが、この不一致は CI を壊すため、必ずコミット前に `node scripts/check-version.mjs` で確認する習慣をつけましょう。
