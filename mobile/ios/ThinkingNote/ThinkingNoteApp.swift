import SwiftUI

struct Record: Identifiable, Codable {
    var id = UUID(); var name: String; var lines: [String]; var category: String; var status: String; var errorIndex: Int?; var correctLines: Int; var date = Date()
}
struct Analysis: Decodable { var status: String; var index: Int?; var correctLines: Int? }
struct Category: Identifiable { var id: String; var name: String; var topic: String; var question: String }
let categories = [
    Category(id:"transpose",name:"移項の符号",topic:"正負の数の加減・等式の性質",question:"この行では、両辺にそれぞれ何をしましたか？"),
    Category(id:"distribute",name:"分配法則",topic:"文字式・分配法則",question:"かっこの外の数は、中のそれぞれの項にどう関わっていますか？"),
    Category(id:"bracket",name:"かっこの符号",topic:"正負の数・文字式の加減",question:"かっこの前の符号は、中の各項にどう関わっていますか？"),
    Category(id:"combine",name:"同類項の計算",topic:"文字式の加法と減法",question:"まとめられる項はどれですか？"),
    Category(id:"arithmetic",name:"正負の数の計算",topic:"正負の数の四則計算",question:"数の計算を符号にも気をつけて確かめられますか？"),
    Category(id:"division",name:"係数で割る",topic:"等式の性質・除法",question:"両辺を同じ数で割れていますか？"),
    Category(id:"fraction",name:"分数・小数の計算",topic:"分数と小数の四則計算",question:"分数や小数の計算を確かめられますか？"),
    Category(id:"equal",name:"等号の使い方",topic:"等式の意味と性質",question:"等号の左右は、いつも同じ値を表していますか？"),
    Category(id:"copy",name:"書き写し",topic:"式の読み取りと表現",question:"前の行の数字や記号を比べてみましょう。"),
    Category(id:"other",name:"その他・分類待ち",topic:"一次方程式の変形",question:"一つ前の行から、両辺に何をしたか説明できますか？")
]
func category(_ id: String) -> Category { categories.first { $0.id == id } ?? categories.last! }
@MainActor final class Store: ObservableObject {
    @Published var records: [Record] = [] { didSet { if let data = try? JSONEncoder().encode(records) { UserDefaults.standard.set(data, forKey: "nativeRecords") } } }
    @Published var serverURL = UserDefaults.standard.string(forKey: "serverURL") ?? "" { didSet { UserDefaults.standard.set(serverURL, forKey: "serverURL") } }
    init() { if let data = UserDefaults.standard.data(forKey: "nativeRecords"), let saved = try? JSONDecoder().decode([Record].self, from: data) { records = saved } }
    func analyze(name: String, lines: [String], category: String) async throws {
        guard let base = URL(string: serverURL), ["http","https"].contains(base.scheme?.lowercased() ?? ""), base.host != nil, let url = URL(string: "/api/analyze", relativeTo: base) else { throw AppError.message("設定で解析サーバーのURLを入力してください。") }
        var request = URLRequest(url: url); request.httpMethod = "POST"; request.setValue("application/json", forHTTPHeaderField: "Content-Type"); request.httpBody = try JSONEncoder().encode(["lines": lines])
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, http.statusCode == 200 else { throw AppError.message("解析サーバーに接続できませんでした。") }
        let result = try JSONDecoder().decode(Analysis.self, from: data)
        records.append(Record(name: name, lines: lines, category: category, status: result.status, errorIndex: result.index, correctLines: result.correctLines ?? 0))
    }
}
enum AppError: LocalizedError { case message(String); var errorDescription: String? { if case .message(let message) = self { return message }; return nil } }
@main struct ThinkingNoteApp: App {
    @StateObject private var store = Store()
    var body: some Scene { WindowGroup { RootView().environmentObject(store).tint(Color(red:0.15,green:0.41,blue:0.31)) } }
}
struct RootView: View {
    var body: some View { TabView {
        DashboardView().tabItem { Label("ホーム", systemImage:"square.grid.2x2") }
        InputView().tabItem { Label("答案入力", systemImage:"square.and.pencil") }
        RecordsView().tabItem { Label("提出一覧", systemImage:"list.bullet.rectangle") }
        ReflectionView().tabItem { Label("振り返り", systemImage:"chart.bar") }
        SettingsView().tabItem { Label("設定", systemImage:"gearshape") }
    }.toolbarBackground(.visible, for: .tabBar) }
}
struct DashboardView: View {
    @EnvironmentObject var store: Store
    var body: some View {
        NavigationStack { ScrollView { VStack(alignment:.leading,spacing:20) {
            VStack(alignment:.leading,spacing:8) { Text("SMALL STEPS, BIG GROWTH").font(.caption.bold()).foregroundStyle(.secondary); Text("一人ひとりの「わかった」を、\n次の授業につなげよう。").font(.title2.bold()); Text("答えではなく、考えるきっかけを。先生の次の一手を支えます。").font(.subheadline).foregroundStyle(.secondary) }.frame(maxWidth:.infinity,alignment:.leading).padding(22).background(Color.green.opacity(0.10),in:RoundedRectangle(cornerRadius:18))
            HStack { metric("答案",store.records.count); metric("要確認",store.records.filter{$0.status == "review"}.count); metric("確認済み",store.records.filter{$0.status == "correct"}.count) }
            Text("クラスのつまずき").font(.headline)
            let counts = categories.map { c in (c, Set(store.records.filter{$0.status == "mistake" && $0.category == c.id}.map{$0.name}).count) }.filter{$0.1 > 0}.sorted{$0.1 > $1.1}
            if counts.isEmpty { Text("答案を入力すると、ここに傾向が表示されます。\n分類は先生が確認してください。").foregroundStyle(.secondary).font(.subheadline) }
            ForEach(counts, id:\.0.id) { c, count in HStack { VStack(alignment:.leading) { Text(c.name).bold(); Text("さかのぼる学び：\(c.topic)").font(.caption).foregroundStyle(.secondary) }; Spacer(); Text("\(count)人").bold() }.padding().background(.background,in:RoundedRectangle(cornerRadius:12)) }
        }.padding() }.background(Color(uiColor:.systemGroupedBackground)).navigationTitle("考えるノート") }
    }
    func metric(_ label:String,_ value:Int) -> some View { VStack(alignment:.leading,spacing:8) { Text(label).font(.caption).foregroundStyle(.secondary); Text("\(value)").font(.title.bold()) }.frame(maxWidth:.infinity,alignment:.leading).padding().background(.background,in:RoundedRectangle(cornerRadius:12)) }
}
struct InputView: View {
    @EnvironmentObject var store: Store
    @State private var name = ""; @State private var lines = ""; @State private var selected = "other"; @State private var busy = false; @State private var message = ""
    @FocusState private var inputFocused: Bool
    var body: some View { NavigationStack { Form {
        Section("生徒名") { TextField("例：山田 はな",text:$name).focused($inputFocused) }
        Section { TextEditor(text:$lines).frame(minHeight:110).focused($inputFocused).textInputAutocapitalization(.never).autocorrectionDisabled() } header: { Text("途中式（1行に1つ）") } footer: { Text("例：2x+3=7 → 2x=4 → x=2（改行して入力）") }
        Section("つまずきの分類（先生が確認）") { Picker("分類",selection:$selected) { ForEach(categories) { Text($0.name).tag($0.id) } } }
        Section { Button { inputFocused = false; submit() } label: { HStack { Spacer(); if busy { ProgressView().tint(.white) }; Text(busy ? "確認中…" : "途中式を確認する").fontWeight(.semibold); Spacer() }.padding(.vertical, 6) }.listRowBackground(Color(red:0.15,green:0.41,blue:0.31)).foregroundStyle(.white).disabled(busy) }
        Section { Text("画像・PDFの取り込みはネイティブ版では未対応です。途中式を入力してください。実際の生徒データは使用しないでください。") .font(.footnote).foregroundStyle(.secondary) }
    }.scrollDismissesKeyboard(.interactively).navigationTitle("答案を入力").navigationBarTitleDisplayMode(.inline).toolbar { ToolbarItemGroup(placement: .keyboard) { Spacer(); Button("完了") { inputFocused = false } } }.alert("お知らせ",isPresented:Binding(get:{!message.isEmpty},set:{if !$0 {message=""}})) { Button("OK",role:.cancel) {} } message: { Text(message) } } }
    func submit() { let n=name.trimmingCharacters(in:.whitespacesAndNewlines); let rows=lines.components(separatedBy:.newlines).map{$0.trimmingCharacters(in:.whitespacesAndNewlines)}.filter{!$0.isEmpty}; guard !n.isEmpty && rows.count >= 2 else { message="名前と2行以上の途中式を入力してください。"; return }; busy=true; Task { do { try await store.analyze(name:n,lines:rows,category:selected); name=""; lines=""; message="答案を確認しました。提出一覧から結果を見られます。" } catch { message=error.localizedDescription }; busy=false } }
}
struct RecordsView: View {
    @EnvironmentObject var store: Store
    var body: some View { NavigationStack { List { if store.records.isEmpty { Text("答案はまだありません。").foregroundStyle(.secondary) }; ForEach(store.records.reversed()) { record in NavigationLink { DetailView(record:record) } label: { VStack(alignment:.leading,spacing:5) { Text(record.name).bold(); Text(record.status == "mistake" ? category(record.category).name : record.status == "review" ? "要確認" : "確認済み").font(.caption).foregroundStyle(.secondary) } } }.onDelete { offsets in let reversed = Array(store.records.reversed()); let ids=offsets.map{reversed[$0].id}; store.records.removeAll{ids.contains($0.id)} } }.navigationTitle("提出一覧") } }
}
struct DetailView: View {
    var record: Record
    var body: some View { List { Section("途中式") { ForEach(Array(record.lines.enumerated()),id:\.offset) { i,line in HStack { Text("\(i+1).").foregroundStyle(.secondary); Text(line).font(.system(.body,design:.monospaced)); if i == record.errorIndex { Spacer(); Text("見直そう").font(.caption).foregroundStyle(.orange) } } } }; if record.status == "mistake" { Section("考えてみよう") { Text(category(record.category).question); Text("さかのぼる学び：\(category(record.category).topic)").font(.caption).foregroundStyle(.secondary) } } else if record.status == "review" { Section { Text("式を検証できませんでした。読み取りや式を確認してください。") } } else { Section("いいところを見つけました") { Text("各行の変形を確認できました。考えた過程を残せていますね。") } } }.navigationTitle(record.name) }
}
struct ReflectionView: View {
    @EnvironmentObject var store: Store
    @State private var selected = ""
    var body: some View { NavigationStack { Form { Section("生徒を選択") { Picker("生徒",selection:$selected) { Text("選択してください").tag(""); ForEach(Array(Set(store.records.map{$0.name})).sorted(),id:\.self) { Text($0).tag($0) } } }; if !selected.isEmpty { let records=store.records.filter{$0.name == selected}; Section("ここまでのがんばり") { Text("取り組んだ答案：\(records.count)件"); Text("確かめられた行：\(records.reduce(0){$0+$1.correctLines})行") }; Section("これまでの記録") { ForEach(records.reversed()) { r in HStack { Text(r.date,style:.date); Spacer(); Text(r.status == "mistake" ? category(r.category).name : r.status == "review" ? "要確認" : "確認済み").foregroundStyle(.secondary) } } } } }.navigationTitle("学びの振り返り") } }
}
struct SettingsView: View {
    @EnvironmentObject var store: Store
    var body: some View { NavigationStack { Form { Section("解析サーバーURL") { TextField("http://192.168.1.10:8080",text:$store.serverURL).textInputAutocapitalization(.never).autocorrectionDisabled().keyboardType(.URL); Text("PCと同じWi-Fiでサーバーを起動し、PCのIPアドレスを入力します。").font(.footnote).foregroundStyle(.secondary) }; Section("このアプリについて") { Text("答案はこの端末に保存されます。解析にはサーバーへの接続が必要です。認証・暗号化がない環境では実際の生徒データを使わないでください。") } }.navigationTitle("設定") } }
}
