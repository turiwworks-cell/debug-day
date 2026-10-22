// Private, single-workspace OAuth. Existing MCP bearer keys remain supported.
const SCOPES=['mcp:read','mcp:write','offline_access'];
const now=()=>Math.floor(Date.now()/1000);
const random=()=>crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-','');
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','Pragma':'no-cache','X-Content-Type-Options':'nosniff'}});
const fail=(error,description,status=400)=>Object.assign(new Error(description),{oauthError:error,status});
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export async function digest(text){const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)));return btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');}
async function same(a,b){return typeof a==='string'&&typeof b==='string'&&a.length>=32&&a.length<=512&&await digest(a)===await digest(b);}
async function fingerprint(env,access){const key=access==='write'?env.MCP_WRITE_TOKEN:env.MCP_READ_TOKEN;if(!key||key.length<32)throw fail('access_denied','The requested MCP access is not enabled.',403);return digest(key);}
function redirectAllowed(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.hash&&!u.search&&((u.hostname==='chatgpt.com'&&(/^\/connector\/oauth\/[A-Za-z0-9_-]+$/.test(u.pathname)||u.pathname==='/connector_platform_oauth_redirect'))||(u.hostname==='claude.ai'&&u.pathname==='/api/mcp/auth_callback'));}catch{return false;}}
function scopeValue(value){if(value!==undefined&&typeof value!=='string')throw fail('invalid_scope','Scope must be a string.');const items=[...new Set((value||'mcp:read mcp:write offline_access').split(' ').filter(Boolean))];if(items.some(s=>!SCOPES.includes(s))||!items.includes('mcp:read'))throw fail('invalid_scope','Use mcp:read, optionally mcp:write and offline_access.');return items.join(' ');}
function resourceValue(value,origin){if(value&&value!==origin+'/mcp'&&value!==origin)throw fail('invalid_target','Unknown resource.');return value||origin+'/mcp';}
async function params(request){
 const reader=request.body?.getReader();if(!reader)throw fail('invalid_request','Missing request body.');
 const chunks=[];let length=0;while(true){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>16384){await reader.cancel();throw fail('invalid_request','Request too large.');}chunks.push(value);}
 const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
 const text=new TextDecoder().decode(bytes),type=request.headers.get('Content-Type')||'';
 try{let p;if(type.includes('application/json'))p=JSON.parse(text);else if(type.includes('application/x-www-form-urlencoded'))p=Object.fromEntries(new URLSearchParams(text));if(p&&typeof p==='object'&&!Array.isArray(p))return p;}catch{}
 throw fail('invalid_request','Use a JSON object or form-encoded request.');
}
async function client(env,id){if(typeof id!=='string'||id.length>300)throw fail('invalid_client','Unknown OAuth client.');let row=await env.DB.prepare('SELECT metadata FROM oauth_clients WHERE id=?').bind(id).first();if(row)return JSON.parse(row.metadata);
 // CIMD is restricted to OpenAI-hosted documents; never fetch an arbitrary URL.
 if(/^https:\/\/chatgpt\.com\/oauth\/(?:[A-Za-z0-9_-]+\/)?client\.json$/.test(id)){
  const response=await fetch(id,{redirect:'error',signal:AbortSignal.timeout(5000)});if(!response.ok)throw fail('invalid_client','Cannot load client metadata.');const text=await response.text();if(text.length>16384)throw fail('invalid_client','Client metadata too large.');const m=JSON.parse(text);if(m.client_id!==id||!Array.isArray(m.redirect_uris)||!m.redirect_uris.length||!m.redirect_uris.every(redirectAllowed))throw fail('invalid_client','Invalid client metadata.');
  const auth=m.token_endpoint_auth_methods_supported||[m.token_endpoint_auth_method||'none'];if(!auth.includes('none'))throw fail('invalid_client','This server requires public-client PKCE.');const metadata={client_id:id,client_name:'ChatGPT',redirect_uris:m.redirect_uris,token_endpoint_auth_method:'none'};
  await env.DB.prepare('INSERT OR IGNORE INTO oauth_clients(id,metadata) VALUES (?,?)').bind(id,JSON.stringify(metadata)).run();return metadata;
 }throw fail('invalid_client','Register the OAuth client first.');}
