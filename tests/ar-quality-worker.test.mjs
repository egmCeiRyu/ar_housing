import assert from 'node:assert/strict';
import worker,{fetchLightVariant} from '../ar-model-worker.mjs';
const source='https://assets.s3.ap-northeast-1.amazonaws.com/house.glb?v=1';
function glb(){let json=new TextEncoder().encode(JSON.stringify({asset:{version:'2.0'},scenes:[{nodes:[0]}],nodes:[{}]}));const n=Math.ceil(json.length/4)*4,b=new Uint8Array(20+n),v=new DataView(b.buffer);v.setUint32(0,0x46546c67,true);v.setUint32(4,2,true);v.setUint32(8,b.length,true);v.setUint32(12,n,true);v.setUint32(16,0x4e4f534a,true);b.fill(32,20);b.set(json,20);return b;}
const requests=[];let variant={sourceUrl:source,light:'house01-light.glb?v=test'};
const env={SUPABASE_URL:'https://database.example',SUPABASE_PUBLISHABLE_KEY:'test',ASSETS:{async fetch(req){const u=new URL(req.url);requests.push(u.pathname);if(u.pathname.endsWith('ar-variants.json'))return Response.json({house01:variant});if(u.pathname==='/models/house01-light.glb')return new Response(glb());return new Response('asset');}}};
const original=globalThis.fetch;let fullDownloads=0;globalThis.fetch=async url=>{if(String(url).startsWith(env.SUPABASE_URL))return Response.json([{glb_url:source}]);fullDownloads++;return new Response(glb());};
try{
 let response=await worker.fetch(new Request('https://qrie.example/ar-model.glb?slug=house01&percent=5&quality=light'),env);assert.equal(response.status,200);let bytes=new Uint8Array(await response.arrayBuffer());let n=new DataView(bytes.buffer).getUint32(12,true);let model=JSON.parse(new TextDecoder().decode(bytes.slice(20,20+n)));assert.deepEqual(model.nodes.at(-1).scale,[.05,.05,.05]);assert.equal(fullDownloads,0);assert(requests.includes('/models/house01-light.glb'));
 response=await worker.fetch(new Request('https://qrie.example/ar-model.glb?slug=house01&percent=100'),env);assert.equal(response.status,200);await response.arrayBuffer();assert.equal(fullDownloads,1);
 variant={sourceUrl:source+'new',light:'house01-light.glb'};assert.equal(await fetchLightVariant(new Request('https://qrie.example/ar-model.glb'),env,'house01',source),null);
 variant={sourceUrl:source,light:'https://external.example/model.glb'};assert.equal(await fetchLightVariant(new Request('https://qrie.example/ar-model.glb'),env,'house01',source),null);
 response=await worker.fetch(new Request('https://qrie.example/ar-model.glb?slug=house01&percent=garbage'),env);assert.equal(response.status,400);
 response=await worker.fetch(new Request('https://qrie.example/ar-model.glb',{method:'POST'}),env);assert.equal(response.status,405);
 console.log('PASS Android AR: light asset selection and scale, full mode preservation, stale/external variant rejection, invalid input.');
}finally{globalThis.fetch=original}
