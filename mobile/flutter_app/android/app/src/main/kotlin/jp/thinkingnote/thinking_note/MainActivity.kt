package jp.thinkingnote.thinking_note

import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "jp.thinkingnote.coach/migration")
            .setMethodCallHandler { call, result ->
                if (call.method != "readLegacyData") { result.notImplemented(); return@setMethodCallHandler }
                val old = getSharedPreferences("MainActivity", MODE_PRIVATE)
                result.success(mapOf("records" to old.getString("nativeRecords", null), "serverURL" to old.getString("serverURL", null)))
            }
    }
}
