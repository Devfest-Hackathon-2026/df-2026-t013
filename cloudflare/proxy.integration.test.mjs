import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {once} from 'node:events';
import {fileURLToPath} from 'node:url';
import {generate} from './gemini.js';

const secret='local-test-token-'.repeat(3);
const code=`import json,server
from http.server import ThreadingHTTPServer
server.vertex_generate=lambda payload: {"candidates":[{"content":{"parts":[{"text":json.dumps({"text":"mock result"})}]}}]}
http=ThreadingHTTPServer(('127.0.0.1',0),server.Handler)
print(http.server_port,flush=True)
http.serve_forever()`;

test('Worker AI bridge reaches proxy and authenticates without contacting Google', {timeout:15000}, async()=>{
 const child=spawn('python',['-u','-c',code],{cwd:fileURLToPath(new URL('./gcp_proxy',import.meta.url)),env:{...process.env,AI_PROXY_TOKEN:secret,AI_CUTOFF_EPOCH:'1798761600'},stdio:['ignore','pipe','pipe']});
 const lines=createInterface({input:child.stdout});
 let errors=''; child.stderr.on('data',data=>errors+=data.toString());
 const original=globalThis.fetch;
 try {
  const [port]=await Promise.race([once(lines,'line'),once(child,'exit').then(()=>{throw Error('Proxy exited early: '+errors)})]);
  const url='http://127.0.0.1:'+Number(port)+'/generate';
  const denied=await original(url,{method:'POST',headers:{Authorization:'Bearer '+('wrong'.repeat(8)),'Content-Type':'application/json'},body:JSON.stringify({prompt:'test'})});assert.equal(denied.status,403);
  let seen=0;
  globalThis.fetch=(target,opts)=>{assert.equal(target,'https://test-123.run.app/generate');seen++;return original(url,opts)};
  const env={AI_PROXY_TOKEN:secret,AI_PROXY_URL:'https://test-123.run.app',AI_CUTOFF:'2027-01-01T00:00:00Z',DB:{prepare(){return {first:async()=>({calls:1}),bind(){return {first:async()=>({calls:1})}}}}}};
  assert.deepEqual(await generate(env,'test','aGVsbG8=','image/png'),{text:'mock result'});assert.equal(seen,1);
 } finally {globalThis.fetch=original;lines.close();child.kill();}
});
