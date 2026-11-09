# 考えるノート | Thinking Process Coach

## 生徒・先生向けWeb版（新構成）

写真提出、AIの即時フィードバック、先生による確認・修正・送信を行うWeb版は [webapp/README.md](webapp/README.md) を参照してください。GoogleログインとGeminiの設定が必要です。現時点では単一サーバーの試作で、実際の生徒データを利用する前に本番向けの安全対策と検証が必要です。

以下は従来のローカル試作の説明です。

中学1年の一次方程式の途中式を確認し、先生にはクラスの傾向、生徒には考え直す問いを届ける試作アプリです。スマートフォンとPCに対応します。

## 起動

Python 3.9以上で `python3 server.py` を実行し、`http://localhost:8080` を開きます。スマートフォンからは同じネットワークの `http://<PCのIPアドレス>:8080` にアクセスします。ホーム画面への追加やカメラはHTTPSが必要な場合があります。

デモは追加設定なしで使えます。デモデータは実際の生徒の答案ではありません。データはブラウザ内に保存され、端末間では同期しません。

## 画像・PDFの読み取り

Google CloudでVertex AIを有効にし、`pip install google-auth requests pypdfium2` を実行してApplication Default Credentialsを用意してください。`GOOGLE_CLOUD_PROJECT`、`GOOGLE_CLOUD_LOCATION`、`GEMINI_MODEL` を設定して起動します。モデル名は利用可能なFlashモデルを指定してください。画像は設定したGoogle Cloudプロジェクトに送られ、サーバーには保存されません。認証情報はGitに含めないでください。

## 現状と本番化

ローカル保存の試作です。Firebase Auth、Firestore、Classroom/Drive連携、Cloud Runへのデプロイ、アクセス制御、クラウド保存は未接続です。類題のClassroom実配信は行いません。実際の生徒データには使用しないでください。数式処理は一変数の一次方程式に限り、解析できない式は要確認にします。読み取りや判定には教員の確認が必要です。

`python3 -m unittest discover -s tests -v` で検証できます。

スマートフォン向けアプリのプロジェクトとビルド方法は [mobile/README.md](mobile/README.md) を参照してください。アプリからは起動中のサーバーへの接続が必要です。

iOS・Android共通のFlutter版は [mobile/flutter_app/README.md](mobile/flutter_app/README.md) にあります。

## 提出情報

チーム：うえすとギルド（さくらゆ、fuga）

公開URL：https://ichigyo.sakurayu.tech

公開版の構成は cloudflare/ を参照してください。運営の案内は ORGANIZER_GUIDE.md に保存しています。
