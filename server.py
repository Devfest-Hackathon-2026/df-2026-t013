#!/usr/bin/env python3
"""Prototype API. Uploaded data is never persisted by this server."""
import ast
import base64
import concurrent.futures
import json
import os
import re
from fractions import Fraction
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent
TAXONOMY = json.loads((ROOT / 'taxonomy.json').read_text())

def linear(node):
    if isinstance(node, ast.Expression): return linear(node.body)
    if isinstance(node, ast.Name) and node.id == 'x': return (Fraction(1), Fraction(0))
    if isinstance(node, ast.Constant) and type(node.value) in (int, float): return (Fraction(0), Fraction(str(node.value)))
    if isinstance(node, ast.UnaryOp) and isinstance(node.op, (ast.USub, ast.UAdd)):
        a, b = linear(node.operand); return (-a, -b) if isinstance(node.op, ast.USub) else (a, b)
    if isinstance(node, ast.BinOp):
        a, b = linear(node.left); c, d = linear(node.right)
        if isinstance(node.op, ast.Add): return a+c, b+d
        if isinstance(node.op, ast.Sub): return a-c, b-d
        if isinstance(node.op, ast.Mult) and not (a and c): return a*d+c*b, b*d
        if isinstance(node.op, ast.Div) and not c and d: return a/d, b/d
    raise ValueError('一次式として読み取れません')

def equation(text):
    text = text.lower().replace('−', '-').replace('－', '-').replace('×', '*').replace('÷', '/').replace('＝', '=').replace(' ', '')
    if len(text) > 200 or text.count('=') != 1 or not re.fullmatch(r'[x0-9.()+*/=\-]+', text): raise ValueError('式を確認してください')
    text = re.sub(r'(?<=[0-9x)])(?=[x(])', '*', text)
    text = re.sub(r'(?<=\))(?=[0-9])', '*', text)
    left, right = text.split('=')
    a, b = linear(ast.parse(left, mode='eval')); c, d = linear(ast.parse(right, mode='eval'))
    if a == c: return ('all',) if b == d else ('none',)
    return ('one', (d-b)/(a-c))

def analyze(lines):
    if not isinstance(lines, list) or len(lines) < 2 or len(lines) > 100: return {'status':'review','error':'途中式を2行以上入力してください。'}
    try:
        solutions = [equation(line) for line in lines]
        for i in range(1, len(solutions)):
            if solutions[i] != solutions[i-1]: return {'status':'mistake','index':i,'correctLines':i}
        return {'status':'correct','index':None,'correctLines':len(lines)}
    except (ValueError, SyntaxError, ZeroDivisionError, RecursionError, TypeError):
        return {'status':'review','error':'式を検証できません。読み取りや入力を確認してください。'}

def vertex_read(data, mime):
    project = os.getenv('GOOGLE_CLOUD_PROJECT'); model = os.getenv('GEMINI_MODEL'); location = os.getenv('GOOGLE_CLOUD_LOCATION', 'global')
    if not project or not model: raise ValueError('Geminiが未設定です。途中式を手入力してください。')
    try:
        import google.auth
        import google.auth.transport.requests
        import requests
    except ImportError: raise ValueError('Gemini用の依存パッケージがありません。READMEの設定を確認してください。')
    credentials, _ = google.auth.default(scopes=['https://www.googleapis.com/auth/cloud-platform'])
    credentials.refresh(google.auth.transport.requests.Request())
    host = 'aiplatform.googleapis.com' if location == 'global' else location + '-aiplatform.googleapis.com'
    url = 'https://%s/v1/projects/%s/locations/%s/publishers/google/models/%s:generateContent' % (host, project, location, model)
    prompt = '中学の一次方程式の手書き答案を上から順に読み取ってください。JSONのみを返す。形式 {"lines":[{"text":"2x+3=7","box":[ymin,xmin,ymax,xmax],"confidence":0.9}],"category":"other"}。boxは画像に対する0から1000の座標。categoryは次から選ぶ: ' + ', '.join(t['id'] for t in TAXONOMY) + '。読めない文字を推測せず確信度を下げる。'
    body = {'contents':[{'role':'user','parts':[{'text':prompt},{'inlineData':{'mimeType':mime,'data':base64.b64encode(data).decode()}}]}], 'generationConfig':{'responseMimeType':'application/json','temperature':0}}
    response = requests.post(url, headers={'Authorization':'Bearer '+credentials.token}, json=body, timeout=90); response.raise_for_status()
    parsed = json.loads(response.json()['candidates'][0]['content']['parts'][0]['text'])
    lines = parsed.get('lines', [])
    if not isinstance(lines, list) or len(lines) > 100: raise ValueError('読み取り結果の形式を確認してください。')
    return {'lines':lines, 'category':parsed.get('category','other')}

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs): super().__init__(*args, directory=str(ROOT), **kwargs)
    def end_headers(self): self.send_header('X-Content-Type-Options', 'nosniff'); super().end_headers()
    def do_GET(self):
        path = urlparse(self.path).path
        if path == '/api/config': return self.reply({'gemini':bool(os.getenv('GOOGLE_CLOUD_PROJECT') and os.getenv('GEMINI_MODEL'))})
        if path not in ('/', '/index.html', '/app.js', '/style.css', '/manifest.webmanifest', '/sw.js', '/icon.svg', '/taxonomy.json'): self.send_error(404); return
        super().do_GET()
    def reply(self, obj, code=200):
        raw = json.dumps(obj, ensure_ascii=False).encode(); self.send_response(code); self.send_header('Content-Type','application/json; charset=utf-8'); self.send_header('Content-Length',str(len(raw))); self.send_header('Cache-Control','no-store'); self.end_headers(); self.wfile.write(raw)
    def do_POST(self):
        if self.path not in ('/api/analyze','/api/read'): self.send_error(404); return
        try:
            length = int(self.headers.get('Content-Length','0'))
            if length <= 0 or length > 20_000_000: raise ValueError('ファイルが大きすぎます（上限約15MB）。')
            data = json.loads(self.rfile.read(length))
            if self.path == '/api/analyze': return self.reply(analyze(data.get('lines')))
            mime = data.get('mime',''); raw = base64.b64decode(data.get('data',''), validate=True)
            if mime not in ('image/jpeg','image/png','image/webp','application/pdf'): raise ValueError('JPEG、PNG、WebP、PDFを選択してください。')
            if mime == 'application/pdf':
                try: import pypdfium2 as pdfium
                except ImportError: raise ValueError('PDFの読み取りにはpypdfium2が必要です。READMEを確認してください。')
                import io
                pdf = pdfium.PdfDocument(raw)
                if len(pdf) > 30: raise ValueError('PDFは30ページ以内にしてください。')
                pages = []
                for page in pdf:
                    image = page.render(scale=1.5).to_pil(); buf = io.BytesIO(); image.save(buf,format='JPEG'); pages.append(buf.getvalue())
                with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool: results = list(pool.map(lambda page: vertex_read(page,'image/jpeg'), pages))
                return self.reply({'pages':results})
            return self.reply({'pages':[vertex_read(raw,mime)]})
        except Exception as exc:
            print('Request failed:', type(exc).__name__, flush=True)
            return self.reply({'error':str(exc) if isinstance(exc, ValueError) else '読み取りに失敗しました。設定・接続を確認してください。'}, 400)

if __name__ == '__main__':
    port = int(os.getenv('PORT','8080'))
    print('Thinking Process Coach: http://localhost:%s' % port, flush=True)
    ThreadingHTTPServer(('0.0.0.0',port), Handler).serve_forever()
