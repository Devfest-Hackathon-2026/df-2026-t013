import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import worker from './worker.js';

const sql=new DatabaseSync(':memory:');
sql.exec(readFileSync(new URL('./schema.sql',import.meta.url),'utf8'));
const DB={prepare(q){return {bind(...args){return {async first(){return sql.prepare(q).get(...args)??null},async all(){return {results:sql.prepare(q).all(...args)}},async run(){return sql.prepare(q).run(...args)}}}}}};
const env={DB,DEMO_SESSION_SECRET:'only-for-testing-this-secret-is-long-enough',ASSETS:{fetch:()=>new Response('asset')}};
async function call(path,token='',body){return worker.fetch(new Request('https://example.test'+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}),env)}
async function login(email,session){const r=await call('/api/login','',{email,session});assert.equal(r.status,200);return (await r.json()).token}
test('demo accounts are isolated and cannot accept Google tokens or forged tokens',async()=>{
 const session='a'.repeat(64), other='b'.repeat(64);
 const teacher=await login('teacher@sample.com',session),student=await login('student@sample.com',session),stranger=await login('student@sample.com',other);
 assert.equal((await call('/api/login','',{email:'bad@example.com',session})).status,400);
 assert.equal((await call('/api/login','',{email:'teacher@sample.com',session:'short'})).status,400);
 const tm=await (await call('/api/me',teacher)).json(),sm=await (await call('/api/me',student)).json();
 assert.equal(tm.role,'teacher');assert.equal(sm.role,'student');assert.notEqual(tm.id,sm.id);
 await call('/api/me',stranger);
 assert.equal((await call('/api/link',student,{code:tm.code})).status,200);
 const id='c'.repeat(48), analysis={status:'review',lines:['x=1'],boxes:[]},feedback={text:'確認',index:null,imageNote:''};
 sql.prepare('INSERT INTO submissions(id,student,title,created,mime,analysis,immediate,draft) VALUES(?,?,?,?,?,?,?,?)').run(id,sm.id,'test',1,'image/png',JSON.stringify(analysis),JSON.stringify(feedback),JSON.stringify(feedback));
 sql.prepare('INSERT INTO image_chunks VALUES(?,?,?)').run(id,0,'YWJj');
 assert.equal((await call('/api/submissions/'+id,stranger)).status,403);
 assert.equal((await call('/api/submissions/'+id,teacher)).status,200);
 assert.equal((await call('/api/submissions/'+id+'/publish',student,{})).status,503);
 assert.equal((await call('/api/submissions/'+id+'/publish',teacher,{})).status,200);
 assert.equal((await (await call('/api/submissions/'+id,student)).json()).published.text,'確認');
 assert.equal((await call('/api/me',teacher.slice(0,-4)+'AAAA')).status,400);
 assert.equal((await call('/api/me','fake.google.token')).status,400);
 sql.prepare('INSERT INTO users(id,name,email,role,code) VALUES(?,?,?,?,?)').run('google-existing','old','old@example.com','teacher','old-code');
 assert.equal((await call('/api/link',student,{code:'old-code'})).status,400);
});
test('five numbered students have distinct submissions in one browser session',async()=>{
 const session='d'.repeat(64),teacher=await login('teacher@sample.com',session);
 const tm=await (await call('/api/me',teacher)).json(), ids=[];
 const analysis=JSON.stringify({status:'review',lines:['x=1'],boxes:[]}), immediate=JSON.stringify({text:'確認',index:null,imageNote:''});
 for(let i=1;i<=5;i++){
  const student=await login(`student${i}@sample.com`,session),me=await (await call('/api/me',student)).json();
  assert.equal(me.name,`審査用生徒${i}`);ids.push(me.id);
  assert.equal((await call('/api/link',student,{code:tm.code})).status,200);
  const submission=String(i).repeat(48);
  sql.prepare('INSERT INTO submissions(id,student,title,created,mime,analysis,immediate) VALUES(?,?,?,?,?,?,?)').run(submission,me.id,`課題${i}`,i,'image/png',analysis,immediate);
  const own=await (await call('/api/submissions',student)).json();assert.deepEqual(own.items.map(x=>x.id),[submission]);
 }
 assert.equal(new Set(ids).size,5);
 assert.equal((await (await call('/api/submissions',teacher)).json()).items.length,5);
 assert.equal((await call('/api/login','',{email:'student6@sample.com',session})).status,400);
 const legacy=await login('student@sample.com',session);assert.equal((await (await call('/api/me',legacy)).json()).id,ids[0]);
});
