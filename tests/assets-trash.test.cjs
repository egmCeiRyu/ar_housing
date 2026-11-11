const fs=require('node:fs');const vm=require('node:vm');const assert=require('node:assert/strict');const {stripTypeScriptTypes}=require('node:module');
const source=fs.readFileSync('supabase/functions/manage-assets/index.ts','utf8');const code=stripTypeScriptTypes(source.replace(/import[\s\S]*?from\s+["'][^"']+["'];/g,''));
(async()=>{
 const id='00000000-0000-4000-8000-000000000001';let checks=0;
 for(const ids of [undefined,[],['invalid'],Array(25).fill(id),[id,id]]) {
  let handler,rpcCalls=0;
  const context={Response,console:{error(){}},Deno:{env:{get:key=>key}},serve:fn=>handler=fn,
   createClient:(url,key)=>key==='SUPABASE_ANON_KEY'?{auth:{getUser:async()=>({data:{user:{app_metadata:{role:'admin'}}},error:null})}}:{rpc:async(name,args)=>{rpcCalls++;assert.equal(name,'clear_asset_trash');assert.equal(args.asset_ids.length,1);assert.equal(args.asset_ids[0],id);return{data:{removed:1,protected:1},error:null}}},
   S3Client:class {constructor(){throw Error('Metadata cleanup must not access S3')}}};
  vm.runInNewContext(code,context);
  const response=await handler(new Request('https://example.com',{method:'POST',headers:{Authorization:'Bearer administrator','Content-Type':'application/json'},body:JSON.stringify({action:'clear_trash',ids})}));
  const valid=Array.isArray(ids)&&ids.length===2;
  assert.equal(response.status,valid?200:400);assert.equal(rpcCalls,valid?1:0);
  if(valid)assert.deepEqual(await response.json(),{removed:1,protected:1});checks++;
 }
 console.log(`PASS: ${checks} cleanup validation/deduplication cases; no S3 client initialized.`);
})();
