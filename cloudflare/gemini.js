// A temporary trial safeguard, not a guarantee against all Google Cloud charges.
const b64url = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const enc = value => b64url(new TextEncoder().encode(JSON.stringify(value)));
// Credit expires on 2027-05-04; stop before the start of that date in Japan.
const CREDIT_CUTOFF = Date.parse('2027-05-03T00:00:00Z');
function proxyUrl(env) {
  try {
    const url = new URL(env.AI_PROXY_URL);
    return url.protocol === 'https:' && url.hostname.endsWith('.run.app') && !url.username && !url.password && !url.port && (url.pathname === '/' || url.pathname === '') && !url.search && !url.hash ? url.origin + '/generate' : null;
  } catch { return null; }
}
export function aiEnabled(env, now=Date.now()) {
  const cutoff=Date.parse(env.AI_CUTOFF || '');
  const authReady=Boolean(env.GOOGLE_SERVICE_ACCOUNT) || Boolean(env.AI_PROXY_TOKEN?.length >= 32 && proxyUrl(env));
  return authReady && Number.isFinite(cutoff) && cutoff <= CREDIT_CUTOFF && now < cutoff;
}

export async function generate(env, prompt, image, mime) {
  if (!aiEnabled(env)) throw new Error('AIの試用期間が終了したか、設定されていません。');
  const total = await env.DB.prepare('INSERT INTO ai_totals(id,calls) VALUES(1,1) ON CONFLICT(id) DO UPDATE SET calls=calls+1 WHERE calls < 100 RETURNING calls').first();
  if (!total) throw new Error('AIの試用回数の上限に達しました。');
  const day = new Date().toISOString().slice(0,10);
  const quota = await env.DB.prepare('INSERT INTO ai_usage(day,calls) VALUES(?,1) ON CONFLICT(day) DO UPDATE SET calls=calls+1 WHERE calls < 20 RETURNING calls').bind(day).first();
  if (!quota) throw new Error('本日のAI利用上限に達しました。');
  if (env.AI_PROXY_TOKEN?.length >= 32 && proxyUrl(env)) {
    const response=await fetch(proxyUrl(env),{method:'POST',headers:{Authorization:'Bearer '+env.AI_PROXY_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({prompt,image:image??null,mime:mime??null})});
    if (!response.ok) throw new Error('AIの応答を取得できませんでした。');
    return response.json();
  }
  const service = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT);
  const now = Math.floor(Date.now()/1000);
  const header = enc({alg:'RS256',typ:'JWT'});
  const payload = enc({iss:service.client_email,scope:'https://www.googleapis.com/auth/cloud-platform',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+300});
  const privateBytes = Uint8Array.from(atob(service.private_key.replace(/-----[^-]+-----/g,'').replace(/\s/g,'')),c=>c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8',privateBytes,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
  const assertion=header+'.'+payload+'.'+b64url(new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,new TextEncoder().encode(header+'.'+payload))));
  const auth=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion})});
  if (!auth.ok) throw new Error('AIの認証に失敗しました。');
  const access = await auth.json();
  const parts=[{text:prompt}];
  if (image) parts.push({inlineData:{mimeType:mime,data:image}});
  const response=await fetch('https://aiplatform.googleapis.com/v1/projects/ichigyo-coach/locations/global/publishers/google/models/gemini-3.5-flash-lite:generateContent',{method:'POST',headers:{Authorization:'Bearer '+access.access_token,'Content-Type':'application/json'},body:JSON.stringify({contents:[{role:'user',parts}],generationConfig:{responseMimeType:'application/json',temperature:0.2,maxOutputTokens:2048}})});
  if (!response.ok) throw new Error('AIの応答を取得できませんでした。');
  const result=await response.json();
  return JSON.parse(result.candidates[0].content.parts.map(p=>p.text||'').join(''));
}
