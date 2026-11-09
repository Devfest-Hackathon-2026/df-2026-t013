import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:thinking_note/main.dart';

void main() {
  testWidgets('empty state and input navigation work', (tester) async {
    SharedPreferences.setMockInitialValues({});
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
            const MethodChannel('jp.thinkingnote.coach/migration'),
            (call) async => null);
    await tester.pumpWidget(const ThinkingApp());
    await tester.pumpAndSettle();
    expect(find.text('まだ答案がありません。\n答案を入力すると、ここに傾向が表示されます。'), findsOneWidget);
    await tester.tap(find.text('答案を入力する'));
    await tester.pumpAndSettle();
    expect(find.text('生徒名'), findsOneWidget);
    expect(find.byType(TextField), findsWidgets);
  });

  testWidgets('imports a legacy answer without changing the original',
      (tester) async {
    SharedPreferences.setMockInitialValues({});
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
            const MethodChannel('jp.thinkingnote.coach/migration'),
            (call) async => {
                  'records':
                      '[{"name":"テスト生徒","lines":["2x+3=7","2x=10"],"category":"transpose","status":"mistake","errorIndex":1,"correctLines":1}]',
                  'serverURL': 'http://10.0.2.2:8080',
                });
    await tester.pumpWidget(const ThinkingApp());
    await tester.pumpAndSettle();
    expect(find.text('移項の符号'), findsOneWidget);
    final prefs = await SharedPreferences.getInstance();
    expect(prefs.getString('flutterRecords'), contains('"index":1'));
    expect(prefs.getString('serverURL'), 'http://10.0.2.2:8080');
  });
}