function redirectResponse(target,values,cookie){const u=new URL(target);for(const[k,v]of Object.entries(values))if(v!==undefined)u.searchParams.set(k,v);return new Response(null,{status:303,headers:{Location:u.href,'Cache-Control':'no-store',...(cookie?{'Set-Cookie':cookie}:{})}});}
const clearCookie='dd_oauth=; Path=/oauth/authorize; HttpOnly; Secure; SameSite=Lax; Max-Age=0';
async function issue(env,grant){const access='dd_at_'+random(),refresh='dd_rt_'+random(),expires=now()+3600;
 const statements=[env.DB.prepare('INSERT INTO oauth_tokens(hash,grant_id,kind,expires,used) VALUES (?,?,?,?,0)').bind(await digest(access),grant.id,'access',expires)];
 if(grant.scope.split(' ').includes('offline_access'))statements.push(env.DB.prepare('INSERT INTO oauth_tokens(hash,grant_id,kind,expires,used) VALUES (?,?,?,?,0)').bind(await digest(refresh),grant.id,'refresh',Math.min(now()+30*86400,grant.expires)));
 await env.DB.batch(statements);return {access_token:access,token_type:'Bearer',expires_in:3600,scope:grant.scope,...(statements.length>1?{refresh_token:refresh}:{})};}
export async function oauthAccess(token,env,origin){if(!token.startsWith('dd_at_')||token.length>150)return null;
 const row=await env.DB.prepare('SELECT g.*,t.expires AS token_expires FROM oauth_tokens t JOIN oauth_grants g ON g.id=t.grant_id WHERE t.hash=? AND t.kind=\'access\'').bind(await digest(token)).first();
 if(!row||row.revoked||row.expires<=now()||row.token_expires<=now()||![origin,origin+'/mcp'].includes(row.resource))return null;
 try{return row.key_hash===await fingerprint(env,row.access)?row.access:null;}catch{return null;}}
