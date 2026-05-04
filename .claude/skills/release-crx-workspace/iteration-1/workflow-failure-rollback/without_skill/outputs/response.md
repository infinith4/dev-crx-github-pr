# v0.3.0 リリース失敗時の対応手順

## 1. 失敗原因の調査

まず gh CLI でワークフローのログを確認します。

```bash
# 最新の失敗したワークフロー実行を確認
gh run list --workflow=release-chrome-extension.yml --limit 5

# 失敗した実行の詳細ログを表示（<RUN_ID> は上記で確認した ID に置き換える）
gh run view <RUN_ID> --log-failed
```

### よくある失敗原因と対処

このプロジェクトのワークフローは以下の順序で実行されます：

1. `npm ci` → 2. `npm test` → 3. `npm run build` → 4. **Validate versions** → 5. Package ZIP → 6. Create GitHub Release → 7. Upload to CWS → 8. Submit for review

**最も起こりやすい失敗: バージョン不整合（ステップ 4）**

ワークフローの `Validate versions` ステップは以下の 2 点を検証します：

- `package.json` の `version` と `manifest.json` の `version` が一致しているか
- どちらも push したタグ `v0.3.0`（= `0.3.0`）と一致しているか

現在のリポジトリの状態を確認すると、`package.json` と `manifest.json` の両方のバージョンが `0.1.0` のままになっています。タグ `v0.3.0` を push した際にこれらのファイルを `0.3.0` に更新していなかった場合、ワークフローはここで失敗します。

---

## 2. 不正なタグの削除とリリースのクリーンアップ

### GitHub Release の削除（作成されていた場合）

```bash
# draft リリースが作成されていれば削除
gh release delete v0.3.0 --yes
```

### リモートタグの削除

```bash
git push origin --delete v0.3.0
```

### ローカルタグの削除

```bash
git tag --delete v0.3.0
```

---

## 3. 問題の修正

`package.json` と `manifest.json` の両方のバージョンを `0.3.0` に更新します。

**package.json**
```json
{
  "version": "0.3.0",
  ...
}
```

**manifest.json**
```json
{
  "version": "0.3.0",
  ...
}
```

修正後、テストとビルドがローカルで通ることを確認してからコミット・タグを打ち直します。

```bash
# 修正をコミット
git add package.json manifest.json
git commit -m "chore: bump version to 0.3.0"

# タグを再作成して push
git tag v0.3.0
git push origin main
git push origin v0.3.0
```

---

## 4. ワークフローの再実行を監視

```bash
# タグ push 後にワークフローが起動したことを確認
gh run list --workflow=release-chrome-extension.yml --limit 3

# リアルタイムでログをウォッチ（<RUN_ID> を置き換える）
gh run watch <RUN_ID>
```

---

## 5. Chrome Web Store の審査を取り消す方法（審査まで進んでいた場合）

ワークフローの CWS アップロード・審査提出ステップ（`Upload to Chrome Web Store` / `Submit for review`）は、リポジトリシークレット `GCP_WORKLOAD_IDENTITY_PROVIDER` が設定されている場合のみ実行されます。設定されていない場合はスキップされるため、CWS への影響はありません。

審査まで提出されていた場合の対処法を以下に示します。

### 方法 A: Chrome Web Store Developer Dashboard から取り消す（推奨）

1. [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole/) を開く
2. 対象の拡張機能を選択
3. 「パッケージ」タブを開く
4. 審査中のバージョンが表示されていれば、**「審査を取り消す」** ボタンをクリック

> **注意:** 審査が「審査中（In Review）」ステータスの場合、取り消しボタンが表示されないことがあります。その場合は方法 B に進んでください。

### 方法 B: Chrome Web Store Publish API で取り消す

```bash
# アクセストークンを取得（GCP サービスアカウントが必要）
ACCESS_TOKEN=$(gcloud auth print-access-token --scopes=https://www.googleapis.com/auth/chromewebstore)

# 公開リクエストをキャンセル（rollback エンドポイント）
curl -X POST \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  "https://chromewebstore.googleapis.com/v2/publishers/${CWS_PUBLISHER_ID}/items/${CWS_EXTENSION_ID}:rollback"
```

> **注意:** `rollback` API は、直前に公開された安定バージョンに戻す操作です。まだ一度も公開されていない拡張機能（初回リリース）の場合は、ロールバック先がないためエラーになります。その場合は Developer Dashboard から「削除」または「非公開」にしてください。

### 方法 C: 問い合わせ（API で取り消せない場合）

審査が完了して誤ったバージョンが公開されてしまった場合、または API での取り消しができない場合は、[Chrome Web Store サポート](https://support.google.com/chrome_webstore/contact/dev_account_transfer) に連絡してください。

---

## まとめ（対応フロー）

```
1. gh run view <RUN_ID> --log-failed  → 失敗ステップ特定
2. gh release delete v0.3.0 --yes     → draft リリース削除（作成済みの場合）
3. git push origin --delete v0.3.0    → リモートタグ削除
4. git tag --delete v0.3.0            → ローカルタグ削除
5. package.json / manifest.json を 0.3.0 に修正
6. git commit → git tag v0.3.0 → git push origin main && git push origin v0.3.0
7. gh run watch <RUN_ID>              → 再実行を監視
8. CWS 審査済みの場合: Developer Dashboard または rollback API で取り消し
```
