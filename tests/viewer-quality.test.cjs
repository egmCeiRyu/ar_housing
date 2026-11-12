const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const scope={URL};vm.runInNewContext(fs.readFileSync(__dirname+'/../js/viewer-quality.js','utf8')+';globalThis.quality=QRIEViewerQuality;',scope);
const project={slug:'house01',glb_url:'https://assets.s3.ap-northeast-1.amazonaws.com/house.glb?v=1'};
const variants={house01:{sourceUrl:project.glb_url,light:'house01-light.glb?v=abc'}};
const options={baseUrl:'https://qrie.example/models/ar-variants.json'};const resolve=o=>scope.quality.resolve(project,variants,{...options,...o});
assert.equal(resolve({mobile:true}).mode,'light');assert.equal(resolve({mobile:false}).mode,'full');assert.equal(resolve({mobile:true,saved:'full'}).mode,'full');assert.equal(resolve({mobile:false,saved:'full',requested:'light'}).mode,'light');assert.equal(resolve({mobile:true,requested:'invalid',saved:'full'}).mode,'full');assert.equal(resolve({mobile:true}).url,'https://qrie.example/models/house01-light.glb?v=abc');
assert.equal(scope.quality.resolve({...project,glb_url:project.glb_url+'new'},variants,options).available,false);
for(const bad of ['https://other.example/model.glb','../secret.glb','model.usdz']){assert.equal(scope.quality.resolve(project,{house01:{sourceUrl:project.glb_url,light:bad}},options).available,false)}
assert.equal(scope.quality.resolve({slug:'other',glb_url:project.glb_url},variants,options).available,false);
console.log('PASS quality selection: mobile/desktop defaults, explicit choice, saved preference, stale/missing variants and restricted asset paths.');
