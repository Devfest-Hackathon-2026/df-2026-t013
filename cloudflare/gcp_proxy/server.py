"""Vertex AI bridge for Cloud Run; no service-account keys are used.

Do not deploy until billing and access controls are reviewed. The service uses
Cloud Run's attached identity and a bearer secret shared only with the Worker.
"""
import hmac
import json
import os
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

MAX_BODY = 9 * 1024 * 1024
CREDIT_CUTOFF = 1809302400  # 2027-05-03 00:00:00 UTC, before credit expiry
MODEL_URL = 'https://aiplatform.googleapis.com/v1/projects/ichigyo-coach/locations/global/publishers/google/models/gemini-3.5-flash-lite:generateContent'


def enabled(env=os.environ, now=None):
    try:
        cutoff = int(env.get('AI_CUTOFF_EPOCH', ''))
    except (TypeError, ValueError):
        return False
    return len(env.get('AI_PROXY_TOKEN', '')) >= 32 and cutoff <= CREDIT_CUTOFF and (now if now is not None else time.time()) < cutoff


def vertex_generate(payload):
    import google.auth
    import google.auth.transport.requests
    import requests
    credentials, _ = google.auth.default(scopes=['https://www.googleapis.com/auth/cloud-platform'])
    credentials.refresh(google.auth.transport.requests.Request())
    result = requests.post(MODEL_URL, headers={'Authorization': 'Bearer ' + credentials.token}, json=payload, timeout=90)
    result.raise_for_status()
    return result.json()


class Handler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass  # Do not log request bodies, tokens, or student answers.

    def reply(self, value, status=200):
        content = json.dumps(value, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(content)))
        self.end_headers()
        self.wfile.write(content)

    def do_POST(self):
        if self.path != '/generate' or not enabled():
            return self.reply({'error': 'unavailable'}, 503)
        expected = os.environ['AI_PROXY_TOKEN']
        provided = self.headers.get('Authorization', '')
        if not hmac.compare_digest(provided.encode('utf-8'), ('Bearer ' + expected).encode('utf-8')):
            return self.reply({'error': 'unauthorized'}, 403)
        try:
            size = int(self.headers.get('Content-Length', '0'))
            if not 0 < size <= MAX_BODY:
                return self.reply({'error': 'invalid request'}, 400)
            data = json.loads(self.rfile.read(size))
            if not isinstance(data, dict):
                return self.reply({'error': 'invalid request'}, 400)
            prompt, image, mime = data.get('prompt'), data.get('image'), data.get('mime')
            if not isinstance(prompt, str) or not 0 < len(prompt) <= 10000:
                return self.reply({'error': 'invalid request'}, 400)
            if image is not None and (not isinstance(image, str) or len(image) > 8 * 1024 * 1024 or mime not in ('image/jpeg', 'image/png', 'image/webp')):
                return self.reply({'error': 'invalid request'}, 400)
            parts = [{'text': prompt}]
            if image is not None:
                parts.append({'inlineData': {'mimeType': mime, 'data': image}})
            result = vertex_generate({'contents': [{'role': 'user', 'parts': parts}], 'generationConfig': {'responseMimeType': 'application/json', 'temperature': 0.2, 'maxOutputTokens': 2048}})
            text = ''.join(part.get('text', '') for part in result['candidates'][0]['content']['parts'])
            self.reply(json.loads(text))
        except (KeyError, TypeError, ValueError, json.JSONDecodeError):
            self.reply({'error': 'invalid request or response'}, 400)
        except Exception:
            self.reply({'error': 'upstream unavailable'}, 502)


if __name__ == '__main__':
    ThreadingHTTPServer(('0.0.0.0', int(os.environ.get('PORT', '8080'))), Handler).serve_forever()
