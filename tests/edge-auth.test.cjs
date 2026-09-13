const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { stripTypeScriptTypes } = require('node:module');

(async () => {
  let checks = 0;
  for (const name of ['create-client-user', 'update-client-login', 'create-s3-upload-url']) {
    const source = fs.readFileSync(`supabase/functions/${name}/index.ts`, 'utf8');
    const code = stripTypeScriptTypes(source.replace(/import[\s\S]*?from\s+["'][^"']+["'];/g, ''));
    for (const [label, token, user, error, status] of [
      ['missing token', null, null, null, 401],
      ['invalid token', 'invalid', null, {message:'invalid'}, 401],
      ['customer', 'customer', {app_metadata:{role:'client'}}, null, 403],
      ['forged metadata', 'customer', {user_metadata:{role:'admin'}}, null, 403],
      ['admin reaches validation', 'admin', {app_metadata:{role:'admin'}}, null, 400]
    ]) {
      let handler;
      const context = vm.createContext({
        Response, console, Deno:{env:{get:key=>key}},
        serve:fn=>{handler=fn},
        createClient:(url,key)=>{
          assert.equal(key,'SUPABASE_ANON_KEY','privileged client must not be created');
          return {auth:{getUser:async()=>({data:{user},error})}};
        }
      });
      vm.runInContext(code,context);
      const response = await handler(new Request('https://example.com',{
        method:'POST', headers: token ? {Authorization:`Bearer ${token}`} : {}, body:'{}'
      }));
      assert.equal(response.status,status,`${name}: ${label}`);
      checks++;
    }
  }
  console.log(`PASS: ${checks} Edge Function authorization cases.`);
})();
