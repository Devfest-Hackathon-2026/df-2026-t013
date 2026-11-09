import Flutter
import UIKit

@main
@objc class AppDelegate: FlutterAppDelegate, FlutterImplicitEngineDelegate {
  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  func didInitializeImplicitFlutterEngine(_ engineBridge: FlutterImplicitEngineBridge) {
    GeneratedPluginRegistrant.register(with: engineBridge.pluginRegistry)
    let channel = FlutterMethodChannel(name: "jp.thinkingnote.coach/migration", binaryMessenger: engineBridge.applicationRegistrar.messenger())
    channel.setMethodCallHandler { call, result in
      guard call.method == "readLegacyData" else { result(FlutterMethodNotImplemented); return }
      let defaults = UserDefaults.standard
      var data: [String: String] = [:]
      if let records = defaults.data(forKey: "nativeRecords").flatMap({ String(data: $0, encoding: .utf8) }) { data["records"] = records }
      if let url = defaults.string(forKey: "serverURL") { data["serverURL"] = url }
      result(data)
    }
  }
}
