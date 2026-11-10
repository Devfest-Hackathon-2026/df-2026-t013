import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import worker from './worker.js';

const options={name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'};
const service=await crypto.subtle.generateKey(options,true,['sign','verify']);
const pkcs8=Buffer.from(await crypto.subtle.exportKey('pkcs8',service.privateKey)).toString('base64').match(/.{1,64}/g).join('\n');
const serviceJson=JSON.stringify({client_email:'fake@example.invalid',private_key:'-----BEGIN PRIVATE KEY-----\n'+pkcs8+'\n-----END PRIVATE KEY-----\n'});
const sql=new DatabaseSync(':memory:'); sql.exec(readFileSync(new URL('./schema.sql',import.meta.url),'utf8'));
const DB={prepare(q){const stmt={q,args:[],bind(...args){return {...stmt,args}},async first(){return sql.prepare(this.q).get(...this.args)??null},async all(){return {results:sql.prepare(this.q).all(...this.args)}},async run(){return sql.prepare(this.q).run(...this.args)}};return stmt},async batch(stmts){sql.exec('BEGIN');try {for(const stmt of stmts)await stmt.run();sql.exec('COMMIT')}catch(e){sql.exec('ROLLBACK');throw e}}};
let aiCalls=0;
const oldFetch=globalThis.fetch;
globalThis.fetch=async (url,opts)=>{
 if(String(url)==='https://oauth2.googleapis.com/token') return Response.json({access_token:'test-only'});
 if(String(url).startsWith('https://aiplatform.googleapis.com/')) {aiCalls++;const request=JSON.parse(opts.body); const hasImage=request.contents[0].parts.some(p=>p.inlineData);const output=hasImage?{lines:[{text:'3x+4=7',box:[0,0,100,500],confidence:.99},{text:'3x=11',box:[110,0,210,500],confidence:.99},{text:'x=11/3',box:[220,0,320,500],confidence:.99}],hint:'移項の符号を見直そう。'}:{text:'左辺の4を移すときの符号は？'};return Response.json({candidates:[{content:{parts:[{text:JSON.stringify(output)}]}}]}); }
 throw Error('Unexpected network request');
};
const env={DB,DEMO_SESSION_SECRET:'test-only-secret-that-is-long-enough-for-hmac',ASSETS:{fetch:()=>new Response('asset')},GOOGLE_SERVICE_ACCOUNT:serviceJson,AI_CUTOFF:'2027-01-01T00:00:00Z'};
async function request(path,t,body){return worker.fetch(new Request('https://example.test'+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+t,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}),env)}
test('full teacher and student flow with synthetic image and mocked AI',async()=>{
 try{
  const signIn=async(email,session)=>{const result=await (await request('/api/login','',{email,session:session.repeat(64)})).json();return result.token};
  const teacher=await signIn('teacher@sample.com','a'),student=await signIn('student@sample.com','a'),other=await signIn('student@sample.com','b'),otherTeacher=await signIn('teacher2@sample.com','a');
  const teacherMe=await (await request('/api/me',teacher)).json();
  assert.equal((await (await request('/api/me',student)).json()).connected,false);
  assert.equal((await request('/api/submissions',student)).status,403);
  assert.equal((await request('/api/assignments',student)).status,403);
  await request('/api/me',other);
  assert.equal((await request('/api/link',student,{code:teacherMe.code})).status,200);
  assert.equal((await (await request('/api/me',student)).json()).connected,true);
  const teachers=await (await request('/api/teachers',student)).json();
  assert.equal(teachers.items.length,1);assert.equal(teachers.items[0].id,teacherMe.teacherRef);
  assert.equal((await request('/api/assignments',student,{title:'不正'})).status,403);
  const assignment=await (await request('/api/assignments',teacher,{title:'一次方程式'})).json();
  assert.equal((await (await request('/api/assignments',student)).json()).items[0].title,'一次方程式');
  assert.equal((await request('/api/assignments',other)).status,403);
  const imageBytes=Buffer.alloc(500001,42); Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]).copy(imageBytes);const image=imageBytes.toString('base64');
  assert.equal((await request('/api/submissions',student,{teacherId:teacherMe.teacherRef,assignmentId:assignment.id,mime:'image/png',image:'YWJj'})).status,400);assert.equal(aiCalls,0);
  assert.equal((await request('/api/submissions',other,{teacherId:teacherMe.teacherRef,assignmentId:assignment.id,mime:'image/png',image})).status,403);assert.equal(aiCalls,0);
  const response=await request('/api/submissions',student,{teacherId:teacherMe.teacherRef,assignmentId:assignment.id,title:'偽の課題名',mime:'image/png',image});assert.equal(response.status,200);const {id}=await response.json();
  const otherTeacherMe=await (await request('/api/me',otherTeacher)).json();
  assert.equal((await request('/api/link',student,{code:otherTeacherMe.code})).status,200);
  const second=await (await request('/api/assignments',otherTeacher,{title:'別の課題'})).json();
  assert.equal((await (await request('/api/teachers',student)).json()).items.length,2);
  assert.equal((await (await request('/api/assignments?teacherId='+teacherMe.teacherRef,student)).json()).items[0].id,assignment.id);
  assert.equal((await (await request('/api/assignments?teacherId='+otherTeacherMe.teacherRef,student)).json()).items[0].id,second.id);
  assert.equal((await (await request('/api/submissions?teacherId='+teacherMe.teacherRef,student)).json()).items.length,1);
  assert.equal((await (await request('/api/submissions?teacherId='+otherTeacherMe.teacherRef,student)).json()).items.length,0);
  assert.equal((await request('/api/submissions',student,{teacherId:otherTeacherMe.teacherRef,assignmentId:assignment.id,mime:'image/png',image})).status,403);
  assert.equal((await request('/api/assignments?teacherId='+('f'.repeat(64)),student)).status,403);
  const secondSubmission=await (await request('/api/submissions',student,{teacherId:otherTeacherMe.teacherRef,assignmentId:second.id,mime:'image/png',image})).json();
  assert.equal((await (await request('/api/submissions',otherTeacher)).json()).items.length,1);
  assert.equal((await (await request('/api/submissions?teacherId='+otherTeacherMe.teacherRef,student)).json()).items[0].id,secondSubmission.id);
  assert.equal((await request('/api/submissions/'+id,otherTeacher)).status,403);
  const submitted=await (await request('/api/submissions/'+id,student)).json();assert.equal(submitted.image,'data:image/png;base64,'+image);assert.equal(submitted.analysis.status,'mistake');assert.equal(submitted.immediate.index,1);assert.equal(submitted.published,null);
  assert.equal(submitted.title,'一次方程式');
  assert.equal((await request('/api/submissions/'+id,other)).status,403);assert.equal((await (await request('/api/submissions',teacher)).json()).items.length,1);
  assert.equal((await request('/api/submissions/'+id+'/draft',teacher,{})).status,200);
  assert.equal((await (await request('/api/submissions/'+id,student)).json()).published,null);
  assert.equal((await request('/api/submissions/'+id+'/publish',teacher,{})).status,200);
  assert.equal((await (await request('/api/submissions/'+id,student)).json()).published.text,'左辺の4を移すときの符号は？');assert.equal(aiCalls,3);
  const deleteRequest=t=>worker.fetch(new Request('https://example.test/api/submissions/'+id,{method:'DELETE',headers:{Authorization:'Bearer '+t}}),env);
  assert.equal((await deleteRequest(teacher)).status,403);
  assert.equal((await deleteRequest(student)).status,200);
  assert.equal((await worker.fetch(new Request('https://example.test/api/submissions/'+secondSubmission.id,{method:'DELETE',headers:{Authorization:'Bearer '+student}}),env)).status,200);
  assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM image_chunks WHERE submission=?').get(id).n,0);
  assert.equal((await request('/api/submissions/'+id,student)).status,403);
 }finally{globalThis.fetch=oldFetch}
});
