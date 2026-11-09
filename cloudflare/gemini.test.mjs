import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generate,aiEnabled} from './gemini.js';

test('AI cannot run without credentials or after cutoff',async()=>{
 let dbCalls=0; const env={DB:{prepare(){dbCalls++; throw new Error('unexpected database access')}},GOOGLE_SERVICE_ACCOUNT:'{}',AI_CUTOFF:'2020-01-01T00:00:00Z'};
 await assert.rejects(generate(env,'test'),/試用期間/); assert.equal(dbCalls,0);
 await assert.rejects(generate({...env,GOOGLE_SERVICE_ACCOUNT:''},'test'),/試用期間/); assert.equal(dbCalls,0);
 await assert.rejects(generate({...env,AI_CUTOFF:'invalid'},'test'),/試用期間/); assert.equal(dbCalls,0);
 assert.equal(aiEnabled({...env,AI_CUTOFF:'2999-01-01T00:00:00Z'},0),false);
});
test('daily limit prevents outbound AI requests',async()=>{
 let calls=0; const prior=globalThis.fetch; globalThis.fetch=()=>{calls++; throw new Error('unexpected network')};
 try { const env={GOOGLE_SERVICE_ACCOUNT:'{}',AI_CUTOFF:'2027-01-01T00:00:00Z',DB:{prepare(){return {first:async()=>({calls:1}),bind(){return {first:async()=>null}}}}}}; await assert.rejects(generate(env,'test'),/利用上限/); assert.equal(calls,0); } finally {globalThis.fetch=prior}
});
test('lifetime limit prevents outbound AI requests',async()=>{
 let calls=0; const prior=globalThis.fetch; globalThis.fetch=()=>{calls++; throw new Error('unexpected network')};
 try { const env={GOOGLE_SERVICE_ACCOUNT:'{}',AI_CUTOFF:'2027-01-01T00:00:00Z',DB:{prepare(){return {first:async()=>null}}}}; await assert.rejects(generate(env,'test'),/試用回数/); assert.equal(calls,0); } finally {globalThis.fetch=prior}
});
test('keyless proxy accepts only a Cloud Run HTTPS origin and sends a bounded request',async()=>{
 const base={AI_PROXY_TOKEN:'test-only-'.repeat(4),AI_PROXY_URL:'https://example-123.run.app',AI_CUTOFF:'2027-01-01T00:00:00Z',DB:{prepare(){return {first:async()=>({calls:1}),bind(){return {first:async()=>({calls:1})}}}}}};
 assert.equal(aiEnabled({...base,AI_PROXY_URL:'https://run.app.attacker.test'},Date.parse('2026-01-01')),false);
 assert.equal(aiEnabled({...base,AI_PROXY_URL:'http://example-123.run.app'},Date.parse('2026-01-01')),false);
 const prior=globalThis.fetch;let target,options;globalThis.fetch=async (url,opts)=>{target=url;options=opts;return Response.json({text:'ok'})};
 assert.equal(aiEnabled({...base,AI_PROXY_TOKEN:'short'},Date.parse('2026-01-01')),false);
 try {assert.deepEqual(await generate(base,'test'),{text:'ok'});assert.equal(target,'https://example-123.run.app/generate');assert.equal(options.headers.Authorization,'Bearer '+'test-only-'.repeat(4))} finally {globalThis.fetch=prior}
});
