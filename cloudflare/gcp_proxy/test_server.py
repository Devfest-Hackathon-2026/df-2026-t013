import json
import os
import threading
import unittest
from http.server import ThreadingHTTPServer
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.request import Request, urlopen
import server


class ProxyTests(unittest.TestCase):
    def setUp(self):
        self.env = patch.dict(os.environ, {'AI_PROXY_TOKEN': 'test-secret-' * 4, 'AI_CUTOFF_EPOCH': str(server.CREDIT_CUTOFF)}, clear=True)
        self.env.start()
        self.http = ThreadingHTTPServer(('127.0.0.1', 0), server.Handler)
        self.thread = threading.Thread(target=self.http.serve_forever, daemon=True)
        self.thread.start()
        self.url = 'http://127.0.0.1:%s/generate' % self.http.server_port

    def tearDown(self):
        self.http.shutdown()
        self.http.server_close()
        self.thread.join()
        self.env.stop()

    def post(self, data, token='test-secret-' * 4):
        request = Request(self.url, data=json.dumps(data).encode(), headers={'Authorization': 'Bearer '+token, 'Content-Type':'application/json'}, method='POST')
        try:
            with urlopen(request) as response:
                return response.status, json.load(response)
        except HTTPError as error:
            return error.code, json.load(error)

    def test_fails_closed_before_google_call(self):
        with patch.object(server, 'vertex_generate') as generate:
            self.assertEqual(self.post({'prompt':'test'}, token='wrong')[0], 403)
            self.assertEqual(self.post({'prompt':''})[0], 400)
            self.assertEqual(self.post(['not an object'])[0], 400)
            os.environ['AI_CUTOFF_EPOCH'] = 'broken'
            self.assertEqual(self.post({'prompt':'test'})[0], 503)
            self.assertFalse(server.enabled({'AI_PROXY_TOKEN':'x', 'AI_CUTOFF_EPOCH':str(server.CREDIT_CUTOFF+1)}, now=0))
            generate.assert_not_called()

    def test_authorized_request_returns_parsed_json(self):
        reply = {'candidates':[{'content':{'parts':[{'text':'{"text":"test"}'}]}}]}
        with patch.object(server, 'vertex_generate', return_value=reply) as generate:
            self.assertEqual(self.post({'prompt':'test', 'image':'YWJj', 'mime':'image/png'}), (200, {'text':'test'}))
            payload = generate.call_args.args[0]
            self.assertEqual(payload['contents'][0]['parts'][1]['inlineData']['mimeType'], 'image/png')
            self.assertEqual(payload['generationConfig']['maxOutputTokens'], 2048)


if __name__ == '__main__':
    unittest.main()
