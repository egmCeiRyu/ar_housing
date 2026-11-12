(() => {
 const container=document.getElementById('furnitureFloors');
 function validate(floors) {
  if(floors.length>100)throw new Error('階数は100まで登録できます。');
  const names=new Set();
  return floors.map(floor=>{
   const name=floor.name.trim(),url=floor.url.trim();
   if(!name||name.length>80)throw new Error('階の名前は1〜80文字で入力してください。');
   if(names.has(name))throw new Error('階の名前が重複しています。');
   names.add(name);
   try {if(new URL(url).protocol!=='https:'||url.length>2048||/\s/.test(url))throw Error();}catch{throw new Error('各階のGLBにはHTTPS URLを入力してください。');}
   return {name,url};
  });
 }
 function add(floor) {
  if(container.children.length>=100){alert('階数は100まで登録できます。');return;}
  const existing=new Set([...container.querySelectorAll('[data-floor-name]')].map(input=>input.value.trim()));
  let number=1;while(existing.has(number+'階'))number++;
  const row=document.createElement('div');row.className='furniture-floor-row';
  const nameLabel=document.createElement('label'),urlLabel=document.createElement('label');
  nameLabel.textContent='階の名前';urlLabel.textContent='GLB URL';
  const name=document.createElement('input'),url=document.createElement('input');
  name.dataset.floorName='';name.maxLength=80;name.value=floor?.name??number+'階';name.placeholder='例：3階';
  url.dataset.floorUrl='';url.type='url';url.maxLength=2048;url.placeholder='https://…';url.value=floor?.url??'';
  nameLabel.append(name);urlLabel.append(url);
  const remove=document.createElement('button');remove.type='button';remove.textContent='階を削除';remove.addEventListener('click',()=>row.remove());
  row.append(nameLabel,urlLabel,remove);container.append(row);
 }
 function render(floors){container.replaceChildren();floors.forEach(add);}
 function read(){return validate([...container.children].map(row=>({name:row.querySelector('[data-floor-name]').value,url:row.querySelector('[data-floor-url]').value})));}
 document.getElementById('addFurnitureFloor').addEventListener('click',()=>add());
 window.projectFloors={render,read,add,validate};
})();
