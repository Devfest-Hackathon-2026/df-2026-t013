import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';

const green = Color(0xff26694f);
const background = Color(0xfff6f8f5);
const categories = <String, (String, String, String)>{
  'transpose': ('移項の符号', '正負の数の加減・等式の性質', 'この行では、両辺にそれぞれ何をしましたか？'),
  'distribute': ('分配法則', '文字式・分配法則', 'かっこの外の数は、中のそれぞれの項にどう関わっていますか？'),
  'bracket': ('かっこの符号', '正負の数・文字式の加減', 'かっこの前の符号は、中の各項にどう関わっていますか？'),
  'combine': ('同類項の計算', '文字式の加法と減法', 'まとめられる項はどれですか？'),
  'arithmetic': ('正負の数の計算', '正負の数の四則計算', '数の計算を符号にも気をつけて確かめられますか？'),
  'division': ('係数で割る', '等式の性質・除法', '両辺を同じ数で割れていますか？'),
  'fraction': ('分数・小数の計算', '分数と小数の四則計算', '分数や小数の計算を確かめられますか？'),
  'equal': ('等号の使い方', '等式の意味と性質', '等号の左右は、いつも同じ値を表していますか？'),
  'copy': ('書き写し', '式の読み取りと表現', '前の行の数字や記号を比べてみましょう。'),
  'other': ('その他・分類待ち', '一次方程式の変形', '一つ前の行から、両辺に何をしたか説明できますか？'),
};

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const ThinkingApp());
}

class ThinkingApp extends StatelessWidget {
  const ThinkingApp({super.key});
  @override
  Widget build(BuildContext context) => MaterialApp(
      title: '考えるノート',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
          useMaterial3: true,
          colorScheme:
              ColorScheme.fromSeed(seedColor: green, surface: background),
          scaffoldBackgroundColor: background,
          inputDecorationTheme: InputDecorationTheme(
              filled: true,
              fillColor: Colors.white,
              border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(14),
                  borderSide: BorderSide.none)),
          cardTheme: CardThemeData(
              color: Colors.white,
              elevation: 0,
              margin: EdgeInsets.zero,
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(18)))),
      home: const Workspace());
}

class Workspace extends StatefulWidget {
  const Workspace({super.key});
  @override
  State<Workspace> createState() => _WorkspaceState();
}

