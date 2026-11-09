package jp.thinkingnote.coach;

import android.app.*;
import android.os.Bundle;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.content.res.ColorStateList;
import android.text.Editable;
import android.text.TextWatcher;
import android.view.*;
import android.widget.*;
import org.json.*;
import java.net.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;

public class MainActivity extends Activity {
    private LinearLayout root, content, tabs;
    private ScrollView scroll;
    private int currentPage = 0;
    private String draftName = "", draftLines = "";
    private int draftCategory = 9;
    private static final int GREEN = 0xff26694f, INK = 0xff263d31, MUTED = 0xff718779, BACK = 0xfff6f8f5;
    private JSONArray records;
    private final String[] names = {"移項の符号", "分配法則", "かっこの符号", "同類項の計算", "正負の数の計算", "係数で割る", "分数・小数の計算", "等号の使い方", "書き写し", "その他・分類待ち"};
    private final String[] ids = {"transpose","distribute","bracket","combine","arithmetic","division","fraction","equal","copy","other"};
    private final String[] questions = {"この行では、両辺にそれぞれ何をしましたか？","かっこの外の数は、中のそれぞれの項にどう関わっていますか？","かっこの前の符号は、中の各項にどう関わっていますか？","まとめられる項はどれですか？","数の計算を符号にも気をつけて確かめられますか？","両辺を同じ数で割れていますか？","分数や小数の計算を確かめられますか？","等号の左右は、いつも同じ値を表していますか？","前の行の数字や記号を比べてみましょう。","一つ前の行から、両辺に何をしたか説明できますか？"};
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        if(state != null) { draftName=state.getString("draftName",""); draftLines=state.getString("draftLines",""); draftCategory=state.getInt("draftCategory",9); currentPage=state.getInt("currentPage",0); }
        try { records = new JSONArray(getPreferences(MODE_PRIVATE).getString("nativeRecords", "[]")); } catch (JSONException e) { records = new JSONArray(); }
        getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
        getWindow().setStatusBarColor(BACK); getWindow().setNavigationBarColor(Color.WHITE);
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
        root = new LinearLayout(this); root.setOrientation(LinearLayout.VERTICAL); root.setBackgroundColor(BACK);
        root.setOnApplyWindowInsetsListener((v, insets) -> {
            if (android.os.Build.VERSION.SDK_INT >= 30) { android.graphics.Insets bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout()); android.graphics.Insets ime = insets.getInsets(WindowInsets.Type.ime()); v.setPadding(bars.left, bars.top, bars.right, Math.max(bars.bottom, ime.bottom)); }
            else v.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(), insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            return insets;
        });
        scroll = new ScrollView(this); scroll.setFillViewport(true); content = new LinearLayout(this); content.setOrientation(LinearLayout.VERTICAL); content.setPadding(dp(20),dp(18),dp(20),dp(24)); scroll.addView(content);
        tabs = new LinearLayout(this); tabs.setOrientation(LinearLayout.HORIZONTAL); tabs.setBackgroundColor(Color.WHITE); tabs.setPadding(dp(4),dp(6),dp(4),dp(6)); tabs.setElevation(dp(8));
        root.addView(scroll,new LinearLayout.LayoutParams(-1,0,1)); root.addView(tabs); setContentView(root); show(currentPage);
    }
    @Override protected void onSaveInstanceState(Bundle state) { super.onSaveInstanceState(state); state.putString("draftName",draftName); state.putString("draftLines",draftLines); state.putInt("draftCategory",draftCategory); state.putInt("currentPage",currentPage); }
    private int dp(float value) { return (int)(getResources().getDisplayMetrics().density * value + 0.5f); }
    private GradientDrawable shape(int color, int radius) { GradientDrawable d = new GradientDrawable(); d.setColor(color); d.setCornerRadius(dp(radius)); return d; }
    private LinearLayout card(int color) { LinearLayout box = new LinearLayout(this); box.setOrientation(LinearLayout.VERTICAL); box.setPadding(dp(18),dp(14),dp(18),dp(14)); box.setBackground(shape(color,16)); LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(-1,-2); p.bottomMargin=dp(12); content.addView(box,p); return box; }
    private void renderTabs() {
        tabs.removeAllViews(); String[] labels={"ホーム","入力","一覧","振り返り","設定"}; String[] icons={"⌂","✎","▤","▥","⚙"};
        for(int i=0;i<labels.length;i++){final int page=i; LinearLayout item=new LinearLayout(this); item.setOrientation(LinearLayout.VERTICAL); item.setGravity(Gravity.CENTER); item.setPadding(0,dp(5),0,dp(5)); item.setMinimumHeight(dp(54)); item.setBackground(shape(i==currentPage?0xffe8f2ea:Color.TRANSPARENT,14)); TextView icon=text(icons[i],21); icon.setGravity(Gravity.CENTER); icon.setPadding(0,0,0,0); icon.setTextColor(i==currentPage?GREEN:MUTED); TextView label=text(labels[i],10); label.setGravity(Gravity.CENTER); label.setPadding(0,0,0,0); label.setTextColor(i==currentPage?GREEN:MUTED); item.addView(icon); item.addView(label); item.setContentDescription(labels[i]); item.setOnClickListener(v -> show(page)); tabs.addView(item,new LinearLayout.LayoutParams(0,-2,1)); }
    }
    private void save() { getPreferences(MODE_PRIVATE).edit().putString("nativeRecords",records.toString()).apply(); }
    private TextView text(String value, int size) { TextView v=new TextView(this); v.setText(value); v.setTextSize(size); v.setTextColor(INK); v.setPadding(0,dp(5),0,dp(5)); return v; }
    private void title(String value) { TextView t=text(value,24); t.setTypeface(null,Typeface.BOLD); t.setPadding(0,dp(3),0,dp(16)); content.addView(t); }
    private EditText field(String hint, boolean multiline) { EditText e=new EditText(this); e.setHint(hint); e.setSingleLine(!multiline); e.setTextSize(16); e.setTextColor(INK); e.setHintTextColor(0xff9aa99f); e.setBackground(shape(Color.WHITE,12)); e.setPadding(dp(16),dp(14),dp(16),dp(14)); if(multiline){e.setMinLines(4);e.setGravity(Gravity.TOP); e.setInputType(android.text.InputType.TYPE_CLASS_TEXT | android.text.InputType.TYPE_TEXT_FLAG_MULTI_LINE | android.text.InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS);} LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-1,-2); p.bottomMargin=dp(14); content.addView(e,p); return e; }
    private Button button(String label, Runnable action) { Button b=new Button(this); b.setText(label); b.setAllCaps(false); b.setTextColor(Color.WHITE); b.setTextSize(15); b.setTypeface(null,Typeface.BOLD); b.setBackgroundTintList(ColorStateList.valueOf(GREEN)); b.setMinHeight(dp(52)); LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-1,-2); p.setMargins(0,dp(6),0,dp(12)); content.addView(b,p); b.setOnClickListener(v -> action.run()); return b; }
    private void show(int page) { View focused=getCurrentFocus(); if(focused!=null){ android.view.inputmethod.InputMethodManager keyboard=(android.view.inputmethod.InputMethodManager)getSystemService(INPUT_METHOD_SERVICE); if(keyboard!=null)keyboard.hideSoftInputFromWindow(focused.getWindowToken(),0); focused.clearFocus(); } currentPage=page; renderTabs(); content.removeAllViews(); scroll.scrollTo(0,0); if(page==0) home(); else if(page==1) input(); else if(page==2) list(); else if(page==3) reflection(); else settings(); }
    private int categoryIndex(String id) { for(int i=0;i<ids.length;i++) if(ids[i].equals(id)) return i; return ids.length-1; }
    private void home() {
        title("考えるノート"); LinearLayout hero=card(0xffe8f2e9); TextView over=text("SMALL STEPS, BIG GROWTH",10); over.setTextColor(GREEN); over.setTypeface(null,Typeface.BOLD); hero.addView(over); TextView headline=text("一人ひとりの『わかった』を、\n次の授業につなげよう。",20); headline.setTypeface(null,Typeface.BOLD); hero.addView(headline); TextView intro=text("答えではなく、考えるきっかけを。",13); intro.setTextColor(MUTED); hero.addView(intro);
        int review=0, correct=0; Map<String,Set<String>> counts=new LinkedHashMap<>();
        for(int i=0;i<records.length();i++){JSONObject r=records.optJSONObject(i); if(r==null) continue; String s=r.optString("status"); if(s.equals("review"))review++; if(s.equals("correct"))correct++; if(s.equals("mistake")) counts.computeIfAbsent(r.optString("category"),k->new HashSet<>()).add(r.optString("name"));}
        LinearLayout stats=new LinearLayout(this); stats.setOrientation(LinearLayout.HORIZONTAL); String[] labels={"答案","要確認","確認済み"}; int[] values={records.length(),review,correct}; for(int i=0;i<labels.length;i++){LinearLayout tile=new LinearLayout(this); tile.setOrientation(LinearLayout.VERTICAL); tile.setPadding(dp(12),dp(12),dp(12),dp(12)); tile.setBackground(shape(Color.WHITE,14)); TextView label=text(labels[i],12); label.setTextColor(MUTED); tile.addView(label); TextView value=text(values[i]+"件",20); value.setTypeface(null,Typeface.BOLD); tile.addView(value); LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(0,-2,1); if(i<2)p.rightMargin=dp(8); stats.addView(tile,p); } LinearLayout.LayoutParams sp=new LinearLayout.LayoutParams(-1,-2);sp.bottomMargin=dp(20);content.addView(stats,sp);
        TextView section=text("クラスのつまずき",18); section.setTypeface(null,Typeface.BOLD); content.addView(section); LinearLayout summary=card(Color.WHITE);
        if(counts.isEmpty()){ TextView empty=text("まだ答案がありません\n答案を入力すると、ここに傾向が表示されます。",14); empty.setTextColor(MUTED); empty.setPadding(0,dp(14),0,dp(14)); summary.addView(empty); }
        for(Map.Entry<String,Set<String>> e:counts.entrySet()) summary.addView(text(names[categoryIndex(e.getKey())]+"　　"+e.getValue().size()+"人",16));
        TextView note=text("分類は先生が確認してください。",12); note.setTextColor(MUTED); summary.addView(note);
        button("＋　答案を入力する",()->show(1));
    }
    private void input() {
        title("答案を入力"); content.addView(text("生徒名",14)); EditText name=field("例：山田 はな",false); name.setText(draftName); content.addView(text("途中式（1行に1つ）",14)); EditText lines=field("2x+3=7\n2x=4\nx=2",true); lines.setText(draftLines);
        name.addTextChangedListener(watch(value -> draftName=value)); lines.addTextChangedListener(watch(value -> draftLines=value));
        content.addView(text("つまずきの分類（先生が確認）",14)); Spinner spinner=new Spinner(this); spinner.setAdapter(new ArrayAdapter<>(this,android.R.layout.simple_spinner_dropdown_item,names)); spinner.setBackground(shape(Color.WHITE,12)); spinner.setPadding(dp(12),dp(8),dp(12),dp(8)); spinner.setMinimumHeight(dp(52)); spinner.setSelection(draftCategory); spinner.setOnItemSelectedListener(new android.widget.AdapterView.OnItemSelectedListener(){public void onItemSelected(android.widget.AdapterView<?> parent,View view,int position,long id){draftCategory=position;}public void onNothingSelected(android.widget.AdapterView<?> parent){}}); content.addView(spinner);
        Button submit=button("途中式を確認する",()->{});
        submit.setOnClickListener(v->{String student=name.getText().toString().trim(); String[] rows=lines.getText().toString().trim().split("\\n");
            if(student.isEmpty()||rows.length<2){toast("名前と2行以上の途中式を入力してください。");return;}
            String server=getPreferences(MODE_PRIVATE).getString("serverURL",""); String selected=ids[spinner.getSelectedItemPosition()]; submit.setEnabled(false);
            new Thread(()->{try{
                URL base=new URL(server); if(!base.getProtocol().equals("http")&&!base.getProtocol().equals("https"))throw new IOException("URLはhttpまたはhttpsを指定してください。");
                HttpURLConnection connection=(HttpURLConnection)new URL(base,"/api/analyze").openConnection(); connection.setRequestMethod("POST"); connection.setConnectTimeout(10000); connection.setReadTimeout(20000); connection.setDoOutput(true); connection.setRequestProperty("Content-Type","application/json");
                JSONArray arr=new JSONArray(); for(String row:rows)arr.put(row.trim()); JSONObject request=new JSONObject().put("lines",arr);
                try(OutputStream out=connection.getOutputStream()){out.write(request.toString().getBytes(StandardCharsets.UTF_8));}
                if(connection.getResponseCode()!=200)throw new IOException("解析サーバーからエラーが返りました。");
                ByteArrayOutputStream result=new ByteArrayOutputStream(); try(InputStream in=connection.getInputStream()){byte[] buffer=new byte[4096];int n;while((n=in.read(buffer))!=-1)result.write(buffer,0,n);}
                JSONObject response=new JSONObject(result.toString("UTF-8")); JSONObject record=new JSONObject().put("name",student).put("lines",arr).put("category",selected).put("status",response.optString("status","review")).put("index",response.optInt("index",-1)).put("correctLines",response.optInt("correctLines",0));
                runOnUiThread(()->{records.put(record);save();draftName="";draftLines="";draftCategory=9;toast("答案を確認しました。");show(2);});
            } catch(Exception e){runOnUiThread(()->{submit.setEnabled(true);toast("接続できません。設定とサーバーを確認してください。");});}}).start();
        });
        content.addView(text("画像・PDFの取り込みはネイティブ版では未対応です。実際の生徒データは使用しないでください。",13));
    }
    private interface TextChange { void set(String value); }
    private TextWatcher watch(TextChange change) { return new TextWatcher(){public void beforeTextChanged(CharSequence s,int start,int count,int after){} public void onTextChanged(CharSequence s,int start,int before,int count){change.set(s.toString());} public void afterTextChanged(Editable e){} }; }
    private void list() { title("提出一覧"); TextView caption=text("答案を選んで、考えた過程を確認しましょう。",13); caption.setTextColor(MUTED); content.addView(caption); if(records.length()==0){LinearLayout empty=card(Color.WHITE); TextView t=text("まだ答案がありません。\n入力画面から始めましょう。",15);t.setTextColor(MUTED);empty.addView(t);button("答案を入力する",()->show(1));} for(int i=records.length()-1;i>=0;i--){final int index=i;JSONObject r=records.optJSONObject(i);if(r==null)continue;LinearLayout row=card(Color.WHITE);TextView name=text(r.optString("name")+" さん　　›",16);name.setTypeface(null,Typeface.BOLD);row.addView(name);TextView status=text(label(r),13);status.setTextColor(GREEN);row.addView(status);row.setMinimumHeight(dp(76));row.setClickable(true);row.setOnClickListener(v->detail(index));} }
    private String label(JSONObject r){String s=r.optString("status");return s.equals("mistake")?names[categoryIndex(r.optString("category"))]:s.equals("review")?"要確認":"確認済み";}
    private void detail(int index){JSONObject r=records.optJSONObject(index);if(r==null)return;content.removeAllViews();scroll.scrollTo(0,0);title(r.optString("name")+" さんの答案");LinearLayout work=card(Color.WHITE);JSONArray lines=r.optJSONArray("lines");if(lines!=null)for(int i=0;i<lines.length();i++){TextView line=text((i+1)+". "+lines.optString(i)+(i==r.optInt("index",-1)?"　← 見直そう":""),18);if(i==r.optInt("index",-1))line.setTextColor(0xffae664d);work.addView(line);}String s=r.optString("status");LinearLayout question=card(0xffeaf4eb);TextView q=text(s.equals("mistake")?"考えてみよう\n"+questions[categoryIndex(r.optString("category"))]:s.equals("review")?"式を検証できませんでした。確認してください。":"各行の変形を確認できました。",16);question.addView(q);button("一覧に戻る",()->show(2));Button remove=button("この答案を削除",()->new AlertDialog.Builder(this).setMessage("この端末から削除しますか？").setNegativeButton("キャンセル",null).setPositiveButton("削除",(d,w)->{records.remove(index);save();show(2);}).show());remove.setBackgroundTintList(ColorStateList.valueOf(0xffedf2ee));remove.setTextColor(INK);}
    private void reflection(){title("学びの振り返り");TextView intro=text("小さな進歩を、一緒に見つけましょう。",13);intro.setTextColor(MUTED);content.addView(intro);Map<String,int[]> totals=new LinkedHashMap<>();for(int i=0;i<records.length();i++){JSONObject r=records.optJSONObject(i);if(r==null)continue;int[] t=totals.computeIfAbsent(r.optString("name"),k->new int[2]);t[0]++;t[1]+=r.optInt("correctLines");}if(totals.isEmpty()){LinearLayout empty=card(Color.WHITE);empty.addView(text("答案を入力すると、ここに記録が表示されます。",15));}for(Map.Entry<String,int[]> e:totals.entrySet()){LinearLayout row=card(Color.WHITE);TextView n=text(e.getKey()+" さん",16);n.setTypeface(null,Typeface.BOLD);row.addView(n);row.addView(text("取り組んだ答案："+e.getValue()[0]+"件\n確かめられた行："+e.getValue()[1]+"行",14));}}
    private void settings(){title("設定");content.addView(text("解析サーバーURL",16));EditText url=field("http://192.168.1.10:8080",false);url.setText(getPreferences(MODE_PRIVATE).getString("serverURL",""));button("保存",()->{String value=url.getText().toString().trim();try{URL u=new URL(value);if(!u.getProtocol().equals("http")&&!u.getProtocol().equals("https"))throw new Exception();getPreferences(MODE_PRIVATE).edit().putString("serverURL",value).apply();toast("保存しました。");}catch(Exception e){toast("httpまたはhttpsのURLを入力してください。");}});content.addView(text("PCと同じWi-Fiでサーバーを起動し、PCのIPアドレスを入力します。認証・暗号化がない環境で実際の生徒データを使わないでください。",13));}
    private void toast(String value){Toast.makeText(this,value,Toast.LENGTH_LONG).show();}
}
