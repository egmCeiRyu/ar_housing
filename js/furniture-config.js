const bucket='https://ar-housing-platform-418384447723-ap-northeast-1-an.s3.ap-northeast-1.amazonaws.com/';
function assetUrl(key) {
 if(typeof key!=='string'||!key.startsWith('clients/')||key.split('/').some(part=>part==='..')) throw new Error('Invalid asset key');
 return bucket+key.split('/').map(encodeURIComponent).join('/');
}
export function furnitureCatalog(config) {
 const models=(config.assets||[]).filter(asset=>asset.asset_type==='model');
 const supports=models.filter(asset=>/table|storage|tvbench|テーブル|収納|ラック|テレビボード/i.test(asset.category_name+' '+asset.name));
 const entries=models.map(asset=>({id:asset.id,name:asset.name,category:asset.category_name||'その他',thumbnail:asset.thumbnail_s3_key?assetUrl(asset.thumbnail_s3_key):null,url:assetUrl(asset.s3_key),scale:1,
 dimensions:[asset.width,asset.height,asset.depth],
 placement:!supports.some(support=>support.id===asset.id)&&/^テレビ$|^tv$/i.test(asset.category_name)?'surface':'floor',supportTypes:supports.map(item=>item.id)}));
 return {entries, floors:config.floors, wallpapers:(config.assets||[]).filter(asset=>asset.asset_type==='texture'&&asset.category_name==='壁紙').map(asset=>({id:asset.id,name:asset.name,url:assetUrl(asset.s3_key),thumbnail:assetUrl(asset.thumbnail_s3_key)}))};
}
