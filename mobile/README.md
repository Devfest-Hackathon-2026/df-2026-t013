# モバイルアプリ

Flutter共通実装は [flutter_app/README.md](flutter_app/README.md) を参照してください。以下は移行前のSwift / Javaネイティブ版の説明です。

iOS / Androidのネイティブ画面を使う試作アプリです。Web画面は表示しません。答案の手入力、サーバーによる途中式の検証、分類別の集計、答案一覧、振り返りに対応します。記録は各端末に保存されます。解析には別途 `python3 server.py` で起動したサーバーまたはデプロイ済みのURLが必要です。設定画面にサーバーのURLを入力してください。PCとスマートフォンは同じネットワークに接続します。端末の `localhost` はPCを指しません。

ネイティブ版では画像・PDF取り込み、類題作成、Classroom連携、ログイン、端末間同期は未実装です。Web版のブラウザ保存データは引き継がれません。

## iOS

`mobile/ios/ThinkingNote.xcodeproj` をXcodeで開きます。実機にインストールするにはSigning & CapabilitiesでApple IDのチームと一意なBundle Identifierを指定してビルドしてください。IPAの配布には適切なApple Developerの署名・プロビジョニングが必要です。

## Android

`mobile/android` をAndroid Studioで開き、Android SDK 35とJDK 17以上をセットアップしてビルドします。ターミナルでは `cd mobile/android` の後に `./gradlew assembleDebug` を実行します。Debug APKは `app/build/outputs/apk/debug/` に作成されます。配布用は署名済みビルドが必要です。

## 注意

サーバーには認証がなく、ローカルHTTPも暗号化されません。実際の生徒の個人情報を含むデータは使用しないでください。Googleサービスとの連携や本番運用についてはルートのREADMEを参照してください。
