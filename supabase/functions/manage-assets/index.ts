import { createClient } from "npm:@supabase/supabase-js@2";
import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand } from "npm:@aws-sdk/client-s3";
import { getSignedUrl } from "npm:@aws-sdk/s3-request-presigner";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const allowedOrigins = new Set(['https://qrie.ceiryu.workers.dev','https://egmceiryu.github.io','http://127.0.0.1:4174','http://localhost:4174']);
const types: Record<string, string> = { glb: 'model/gltf-binary', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' };
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const demand = (condition: unknown, message: string) => { if (!condition) throw new Error(message); };
function metadata(body: any) {
    demand(typeof body.name === 'string' && body.name.trim().length > 0 && body.name.trim().length <= 120, '名前を確認してください。');
    demand(typeof body.category_id === 'string' && body.category_id.length <= 40, 'カテゴリーを確認してください。');
    demand(['active','inactive'].includes(body.status), '状態を確認してください。');
    for (const key of ['width','height','depth']) demand(typeof body[key] === 'number' && Number.isFinite(body[key]) && body[key] >= 0 && body[key] < 1000, '寸法を確認してください。');
    demand(Array.isArray(body.project_ids) && body.project_ids.length <= 200 && body.project_ids.every(uuid), 'プロジェクトを確認してください。');
    return { name: body.name.trim(), category_id: body.category_id, width: body.width, depth: body.depth, height: body.height, status: body.status };
}
serve(async req => {
    const origin = req.headers.get('Origin');
    const headers = { 'Access-Control-Allow-Origin': origin && allowedOrigins.has(origin) ? origin : 'https://qrie.ceiryu.workers.dev', 'Access-Control-Allow-Headers': 'authorization,x-client-info,apikey,content-type', 'Access-Control-Allow-Methods': 'POST,OPTIONS', 'Vary': 'Origin', 'Content-Type': 'application/json', 'Cache-Control':'no-store' };
    const reply = (data: unknown, status=200) => new Response(JSON.stringify(data), {status,headers});
    if (origin && !allowedOrigins.has(origin)) return reply({error:'Origin not allowed'},403);
    if (req.method === 'OPTIONS') return new Response(null,{status:204,headers});
    if (req.method !== 'POST') return reply({error:'Method not allowed'},405);
    const token = req.headers.get('Authorization')?.match(/^Bearer (.+)$/i)?.[1];
    if (!token) return reply({error:'Unauthorized'},401);
    const auth = createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!);
    const {data:authData,error:authError} = await auth.auth.getUser(token);
    if (authError || !authData.user) return reply({error:'Unauthorized'},401);
    if (authData.user.app_metadata?.role !== 'admin') return reply({error:'Forbidden'},403);
    try {
        demand(Number(req.headers.get('Content-Length') || 0) <= 32768, 'リクエストが大きすぎます。');
        const body = await req.json();
        const actions = ['list','begin','complete','update','delete','restore'];
        demand(actions.includes(body.action), 'Invalid action');
        const db = createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
        const s3 = new S3Client({region:Deno.env.get('AWS_REGION')!,credentials:{accessKeyId:Deno.env.get('AWS_ACCESS_KEY_ID')!,secretAccessKey:Deno.env.get('AWS_SECRET_ACCESS_KEY')!}});
        const bucket = Deno.env.get('AWS_BUCKET_NAME')!;
        const signedRead = (key: string) => getSignedUrl(s3,new GetObjectCommand({Bucket:bucket,Key:key}),{expiresIn:3600});
        if (body.action === 'list') {
            const page = Number.isInteger(body.page) && body.page >= 0 ? Math.min(body.page,10000) : 0;
            let query = db.from('assets').select('*',{count:'exact'}).order('created_at',{ascending:false}).order('id').range(page*24,page*24+23);
            if (body.status) { demand(['draft','active','inactive','deleted'].includes(body.status),'Invalid status'); query=query.eq('status',body.status); }
            else query=query.neq('status','deleted');
            if (body.category_id) query=query.eq('category_id',body.category_id);
            if (body.search) { demand(typeof body.search==='string' && body.search.length<=120,'Invalid search'); query=query.ilike('name','%'+body.search.replace(/[\\%_]/g,'\\$&')+'%'); }
            const {data,error,count}=await query; if(error) throw error;
            const assets=await Promise.all((data||[]).map(async asset=>({...asset,thumbnail_url:asset.status==='draft'?null:await signedRead(asset.thumbnail_s3_key)})));
            return reply({assets,count,page});
        }
        if (body.action === 'begin') {
            const meta=metadata(body);
            demand(typeof body.filename==='string' && body.filename.length<=255,'ファイル名を確認してください。');
            const extension=body.filename.split('.').pop().toLowerCase(); const contentType=types[extension];
            demand(contentType,'GLB・PNG・JPEG・WebP を選択してください。');
            const model=extension==='glb';
            demand(Number.isInteger(body.file_size)&&body.file_size>0&&body.file_size<=(model?104857600:20971520),'ファイルサイズが上限を超えています。');
            demand(Number.isInteger(body.thumbnail_size)&&body.thumbnail_size>0&&body.thumbnail_size<=2097152,'サムネイルが大きすぎます。');
            demand(body.pivot_offset===null || (Array.isArray(body.pivot_offset)&&body.pivot_offset.length===3&&body.pivot_offset.every((n:unknown)=>typeof n==='number'&&Number.isFinite(n))),'Invalid pivot');
            // Prevent uncontrolled catalog growth on the shared free database.
            const {count,error:countError}=await db.from('assets').select('id',{count:'exact',head:true}); if(countError) throw countError;
            demand((count||0)<2000,'ライブラリの登録上限に達しました。');
            const id=crypto.randomUUID(); const base=`qrie-assets/${model?'furniture':'textures'}/${id}`;
            const assetKey=`${base}/original.${extension==='jpeg'?'jpg':extension}`,thumbKey=`${base}/thumbnail.webp`;
            const {error}=await db.from('assets').insert({...meta,id,status:'draft',desired_status:meta.status,asset_type:model?'model':'texture',s3_key:assetKey,thumbnail_s3_key:thumbKey,original_filename:body.filename,content_type:contentType,file_size:body.file_size,thumbnail_size:body.thumbnail_size,pivot_offset:body.pivot_offset,created_by:authData.user.id}); if(error) throw error;
            const upload=async(key:string,type:string)=>getSignedUrl(s3,new PutObjectCommand({Bucket:bucket,Key:key,ContentType:type,CacheControl:'private, max-age=3600'}),{expiresIn:300});
            return reply({id,upload_url:await upload(assetKey,contentType),thumbnail_upload_url:await upload(thumbKey,'image/webp'),content_type:contentType});
        }
        demand(uuid(body.id),'Invalid asset id');
        const {data:asset,error:assetError}=await db.from('assets').select('*').eq('id',body.id).single(); if(assetError||!asset) return reply({error:'Asset not found'},404);
        if (body.action === 'complete') {
            demand(asset.status==='draft','Asset already completed');
            for (const [key,size,type] of [[asset.s3_key,asset.file_size,asset.content_type],[asset.thumbnail_s3_key,asset.thumbnail_size,'image/webp']]) {
                const head=await s3.send(new HeadObjectCommand({Bucket:bucket,Key:key}));
                demand(head.ContentLength===Number(size)&&head.ContentType===type,'アップロードしたファイルを確認できませんでした。');
            }
            const {error}=await db.from('assets').update({status:asset.desired_status,uploaded_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',asset.id).eq('status','draft'); if(error) throw error;
            return reply({id:asset.id});
        }
        if (body.action === 'update') {
            demand(['active','inactive'].includes(asset.status),'Asset cannot be edited');
            const meta=metadata(body);
            const {error}=await db.rpc('save_asset_metadata',{target_id:asset.id,metadata:meta,project_ids:[...new Set(body.project_ids)]}); if(error) throw error;
            return reply({id:asset.id});
        }
        if (body.action === 'delete' || body.action === 'restore') {
            const status=body.action==='delete'?'deleted':'inactive';
            demand(body.action==='delete'||(asset.status==='deleted'&&asset.uploaded_at),'Asset cannot be restored');
            const {error}=await db.from('assets').update({status,updated_at:new Date().toISOString()}).eq('id',asset.id); if(error) throw error;
            return reply({id:asset.id});
        }
        return reply({error:'Invalid action'},400);
    } catch(error) {
        console.error('Asset operation failed:',error instanceof Error?error.message:'Database operation');
        return reply({error:error instanceof Error?error.message:'保存できませんでした。もう一度お試しください。'},400);
    }
});
