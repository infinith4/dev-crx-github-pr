# v0.3.0 ワークフロー失敗時の対応手順

`v0.3.0` タグを push した後、`release-chrome-extension` ワークフローが失敗した場合の調査・修正・再リリース、および Chrome Web Store 審査のキャンセル方法を説明します。

---

## 1. 失敗原因の調査

まず、どのステップで失敗したかをログで確認します。

```bash
# 最新の実行一覧を確認
gh run list --workflow=release-chrome-extension.yml --limit 5

# 失敗した実行の詳細ログを確認（<run-id> は上記で取得）
gh run view <run-id>

# リアルタイムログを追う場合
gh run watch <run-id>
```

### よくある失敗原因と確認ポイント

| ステップ | 失敗原因の例 |
|---|---|
| `npm test` | テストが通っていない |
| `npm run build` | ビルドエラー |
| `Validate versions` | `package.json` と `manifest.json` のバージョンが不一致、またはタグ `v0.3.0` とバージョン `0.3.0` が一致していない |
| `Package extension` | `dist/` が生成されていない |
| `Create GitHub Release` | 同名のリリースがすでに存在する |
| `Upload to Chrome Web Store` | GCP Secrets が未設定または認証エラー |
| `Submit for review` | Chrome Web Store API エラー |

最も多い失敗原因は **バージョン不一致** です。次のコマンドでローカル確認できます。

```bash
node -p "require('./package.json').version"
node -p "require('./manifest.json').version"
# → 両方とも "0.3.0" でなければならない
```

---

## 2. 不正なタグの削除

失敗した状態のままのタグ `v0.3.0` を削除します。

```bash
# ローカルのタグを削除
git tag -d v0.3.0

# リモートのタグを削除
git push origin --delete v0.3.0
```

GitHub Actions がすでに実行中であればキャンセルします。

```bash
# 実行中のワークフローをキャンセル
gh run cancel <run-id>
```

GitHub Release の draft が作成されていた場合は、GitHub の Releases ページから手動で削除してください。

---

## 3. Chrome Web Store 審査のキャンセル（審査まで進んでいた場合）

ワークフローの `Submit for review` ステップまで成功していた場合、Chrome Web Store に審査提出済みの状態になっています。

### 方法 A: API でキャンセル（推奨）

GCP のアクセストークンを取得した上で、次のコマンドを実行します。

```bash
# アクセストークンを取得（gcloud CLI が使える場合）
ACCESS_TOKEN=$(gcloud auth print-access-token)

# 審査提出をキャンセル
curl -X POST \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  "https://chromewebstore.googleapis.com/v2/publishers/${CWS_PUBLISHER_ID}/items/${CWS_EXTENSION_ID}:cancelSubmission"
```

`CWS_PUBLISHER_ID` と `CWS_EXTENSION_ID` は GitHub Secrets に設定されている値を使用してください。

### 方法 B: Chrome Developer Dashboard から手動キャンセル

1. [Chrome Developer Dashboard](https://chrome.google.com/webstore/developer/dashboard) を開く。
2. 対象の extension item を選択する。
3. ステータスが `Pending review` になっていることを確認する。
4. 「Cancel submission」または「Edit」から提出を取り消す。

---

## 4. 問題の修正

調査で判明した原因を修正します。

### バージョン不一致の場合

`package.json` と `manifest.json` の両方を `0.3.0` に揃えます。

```json
// package.json
"version": "0.3.0"

// manifest.json
"version": "0.3.0"
```

修正後にローカルで整合チェックを実行します。

```bash
node scripts/check-version.mjs
```

### テスト・ビルドの失敗の場合

```bash
npm test
npm run build
```

エラーを修正してから次のステップへ進みます。

---

## 5. 修正をコミットしてタグを再作成

```bash
# 修正内容をコミット（バージョンファイルを変更した場合）
git add package.json manifest.json
git commit -m "chore: fix v0.3.0 release"

# タグを再作成（v プレフィックスが必須）
git tag v0.3.0

# main ブランチとタグを push
git push origin main
git push origin v0.3.0
```

---

## 6. ワークフローの再実行と確認

タグを push するとワークフローが自動的に再トリガーされます。

```bash
# 実行状況を確認
gh run list --workflow=release-chrome-extension.yml --limit 5

# ログをリアルタイムで確認
gh run watch <new-run-id>
```

ワークフローが成功すると:
- GitHub Release が **draft 状態** で作成される
- Chrome Web Store の Secrets が設定されている場合は審査提出まで自動実行される

GitHub Release を公開する場合は、GitHub の Releases ページで draft を確認・編集してから「Publish release」をクリックしてください。

---

## 7. 公開後の確認

Chrome Developer Dashboard でステータスが `Pending review` になっていることを確認します。審査通過後は Chrome Web Store からインストールして動作確認（smoke test）を行います。

- 隠れたコメントの展開が正常に動作するか確認する。
- スレッドの解決・未解決操作が正常に動作するか確認する。

---

## まとめ（対応フロー）

```
1. gh run view <run-id>       → 失敗ステップを特定
2. gh run cancel <run-id>     → 実行中なら停止
3. git push origin --delete v0.3.0  → リモートタグ削除
4. git tag -d v0.3.0          → ローカルタグ削除
5. （審査済みなら）cancelSubmission API または Dashboard でキャンセル
6. 原因を修正してコミット
7. git tag v0.3.0 && git push origin v0.3.0  → 再リリース
8. gh run watch <new-run-id>  → 成功を確認
```
