export function createFurnitureMenu(entries, container) {
 container.replaceChildren();
 const groups=new Map();
 for(const entry of entries){const name=entry.category||'その他';if(!groups.has(name))groups.set(name,[]);groups.get(name).push(entry);}
 const buttons=[],dialogs=[];
 function pieceButton(entry,text,preview=false){
  const button=document.createElement('button');button.type='button';button.dataset.piece=entry.id;
  if(preview&&entry.thumbnail){const image=document.createElement('img');image.src=entry.thumbnail;image.alt='';image.loading='lazy';image.draggable=false;button.append(image);}
  const label=document.createElement('span');label.textContent=text;button.append(label);buttons.push(button);return button;
 }
 for(const [name,items] of groups){
  if(items.length===1){container.append(pieceButton(items[0],name));continue;}
  const launcher=document.createElement('button');launcher.type='button';launcher.textContent=name;launcher.disabled=true;launcher.setAttribute('aria-haspopup','dialog');
  const dialog=document.createElement('dialog');dialog.className='furniture-menu';dialog.setAttribute('aria-label',name+'を選ぶ');
  const heading=document.createElement('div');heading.className='furniture-menu-heading';const title=document.createElement('h2');title.textContent=name;
  const close=document.createElement('button');close.type='button';close.textContent='閉じる';close.addEventListener('click',()=>dialog.close());heading.append(title,close);
  const hint=document.createElement('p');hint.textContent='左右にスワイプして、配置する家具を選んでください。';
  const track=document.createElement('div');track.className='catalog-carousel';track.setAttribute('aria-label',name+'の家具');
  const pieces=items.map(entry=>pieceButton(entry,entry.name,true));track.append(...pieces);dialog.append(heading,hint,track);container.append(launcher,dialog);dialogs.push(dialog);
  launcher.addEventListener('click',()=>dialog.showModal());
  const sync=()=>{launcher.disabled=pieces.every(piece=>piece.disabled);launcher.setAttribute('aria-pressed',String(pieces.some(piece=>piece.getAttribute('aria-pressed')==='true')));};
  const observer=new MutationObserver(sync);for(const piece of pieces)observer.observe(piece,{attributes:true,attributeFilter:['disabled','aria-pressed']});sync();
  let drag=null,moved=false;
  track.addEventListener('pointerdown',event=>{moved=false;if(event.pointerType==='mouse'&&event.button===0)drag={id:event.pointerId,x:event.clientX,left:track.scrollLeft};});
  track.addEventListener('pointermove',event=>{if(!drag||drag.id!==event.pointerId)return;const dx=event.clientX-drag.x;if(Math.abs(dx)>6)moved=true;if(moved){track.setPointerCapture(event.pointerId);track.scrollLeft=drag.left-dx;event.preventDefault();}});
  track.addEventListener('pointerup',()=>{drag=null;});track.addEventListener('pointercancel',()=>{drag=null;});
  track.addEventListener('click',event=>{if(moved&&event.detail){event.preventDefault();event.stopImmediatePropagation();}},true);
 }
 return {buttons,close(){for(const dialog of dialogs)if(dialog.open)dialog.close();}};
}