export function oauthRoute(path){return path.startsWith('/oauth/')||path.startsWith('/.well-known/');}
export async function oauth(request,env){const u=new URL(request.url),origin=u.origin,path=u.pathname;
 try{
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization'}});
 if(request.method==='GET'&&(path==='/.well-known/oauth-protected-resource'||path==='/.well-known/oauth-protected-resource/mcp'))return json({resource:origin+'/mcp',authorization_servers:[origin],scopes_supported:SCOPES,bearer_methods_supported:['header'],resource_name:'Debug Day'});
 if(request.method==='GET'&&(path==='/.well-known/oauth-authorization-server'||path==='/.well-known/openid-configuration'))return json({issuer:origin,authorization_endpoint:origin+'/oauth/authorize',token_endpoint:origin+'/oauth/token',registration_endpoint:origin+'/oauth/register',revocation_endpoint:origin+'/oauth/revoke',response_types_supported:['code'],grant_types_supported:['authorization_code','refresh_token'],token_endpoint_auth_methods_supported:['none'],code_challenge_methods_supported:['S256'],scopes_supported:SCOPES,authorization_response_iss_parameter_supported:true,client_id_metadata_document_supported:true});
 if(path==='/oauth/register'&&request.method==='POST'){
  const m=await params(request);if(!Array.isArray(m.redirect_uris)||!m.redirect_uris.length||m.redirect_uris.length>5||!m.redirect_uris.every(redirectAllowed))throw fail('invalid_redirect_uri','Only official ChatGPT and Claude HTTPS callbacks are supported.');
  if(m.token_endpoint_auth_method&&m.token_endpoint_auth_method!=='none')throw fail('invalid_client_metadata','Use token_endpoint_auth_method none and PKCE S256.');
  const id='dd_client_'+random(),metadata={client_id:id,client_id_issued_at:now(),client_name:String(m.client_name||'AI assistant').slice(0,100),redirect_uris:m.redirect_uris,token_endpoint_auth_method:'none',grant_types:['authorization_code','refresh_token'],response_types:['code'],scope:scopeValue(m.scope)};
  await env.DB.prepare('INSERT INTO oauth_clients(id,metadata) VALUES (?,?)').bind(id,JSON.stringify(metadata)).run();return json(metadata,201);
 }
 if(path==='/oauth/authorize'&&request.method==='GET'){
  const p=Object.fromEntries(u.searchParams),c=await client(env,p.client_id);if(!c.redirect_uris.includes(p.redirect_uri)||!redirectAllowed(p.redirect_uri))throw fail('invalid_request','Redirect URI does not match the registered client.');
  if(p.response_type!=='code'||p.code_challenge_method!=='S256'||!/^[-_A-Za-z0-9]{43}$/.test(p.code_challenge||''))throw fail('invalid_request','Authorization code with PKCE S256 is required.');if(p.state&&p.state.length>2048)throw fail('invalid_request','State too long.');
  const data={client_id:p.client_id,redirect_uri:p.redirect_uri,challenge:p.code_challenge,state:p.state,scope:scopeValue(p.scope),resource:resourceValue(p.resource,origin)},pending=random(),nonce=random();
  await env.DB.batch([env.DB.prepare('DELETE FROM oauth_pending WHERE expires < ?').bind(now()),env.DB.prepare('DELETE FROM oauth_codes WHERE expires < ?').bind(now()),env.DB.prepare('DELETE FROM oauth_tokens WHERE expires < ?').bind(now()),env.DB.prepare('INSERT INTO oauth_pending(id,nonce_hash,data,expires,attempts) VALUES (?,?,?,?,0)').bind(pending,await digest(nonce),JSON.stringify(data),now()+600)]);
  const canWrite=data.scope.split(' ').includes('mcp:write');const html=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Connect Debug Day</title><style>body{color:#e8e8e8;background:#141414;font:16px system-ui;max-width:460px;margin:8vh auto;padding:24px}input,select,button{box-sizing:border-box;width:100%;padding:13px;margin:10px 0 24px;background:#242424;color:inherit;border:1px solid #666;border-radius:8px}button{background:#ff9c4a;color:#171717;font-weight:600;cursor:pointer}.muted{color:#bbb;font-size:14px;overflow-wrap:anywhere}label{display:block}</style><h1>Connect Debug Day</h1><p>Allow <b>${esc(c.client_name)}</b> to use your private planner.</p><p class="muted">Return address: ${esc(data.redirect_uri)}</p><form method="post" action="/oauth/authorize"><input type="hidden" name="pending" value="${pending}"><input type="hidden" name="nonce" value="${nonce}"><label>Access<select name="access"><option value="read">Read only</option>${canWrite?'<option value="write">Read and edit</option>':''}</select></label><label>MCP key<input name="key" type="password" required minlength="32" maxlength="512" autocomplete="off" placeholder="Paste MCP_READ_TOKEN or MCP_WRITE_TOKEN"></label><p class="muted">Use the matching key from PRIVATE-KEYS.txt. Your key stays on this site and is never sent to the assistant. Do not use SYNC_TOKEN.</p><button name="decision" value="allow">Allow connection</button><button name="decision" value="deny" formnovalidate>Cancel</button></form></html>`;
  return new Response(html,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'same-origin','X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",'Set-Cookie':`dd_oauth=${nonce}; Path=/oauth/authorize; HttpOnly; Secure; SameSite=Lax; Max-Age=600`}});
 }
 if(path==='/oauth/authorize'&&request.method==='POST'){
  // Privacy settings can omit Origin or send literal null on form POSTs.
  // A matching one-time nonce in both the HttpOnly cookie and form is mandatory below.
  const formOrigin=request.headers.get('Origin'),site=request.headers.get('Sec-Fetch-Site');
  if(site==='cross-site'||formOrigin&&formOrigin!=='null'&&formOrigin!==origin)throw fail('access_denied','Invalid form origin.',403);const p=await params(request),row=await env.DB.prepare('SELECT * FROM oauth_pending WHERE id=?').bind(p.pending||'').first(),cookie=/\bdd_oauth=([^;]+)/.exec(request.headers.get('Cookie')||'')?.[1];
  if(!row||row.expires<=now()||row.attempts>=5||!p.nonce||p.nonce!==cookie||await digest(p.nonce)!==row.nonce_hash)throw fail('access_denied','This sign-in expired. Start the connection again.',403);const data=JSON.parse(row.data);
  if(p.decision==='deny'){await env.DB.prepare('DELETE FROM oauth_pending WHERE id=?').bind(row.id).run();return redirectResponse(data.redirect_uri,{error:'access_denied',state:data.state,iss:origin},clearCookie);}
  await env.DB.prepare('UPDATE oauth_pending SET attempts=attempts+1 WHERE id=?').bind(row.id).run();const access=p.access;if(!['read','write'].includes(access)||p.decision!=='allow'||access==='write'&&!data.scope.split(' ').includes('mcp:write'))throw fail('access_denied','Invalid consent.',403);
  const valid=access==='write'?await same(p.key,env.MCP_WRITE_TOKEN):(await same(p.key,env.MCP_READ_TOKEN)||await same(p.key,env.MCP_WRITE_TOKEN));if(!valid)throw fail('access_denied','Incorrect MCP key. Go back to try again, or restart the connection.',403);
  const consumed=await env.DB.prepare('DELETE FROM oauth_pending WHERE id=? AND attempts<=5 RETURNING id').bind(row.id).first();if(!consumed)throw fail('access_denied','This sign-in was already completed.',403);
  const code='dd_code_'+random(),scope=data.scope.split(' ').filter(s=>access==='write'||s!=='mcp:write').join(' '),grant={id:random(),client_id:data.client_id,resource:data.resource,scope,access,key_hash:await fingerprint(env,access),expires:now()+90*86400};
  await env.DB.batch([env.DB.prepare('INSERT INTO oauth_grants(id,client_id,resource,scope,access,key_hash,expires,revoked) VALUES (?,?,?,?,?,?,?,0)').bind(grant.id,grant.client_id,grant.resource,grant.scope,grant.access,grant.key_hash,grant.expires),env.DB.prepare('INSERT INTO oauth_codes(hash,grant_id,redirect_uri,challenge,expires) VALUES (?,?,?,?,?)').bind(await digest(code),grant.id,data.redirect_uri,data.challenge,now()+120)]);
  return redirectResponse(data.redirect_uri,{code,state:data.state,iss:origin},clearCookie);
 }
 if(path==='/oauth/token'&&request.method==='POST'){
  const p=await params(request);await client(env,p.client_id);let grant;
  if(p.grant_type==='authorization_code'){
   const row=await env.DB.prepare('SELECT * FROM oauth_codes WHERE hash=?').bind(await digest(p.code||'')).first();if(!row||row.expires<=now()||!/^[-._~A-Za-z0-9]{43,128}$/.test(p.code_verifier||'')||await digest(p.code_verifier)!==row.challenge||p.redirect_uri!==row.redirect_uri)throw fail('invalid_grant','Invalid or expired authorization code.');
   grant=await env.DB.prepare('SELECT * FROM oauth_grants WHERE id=?').bind(row.grant_id).first();if(!grant||grant.client_id!==p.client_id||p.resource&&resourceValue(p.resource,origin)!==grant.resource)throw fail('invalid_grant','Client or resource mismatch.');
   if(!await env.DB.prepare('DELETE FROM oauth_codes WHERE hash=? RETURNING hash').bind(row.hash).first())throw fail('invalid_grant','Code already used.');
  }else if(p.grant_type==='refresh_token'){
   const row=await env.DB.prepare('SELECT * FROM oauth_tokens WHERE hash=? AND kind=\'refresh\'').bind(await digest(p.refresh_token||'')).first();if(!row||row.expires<=now())throw fail('invalid_grant','Invalid or expired refresh token.');
   grant=await env.DB.prepare('SELECT * FROM oauth_grants WHERE id=?').bind(row.grant_id).first();if(!grant||grant.client_id!==p.client_id||p.resource&&resourceValue(p.resource,origin)!==grant.resource)throw fail('invalid_grant','Client or resource mismatch.');
   if(p.scope&&p.scope.split(' ').some(s=>!grant.scope.split(' ').includes(s)))throw fail('invalid_scope','Scope escalation is not allowed.');
   if(!await env.DB.prepare('UPDATE oauth_tokens SET used=1 WHERE hash=? AND used=0 RETURNING hash').bind(row.hash).first()){await env.DB.prepare('UPDATE oauth_grants SET revoked=1 WHERE id=?').bind(grant.id).run();throw fail('invalid_grant','Refresh token reused; reconnect this client.');}
  }else throw fail('unsupported_grant_type','Use authorization_code or refresh_token.');
  if(grant.revoked||grant.expires<=now()||grant.key_hash!==await fingerprint(env,grant.access))throw fail('invalid_grant','Access revoked. Reconnect this client.');return json(await issue(env,grant));
 }
 if(path==='/oauth/revoke'&&request.method==='POST'){
  const p=await params(request),row=await env.DB.prepare('SELECT grant_id FROM oauth_tokens WHERE hash=?').bind(await digest(p.token||'')).first();if(row)await env.DB.prepare('UPDATE oauth_grants SET revoked=1 WHERE id=? AND client_id=?').bind(row.grant_id,p.client_id||'').run();return json({});
 }
 return json({error:'not_found'},404);
 }catch(e){return json({error:e.oauthError||'server_error',error_description:e.oauthError?e.message:'OAuth is not ready. Apply the database migration and retry.'},e.status||503);}
}
