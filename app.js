/* Client presentation. Two tiled-roof schemes, metric geometry and a private master suite. */
(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const scheme = new URLSearchParams(location.search).get('scheme') === '1' ? 1 : 2;
  $$('#room-camera option').forEach(o=>{o.value=o.value.replace(/^r3-[12]-/,`r3-${scheme}-`);});
  const schemeSelect = $('#scheme-select'); schemeSelect.value = String(scheme);
  $('#scheme-label').textContent = scheme === 1 ? '方案1 · 原房间尺度' : '方案2 · 大中厅';
  schemeSelect.onchange = () => { const u=new URL(location.href);u.searchParams.set('scheme',schemeSelect.value);u.searchParams.delete('view');u.searchParams.delete('room');u.hash='model';location.assign(u.href); };
  const imageInfo = {
    'tiled-option2': ['方案2 · 大中厅与完整灰瓦顶', 'assets/tiled-r1/option2-imagegen-exterior.jpg'],
    'tiled-option1': ['方案1 · 原房间尺度与完整灰瓦顶', 'assets/tiled-r1/option1-imagegen-exterior.jpg'],
    'tiled-roof': ['完整四坡瓦屋顶 · 非上人屋面', 'assets/tiled-r1/option2-blender-roof.jpg']
  };
  let currentHero = 'tiled-option2', lastImageButton;
  $$('[data-hero]').forEach(b => b.addEventListener('click', () => {
    currentHero = b.dataset.hero === 'dusk' ? 'tiled-option1' : 'tiled-option2';
    $('#hero-image').src = imageInfo[currentHero][1];
    $('#hero-image').alt = imageInfo[currentHero][0] + '，屋檐投影在12×11米范围内，不增加外圈过道';
    $('.hero-figure .image-open').dataset.image = currentHero;
    $('.hero-figure .image-open').setAttribute('aria-label', '放大查看' + imageInfo[currentHero][0]);
    $$('[data-hero]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  }));
  const dialog = $('#image-dialog');
  $$('[data-image]').forEach(b => b.addEventListener('click', () => {
    const info = imageInfo[b.dataset.image];
    $('#lightbox-title').textContent = info[0];
    $('#lightbox-image').src = info[1];
    $('#lightbox-image').alt = info[0];
    $('#download-image').href = info[1].includes('imagegen') ? info[1].replace('.jpg','.png') : info[1];
    $('#download-image').download = b.dataset.image + (info[1].includes('imagegen') ? '.png' : '.jpg');
    lastImageButton = b;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
  }));
  $('#close-dialog').onclick = () => dialog.close();
  dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });
  dialog.addEventListener('close', () => { document.body.style.overflow = $('#model-panel').classList.contains('fullscreen-fallback')?'hidden':''; lastImageButton?.focus({preventScroll:true}); });

  const stage = $('#stage'), status = $('#model-status'), panel = $('#model-panel');
  const motionReduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let api = null, loadPromise;
  const loadModel = () => loadPromise || (loadPromise = fetch(`assets/house-option${scheme}-tiled.json?v=windows-r3`)
    .then(r => { if (!r.ok) throw new Error('模型文件暂时不可用'); return r.json(); })
    .then(async data => { if (!window.THREE || !window.GLTFLoader) throw new Error('三维引擎未能加载'); const detail=await new window.GLTFLoader().loadAsync(`assets/house-option${scheme}-tiled.glb?v=windows-r3`); api = createModel(data,detail.scene);const initialView=new URLSearchParams(location.search).get('view');if(['floor1','floor2','roof'].includes(initialView))api.setMode(initialView);const initialRoom=new URLSearchParams(location.search).get('room');const room=window.GUIYUAN_ROOMS.find(r=>r.id===initialRoom);if(room?.camera)api.setRoom(initialRoom);else if(room?.view)api.setView(room.view);return api; })
    .catch(e => {
      const el = $('#model-loading'); el.replaceChildren();
      const msg = document.createElement('div'); msg.className = 'error-fallback';
      msg.textContent = '当前浏览器暂时无法显示三维模型。可以先查看上方效果图，或换用支持 WebGL 的浏览器。';
      const retry = document.createElement('button'); retry.textContent = '重新加载'; retry.onclick = () => location.reload();
      msg.append(document.createElement('br'), retry); el.append(msg);
      status.textContent = '三维模型未加载：' + e.message;
      console.error('Model unavailable:', e);
      return null;
    }));
  const observer = new IntersectionObserver(entries => {
    if (entries.some(x => x.isIntersecting)) { loadModel(); observer.disconnect(); }
  }, {rootMargin:'450px'});
  observer.observe(stage);
  window.openRoom3D = async id => { const r=window.GUIYUAN_ROOMS.find(x=>x.id===id);if(!r)return;if(r.scheme&&r.scheme!==scheme){const u=new URL(location.href);u.searchParams.set('scheme',r.scheme);u.searchParams.set('view',r.mode||'all');u.searchParams.set('room',id);u.hash='model';location.assign(u.href);return;} $('#model').scrollIntoView({behavior:motionReduced?'auto':'smooth'});const model=await loadModel();if(r.camera)model?.setRoom(id);else {model?.setMode(r.mode||'all');if(r.view)model?.setView(r.view);} };
  $$('[data-jump]').forEach(b => b.onclick = async () => {
    $('#model').scrollIntoView({behavior:motionReduced ? 'auto' : 'smooth'});
    const model = await loadModel(); model?.setMode(b.dataset.jump);
  });

  function createModel(HOUSE, detailModel) {
    for (const b of HOUSE.boxes) {
      if (b.p[0] < -1e-6 || b.p[1] < -1e-6 || b.p[0]+b.size[0] > 12.000001 || b.p[1]+b.size[1] > 11.000001) {
        throw new Error('模型外包超出12×11米控制范围');
      }
    }
    const T = THREE;
    const renderer = new T.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true,powerPreference:'high-performance'});
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.localClippingEnabled = true;
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.03;
    renderer.setClearColor(0xeef0e8, 0);
    renderer.domElement.tabIndex = 0;
    renderer.domElement.setAttribute('role','img');
    renderer.domElement.setAttribute('aria-label','住宅三维模型。拖动或方向键旋转，加减键缩放，数字0复位。');
    stage.prepend(renderer.domElement);
    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(36, 1, .1, 250);
    const ambient = new T.HemisphereLight('#fff9ed', '#a8af9d', 1.0); scene.add(ambient);
    const sun = new T.DirectionalLight('#fff0d5', 2.0);
    sun.position.set(-12, 25, 16); sun.castShadow = true;
    sun.shadow.mapSize.set(2048,2048); sun.shadow.camera.left=-23; sun.shadow.camera.right=23;
    sun.shadow.camera.top=23; sun.shadow.camera.bottom=-23; sun.shadow.camera.near=1; sun.shadow.camera.far=80;
    sun.shadow.normalBias=.025; sun.shadow.bias=-.00015; scene.add(sun);
    const fill = new T.DirectionalLight('#d9e5e9', .65); fill.position.set(16,12,-15); scene.add(fill);
    const indoorAmbient = new T.AmbientLight('#fff8ed',1.4); indoorAmbient.visible=false;scene.add(indoorAmbient);
    // Neutral shadow plane is presentation background, not a site walkway or additional land.
    const ground = new T.Mesh(new T.PlaneGeometry(120,120),new T.ShadowMaterial({opacity:.17}));
    ground.rotation.x=-Math.PI/2; ground.position.y=-.215; ground.receiveShadow=true; scene.add(ground);
    const modelGroup = new T.Group(); scene.add(modelGroup);
    const dimGroup = new T.Group(); scene.add(dimGroup);
    const cube = new T.BoxGeometry(1,1,1), matrix = new T.Matrix4(), dummy = new T.Object3D();
    let seed = 721;
    const random = () => { seed=(seed*1664525+1013904223)>>>0; return seed/4294967296; };
    function surface(kind) {
      const c = document.createElement('canvas'); c.width=256; c.height=256;
      const ctx=c.getContext('2d'), img=ctx.createImageData(256,256);
      for(let i=0;i<img.data.length;i+=4){const n=180+Math.round(random()*36);img.data[i]=img.data[i+1]=img.data[i+2]=n;img.data[i+3]=255;}
      ctx.putImageData(img,0,0);
      if(kind==='wood'){for(let i=0;i<120;i++){ctx.strokeStyle='rgba(70,70,70,.10)';ctx.lineWidth=1+random()*2;const x=random()*256;ctx.beginPath();ctx.moveTo(x,0);ctx.bezierCurveTo(x+random()*8,85,x-random()*8,175,x,256);ctx.stroke();}}
      const tex=new T.CanvasTexture(c);tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.repeat.set(kind==='wood'?2:5,kind==='wood'?1:5);tex.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),4);return tex;
    }
    const textures={plaster:surface('plaster'),stone:surface('stone'),wood:surface('wood')};
    const palette={plaster:'#e7e3d9',stone:'#bbbcb4',dark:'#343d38',wood:'#9c7951',glass:'#a9b9b4',floor:'#d8ccb7',tile:'#bfc2b8',fabric:'#e4dbc7',green:'#728161',white:'#f0eee5',ground:'#d4d7cd',light:'#f4ddab'};
    const mats={};
    for(const[k,v]of Object.entries(HOUSE.materials)) {
      const opt={color:palette[k]||v.color,roughness:k==='glass'?.16:v.roughness,metalness:k==='dark'?.32:0,transparent:k==='glass',opacity:k==='glass'?.46:1,depthWrite:k!=='glass'};
      if(textures[k]){opt.bumpMap=textures[k];opt.bumpScale=k==='plaster'?.018:.025;}
      if(k==='light'){opt.emissive='#d9a75b';opt.emissiveIntensity=.3;}
      mats[k]=new T.MeshStandardMaterial(opt);
    }
    let mode='all',view='perspective',dark=false,dimensions=true,autoRotate=false,inside=null;
    let az=.60,el=.50,dist=31,target=new T.Vector3(0,4.3,0),aim={az:.60,el:.50,dist:31,target:new T.Vector3(0,4.3,0)};
    let labels=[],dirty=true,inView=true,previousTime=0;
    const selectedViews={perspective:[.60,.50,31,'前侧鸟瞰'],front:[0,.095,29,'正面'],left:[-Math.PI/2,.13,29,'左侧'],rear:[Math.PI,.13,29,'背面'],right:[Math.PI/2,.13,29,'右侧'],top:[0,Math.PI/2-.001,30,'俯视']};
    const modes={all:['两层主体 · 四卧三卫 · 主卧套房',4.25],floor1:['长者／客卧 · 团聚厅 · 厨餐 · 公卫洗衣',.55],floor2:['主卧套房 · 两间客卧 · 公卫 · 家庭起居',4.05],roof:['完整四坡瓦屋顶 · 坡度35%暂定 · 非上人',7.7]};
    const lineMaterial = new T.LineBasicMaterial({color:'#78966b',transparent:true,opacity:.85,depthTest:false});
    function line(points) {const g=new T.BufferGeometry().setFromPoints(points.map(p=>new T.Vector3(...p)));const l=new T.Line(g,lineMaterial);l.renderOrder=8;dimGroup.add(l);}
    function addLabel(text,x,y,z,kind='') {const el=document.createElement('span');el.className='hotspot '+kind;el.textContent=text;$('#hotspots').append(el);labels.push({el,p:new T.Vector3(x,y,z),kind});}
    function dimensionsFor(level) {
      while(dimGroup.children.length){const child=dimGroup.children[0];child.geometry.dispose();dimGroup.remove(child);}
      const y=level+.025;
      line([[-6,y,-5.5],[6,y,-5.5],[6,y,5.5],[-6,y,5.5],[-6,y,-5.5]]);
      line([[-6,y,5.5],[-6,y,7.2]]);line([[6,y,5.5],[6,y,7.2]]);line([[-6,y,6.7],[6,y,6.7]]);
      line([[6,y,-5.5],[7.6,y,-5.5]]);line([[6,y,5.5],[7.6,y,5.5]]);line([[7.2,y,-5.5],[7.2,y,5.5]]);
      for(const x of [-6,6])line([[x-.16,y,6.5],[x+.16,y,6.9]]);
      for(const z of [-5.5,5.5])line([[7,y,z-.16],[7.4,y,z+.16]]);
      addLabel('12.00 m',0,y+.22,6.95,'dimension');
      addLabel('11.00 m',7.35,y+.22,0,'dimension');
      dimGroup.visible=dimensions;
    }
    function rebuild() {
      for(const child of [...modelGroup.children]){modelGroup.remove(child);child.dispose?.();}
      $('#hotspots').replaceChildren();labels=[];
      const bins={};
      for(const b of HOUSE.boxes){
        let[x,y,z]=b.p,[w,d,h]=b.size;
        if(mode==='floor1') {if(!['floor1','facade'].includes(b.group)||z>=1.3)continue;h=Math.min(h,1.3-z);}
        else if(mode==='floor2') {if(!['floor2','facade'].includes(b.group)||z>=4.9||z+h<=3.4)continue;const lo=Math.max(z,3.4);h=Math.min(z+h,4.9)-lo;z=lo;}
        else if(mode==='roof') {if(!['roof','roofhouse','pergola'].includes(b.group))continue;}
        if(h<=0)continue;
        (bins[b.mat] ||= []).push({x:x+w/2-6,y:z+h/2,z:y+d/2-5.5,w,h,d});
      }
      if(detailModel){
        modelGroup.add(detailModel);
        const planes=mode==='floor1'?[new T.Plane(new T.Vector3(0,-1,0),1.45)]:mode==='floor2'?[new T.Plane(new T.Vector3(0,-1,0),5.05)]:[];
        detailModel.traverse(o=>{if(!o.isMesh)return;const g=o.userData.group,zmin=o.userData.zmin||0,zmax=o.userData.zmax||0;
          o.visible=mode==='all'||(mode==='floor1'&&['floor1','facade'].includes(g)&&zmin<1.45)||(mode==='floor2'&&['floor2','facade'].includes(g)&&zmax>3.4&&zmin<5.05)||(mode==='roof'&&['roof','roofhouse','pergola'].includes(g));
          o.castShadow=true;o.receiveShadow=true;
          for(const m of(Array.isArray(o.material)?o.material:[o.material])){m.clippingPlanes=planes;m.clipShadows=true;m.needsUpdate=true;}
        });
      } else for(const[k,parts]of Object.entries(bins)){
        const inst=new T.InstancedMesh(cube,mats[k],parts.length);
        parts.forEach((p,i)=>{dummy.position.set(p.x,p.y,p.z);dummy.scale.set(p.w,p.h,p.d);dummy.rotation.set(0,0,0);dummy.updateMatrix();matrix.copy(dummy.matrix);inst.setMatrixAt(i,matrix);});
        inst.castShadow=k!=='glass';inst.receiveShadow=true;inst.instanceMatrix.needsUpdate=true;inst.computeBoundingSphere();modelGroup.add(inst);
      }
      if(mode==='floor1'||mode==='floor2'){
        const level=mode==='floor1'?1:2;
        for(const[name,x,y,w,d]of HOUSE.rooms[String(level)])if(!/走道|门廊|阳台|楼梯前厅/.test(name))addLabel(name,x+w/2-6,level===1?1.35:4.95,y+d/2-5.5);
      }
      if(mode==='roof'){
        addLabel('脊顶暂 +8.965m',0,9.15,0);addLabel('瓦面坡度 35%',0,8.1,3.0);addLabel('周边内收檐沟',4.7,7.5,5.0);
      }
      ground.visible=mode==='all';
      dimensionsFor(mode==='floor2'?3.6:mode==='roof'?6.9:0);
      updateLabels();dirty=true;
    }
    function updateUI(){
      indoorAmbient.visible=!!inside;
      $$('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===mode)));
      $$('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===view)));
      $('#model-view-name').textContent=inside?'室内 · '+inside.name:({all:'整栋',floor1:'一层',floor2:'二层',roof:'屋顶'}[mode])+' · '+selectedViews[view][3];
      $('#mode-description').textContent=inside?'Blender 家具与材质 · 拖动环视':modes[mode][0];
      status.textContent='方案'+scheme+' · '+$('#model-view-name').textContent;
    }
    function preset(instant=false){
      camera.fov=inside?70:36;camera.updateProjectionMatrix();
      const v=selectedViews[view];aim.az=v[0];aim.el=v[1];aim.dist=v[2];aim.target.set(0,modes[mode][1],0);
      if(mode!=='all'&&view==='perspective'){aim.el=1.06;aim.az=.18;aim.dist=25;}
      if(mode!=='all'&&view==='top')aim.dist=25;
      // Shortest angular route to the new view.
      aim.az=az+Math.atan2(Math.sin(aim.az-az),Math.cos(aim.az-az));
      if(instant||motionReduced){az=aim.az;el=aim.el;dist=aim.dist;target.copy(aim.target);}
      dirty=true;updateUI();
    }
    function setMode(key){inside=null;$('#room-camera').value='';mode=key;view='perspective';autoRotate=false;$('#rotate-toggle').setAttribute('aria-pressed','false');rebuild();preset();}
    function setView(key){inside=null;$('#room-camera').value='';dimGroup.visible=dimensions;view=key;autoRotate=false;$('#rotate-toggle').setAttribute('aria-pressed','false');preset();}
    function setRoom(id){const r=window.GUIYUAN_ROOMS.find(r=>r.id===id&&r.camera);if(!r)return;setMode('all');inside=r;$('#room-camera').value=id;const points=(scheme===2&&r.camera2)||r.camera;const a=points[0],b=points[1],p=new T.Vector3(a[0]-6,a[2],a[1]-5.5),t=new T.Vector3(b[0]-6,b[2],b[1]-5.5),d=p.clone().sub(t);aim.target.copy(t);aim.dist=d.length();aim.az=Math.atan2(d.x,d.z);aim.el=Math.asin(d.y/aim.dist);az=aim.az;el=aim.el;dist=aim.dist;target.copy(t);camera.fov=70;camera.updateProjectionMatrix();dimGroup.visible=false;labels.forEach(l=>l.el.hidden=true);dirty=true;updateUI();render();}
    $('#room-camera').onchange=e=>{if(e.target.value){const id=e.target.value.replace(/^r3-[12]-/,`r3-${scheme}-`);setRoom(id);}};$('#exit-room').onclick=()=>setMode('all');
    function updateLabels(){
      const w=stage.clientWidth,h=stage.clientHeight;
      for(const l of labels){
        if(inside){l.el.hidden=true;continue;}
        if(l.kind==='dimension'&&!dimensions){l.el.hidden=true;continue;}
        const p=l.p.clone().project(camera);
        l.el.hidden=p.z>1||p.z< -1||Math.abs(p.x)>1.15||Math.abs(p.y)>1.15;
        l.el.style.left=((p.x+1)*w/2)+'px';l.el.style.top=((-p.y+1)*h/2)+'px';
      }
    }
    function render(){
      const multiplier=inside?1:Math.max(1,1.14/camera.aspect);
      camera.position.set(target.x+dist*multiplier*Math.sin(az)*Math.cos(el),target.y+dist*multiplier*Math.sin(el),target.z+dist*multiplier*Math.cos(az)*Math.cos(el));
      camera.lookAt(target);camera.updateMatrixWorld();renderer.render(scene,camera);updateLabels();dirty=false;
    }
    function resize(){renderer.setSize(stage.clientWidth,stage.clientHeight);camera.aspect=stage.clientWidth/stage.clientHeight;camera.updateProjectionMatrix();dirty=true;render();}
    new ResizeObserver(resize).observe(stage);
    new IntersectionObserver(entries=>{inView=entries[0].isIntersecting;if(inView)dirty=true;}).observe(stage);
    function tick(time){
      requestAnimationFrame(tick);
      const dt=Math.min((time-previousTime)/1000,.05)||.016;previousTime=time;
      if(!inView||document.hidden)return;
      const difference=Math.abs(az-aim.az)+Math.abs(el-aim.el)+Math.abs(dist-aim.dist)+target.distanceTo(aim.target);
      if(difference>.0002){const a=motionReduced?1:1-Math.exp(-9*dt);az+=(aim.az-az)*a;el+=(aim.el-el)*a;dist+=(aim.dist-dist)*a;target.lerp(aim.target,a);dirty=true;}
      if(autoRotate){aim.az+=dt*.13;az=aim.az;dirty=true;}
      if(dirty)render();
    }
    $$('[data-mode]').forEach(b=>b.onclick=()=>setMode(b.dataset.mode));
    $$('[data-view]').forEach(b=>b.onclick=()=>setView(b.dataset.view));
    $('#dimension-toggle').onclick=()=>{dimensions=!dimensions;dimGroup.visible=dimensions&&!inside;$('#dimension-toggle').setAttribute('aria-pressed',String(dimensions));$('.scale-key').hidden=!dimensions;dirty=true;};
    $('#light-toggle').onclick=()=>{
      dark=!dark;$('#light-toggle').setAttribute('aria-pressed',String(dark));$('#light-toggle').textContent=dark?'切换日光':'切换暮色';
      ambient.intensity=dark?.90:1;ambient.color.set(dark?'#bed0e0':'#fff9ed');sun.intensity=dark?.78:2;sun.color.set(dark?'#c4cde0':'#fff0d5');fill.intensity=dark?.45:.65;renderer.toneMappingExposure=dark?1.15:1.03;
      mats.glass.emissive.set(dark?'#edb364':'#000000');mats.glass.emissiveIntensity=dark?.42:0;mats.light.emissiveIntensity=dark?1.2:.3;
      detailModel.traverse(o=>{if(!o.isMesh)return;for(const m of(Array.isArray(o.material)?o.material:[o.material])){if(m.name==='light')m.emissiveIntensity=dark?3:1;if(m.name==='glass'){m.emissive.set(dark?'#edb364':'#000000');m.emissiveIntensity=dark?.22:0;}}});
      stage.style.background=dark?'radial-gradient(ellipse at 50% 25%,#b8c3c9,#8c9ba5)':'';dirty=true;
    };
    $('#rotate-toggle').onclick=()=>{autoRotate=!autoRotate;$('#rotate-toggle').setAttribute('aria-pressed',String(autoRotate));dirty=true;};
    const stopRotate=()=>{autoRotate=false;$('#rotate-toggle').setAttribute('aria-pressed','false');};
    const zoom=factor=>{aim.dist=Math.max(inside?.6:16,Math.min(inside?9:65,aim.dist*factor));dirty=true;};
    $('#zoom-in').onclick=()=>zoom(.86);$('#zoom-out').onclick=()=>zoom(1.16);
    $('#reset-view').onclick=()=>{stopRotate();if(inside)setRoom(inside.id);else preset();};
    const points=new Map();let pinch=0;
    renderer.domElement.addEventListener('pointerdown',e=>{stopRotate();points.set(e.pointerId,[e.clientX,e.clientY]);renderer.domElement.setPointerCapture(e.pointerId);});
    renderer.domElement.addEventListener('pointermove',e=>{
      if(!points.has(e.pointerId))return;
      const prev=points.get(e.pointerId);points.set(e.pointerId,[e.clientX,e.clientY]);
      if(points.size===1){aim.az-=(e.clientX-prev[0])*.006;aim.el=Math.max(inside?-.8:.035,Math.min(1.569,aim.el+(e.clientY-prev[1])*.005));}
      else{const p=[...points.values()],length=Math.hypot(p[0][0]-p[1][0],p[0][1]-p[1][1]);if(pinch&&length>0)zoom(pinch/length);pinch=length;}
      dirty=true;
    });
    const end=e=>{points.delete(e.pointerId);pinch=0;};
    renderer.domElement.addEventListener('pointerup',end);renderer.domElement.addEventListener('pointercancel',end);
    renderer.domElement.addEventListener('wheel',e=>{e.preventDefault();stopRotate();zoom(Math.exp(e.deltaY*.0008));},{passive:false});
    renderer.domElement.addEventListener('keydown',e=>{
      if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-','0'].includes(e.key))return;
      e.preventDefault();stopRotate();
      if(e.key==='ArrowLeft')aim.az-=.13;if(e.key==='ArrowRight')aim.az+=.13;
      if(e.key==='ArrowUp')aim.el=Math.min(1.569,aim.el+.09);if(e.key==='ArrowDown')aim.el=Math.max(.035,aim.el-.09);
      if(e.key==='+'||e.key==='=')zoom(.9);if(e.key==='-')zoom(1.1);if(e.key==='0'){if(inside)setRoom(inside.id);else preset();}dirty=true;
    });
    const fullscreenButton=$('#fullscreen');
    const syncFullscreen=()=>{const active=document.fullscreenElement===panel||panel.classList.contains('fullscreen-fallback');fullscreenButton.setAttribute('aria-label',active?'退出全屏':'全屏查看模型');fullscreenButton.title=active?'退出全屏':'全屏';};
    fullscreenButton.onclick=()=>{
      const open=panel.classList.toggle('fullscreen-fallback');
      document.body.style.overflow=open?'hidden':'';
      syncFullscreen();resize();
    };
    document.addEventListener('fullscreenchange',syncFullscreen);
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&panel.classList.contains('fullscreen-fallback')){panel.classList.remove('fullscreen-fallback');document.body.style.overflow='';syncFullscreen();resize();}});
    $('#save-view').onclick=()=>{
      stopRotate();az=aim.az;el=aim.el;dist=aim.dist;target.copy(aim.target);render();
      const out=document.createElement('canvas');out.width=renderer.domElement.width;out.height=renderer.domElement.height+80;
      const ctx=out.getContext('2d');ctx.fillStyle=dark?'#9caab4':'#eff1e8';ctx.fillRect(0,0,out.width,out.height);ctx.drawImage(renderer.domElement,0,40);
      ctx.fillStyle='#34452f';ctx.font='16px sans-serif';ctx.fillText('归院 · '+$('#model-view-name').textContent+' · 12 × 11 m',24,28);
      ctx.font='12px sans-serif';ctx.fillText('建筑尺寸模型 · 材质与家具为方案表达',24,out.height-14);
      const data=out.toDataURL('image/png');
      $('#lightbox-title').textContent='三维视角 · '+$('#model-view-name').textContent;
      $('#lightbox-image').src=data;$('#lightbox-image').alt='当前住宅三维视角导出预览';
      $('#download-image').href=data;$('#download-image').download='guiyuan-'+mode+'-'+view+'.png';
      lastImageButton=$('#save-view');dialog.showModal();document.body.style.overflow='hidden';
      status.textContent='已生成当前视角预览，可点击下载原图保存';
    };
    renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();status.textContent='三维显示中断，请刷新页面重新加载';});
    rebuild();preset(true);resize();requestAnimationFrame(tick);
    $('#model-loading').classList.add('hidden');
    panel.dataset.loaded='true';panel.dataset.footprint='12x11';
    return {setMode,setView,setRoom};
  }
})();
