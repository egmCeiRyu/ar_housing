import { createAssetPreview } from './asset-preview.js?v=1';
const $ = id => document.getElementById(id);
const state = { categories: [], projects: [], assets: [], page: 0, count: 0, editing: null, prepared: null, file: null, busy: false, request: 0, previewRequest: 0 };
const labels = { active:'有効',inactive:'無効',draft:'未完了',deleted:'削除済み' };
let searchTimer;
async function api(body) {
    const {data,error}=await supabaseClient.functions.invoke('manage-assets',{body});
    if(error) {
        let detail;
        try { detail=await error.context?.json(); } catch {}
        throw new Error(detail?.error || '接続できませんでした。権限とネットワークを確認してください。');
    }
    if(data?.error) throw new Error(data.error);
    return data;
}
function sortCategories(categories) {
    return [...categories].sort((a,b)=>Number(a.id==='other')-Number(b.id==='other'));
}
function option(value,text) { const item=document.createElement('option'); item.value=value; item.textContent=text; return item; }
function message(text) { $('notice').textContent=text; }
function releasePreview() { state.previewRequest++; state.prepared?.dispose(); state.prepared=null; state.file=null; $('asset-preview').replaceChildren(); }
function setBusy(value) {
    state.busy=value; document.body.classList.toggle('busy',value);
    for(const control of $('asset-form').querySelectorAll('input,select,button')) control.disabled=value;
    if(!value) $('asset-file').disabled=Boolean(state.editing);
}
function projects(selected=[]) {
    const chosen=new Set(selected); $('project-options').replaceChildren();
    for(const project of state.projects) {
        const label=document.createElement('label'), checkbox=document.createElement('input');
        checkbox.type='checkbox'; checkbox.value=project.id; checkbox.checked=chosen.has(project.id);
        label.append(checkbox,document.createTextNode(project.label||project.name||'名称未設定')); $('project-options').append(label);
    }
    if(!state.projects.length) $('project-options').textContent='プロジェクトがありません。';
    $('project-search').value='';
}
async function loadAssets() {
    $('clear-trash').hidden=true;
    const request=++state.request;
    message('アセットを読み込んでいます…');
    try {
        const result=await api({action:'list',page:state.page,search:$('search').value.trim().slice(0,120),category_id:$('category-filter').value,status:$('status-filter').value});
        if(request!==state.request) return;
        state.assets=result.assets; state.count=result.count;
        $('asset-grid').replaceChildren();
        for(const asset of state.assets) {
            const card=document.createElement('button'); card.type='button'; card.className='asset-card';
            card.setAttribute('aria-label',asset.name+'を編集');
            const image=document.createElement('img'); image.alt=''; image.loading='lazy';
            if(asset.thumbnail_url) image.src=asset.thumbnail_url;
            const content=document.createElement('div'); content.className='card-content';
            const badge=document.createElement('span'); badge.className='badge '+asset.status; badge.textContent=labels[asset.status];
            const title=document.createElement('h3'); title.textContent=asset.name;
            const category=document.createElement('p'); category.textContent=state.categories.find(item=>item.id===asset.category_id)?.name||'';
            const size=document.createElement('p'); size.textContent=asset.asset_type==='model'?[asset.width,asset.depth,asset.height].map(n=>(n*100).toFixed(1)).join(' × ')+' cm':'テクスチャ';
            content.append(badge,title,category,size); card.append(image,content); card.addEventListener('click',()=>openAsset(asset)); $('asset-grid').append(card);
        }
        if(!state.assets.length) { const empty=document.createElement('p'); empty.className='empty'; empty.textContent='アセットがありません。「アセットを追加」から登録してください。'; $('asset-grid').append(empty); }
        $('asset-count').textContent=state.count+' 件'; $('page-label').textContent=(state.page+1)+' / '+Math.max(1,Math.ceil(state.count/24));
        $('clear-trash').hidden=$('status-filter').value!=='deleted'||!state.assets.some(asset=>asset.status==='deleted');
        $('previous-page').disabled=state.page===0; $('next-page').disabled=(state.page+1)*24>=state.count;
        message('GLB・画像は S3 に保存されます。');
    } catch(error) { if(request===state.request) message(error.message); }
}
async function openAsset(asset=null) {
    if(state.busy) return;
    releasePreview(); state.editing=asset; setBusy(false); $('asset-form').reset(); $('form-status').textContent=''; $('preview-details').textContent='';
    $('upload-progress').hidden=true; $('upload-progress').value=0;
    $('dialog-title').textContent=asset?'アセットを編集':'アセットを追加';
    $('asset-name').value=asset?.name||''; $('asset-category').value=asset?.category_id||state.categories[0]?.id||'';
    for(const key of ['width','depth','height']) $('asset-'+key).value=((asset?.[key]||0)*100).toFixed(1);
    $('asset-status').value=asset?.status==='active'?'active':'inactive'; if(!asset) $('asset-status').value='active';
    $('asset-file').disabled=Boolean(asset); $('delete-asset').hidden=!asset||asset.status==='deleted';
    $('restore-asset').hidden=asset?.status!=='deleted'; $('restore-asset').disabled=asset?.status==='deleted'&&!asset.uploaded_at;
    $('save-asset').hidden=Boolean(asset&&['draft','deleted'].includes(asset.status));
    projects();
    if(asset?.thumbnail_url) { const image=document.createElement('img'); image.src=asset.thumbnail_url; image.alt=asset.name; $('asset-preview').append(image); }
    if(asset) $('preview-details').textContent=asset.original_filename+' · '+(asset.file_size/1048576).toFixed(1)+' MB';
    if(asset?.status==='draft') $('form-status').textContent='アップロードが完了していません。削除してから、もう一度登録してください。';
    $('asset-dialog').showModal();
    if(asset) {
        $('save-asset').disabled=true;
        const {data,error}=await supabaseClient.from('project_assets').select('project_id').eq('asset_id',asset.id).eq('enabled',true);
        if(state.editing!==asset||!$('asset-dialog').open) return;
        if(error) { $('form-status').textContent='プロジェクト設定を読み込めませんでした。画面を開き直してください。'; $('save-asset').disabled=true; return; }
        projects((data||[]).map(item=>item.project_id));
        $('save-asset').disabled=false;
    }
}
function closeDialog() { if(state.busy)return; $('asset-dialog').close(); releasePreview(); state.editing=null; }
$('new-asset').addEventListener('click',()=>openAsset());
$('close-dialog').addEventListener('click',closeDialog); $('cancel-dialog').addEventListener('click',closeDialog);
$('asset-dialog').addEventListener('cancel',event=>{event.preventDefault(); closeDialog();});
$('asset-file').addEventListener('change',async()=>{
    const file=$('asset-file').files[0]; releasePreview();
    if(!file)return;
    const request=state.previewRequest;
    const ext=file.name.split('.').pop().toLowerCase();
    if(!['glb','png','jpg','jpeg','webp'].includes(ext)||file.size>(ext==='glb'?100:20)*1048576) { $('form-status').textContent='対応形式とファイルサイズを確認してください。';return; }
    $('form-status').textContent='プレビューとサムネイルを作成しています…'; $('save-asset').disabled=true;
    try {
        const target=document.createElement('div');
        target.style.cssText='width:100%;height:100%';
        const prepared=await createAssetPreview(file,target);
        if(request!==state.previewRequest||!$('asset-dialog').open) { prepared.dispose();return; }
        $('asset-preview').replaceChildren(target);
        state.prepared=prepared; state.file=file;
        if(!$('asset-name').value) $('asset-name').value=file.name.replace(/\.[^.]+$/,'').slice(0,120);
        for(const key of ['width','depth','height']) $('asset-'+key).value=(prepared[key]*100).toFixed(1);
        $('preview-details').textContent=prepared.details;
        $('form-status').textContent='プレビューを確認して保存してください。';
    } catch(error) { if(request===state.previewRequest) $('form-status').textContent=error.message; }
    finally { if(request===state.previewRequest) $('save-asset').disabled=false; }
});
function upload(url,blob,contentType,progress) {
    return new Promise((resolve,reject)=>{
        const request=new XMLHttpRequest(); request.open('PUT',url); request.timeout=300000;
        request.setRequestHeader('Content-Type',contentType);
        request.upload.onprogress=event=>{if(event.lengthComputable)progress(event.loaded/event.total);};
        request.onload=()=>{
            if(request.status>=200&&request.status<300) { resolve(); return; }
            const xml=new DOMParser().parseFromString(request.responseText,'application/xml');
            const code=xml.querySelector('Code')?.textContent?.slice(0,80)||'UploadFailed';
            reject(new Error('S3 ('+request.status+'): '+code+'。アップロードできませんでした。'));
        };
        request.onerror=request.ontimeout=()=>reject(new Error('アップロードが中断されました。接続を確認してください。'));
        request.send(blob);
    });
}
$('asset-form').addEventListener('submit',async event=>{
    event.preventDefault(); if(state.busy)return;
    if(!state.editing&&!state.prepared) { $('form-status').textContent='先にファイルを選択してください。'; return; }
    const metadata={name:$('asset-name').value.trim(),category_id:$('asset-category').value,status:$('asset-status').value,
        project_ids:[...$('project-options').querySelectorAll('input:checked')].map(item=>item.value)};
    for(const key of ['width','height','depth']) metadata[key]=Number($('asset-'+key).value)/100;
    setBusy(true); $('form-status').textContent='保存しています…';
    let createdId=null;
    try {
        let id=state.editing?.id;
        if(!id) {
            const prepared=state.prepared;
            const begin=await api({action:'begin',...metadata,filename:state.file.name,file_size:state.file.size,thumbnail_size:prepared.thumbnail.size,pivot_offset:prepared.pivotOffset});
            createdId=id=begin.id; $('upload-progress').hidden=false;
            await upload(begin.upload_url,state.file,begin.content_type,n=>{$('upload-progress').value=n*90;});
            await upload(begin.thumbnail_upload_url,prepared.thumbnail,'image/webp',n=>{$('upload-progress').value=90+n*10;});
            await api({action:'complete',id});
        }
        await api({action:'update',id,...metadata});
        setBusy(false); closeDialog(); await loadAssets(); message('アセットを保存しました。');
    } catch(error) {
        $('form-status').textContent=error.message+(createdId?' 登録内容は一覧に残ります。画面を閉じて確認してください。':'');
        // Prevent a retry from silently creating a duplicate after an interrupted upload.
        if(createdId) { state.editing={id:createdId}; $('save-asset').hidden=true; }
    } finally { setBusy(false); }
});
$('delete-asset').addEventListener('click',()=>{$('delete-dialog').showModal();});
$('cancel-delete').addEventListener('click',()=>{$('delete-dialog').close();});
$('confirm-delete').addEventListener('click',async()=>{
    if(state.busy)return;
    $('delete-dialog').close(); setBusy(true);
    try { await api({action:'delete',id:state.editing.id}); setBusy(false); closeDialog(); await loadAssets(); message('削除しました。「削除済み」から復元できます。'); }
    catch(error) { $('form-status').textContent=error.message; }
    finally { setBusy(false); }
});
$('restore-asset').addEventListener('click',async()=>{
    if(state.busy)return; setBusy(true);
    try { await api({action:'restore',id:state.editing.id}); setBusy(false); closeDialog(); await loadAssets(); message('無効の状態で復元しました。'); }
    catch(error){$('form-status').textContent=error.message;}
    finally{setBusy(false);}
});
$('project-search').addEventListener('input',()=>{const query=$('project-search').value.toLowerCase(); for(const label of $('project-options').children)label.hidden=!label.textContent.toLowerCase().includes(query);});
$('search').addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>{state.page=0;loadAssets();},500);});
for(const id of ['category-filter','status-filter']) $(id).addEventListener('change',()=>{state.page=0;loadAssets();});
$('previous-page').addEventListener('click',()=>{if(state.page>0){state.page--;loadAssets();}});
$('next-page').addEventListener('click',()=>{state.page++;loadAssets();});
let trashBusy=false;
let pendingTrashIds=[];
$('clear-trash').addEventListener('click',()=>{
    pendingTrashIds=state.assets.filter(asset=>asset.status==='deleted').map(asset=>asset.id);
    if(!pendingTrashIds.length)return;
    $('trash-description').textContent='このページの削除済み登録 '+pendingTrashIds.length+' 件を完全に消去します。ほかのページや有効なアセットは対象外です。';
    $('trash-confirm').checked=false;$('confirm-trash').disabled=true;$('trash-notice').textContent='';$('trash-dialog').showModal();
});
$('trash-confirm').addEventListener('change',()=>{$('confirm-trash').disabled=trashBusy||!$('trash-confirm').checked;});
function closeTrash(){if(trashBusy)return;$('trash-dialog').close();pendingTrashIds=[];}
$('cancel-trash').addEventListener('click',closeTrash);
$('trash-dialog').addEventListener('cancel',event=>{event.preventDefault();closeTrash();});
$('confirm-trash').addEventListener('click',async()=>{
    if(trashBusy||!$('trash-confirm').checked||!pendingTrashIds.length)return;
    trashBusy=true;for(const control of $('trash-dialog').querySelectorAll('button,input'))control.disabled=true;
    $('trash-notice').textContent='消去しています…';
    try {
        const result=await api({action:'clear_trash',ids:pendingTrashIds});
        $('trash-dialog').close();pendingTrashIds=[];state.page=0;await loadAssets();
        message(result.removed+' 件の登録を消去しました。'+(result.protected?' '+result.protected+' 件はプロジェクトで使用中のため保護されました。':'')+' S3の元ファイルは保持されています。');
    } catch(error){$('trash-notice').textContent=error.message;}
    finally{trashBusy=false;for(const control of $('trash-dialog').querySelectorAll('button,input'))control.disabled=false;$('confirm-trash').disabled=!$('trash-confirm').checked;}
});
let categoryBusy=false;
let managedCategories=[];
let deletingCategory=null;
function setCategoryBusy(value) {
    categoryBusy=value;
    for(const dialog of [$('category-dialog'),$('category-delete-dialog')]) {
        for(const control of dialog.querySelectorAll('input,select,button')) control.disabled=value;
    }
    if(!value&&state.categories.length<=1) for(const button of $('category-list').querySelectorAll('[data-category-delete]')) button.disabled=true;
}
function syncCategoryOptions() {
    const filter=$('category-filter').value, selected=$('asset-category').value;
    state.categories=managedCategories.filter(category=>!category.archived_at);
    $('category-filter').replaceChildren(option('','すべてのカテゴリー'));
    $('asset-category').replaceChildren();
    for(const category of state.categories) {
        $('category-filter').append(option(category.id,category.name));
        $('asset-category').append(option(category.id,category.name));
    }
    $('category-filter').value=state.categories.some(category=>category.id===filter)?filter:'';
    $('asset-category').value=state.categories.some(category=>category.id===selected)?selected:state.categories[0]?.id||'';
}
async function refreshManagedCategories() {
    const result=await api({action:'category_list',include_archived:$('show-archived-categories').checked});
    managedCategories=sortCategories(result.categories);
    syncCategoryOptions();
    $('category-list').replaceChildren();
    for(const category of managedCategories) {
        const row=document.createElement('div');row.className='category-row';
        const label=document.createElement('label');
        const caption=document.createElement('small');caption.textContent=category.asset_count+' 件'+(category.archived_at?' · 削除済み':'');
        const input=document.createElement('input');input.value=category.name;input.maxLength=80;input.required=true;
        input.setAttribute('aria-label','カテゴリー名：'+category.name);
        label.append(caption,input);row.append(label);
        const save=document.createElement('button');save.type='button';save.textContent=category.archived_at?'復元':'名前を保存';
        save.addEventListener('click',()=>{
            if(!input.reportValidity())return;
            changeCategory(category.archived_at?'category_restore':'category_rename',{id:category.id,name:input.value},'カテゴリーを保存しました。');
        });row.append(save);
        if(!category.archived_at) {
            const remove=document.createElement('button');remove.type='button';remove.className='danger';remove.textContent='削除';remove.dataset.categoryDelete=category.id;
            remove.disabled=state.categories.length<=1;
            remove.addEventListener('click',()=>openCategoryDelete(category));row.append(remove);
        }
        $('category-list').append(row);
    }
}
async function changeCategory(action,values,success) {
    if(categoryBusy)return;
    setCategoryBusy(true);$('category-notice').textContent='保存しています…';
    try {
        await api({action,...values});
        if(action==='category_create')$('new-category-name').value='';
        await refreshManagedCategories();state.page=0;await loadAssets();
        $('category-notice').textContent=success;
    } catch(error){$('category-notice').textContent=error.message;}
    finally{setCategoryBusy(false);}
}
$('manage-categories').addEventListener('click',async()=>{
    if(state.busy||categoryBusy)return;
    $('category-notice').textContent='カテゴリーを読み込んでいます…';$('category-dialog').showModal();setCategoryBusy(true);
    try {await refreshManagedCategories();$('category-notice').textContent='';}
    catch(error){$('category-notice').textContent=error.message;}
    finally{setCategoryBusy(false);}
});
function closeCategories(){if(categoryBusy)return;$('category-dialog').close();$('manage-categories').focus();}
$('close-categories').addEventListener('click',closeCategories);
$('category-dialog').addEventListener('cancel',event=>{event.preventDefault();closeCategories();});
$('category-create-form').addEventListener('submit',event=>{event.preventDefault();changeCategory('category_create',{name:$('new-category-name').value},'カテゴリーを追加しました。');});
$('show-archived-categories').addEventListener('change',async()=>{
    if(categoryBusy)return;setCategoryBusy(true);
    try{await refreshManagedCategories();}catch(error){$('category-notice').textContent=error.message;}finally{setCategoryBusy(false);}
});
function openCategoryDelete(category) {
    if(categoryBusy)return;deletingCategory=category;
    $('category-delete-description').textContent='「'+category.name+'」を削除します。アセット '+category.asset_count+' 件（削除済みを含む）の移動先を確認してください。';
    $('category-delete-target').replaceChildren(option('',Number(category.asset_count)>0?'移動先を選択':'移動しない（空の場合のみ）'));
    for(const target of state.categories)if(target.id!==category.id)$('category-delete-target').append(option(target.id,target.name));
    $('category-delete-target').required=Number(category.asset_count)>0;
    $('category-delete-notice').textContent='';$('category-delete-dialog').showModal();
}
function closeCategoryDelete(){if(categoryBusy)return;$('category-delete-dialog').close();deletingCategory=null;}
$('cancel-category-delete').addEventListener('click',closeCategoryDelete);
$('category-delete-dialog').addEventListener('cancel',event=>{event.preventDefault();closeCategoryDelete();});
$('category-delete-form').addEventListener('submit',async event=>{
    event.preventDefault();if(categoryBusy||!deletingCategory)return;setCategoryBusy(true);$('category-delete-notice').textContent='保存しています…';
    try {
        await api({action:'category_delete',id:deletingCategory.id,target_category_id:$('category-delete-target').value||null});
        $('category-delete-dialog').close();deletingCategory=null;
        await refreshManagedCategories();state.page=0;await loadAssets();
        $('category-notice').textContent='カテゴリーを削除しました。アセットとファイルは保持されています。';
    } catch(error){$('category-delete-notice').textContent=error.message;}
    finally{setCategoryBusy(false);}
});
try {
    if(await requireAdmin()) {
        const [categories,properties]=await Promise.all([
            supabaseClient.from('asset_categories').select('id,name').is('archived_at',null).order('sort_order'),
            supabaseClient.from('properties').select('id,name,clients(company_name)').order('name').limit(200)
        ]);
        if(categories.error||properties.error) throw new Error('ライブラリを初期化できませんでした。管理者に連絡してください。');
        state.categories=sortCategories(categories.data);state.projects=(properties.data||[]).map(project=>({...project,label:(project.clients?.company_name||'顧客未設定')+' → '+(project.name||'名称未設定')}));
        for(const category of state.categories) { $('category-filter').append(option(category.id,category.name));$('asset-category').append(option(category.id,category.name)); }
        $('new-asset').disabled=false;
        $('manage-categories').disabled=false;
        await loadAssets();
    }
} catch(error){message(error.message);}
