const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const {stripTypeScriptTypes}=require('node:module');
const source=fs.readFileSync('supabase/functions/manage-assets/index.ts','utf8');
const code=stripTypeScriptTypes(source.replace(/import[\s\S]*?from\s+["'][^"']+["'];/g,''));
(async()=>{
 let checks=0;
 const actions=['list','begin','complete','update','delete','restore'];
 for(const action of actions) for(const [token,user,error,expected] of [
  [null,null,null,401],['invalid',null,{message:'invalid'},401],
  ['client',{app_metadata:{role:'client'}},null,403],
  ['forged',{user_metadata:{role:'admin'}},null,403]
 ]) {
  let handler;
  vm.runInNewContext(code,{Response,console,Deno:{env:{get:key=>key}},serve:fn=>handler=fn,
    createClient:(url,key)=>{assert.equal(key,'SUPABASE_ANON_KEY');return {auth:{getUser:async()=>({data:{user},error})}}}});
  const response=await handler(new Request('https://example.com',{method:'POST',headers:token?{Authorization:`Bearer ${token}`}:{},body:JSON.stringify({action})}));
  assert.equal(response.status,expected,`${action}: ${token}`);checks++;
 }
 let handler;
 vm.runInNewContext(code,{Response,console,Deno:{env:{get:key=>key}},serve:fn=>handler=fn,
  createClient:()=>{throw Error('Cross-origin request must not initialize a client')}});
 assert.equal((await handler(new Request('https://example.com',{method:'POST',headers:{Origin:'https://untrusted.example'}}))).status,403);checks++;
 assert.equal((await handler(new Request('https://example.com',{method:'OPTIONS',headers:{Origin:'https://qrie.ceiryu.workers.dev'}}))).status,204);checks++;
 assert.equal((await handler(new Request('https://example.com',{method:'GET'}))).status,405);checks++;
 console.log(`PASS: ${checks} asset authorization, origin and method checks.`);
})();
