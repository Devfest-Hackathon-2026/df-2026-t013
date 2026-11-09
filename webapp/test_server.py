import base64
import json
import tempfile
import threading
import unittest
from http.server import ThreadingHTTPServer
from urllib.error import HTTPError
from urllib.request import Request, urlopen
from unittest.mock import patch

import server as api

class WebFlowTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.old_db = api.DB_PATH
        api.DB_PATH = self.tmp.name + '/test.sqlite3'
        api.initialize()
        self.users = {
            'student': {'id':'student-1','name':'生徒','email':'s@example.com','role':'student'},
            'other': {'id':'student-2','name':'別の生徒','email':'o@example.com','role':'student'},
            'teacher': {'id':'teacher-1','name':'先生','email':'t@example.com','role':'teacher'},
            'stranger': {'id':'teacher-2','name':'別の先生','email':'u@example.com','role':'teacher'},
        }
        with api.db() as c:
            for key, u in self.users.items():
                c.execute('INSERT INTO users(id,name,email,role,code) VALUES(?,?,?,?,?)',(u['id'],u['name'],u['email'],u['role'],'secret-invitation' if key=='teacher' else None))
        self.patches = [patch.object(api,'identity',side_effect=lambda token:self.users[token]), patch.object(api,'vertex_read',return_value={'lines':[{'text':'2x+3=7','confidence':0.99,'box':[10,20,100,900]},{'text':'2x=10','confidence':0.99,'box':[110,20,200,900]}],'category':'transpose'}),patch.object(api,'generate_ai',return_value='両辺に何をしましたか？')]
        for p in self.patches: p.start()
        self.http = ThreadingHTTPServer(('127.0.0.1',0),api.Handler)
        self.thread = threading.Thread(target=self.http.serve_forever,daemon=True); self.thread.start()
        self.base = 'http://127.0.0.1:' + str(self.http.server_port)
    def tearDown(self):
        self.http.shutdown(); self.http.server_close(); self.thread.join()
        for p in self.patches: p.stop()
        api.DB_PATH = self.old_db; self.tmp.cleanup()
    def call(self,path,who,data=None):
        request=Request(self.base+path,headers={'Authorization':'Bearer '+who,'Content-Type':'application/json'},data=None if data is None else json.dumps(data).encode(),method='GET' if data is None else 'POST')
        try:
            with urlopen(request) as response: return response.status,json.load(response)
        except HTTPError as e: return e.code,json.load(e)
    def test_submission_sharing_and_approval(self):
        self.assertEqual(self.call('/api/link','student',{'code':'secret-invitation'})[0],200)
        status, result = self.call('/api/submissions','student',{'title':'宿題','mime':'image/png','image':base64.b64encode(b'test-image').decode()})
        self.assertEqual(status,200); ident=result['id']
        status, student = self.call('/api/submissions/'+ident,'student')
        self.assertEqual(student['analysis']['index'],1); self.assertEqual(student['immediate']['text'],'両辺に何をしましたか？')
        self.assertEqual(self.call('/api/submissions/'+ident,'other')[0],403)
        self.assertEqual(self.call('/api/submissions/'+ident,'stranger')[0],403)
        self.assertEqual(self.call('/api/submissions','stranger')[1]['items'],[])
        self.assertEqual(self.call('/api/submissions/'+ident+'/publish','teacher',{})[0],400)
        self.assertEqual(self.call('/api/submissions/'+ident+'/draft','teacher',{})[0],200)
        self.assertIsNone(self.call('/api/submissions/'+ident,'student')[1]['published'])
        self.assertEqual(self.call('/api/submissions/'+ident+'/revise','teacher',{'instruction':'やさしく'})[0],200)
        self.assertEqual(self.call('/api/submissions/'+ident+'/save','teacher',{'text':'自分の言葉で考えよう。','index':0,'imageNote':'一行目から考えよう。'})[0],200)
        self.assertEqual(self.call('/api/submissions/'+ident+'/publish','student',{})[0],403)
        self.assertEqual(self.call('/api/submissions/'+ident+'/publish','teacher',{})[0],200)
        published=self.call('/api/submissions/'+ident,'student')[1]['published']
        self.assertEqual(published['text'],'自分の言葉で考えよう。')
        self.assertEqual(published['index'],0)
        self.assertEqual(published['imageNote'],'一行目から考えよう。')
        self.assertNotIn('draft',self.call('/api/submissions/'+ident,'student')[1])

    def test_low_confidence_is_not_highlighted(self):
        api.vertex_read.return_value={'lines':[{'text':'2x+3=7','confidence':0.4,'box':[10,20,100,900]},{'text':'2x=10','confidence':0.4,'box':[110,20,200,900]}],'category':'transpose'}
        status, result = self.call('/api/submissions','student',{'title':'宿題','mime':'image/png','image':base64.b64encode(b'test-image').decode()})
        self.assertEqual(status,200)
        submission=self.call('/api/submissions/'+result['id'],'student')[1]
        self.assertEqual(submission['analysis']['status'],'review')
        self.assertIsNone(submission['immediate']['index'])

    def test_latex_equation_normalization(self):
        self.assertEqual(api.normalize_latex_equation(r'$\frac{x+1}{2}=3$'), '((x+1)/(2))=3')
        self.assertEqual(api.analyze([api.normalize_latex_equation(r'\frac{x+1}{2}=3'), 'x+1=6', 'x=5'])['status'],'correct')

if __name__ == '__main__': unittest.main()