class _WorkspaceState extends State<Workspace> {
  int page = 0;
  bool loading = true, busy = false;
  final name = TextEditingController(),
      lines = TextEditingController(),
      server = TextEditingController();
  String selected = 'other';
  List<Map<String, dynamic>> records = [];
  SharedPreferences? prefs;
  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    try {
      prefs = await SharedPreferences.getInstance();
      if (!prefs!.containsKey('nativeMigrationComplete')) {
        try {
          final old =
              await const MethodChannel('jp.thinkingnote.coach/migration')
                  .invokeMapMethod<String, dynamic>('readLegacyData');
          if (old != null) {
            if (!prefs!.containsKey('flutterRecords') &&
                old['records'] is String) {
              final decoded =
                  (jsonDecode(old['records'] as String) as List).map((item) {
                final record = Map<String, dynamic>.from(item as Map);
                record['index'] ??= record['errorIndex'];
                return record;
              }).toList();
              await prefs!.setString('flutterRecords', jsonEncode(decoded));
            }
            if (!prefs!.containsKey('serverURL') && old['serverURL'] is String) {
              await prefs!.setString('serverURL', old['serverURL'] as String);
            }
          }
          await prefs!.setBool('nativeMigrationComplete', true);
        } on MissingPluginException {
          /* Non-mobile previews have no legacy data. */
        }
      }
      final raw = prefs!.getString('flutterRecords');
      if (raw != null) {
        records = (jsonDecode(raw) as List)
            .map((e) => Map<String, dynamic>.from(e as Map))
            .toList();
      }
      server.text = prefs!.getString('serverURL') ?? '';
    } catch (_) {
      if (mounted) message('保存データを読み込めませんでした。');
    }
    if (mounted) setState(() => loading = false);
  }

  @override
  void dispose() {
    name.dispose();
    lines.dispose();
    server.dispose();
    super.dispose();
  }

  void message(String text) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));
  }

  Future<void> saveRecords() async {
    await prefs?.setString('flutterRecords', jsonEncode(records));
  }

  void switchPage(int index) {
    FocusManager.instance.primaryFocus?.unfocus();
    setState(() => page = index);
  }

  Future<void> submit() async {
    final student = name.text.trim(),
        rows = lines.text
            .split('\n')
            .map((e) => e.trim())
            .where((e) => e.isNotEmpty)
            .toList();
    if (student.isEmpty || rows.length < 2) {
      message('名前と2行以上の途中式を入力してください。');
      return;
    }
    final base = Uri.tryParse(server.text.trim());
    if (base == null ||
        !['http', 'https'].contains(base.scheme) ||
        base.host.isEmpty) {
      message('設定画面で解析サーバーのURLを入力してください。');
      return;
    }
    setState(() => busy = true);
    FocusManager.instance.primaryFocus?.unfocus();
    final client = HttpClient();
    try {
      final request = await client
          .postUrl(base.resolve('/api/analyze'))
          .timeout(const Duration(seconds: 15));
      request.headers.contentType = ContentType.json;
      request.write(jsonEncode({'lines': rows}));
      final response =
          await request.close().timeout(const Duration(seconds: 30));
      final data = jsonDecode(await response.transform(utf8.decoder).join())
          as Map<String, dynamic>;
      if (response.statusCode != 200 ||
          !['correct', 'mistake', 'review'].contains(data['status'])) {
        throw const FormatException();
      }
      records.add({
        'name': student,
        'lines': rows,
        'category': selected,
        'status': data['status'],
        'index': data['index'],
        'correctLines': data['correctLines'] ?? 0,
        'date': DateTime.now().toIso8601String()
      });
      await saveRecords();
      name.clear();
      lines.clear();
      selected = 'other';
      if (mounted) {
        switchPage(2);
        message('答案を確認しました。');
      }
    } catch (_) {
      if (mounted) message('解析できませんでした。サーバーの接続先と起動状態を確認してください。');
    } finally {
      client.close(force: true);
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final pages = [home(), input(), list(), reflection(), settings()];
    return Scaffold(
        body: SafeArea(
            child: loading
                ? const Center(child: CircularProgressIndicator())
                : IndexedStack(index: page, children: pages)),
        bottomNavigationBar: NavigationBar(
            selectedIndex: page,
            onDestinationSelected: switchPage,
            destinations: const [
              NavigationDestination(
                  icon: Icon(Icons.grid_view_rounded), label: 'ホーム'),
              NavigationDestination(
                  icon: Icon(Icons.edit_note_rounded), label: '入力'),
              NavigationDestination(
                  icon: Icon(Icons.view_list_rounded), label: '一覧'),
              NavigationDestination(
                  icon: Icon(Icons.bar_chart_rounded), label: '振り返り'),
              NavigationDestination(
                  icon: Icon(Icons.settings_outlined), label: '設定')
            ]));
  }

  Widget screen(String title, List<Widget> children) => LayoutBuilder(
      builder: (context, constraints) => SingleChildScrollView(
          keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 28),
          child: Center(
              child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 640),
                  child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text(title,
                            style: Theme.of(context)
                                .textTheme
                                .headlineSmall
                                ?.copyWith(
                                    fontWeight: FontWeight.bold,
                                    color: const Color(0xff263d31))),
                        const SizedBox(height: 20),
                        ...children
                      ])))));
  Widget box(Widget child, {Color color = Colors.white}) => Container(
      padding: const EdgeInsets.all(18),
      decoration:
          BoxDecoration(color: color, borderRadius: BorderRadius.circular(18)),
      child: child);
  Widget gap([double size = 14]) => SizedBox(height: size);
  Widget metric(String label, int value) => Expanded(
          child: box(
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(label,
            style: const TextStyle(color: Colors.black54, fontSize: 12)),
        gap(8),
        Text('$value',
            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 24))
      ])));
  Widget home() {
    final review = records.where((r) => r['status'] == 'review').length,
        correct = records.where((r) => r['status'] == 'correct').length;
    final grouped = <String, Set<String>>{};
    for (final r in records.where((r) => r['status'] == 'mistake')) {
      grouped
          .putIfAbsent(r['category'] as String, () => {})
          .add(r['name'] as String);
    }
    return screen('考えるノート', [
      box(
          const Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('SMALL STEPS, BIG GROWTH',
                style: TextStyle(
                    color: green,
                    fontWeight: FontWeight.bold,
                    fontSize: 10,
                    letterSpacing: 1)),
            SizedBox(height: 10),
            Text('一人ひとりの「わかった」を、\n次の授業につなげよう。',
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
            SizedBox(height: 8),
            Text('答えではなく、考えるきっかけを。', style: TextStyle(color: Colors.black54))
          ]),
          color: const Color(0xffe8f2e9)),
      gap(16),
      Row(children: [
        metric('答案', records.length),
        gapHorizontal(),
        metric('要確認', review),
        gapHorizontal(),
        metric('確認済み', correct)
      ]),
      gap(24),
      const Text('クラスのつまずき',
          style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
      gap(),
      box(grouped.isEmpty
          ? const Text('まだ答案がありません。\n答案を入力すると、ここに傾向が表示されます。',
              style: TextStyle(color: Colors.black54, height: 1.6))
          : Column(
              children: grouped.entries.map((e) {
              final c = categories[e.key] ?? categories['other']!;
              return ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text(c.$1),
                  subtitle: Text('さかのぼる学び：${c.$2}'),
                  trailing: Text('${e.value.length}人'));
            }).toList())),
      gap(),
      FilledButton.icon(
          onPressed: () => switchPage(1),
          icon: const Icon(Icons.add),
          label: const Text('答案を入力する'),
          style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(52)))
    ]);
  }

  Widget gapHorizontal() => const SizedBox(width: 8);
  Widget input() => screen('答案を入力', [
        const Text('生徒名'),
        gap(6),
        TextField(
            controller: name,
            decoration: const InputDecoration(hintText: '例：山田 はな'),
            textInputAction: TextInputAction.next),
        gap(),
        const Text('途中式（1行に1つ）'),
        gap(6),
        TextField(
            controller: lines,
            minLines: 4,
            maxLines: 8,
            keyboardType: TextInputType.multiline,
            decoration: const InputDecoration(hintText: '2x+3=7\n2x=4\nx=2')),
        gap(),
        const Text('つまずきの分類（先生が確認）'),
        gap(6),
        DropdownButtonFormField<String>(
            initialValue: selected,
            decoration: const InputDecoration(),
            items: categories.entries
                .map((e) =>
                    DropdownMenuItem(value: e.key, child: Text(e.value.$1)))
                .toList(),
            onChanged: (value) => setState(() => selected = value ?? 'other')),
        gap(20),
        FilledButton(
            onPressed: busy ? null : submit,
            style:
                FilledButton.styleFrom(minimumSize: const Size.fromHeight(52)),
            child: Text(busy ? '確認中…' : '途中式を確認する')),
        gap(),
        const Text('画像・PDFの取り込みは未対応です。実際の生徒データは使用しないでください。',
            style: TextStyle(color: Colors.black54, fontSize: 12, height: 1.5))
      ]);
  String status(Map<String, dynamic> r) => r['status'] == 'mistake'
      ? (categories[r['category']] ?? categories['other']!).$1
      : r['status'] == 'review'
          ? '要確認'
          : '確認済み';
  Widget list() => screen('提出一覧', [
        const Text('答案を選んで、考えた過程を確認しましょう。',
            style: TextStyle(color: Colors.black54)),
        gap(),
        if (records.isEmpty)
          box(const Text('まだ答案がありません。\n入力画面から始めましょう。',
              style: TextStyle(height: 1.6, color: Colors.black54)))
        else
          ...records.reversed.map((r) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Card(
                  child: ListTile(
                      contentPadding: const EdgeInsets.symmetric(
                          horizontal: 18, vertical: 6),
                      title: Text('${r['name']} さん'),
                      subtitle: Text(status(r)),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () => detail(r)))))
      ]);
  void detail(Map<String, dynamic> r) {
    final c = categories[r['category']] ?? categories['other']!;
    Navigator.of(context).push(MaterialPageRoute(
        builder: (context) => Scaffold(
            appBar: AppBar(title: Text('${r['name']} さんの答案')),
            body: SafeArea(
                child: SingleChildScrollView(
                    padding: const EdgeInsets.all(20),
                    child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          box(Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                for (final (i, line)
                                    in (r['lines'] as List).indexed)
                                  Padding(
                                      padding: const EdgeInsets.symmetric(
                                          vertical: 6),
                                      child: Text(
                                          '${i + 1}. $line${i == r['index'] ? '　← 見直そう' : ''}',
                                          style: TextStyle(
                                              fontSize: 18,
                                              color: i == r['index']
                                                  ? Colors.deepOrange
                                                  : Colors.black87)))
                              ])),
                          gap(),
                          box(
                              Text(
                                  r['status'] == 'mistake'
                                      ? '考えてみよう\n${c.$3}\n\nさかのぼる学び：${c.$2}'
                                      : r['status'] == 'review'
                                          ? '式を検証できませんでした。式を確認してください。'
                                          : '各行の変形を確認できました。',
                                  style: const TextStyle(height: 1.6)),
                              color: const Color(0xffeaf4eb)),
                          gap(),
                          OutlinedButton(
                              onPressed: () async {
                                final confirm = await showDialog<bool>(
                                    context: context,
                                    builder: (c) => AlertDialog(
                                            title: const Text('答案を削除しますか？'),
                                            content: const Text('この端末から削除します。'),
                                            actions: [
                                              TextButton(
                                                  onPressed: () =>
                                                      Navigator.pop(c, false),
                                                  child: const Text('キャンセル')),
                                              TextButton(
                                                  onPressed: () =>
                                                      Navigator.pop(c, true),
                                                  child: const Text('削除'))
                                            ]));
                                if (confirm == true) {
                                  records.remove(r);
                                  await saveRecords();
                                  if (context.mounted) Navigator.pop(context);
                                  if (mounted) setState(() {});
                                }
                              },
                              child: const Text('この答案を削除'))
                        ]))))));
  }

  Widget reflection() {
    final totals = <String, (int, int)>{};
    for (final r in records) {
      final n = r['name'] as String;
      final t = totals[n] ?? (0, 0);
      totals[n] = (t.$1 + 1, t.$2 + (r['correctLines'] as num).toInt());
    }
    return screen('学びの振り返り', [
      const Text('小さな進歩を、一緒に見つけましょう。', style: TextStyle(color: Colors.black54)),
      gap(),
      if (totals.isEmpty)
        box(const Text('答案を入力すると、ここに記録が表示されます。'))
      else
        ...totals.entries.map((e) => Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: box(Text(
                '${e.key} さん\n取り組んだ答案：${e.value.$1}件\n確かめられた行：${e.value.$2}行',
                style: const TextStyle(height: 1.8)))))
    ]);
  }

  Widget settings() => screen('設定', [
        const Text('解析サーバーURL'),
        gap(6),
        TextField(
            controller: server,
            keyboardType: TextInputType.url,
            autocorrect: false,
            decoration:
                const InputDecoration(hintText: 'http://192.168.1.10:8080')),
        gap(),
        FilledButton(
            onPressed: () async {
              final uri = Uri.tryParse(server.text.trim());
              if (uri == null ||
                  !['http', 'https'].contains(uri.scheme) ||
                  uri.host.isEmpty) {
                message('httpまたはhttpsのURLを入力してください。');
                return;
              }
              await prefs?.setString('serverURL', server.text.trim());
              if (mounted) {
                FocusManager.instance.primaryFocus?.unfocus();
                message('保存しました。');
              }
            },
            child: const Text('保存')),
        gap(),
        const Text(
            'PCと同じWi-Fiでサーバーを起動し、PCのIPアドレスを入力します。認証・暗号化がない環境では実際の生徒データを使用しないでください。',
            style: TextStyle(color: Colors.black54, height: 1.6))
      ]);
}
