/* Local, portable client review. No account, backend or tracking. */
(() => {
 'use strict';
 const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
 const catalog=window.GUIYUAN_ROOMS;
 if(!catalog)return;
 const key='guiyuan-review-v7-20261014';let data={},active=null,tool='circle',draft=null,start=null,lastFocus;
 const canvas=$('#review-canvas'),ctx=canvas.getContext('2d'),dlg=$('#review-dialog'),img=new Image();
 const valid=(raw)=>{
  const clean={};if(!raw||typeof raw!=='object')return clean;
  for(const room of catalog){const arr=raw[room.id];if(!Array.isArray(arr))continue;
   clean[room.id]=arr.slice(0,60).filter(n=>n&&['circle','pin'].includes(n.type)&&['x','y','w','h'].every(k=>Number.isFinite(n[k])&&n[k]>=0&&n[k]<=1)).map(n=>({id:String(n.id||Date.now()).slice(0,60),type:n.type,x:n.x,y:n.y,w:Math.min(n.w,1-n.x),h:Math.min(n.h,1-n.y),text:String(n.text||'').slice(0,500)}));}
  return clean;
 };
 try{data=valid(JSON.parse(localStorage.getItem(key)||'{}'));}catch{}
 function announce(s){$('#review-status').textContent=s;$('#gallery-status').textContent=s;}
 function save(){try{localStorage.setItem(key,JSON.stringify(data));announce('已保存在此浏览器。点击“复制意见链接”发给设计方。');}catch{announce('此浏览器无法保存；请导出意见文件。');}updateBadges();}
 function count(){return Object.values(data).reduce((n,a)=>n+a.length,0);}
 function updateBadges(){ $('#review-count').textContent=count()+' 条意见';$$('[data-review]').forEach(b=>{const n=data[b.dataset.review]?.length||0;b.title=n?`已有 ${n} 条本地意见`:'';}); }
 function drawOne(n,i){
  const W=canvas.width,H=canvas.height;ctx.save();ctx.strokeStyle='#ca513a';ctx.fillStyle='#ca513a';ctx.lineWidth=Math.max(3,W/340);
  if(n.type==='circle'){ctx.beginPath();ctx.ellipse((n.x+n.w/2)*W,(n.y+n.h/2)*H,n.w*W/2,n.h*H/2,0,0,Math.PI*2);ctx.stroke();}
  const x=Math.max(16,Math.min(W-16,n.x*W)),y=Math.max(16,Math.min(H-16,n.y*H));ctx.beginPath();ctx.arc(x,y,14,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fff';ctx.font='bold 16px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(i),x,y);ctx.restore();
 }
 function draw(){if(!img.complete||!img.naturalWidth)return;ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);(data[active.id]||[]).forEach((n,i)=>drawOne(n,i+1));if(draft)drawOne(draft,(data[active.id]?.length||0)+1);}
 function notes(){const list=$('#review-notes');list.replaceChildren();(data[active.id]||[]).forEach((n,i)=>{const li=document.createElement('li');const text=document.createElement('p');text.textContent=`${i+1}. ${n.text||'圈点待讨论'}`;const b=document.createElement('button');b.textContent='删除';b.setAttribute('aria-label',`删除第 ${i+1} 条意见`);b.onclick=()=>{data[active.id]=data[active.id].filter(x=>x.id!==n.id);save();notes();draw();};li.append(text,b);list.append(li);});$('#empty-notes').hidden=!!list.children.length;}
 function open(id){active=catalog.find(x=>x.id===id);if(!active)return;lastFocus=document.activeElement;draft=null;$('#review-text').value='';$('#review-title').textContent=active.name;$('#review-detail').textContent=active.detail;img.onload=()=>{canvas.width=Math.min(1600,img.naturalWidth);canvas.height=Math.round(canvas.width*img.naturalHeight/img.naturalWidth);draw();};img.onerror=()=>announce('图片加载失败，请关闭后重试。');img.src=active.image;notes();announce('在图片上拖动圈选，或切换“标记点”，再填写意见。');if(!dlg.open)dlg.showModal();document.body.style.overflow='hidden';}
 window.openRoomReview=open;
 function renderGallery(filter='all'){
  const grid=$('#room-gallery');grid.replaceChildren();
  catalog.filter(r=>filter==='all'||r.floor===filter).forEach(r=>{const a=document.createElement('article');a.className='room-card';const b=document.createElement('button');b.className='room-photo';b.dataset.review=r.id;b.setAttribute('aria-label','查看并圈点 '+r.name);const im=document.createElement('img');im.src=r.image;im.alt=r.name+'室内设计效果';im.loading='lazy';b.append(im);b.onclick=()=>open(r.id);const t=document.createElement('div');t.className='room-info';const small=document.createElement('span');small.textContent=r.code+' / '+r.kind;const h=document.createElement('h3');h.textContent=r.name;const p=document.createElement('p');p.textContent=r.detail;const row=document.createElement('div');row.className='room-card-actions';const note=document.createElement('button');note.textContent='放大 / 圈点提建议 ↗';note.onclick=()=>open(r.id);row.append(note);if(r.mode){const model=document.createElement('button');model.textContent='在 3D 中看';model.onclick=()=>window.openRoom3D?.(r.id);row.append(model);}t.append(small,h,p,row);a.append(b,t);grid.append(a);});updateBadges();
 }
 $$('[data-room-filter]').forEach(b=>b.onclick=()=>{$$('[data-room-filter]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));renderGallery(b.dataset.roomFilter);});
 $$('[data-review-tool]').forEach(b=>b.onclick=()=>{tool=b.dataset.reviewTool;$$('[data-review-tool]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));draft=null;draw();});
 const point=e=>{const r=canvas.getBoundingClientRect();return{x:Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),y:Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))};};
 canvas.addEventListener('pointerdown',e=>{if(e.button>0)return;start=point(e);canvas.setPointerCapture(e.pointerId);draft={id:crypto.randomUUID(),type:tool,x:start.x,y:start.y,w:0,h:0,text:''};draw();});
 canvas.addEventListener('pointermove',e=>{if(!start||!draft)return;const p=point(e);if(tool==='circle'){draft.x=Math.min(p.x,start.x);draft.y=Math.min(p.y,start.y);draft.w=Math.abs(p.x-start.x);draft.h=Math.abs(p.y-start.y);}draw();});
 canvas.addEventListener('pointerup',()=>{if(!draft)return;start=null;if(draft.type==='circle'&&(draft.w<.005||draft.h<.005))draft.type='pin';draw();$('#review-text').focus({preventScroll:true});announce('已选中位置，请写下意见并点击“保存这条意见”。');});
 canvas.addEventListener('pointercancel',()=>{start=null;draft=null;draw();});
 $('#review-form').onsubmit=e=>{e.preventDefault();const value=$('#review-text').value.trim();if(!draft){announce('请先在图片上圈选或点一个位置。');return;}if(!value){announce('请填写一条具体意见。');$('#review-text').focus();return;}if((data[active.id]?.length||0)>=60){announce('每张图最多保存60条意见，请先导出。');return;}draft.text=value;(data[active.id]||=[]).push(draft);draft=null;$('#review-text').value='';save();notes();draw();};
 $('#review-undo').onclick=()=>{if(draft){draft=null;}else{data[active.id]?.pop();save();}notes();draw();};
 $('#review-close').onclick=()=>dlg.close();dlg.addEventListener('close',()=>{document.body.style.overflow='';lastFocus?.focus({preventScroll:true});});
 function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
 function exportJSON(){download(new Blob([JSON.stringify({project:'guiyuan',revision:'v7-20261014',created:new Date().toISOString(),reviews:data},null,2)],{type:'application/json'}),'归院-V7-意见.json');announce('意见文件已生成。可发给设计方或在另一台设备导入。');}
 $('#review-export-json').onclick=exportJSON;$('#all-reviews-export').onclick=exportJSON;
 $('#review-export-image').onclick=()=>{draw();const all=data[active.id]||[];const rows=all.flatMap((n,i)=>{const s=`${i+1}. ${n.text}`;return s.match(/.{1,54}/gu)||[''];});const out=document.createElement('canvas');out.width=canvas.width;out.height=canvas.height+90+rows.length*27;const c=out.getContext('2d');c.fillStyle='#f5f3ee';c.fillRect(0,0,out.width,out.height);c.drawImage(canvas,0,0);c.fillStyle='#273628';c.font='22px sans-serif';c.fillText('归院 V7 · '+active.name+' · 客户意见',24,canvas.height+35);c.font='18px sans-serif';rows.forEach((s,i)=>c.fillText(s,24,canvas.height+72+i*27));out.toBlob(b=>b&&download(b,`归院-${active.name}-圈点意见.png`));announce('已生成带圈点及意见文字的图片。');};
 async function share(){const raw=JSON.stringify({v:7,reviews:data}),bytes=new TextEncoder().encode(raw);if(bytes.length>18000){announce('意见较多，请导出意见文件发送。');return;}const encoded=btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');if(encoded.length>24000){announce('意见较多，请用“导出意见文件”，避免分享链接过长。');return;}const url=location.origin+location.pathname+'#review='+encoded;try{await navigator.clipboard.writeText(url);announce('已复制含全部意见的链接。请发给设计方；网站不会自动上传或集中收集。');}catch{const f=dlg.open?$('#share-link'):$('#gallery-share-link');f.hidden=false;f.value=url;f.select();announce('请复制下方链接发给设计方。');}}
 $('#review-share').onclick=share;$('#all-reviews-share').onclick=share;
 $('#review-import').onchange=async e=>{const f=e.target.files[0];if(!f)return;if(f.size>250000){announce('文件过大，无法导入。');return;}try{const x=JSON.parse(await f.text());if(x.revision!=='v7-20261014')throw Error('不是V7意见文件');const incoming=valid(x.reviews);for(const [id,arr] of Object.entries(incoming)){const merged=[...(data[id]||[]),...arr];data[id]=[...new Map(merged.map(n=>[n.id,n])).values()].slice(0,60);}save();if(active){notes();draw();}$('#gallery-status').textContent='意见已导入到本机，共 '+count()+' 条。';}catch(err){$('#gallery-status').textContent='无法导入：'+err.message;}e.target.value='';};
 $('#review-from-lightbox').onclick=()=>{const src=$('#lightbox-image').getAttribute('src');const item=catalog.find(r=>r.image===src);if(item){$('#image-dialog').close();open(item.id);}else{announce('请选择分区效果图进行圈点。');}};
 renderGallery();
 function readSharedReviews(){if(location.hash.startsWith('#review=')){try{const token=location.hash.slice(8);if(token.length>250000)throw Error();const raw=atob(token.replace(/-/g,'+').replace(/_/g,'/'));const x=JSON.parse(new TextDecoder().decode(Uint8Array.from(raw,c=>c.charCodeAt(0))));if(x.v!==7)throw Error();const incoming=valid(x.reviews);for(const [id,arr]of Object.entries(incoming)){data[id]=[...new Map([...(data[id]||[]),...arr].map(n=>[n.id,n])).values()].slice(0,60);}updateBadges();$('#gallery-status').textContent='已打开分享意见；编辑后保存在本机，可导出或再次分享。';const first=Object.keys(incoming).find(k=>incoming[k].length);if(first)open(first);}catch{$('#gallery-status').textContent='分享链接无效，请使用导出的意见文件。';}}}
 window.addEventListener('hashchange',readSharedReviews);readSharedReviews();
})();
