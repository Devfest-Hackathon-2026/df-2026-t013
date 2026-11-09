# 考えるノート Flutter版

iOS / Android向け共通Dartコードのネイティブアプリです。`flutter pub get` 後に `flutter run` で起動できます。`flutter build apk --debug` でAndroid APK、`flutter build ios --simulator --debug` でiOSシミュレーター用アプリを生成します。iOS実機へのインストールにはXcodeの署名設定が必要です。

Flutter 3.47.9で確認しています。iOSビルドは `flutter config --enable-swift-package-manager` を有効にして検証しました。Macのクラウド同期フォルダでiOSビルド時に `resource fork, Finder information, or similar detritus not allowed` が出る場合は、プロジェクトを非同期のローカルフォルダにコピーしてビルドしてください。Xcodeの署名設定は各開発者の環境で行います。

答案の解析には既存の `server.py` を起動し、設定画面でアクセス可能なサーバーURLを指定します。AndroidエミュレーターからホストMacのサーバーに接続する場合は `http://10.0.2.2:8080` を使用します。実機では同じネットワーク上のMacのIPアドレスを指定します。アプリは記録を端末内に保存します。

既存ネイティブ版から同じアプリIDで上書きインストールした際、初回起動時に端末内の答案とサーバーURLを読み込む移行処理を用意しています。Androidは元のAPKと同じ署名鍵が必要です。移行ロジックの自動テストは実施済みですが、実際の生徒データを使った検証はしていません。OSが異なる端末間の同期は行いません。機種変更やアンインストールではアプリのローカルデータが消える可能性があります。

画像・PDF取り込み、Classroom連携、ログイン、クラウド同期は未実装です。サーバーは認証なしの試作です。実際の生徒の個人情報を含むデータを使用しないでください。
