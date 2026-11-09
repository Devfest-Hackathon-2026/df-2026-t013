import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import worker from './worker.js';

const options={name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'};
const identity=await crypto.subtle.generateKey(options,true,['sign','verify']);
const service=await crypto.subtle.generateKey(options,true,['sign','verify']);
const jwk=await crypto.subtle.exportKey('jwk',identity.publicKey); jwk.kid='integration-test';
const pkcs8=Buffer.from(await crypto.subtle.exportKey('pkcs8',service.privateKey)).toString('base64').match(/.{1,64}/g).join('\n');
const serviceJson=JSON.stringify({client_email:'fake@example.invalid',private_key:'-----BEGIN PRIVATE KEY-----\n'+pkcs8+'\n-----END PRIVATE KEY-----\n'});
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
async function signed(id,email) {const body=b64({alg:'RS256',kid:jwk.kid})+'.'+b64({sub:id,email,email_verified:true,name:id,aud:'421511145910-prn4adkvp0ld6kfkh8khrsb8g9a7s8e8.apps.googleusercontent.com',iss:'https://accounts.google.com',exp:Math.floor(Date.now()/1000)+3600});return body+'.'+Buffer.from(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',identity.privateKey,new TextEncoder().encode(body))).toString('base64url')}
const sql=new DatabaseSync(':memory:'); sql.exec(readFileSync(new URL('./schema.sql',import.meta.url),'utf8'));
const DB={prepare(q){const stmt={q,args:[],bind(...args){return {...stmt,args}},async first(){return sql.prepare(this.q).get(...this.args)??null},async all(){return {results:sql.prepare(this.q).all(...this.args)}},async run(){return sql.prepare(this.q).run(...this.args)}};return stmt},async batch(stmts){sql.exec('BEGIN');try {for(const stmt of stmts)await stmt.run();sql.exec('COMMIT')}catch(e){sql.exec('ROLLBACK');throw e}}};
let aiCalls=0;
const oldFetch=globalThis.fetch;
globalThis.fetch=async (url,opts)=>{
 if(String(url)==='https://www.googleapis.com/oauth2/v3/certs') return Response.json({keys:[jwk]});
 if(String(url)==='https://oauth2.googleapis.com/token') return Response.json({access_token:'test-only'});
 if(String(url).startsWith('https://aiplatform.googleapis.com/')) {aiCalls++;const request=JSON.parse(opts.body); const hasImage=request.contents[0].parts.some(p=>p.inlineData);const output=hasImage?{lines:[{text:'3x+4=7',box:[0,0,100,500],confidence:.99},{text:'3x=11',box:[110,0,210,500],confidence:.99},{text:'x=11/3',box:[220,0,320,500],confidence:.99}],hint:'移項の符号を見直そう。'}:{text:'左辺の4を移すときの符号は？'};return Response.json({candidates:[{content:{parts:[{text:JSON.stringify(output)}]}}]}); }
 throw Error('Unexpected network request');
};
const env={DB,ASSETS:{fetch:()=>new Response('asset')},GOOGLE_SERVICE_ACCOUNT:serviceJson,AI_CUTOFF:'2027-01-01T00:00:00Z'};
async function request(path,t,body){return worker.fetch(new Request('https://example.test'+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+t,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}),env)}
test('full teacher and student flow with synthetic image and mocked AI',async()=>{
 try{
  const teacher=await signed('teacher','sakurasyouyu.no.ki@gmail.com'),student=await signed('student','student@example.com'),other=await signed('other','other@example.com');
  const teacherMe=await (await request('/api/me',teacher)).json();await request('/api/me',student);await request('/api/me',other);
  assert.equal((await request('/api/link',student,{code:teacherMe.code})).status,200);
  const imageBytes=Buffer.alloc(500001,42); Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]).copy(imageBytes);const image=imageBytes.toString('base64');
  assert.equal((await request('/api/submissions',student,{title:'テスト',mime:'image/png',image:'YWJj'})).status,400);assert.equal(aiCalls,0);
  const response=await request('/api/submissions',student,{title:'テスト',mime:'image/png',image});assert.equal(response.status,200);const {id}=await response.json();
  const submitted=await (await request('/api/submissions/'+id,student)).json();assert.equal(submitted.image,'data:image/png;base64,'+image);assert.equal(submitted.analysis.status,'mistake');assert.equal(submitted.immediate.index,1);assert.equal(submitted.published,null);
  assert.equal((await request('/api/submissions/'+id,other)).status,403);assert.equal((await (await request('/api/submissions',teacher)).json()).items.length,1);
  assert.equal((await request('/api/submissions/'+id+'/draft',teacher,{})).status,200);
  assert.equal((await (await request('/api/submissions/'+id,student)).json()).published,null);
  assert.equal((await request('/api/submissions/'+id+'/publish',teacher,{})).status,200);
  assert.equal((await (await request('/api/submissions/'+id,student)).json()).published.text,'左辺の4を移すときの符号は？');assert.equal(aiCalls,2);
  const deleteRequest=t=>worker.fetch(new Request('https://example.test/api/submissions/'+id,{method:'DELETE',headers:{Authorization:'Bearer '+t}}),env);
  assert.equal((await deleteRequest(teacher)).status,403);
  assert.equal((await deleteRequest(student)).status,200);
  assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM image_chunks WHERE submission=?').get(id).n,0);
  assert.equal((await request('/api/submissions/'+id,student)).status,403);
 }finally{globalThis.fetch=oldFetch}
});
