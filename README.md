# denozon
![IMG_6075](https://github.com/user-attachments/assets/017f37f5-7385-47a7-8b9e-498bafc3a091)
このプロジェクトは、Amazon.co.jpの商品を監視し、価格変更や在庫状況の変化をリアルタイムで通知するDenoスクリプトです。キーワード検索による商品モニタリングと、特定のURLの商品監視の両方をサポートしています。

## 機能

- キーワードに基づく商品検索と監視
- 特定のURLの商品監視
- 新しい最安値商品の通知
- 在庫切れ商品の入荷通知
- Discord Webhookを使用した通知システム
- 検索履歴の保存と表示
- 監視対象URLの管理（追加・保存・読み込み）

## 必要条件

- Discord Webhook URL

## セットアップ

1. このリポジトリをクローンするか、スクリプトをダウンロードします。

2. プロジェクトのルートディレクトリに `.env` ファイルを作成し、以下の内容を追加します：

   ```
   WEBHOOK_URL=あなたのDiscord_Webhook_URL
   ```

3. setup_and_run.batを実行します。

## 使用方法

1. スクリプトを実行すると、以下の動作をします：
   - 保存された検索履歴を表示します。
   - 新しい検索キーワードの入力を促します。
   - 現在監視中のURLを表示します。
   - 新しく監視するURLの入力を促します。

2. キーワード検索モード：
   - 入力されたキーワードで商品を検索し、最安値商品を通知します。
   - 定期的に商品をチェックし、新しい最安値商品や新入荷商品を通知します。

3. 特定URL監視モード：
   - 入力されたURLの商品を定期的にチェックします。
   - 在庫切れだった商品が入荷された場合に通知します。

4. 通知はすべてDiscord Webhookを通じて送信されます。

## ファイル説明

- `main.ts`: メインのスクリプトファイル
- `search_history.json`: 検索履歴を保存するJSONファイル
- `monitored_urls.json`: 監視対象のURLを保存するJSONファイル

## 注意事項

- このスクリプトは教育目的で作成されています。使用する際は、Amazon.co.jpの利用規約を遵守してください。
- 過度に頻繁なリクエストは、IPアドレスのブロックにつながる可能性があります。適切な間隔でのみ使用してください。
- Discordの通知頻度に注意してください。必要以上の通知はサーバーの負担になる可能性があります。

## ライセンス

このプロジェクトはMITライセンスの下で公開されています。詳細は[LICENSE](LICENSE)ファイルを参照してください。
