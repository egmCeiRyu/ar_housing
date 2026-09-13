const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync('js/auth.js', 'utf8');
(async () => {
  for (const [label, user, error, expected] of [
    ['anonymous', null, null, false],
    ['customer', {app_metadata: {role:'client'}}, null, false],
    ['missing role', {app_metadata:{}}, null, false],
    ['forged user metadata', {user_metadata:{role:'admin'}}, null, false],
    ['administrator', {app_metadata:{role:'admin'}}, null, true],
    ['invalid token', {app_metadata:{role:'admin'}}, {message:'invalid'}, false]
  ]) {
    let redirected = false;
    const context = vm.createContext({supabaseClient:{auth:{getUser:async()=>({data:{user},error})}},window:{location:{replace:()=>{redirected=true}}}});
    vm.runInContext(source,context);
    assert.equal(await context.requireAdmin(),expected,label);
    assert.equal(redirected,!expected,label);
  }
  const context = vm.createContext({supabaseClient:{auth:{getUser:async()=>{throw Error('offline')}}},window:{location:{replace:()=>{}}}});
  vm.runInContext(source,context);
  assert.equal(await context.requireAdmin(),false);
  for(const file of fs.readdirSync('js').filter(f=>f.endsWith('.js'))) {
    const text=fs.readFileSync('js/'+file,'utf8');
    new vm.Script(text,{filename:file});
    if (text.includes('await requireAdmin();')) assert(text.includes('if (!ok) return;'),file);
  }
  console.log('PASS: seven authorization cases, redirect behavior, JS syntax and initialization guards.');
})();
