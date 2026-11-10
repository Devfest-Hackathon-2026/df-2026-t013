# 審査用Webアプリ

Cloudflare WorkersとD1で画面・API・データを提供し、Cloud Runの中継を通じてVertex AIを利用します。公開先は https://ichigyo.sakurayu.tech です。

審査用ログインは先生 `teacher1@sample.com`〜`teacher5@sample.com` と生徒 `student1@sample.com`〜`student5@sample.com` です。旧アドレス `teacher@sample.com` と `student@sample.com` は、それぞれ先生1と生徒1の互換用の別名です。これはメール認証や本人確認ではなく、ブラウザごとにランダムなデモ環境を作成する機能です。同じブラウザでは役割を切り替えることができ、別ブラウザでは先生の招待コードを生徒が入力すると接続できます。実際の生徒の個人情報や答案は入力しないでください。ブラウザデータを消すと、同じ環境には戻れなくなります。既存のGoogleログイン由来のユーザーデータにはデモからアクセスできません。

認証トークンの署名用に、Worker secret `DEMO_SESSION_SECRET` が必要です。十分に長いランダム値を設定し、ソースに書き込まないでください。変更すると既存のログイントークンは無効になります。

AI機能はCloud Runに付与した実行IDでVertex AIに接続し、Workerと中継の間に共有シークレットを使います。AI呼び出しは1日20回、累計100回に制限され、指定期限で停止します。この制限とGoogle Cloudの利用上限は追加請求ゼロを保証しません。テストと審査で同じ枠を消費します。

先生は「課題を設定」から課題を追加し、生徒はログイン後の接続画面で先生の招待コードを入力してから、先生を選択してその先生の課題を提出します。「先生を切り替える」から、つながった別の先生の課題や提出履歴を表示できます。先生側の招待画面にある識別番号は、生徒側の先生選択画面と一致します。接続前の生徒は接続画面以外に移動できず、提出や課題一覧のAPIも利用できません。先生の課題は、その先生と接続した生徒にだけ表示されます。課題の保存には `migrations/0002_assignments.sql` を既存DBに一度だけ適用します。新規DBには `schema.sql` を使います。先生をひも付ける前に作成された提出は、履歴の「以前の提出（先生未指定）」に表示します。

テスト：`node --test cloudflare/worker.test.mjs cloudflare/integration.test.mjs cloudflare/equations.test.mjs cloudflare/gemini.test.mjs cloudflare/proxy.integration.test.mjs`
