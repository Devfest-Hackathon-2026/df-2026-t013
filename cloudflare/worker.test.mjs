import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import worker from './worker.js';

const pair=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
const jwk=await crypto.subtle.exportKey('jwk',pair.publicKey); jwk.kid='test';
const originalFetch=globalThis.fetch;
globalThis.fetch=async (...args)=>String(args[0])==='https://www.googleapis.com/oauth2/v3/certs' ? Response.json({keys:[jwk]}) : originalFetch(...args);
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
async function token(id,email,extra={}) {const body=b64({alg:'RS256',kid:'test'})+'.'+b64({sub:id,email,email_verified:true,name:id,aud:'421511145910-prn4adkvp0ld6kfkh8khrsb8g9a7s8e8.apps.googleusercontent.com',iss:'https://accounts.google.com',exp:Math.floor(Date.now()/1000)+3600,...extra});return body+'.'+Buffer.from(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',pair.privateKey,new TextEncoder().encode(body))).toString('base64url')}
const sql=new DatabaseSync(':memory:'); sql.exec(readFileSync(new URL('./schema.sql',import.meta.url),'utf8'));
const DB={prepare(q){return {bind(...args){return {async first(){return sql.prepare(q).get(...args)??null},async all(){return {results:sql.prepare(q).all(...args)}},async run(){return sql.prepare(q).run(...args)}}}}}};
async function call(path,t,body) {return worker.fetch(new Request('https://example.test'+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+t,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}),{DB,ASSETS:{fetch:()=>new Response('asset')}})}
test('identity, linking, submission access and publishing require correct roles',async()=>{
 const teacher=await token('teacher','sakurasyouyu.no.ki@gmail.com'), student=await token('student','student@gmail.com'), stranger=await token('stranger','other@gmail.com');
 const me=await (await call('/api/me',teacher)).json(); assert.equal(me.role,'teacher');
 await call('/api/me',student); await call('/api/me',stranger);
 assert.equal((await call('/api/link',student,{code:me.code})).status,200);
 const id='a'.repeat(48), analysis={status:'review',lines:['x=1'],boxes:[]}, feedback={text:'確認',index:null,imageNote:''};
 sql.prepare('INSERT INTO submissions(id,student,title,created,mime,analysis,immediate,draft) VALUES(?,?,?,?,?,?,?,?)').run(id,'student','test',1,'image/png',JSON.stringify(analysis),JSON.stringify(feedback),JSON.stringify(feedback));
 sql.prepare('INSERT INTO image_chunks VALUES(?,?,?)').run(id,0,'YWJj');
 assert.equal((await call('/api/submissions/'+id,stranger)).status,403);
 const own=await (await call('/api/submissions/'+id,student)).json(); assert.equal(own.image,'data:image/png;base64,YWJj'); assert.equal('draft' in own,false);
 assert.equal((await call('/api/submissions/'+id+'/publish',student,{})).status,503);
 assert.equal((await call('/api/submissions/'+id+'/save',teacher,{text:'見直してみよう',index:null,imageNote:'確認しよう'})).status,200);
 assert.equal((await call('/api/submissions/'+id+'/publish',teacher,{})).status,200);
 assert.equal((await (await call('/api/submissions/'+id,student)).json()).published.text,'見直してみよう');
 const forged=teacher.slice(0,-4)+'AAAA'; assert.equal((await call('/api/me',forged)).status,400);
 assert.equal((await call('/api/me',await token('bad','bad@gmail.com',{exp:null}))).status,400);
 assert.equal((await call('/api/me',await token('bad','bad@gmail.com',{nbf:Math.floor(Date.now()/1000)+3600}))).status,400);
});
