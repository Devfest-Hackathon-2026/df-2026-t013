# Cloudflare移行作業

試験用WorkerとD1データベースを作成済みです。既存のローカルSQLiteは自動移行されません。AIの認証は未設定で、実際の生徒データを使う段階ではありません。

`node --test cloudflare/worker.test.mjs` で認証・権限管理の基本テスト、`npx wrangler deploy --dry-run --config cloudflare/wrangler.toml` でデプロイ構成を確認します。

Geminiの利用にはサービスアカウントをWorkerのシークレットに設定し、期限を指定する必要があります。呼び出しを1日20回、累計100回に制限し、設定期限とクレジット終了日前日の早い方で停止します。制限は利用を抑えるためのもので、Google Cloudの追加請求ゼロを保証するものではありません。料金設定、クレジット残高、別サービスからの使用状況を確認するまではAIを有効化しないでください。

`gcp_proxy/` には長期のGoogleサービスアカウント鍵を使わずCloud Runの実行IDでVertex AIに接続する代替案があります。Cloud RunとCloudflare間の共有認証、両側の期限設定、課金と権限の確認が必要です。Cloud Run自体にも料金が発生し得るため、現時点ではデプロイしていません。
