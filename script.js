const PHOTOS = [
  { src: "", full: "", caption: "[照片说明]", date: "[日期]", place: "[地点]" },
  { src: "", full: "", caption: "[照片说明]", date: "[日期]", place: "[地点]" },
  { src: "", full: "", caption: "[照片说明]", date: "[日期]", place: "[地点]" },
  { src: "", full: "", caption: "[照片说明]", date: "[日期]", place: "[地点]" },
  { src: "", full: "", caption: "[照片说明]", date: "[日期]", place: "[地点]" },
  { src: "", full: "", caption: "[照片说明]", date: "[日期]", place: "[地点]" }
];
'use strict';
const WRITING=[{title:'',text:''},{title:'',text:''},{title:'',text:''}];
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const root=document.documentElement,reduceQuery=matchMedia('(prefers-reduced-motion: reduce)'),mobileQuery=matchMedia('(max-width:760px)'),finePointer=matchMedia('(hover:hover) and (pointer:fine)');
const {clamp,ease}=WorldCamera,smooth=WorldTime.smooth,random=(a,b)=>a+Math.random()*(b-a);
const ids=['home','recent','gallery','things','notes','about'],chapters=ids.map(id=>$('#'+id));
const boot=ids.includes(root.dataset.initialScene)?root.dataset.initialScene:'home';
const worldState=WorldEnvironment.create(performance.now(),boot),camera=new WorldCamera.CameraController(ids.indexOf(boot));
worldState.camera=camera;worldState.cameraProgress=camera.position;
const styleCache=new WeakMap();
function style(el,name,value){if(!el)return;let cache=styleCache.get(el);if(!cache){cache=new Map();styleCache.set(el,cache);}if(cache.get(name)!==value){cache.set(name,value);el.style.setProperty(name,value);}}
const world=$('#world'),nav=$('.desktop-nav'),header=$('.site-header'),sky=$('.world-sky'),sun=$('.sun-disc'),moon=$('.moon-disc'),halo=$('.sun-halo'),leaf=$('.camera-leaf');
const css=(key,value)=>style(key.startsWith('--nav-')?nav:key==='--book-open'?$('#notes'):key==='--photo-ui'?$('#lightbox'):world,key,value);
const color=a=>`rgb(${a.map(Math.round).join(' ')})`,isReal=t=>typeof t==='string'&&t.trim()&&!/^\[.*\]$/.test(t.trim());
let frame=0,wakeTimer=0,lastFrame=performance.now(),lastEnvironmentFrame=0,lastClock=0,lastPaintClock=0,manualPaused=false;
let viewport={width:innerWidth,height:innerHeight},writtenY=-1,lastUserScroll=-Infinity,hiddenAt=null,initializing=true,pendingScroll=null,cameraDirty=true;
let quality=WorldEnvironment.selectQuality({width:innerWidth,dpr:devicePixelRatio,cores:navigator.hardwareConcurrency,reduced:reduceQuery.matches}),config=WorldEnvironment.qualityConfigs[quality];
root.dataset.quality=quality;
const painter=new ScenePainter({...viewport,quality}),canvas=$('#environment-canvas'),ctx=canvas.getContext('2d');
let pointer={x:0,y:0,toX:0,toY:0},indicator={x:0,width:0,alpha:0},navRects=[];
let occlusion=null,occlusionTravel=0,lastSettled=boot,lastNavScene='',windowRequested=boot==='notes';
const paused=()=>manualPaused||reduceQuery.matches;
const cameraKeys=[{x:0,y:0,s:1},{x:-2.5,y:-4,s:1.2},{x:4,y:-7,s:1.36},{x:-8,y:-12,s:1.48},{x:-17,y:-17,s:1.66},{x:3,y:-1,s:1.03}];
const mobileKeys=[{x:0,y:0,s:1},{x:-1,y:-1,s:1.035},{x:1,y:-2,s:1.06},{x:-2,y:-3,s:1.085},{x:-3,y:-4,s:1.12},{x:0,y:0,s:1.01}];
let windowPresence=boot==='notes'?1:0,reducedView=null,environmentDirty=true;
const scenePresentation=ids.map(id=>({indexAlpha:Number(id===boot),titleAlpha:Number(id===boot),objectAlpha:Number(id===boot)}));
const navLinks=$$('.desktop-nav a,.scene-rail a'),inkNodes=[$('.hero-copy'),header,$('.quiet-signature')];
const tracked=new Set(),eventQueue=[];let metricTries=0;
function track(name,data={}){if(typeof window.umami?.track==='function'){try{Promise.resolve(window.umami.track(name,data)).catch(()=>{});}catch{}}else if(eventQueue.length<20)eventQueue.push([name,data]);}
const metricsTimer=setInterval(()=>{if(typeof window.umami?.track==='function'){for(const e of eventQueue.splice(0))track(...e);clearInterval(metricsTimer);}else if(++metricTries>=25){eventQueue.length=0;clearInterval(metricsTimer);}},1000);
let toastTimer;
function notify(text){clearTimeout(toastTimer);$('#status-message').textContent=text;$('#status-message').classList.add('visible');toastTimer=setTimeout(()=>$('#status-message').classList.remove('visible'),3000);}
const imagePromises=new WeakMap();
async function warmImage(img){
  if(imagePromises.has(img))return imagePromises.get(img);
  const p=(async()=>{if(img.dataset.src){img.src=img.dataset.src;delete img.dataset.src;worldState.metrics.assetLoads++;}else if(img.complete&&!img.naturalWidth&&img.getAttribute('src')){const retrySrc=img.getAttribute('src');img.removeAttribute('src');img.src=retrySrc;}try{await img.decode();img.hidden=false;img.classList.add('is-decoded');const empty=img.closest('.photo-button')?.querySelector('.empty-photo');if(empty)empty.hidden=true;return true;}catch{imagePromises.delete(img);return false;}})();imagePromises.set(img,p);return p;
}
function prefetchScene(index){if(Math.abs(index-2)<1.6)$$('.photo-line img[data-src]').forEach(warmImage);if(index>2.4&&!windowRequested){windowRequested=true;requestAppearance({});}}
function updateTime(now,force=false){const tr=worldState.timeTransition;if(tr){const t=clamp((now-tr.start)/tr.duration);worldState.time=WorldTime.mix(tr.from,tr.to,ease(t));if(t===1)worldState.timeTransition=null;}else if(force||now-lastClock>=1000){worldState.time=WorldTime.sample(worldState.timeMode==='auto'?new Date():WorldTime.previewTimes[worldState.timeMode]);lastClock=now;}}
function applyTime(){
  const t=worldState.time,a=WorldEnvironment.deriveAppearance(t,worldState.weather.values,worldState.season.weights);
  style(sky,'--sky-top',color(a.skyTop));style(sky,'--sky-bottom',color(a.skyBottom));
  for(const node of [sun,halo]){style(node,'--sun-x',t.sunPosition[0].toFixed(3)+'%');style(node,'--sun-y',t.sunPosition[1].toFixed(3)+'%');style(node,'--sun-opacity',(t.sunOpacity*(1-a.sunVeil)).toFixed(3));}
  style(sun,'--sun-color',color(t.sunColor));style(moon,'--moon-x',t.moonPosition[0].toFixed(3)+'%');style(moon,'--moon-y',t.moonPosition[1].toFixed(3)+'%');style(moon,'--moon-opacity',(t.moonOpacity*(1-a.cloud*.8)).toFixed(3));
  for(const node of $$('.cloud-layer'))style(node,'--cloud-opacity',(.35+a.cloud*.65).toFixed(3));
  const light=clamp((t.nightMix-.2)/.6),ink=color([63,63,50].map((v,i)=>v+([242,239,220][i]-v)*light));for(const n of inkNodes)style(n,'--world-ink',ink);
  if($('#time-label').textContent!==t.label)$('#time-label').textContent=t.label;
  $('#time-mode-label').textContent=worldState.timeMode==='auto'?'AUTO':'预览';$('.time-symbol').textContent=t.moonOpacity>.45?'☾':'☀';$('meta[name="theme-color"]').content=color(a.skyTop);
  environmentDirty=true;
}
let intent={season:worldState.season.mode,weather:worldState.weather.name,time:worldState.timeMode},weatherIntentSource='auto',appearanceRequest=0,appearancePending=false;
async function requestAppearance(change,{source='manual'}={}){
  Object.assign(intent,change);if(change.weather)weatherIntentSource=source;const selection={...intent,weatherSource:weatherIntentSource},request=++appearanceRequest;appearancePending=true;
  const season=selection.season==='auto'?WorldEnvironment.seasonForMonth(new Date().getMonth()):selection.season,time=WorldTime.sample(selection.time==='auto'?new Date():WorldTime.previewTimes[selection.time]);
  try{const paint=await painter.prepare({season,weather:selection.weather,time,needWindow:windowRequested});if(request!==appearanceRequest)return;
    const now=performance.now();updateTime(now);WorldEnvironment.updateClimate(worldState,now);
    if(selection.weather!==worldState.weather.name||change.weather){WorldEnvironment.setWeather(worldState,selection.weather,now,{source:selection.weatherSource});track('weather_change',{weather:selection.weather});}
    if(selection.season!==worldState.season.mode||season!==worldState.season.name){WorldEnvironment.setSeason(worldState,selection.season,now);track('season_change',{season:selection.season});}
    if(selection.time!==worldState.timeMode){worldState.timeTransition={from:structuredClone(worldState.time),to:time,start:now,duration:1200};worldState.timeMode=selection.time;track('time_change',{mode:selection.time});}
    const changing=worldState.timeTransition||worldState.weather.transition||worldState.season.transition;
    painter.commit(paint,now,changing||worldState.timeMode==='auto'&&painter.ready&&now-lastPaintClock>20000?1200:0);lastPaintClock=now;appearancePending=false;
    for(const [key,name] of [['weather','weather'],['season','season'],['time','time']])$$('[data-'+key+']').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset[key]===selection[name])));
    applyTime();startFrames();
  }catch(error){if(request===appearanceRequest){appearancePending=false;intent={season:worldState.season.mode,weather:worldState.weather.name,time:worldState.timeMode};notify('风景暂未载入，请稍后再试');console.warn(error.message);}}
}
function setTimeMode(mode){if(mode==='auto'||mode in WorldTime.previewTimes)return requestAppearance({time:mode});}
function setSeason(mode){if(['auto','spring','summer','autumn','winter'].includes(mode))return requestAppearance({season:mode});}
function setWeather(name){if(name in WorldEnvironment.climates)return requestAppearance({weather:name});}
function writeScroll(position){writtenY=position*viewport.height;window.scrollTo({top:writtenY,behavior:'instant'});}
function navigate(id,{source='navigation',historyMode='push'}={}){
  if(!ids.includes(id))return;const target=ids.indexOf(id);if(camera.travel?.to===target&&source==='history')return;
  finishIntro();if(worldState.book.target)setBook(false);if(openPhoto)closePhoto(true);
  const now=performance.now();if(camera.travel)worldState.metrics.retargets++;worldState.metrics.navigation++;
  const origin=id==='home'&&source==='navigation'?'home':source;camera.go(target,now,{source:origin,reduced:paused(),duration:config.cameraDuration(target-camera.position,origin)});worldState.targetScene=id;cameraDirty=true;
  if(historyMode==='push'&&location.hash!=='#'+id)history.pushState({scene:id},'','#'+id);prefetchScene(target);startFrames();
}
function interruptJourney(){if(!camera.travel)return;camera.input(camera.position);worldState.targetScene=ids[Math.round(camera.position)];writeScroll(camera.position);cameraDirty=true;startFrames();}
window.addEventListener('wheel',event=>{if(event.target.closest('dialog[open],.desk-book-page'))return;interruptJourney();lastUserScroll=performance.now();},{passive:true});
window.addEventListener('touchstart',event=>{if(event.target.closest('dialog[open],.desk-book-page,button,a'))return;interruptJourney();lastUserScroll=performance.now();},{passive:true});
window.addEventListener('keydown',event=>{if(event.defaultPrevented||event.target.closest('input,textarea,dialog[open],.desk-book-page'))return;if(['PageDown','PageUp','Home','End','ArrowUp','ArrowDown',' '].includes(event.key)){interruptJourney();lastUserScroll=performance.now();}},{passive:true});
window.addEventListener('scroll',()=>{if(initializing||Math.abs(window.scrollY-writtenY)<1.5)return;pendingScroll=window.scrollY;lastUserScroll=performance.now();startFrames();},{passive:true});
$$('a[href^="#"]').forEach(link=>{if(!ids.includes(link.hash.slice(1)))return;link.addEventListener('click',event=>{if(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;event.preventDefault();if(menu.open)closeSmallDialog(menu);navigate(link.hash.slice(1));});});
$('.skip-link').addEventListener('click',e=>{e.preventDefault();const section=chapters[ids.indexOf(worldState.currentScene)];section.setAttribute('tabindex','-1');section.focus({preventScroll:true});});
function locationJourney(){navigate(ids.includes(location.hash.slice(1))?location.hash.slice(1):'home',{source:'history',historyMode:'none'});}
window.addEventListener('popstate',locationJourney);window.addEventListener('hashchange',locationJourney);
function settleScene(){const nearest=ids[Math.round(camera.position)];if(Math.abs(camera.position-Math.round(camera.position))>.015)return;if(!camera.travel&&nearest!==lastSettled){lastSettled=nearest;if(location.hash!=='#'+nearest)history.replaceState({scene:nearest},'','#'+nearest);$('#journey-announcement').textContent='来到'+chapters[ids.indexOf(nearest)].dataset.chapter;}if(nearest!=='home'&&!tracked.has(nearest)){tracked.add(nearest);track('scene_change',{scene:nearest});}}
function measure(){viewport={width:innerWidth,height:innerHeight};style($('#main'),'height',viewport.height*6+'px');quality=WorldEnvironment.selectQuality({width:innerWidth,dpr:devicePixelRatio,cores:navigator.hardwareConcurrency,reduced:reduceQuery.matches});config=WorldEnvironment.qualityConfigs[quality];root.dataset.quality=quality;painter.resize(innerWidth,innerHeight,quality);
  const navBox=nav.getBoundingClientRect();navRects=ids.map(id=>{const a=nav.querySelector('a[href="#'+id+'"]');if(!a)return null;const r=a.getBoundingClientRect();return{x:r.left-navBox.left,width:r.width};});
  const dpr=config.canvasDpr;canvas.width=Math.round(viewport.width*dpr);canvas.height=Math.round(viewport.height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);writeScroll(camera.position);renderCamera(performance.now(),0,true);environmentDirty=true;if(painter.ready)requestAppearance({});startFrames();
}
let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(measure,120);},{passive:true});
document.addEventListener('pointermove',e=>{if(!finePointer.matches||paused()||openPhoto||quality!=='high')return;pointer.toX=(e.clientX/innerWidth-.5)*18;pointer.toY=(e.clientY/innerHeight-.5)*10;cameraDirty=true;startFrames();},{passive:true});
root.addEventListener('pointerleave',()=>{pointer.toX=pointer.toY=0;cameraDirty=true;startFrames();});
function renderCamera(now,dt,immediate=false){
  const p=camera.position,i=Math.min(4,Math.floor(p)),q=ease(p-i),keys=quality==='high'?cameraKeys:mobileKeys,a=keys[i],b=keys[i+1];
  worldState.cameraProgress=p;
  const current=ids[Math.round(p)];worldState.currentScene=current;
  const limited=paused(),book=worldState.book.value;
  let x=a.x+(b.x-a.x)*q,y=a.y+(b.y-a.y)*q,s=a.s+(b.s-a.s)*q;
  const travel=camera.travel;
  if(limited){x=y=0;s=1;}
  css('--camera-x',x.toFixed(4)+'%');css('--camera-y',y.toFixed(4)+'%');css('--camera-scale',(s*(1+(limited?0:quality==='high'?.065:.02)*book*clamp(1-Math.abs(p-4)*3))).toFixed(5));
  const wp=n=>smooth(clamp((n-3.38)/.45))*(1-smooth(clamp((n-4.2)/.58)));
  if(limited){
    const target=Math.round(travel?travel.to:camera.target);
    // Continue the visible dissolve itself when redirected; camera coordinates may
    // be crossing a chapter that has never been visible in reduced-motion mode.
    if(!reducedView||(travel&&travel.id!==reducedView.travelId)||target!==reducedView.target){
      reducedView={target,travelId:travel?.id,from:scenePresentation.map(value=>({...value})),windowFrom:windowPresence,start:travel?.start??now,duration:travel?.duration??200,progress:0};
    }
    reducedView.progress=clamp((now-reducedView.start)/reducedView.duration);
    windowPresence=reducedView.windowFrom+(wp(target)-reducedView.windowFrom)*ease(reducedView.progress);
  }else{reducedView=null;windowPresence=wp(p);}
  css('--window-presence',windowPresence.toFixed(4));css('--near-presence',(1-windowPresence).toFixed(4));css('--about-quiet',smooth(clamp((p-4.45)/.55)).toFixed(4));style(header,'--header-presence',clamp(p).toFixed(4));header.classList.toggle('at-window',windowPresence>.5);
  const friction=immediate?1:1-Math.exp(-9*dt);pointer.x+=(pointer.toX-pointer.x)*friction;pointer.y+=(pointer.toY-pointer.y)*friction;
  css('--pointer-x',(limited||mobileQuery.matches?0:pointer.x).toFixed(2)+'px');css('--pointer-y',(limited||mobileQuery.matches?0:pointer.y).toFixed(2)+'px');
  css('--mobile-pan',mobileQuery.matches&&!limited?(-p*viewport.width*.10).toFixed(2)+'px':'0px');
  for(let index=0;index<chapters.length;index++){
    const section=chapters[index],distance=Math.abs(p-index),d=p-index;
    let indexAlpha=1-ease(clamp((distance-.20)/.78)),titleAlpha=1-ease(clamp((distance-.08)/.62)),objectAlpha=1-ease(clamp((distance-.025)/.44));
    let shift=-d*(mobileQuery.matches?52:85),scale=1-Math.min(.12,distance*.14);
    if(limited){const t=ease(reducedView.progress),from=reducedView.from[index],to=Number(index===reducedView.target);indexAlpha=from.indexAlpha+(to-from.indexAlpha)*t;titleAlpha=from.titleAlpha+(to-from.titleAlpha)*t;objectAlpha=from.objectAlpha+(to-from.objectAlpha)*t;shift=(1-objectAlpha)*5;scale=1;}
    Object.assign(scenePresentation[index],{indexAlpha,titleAlpha,objectAlpha});
    const near=indexAlpha>.002||objectAlpha>.002;section.classList.toggle('is-near',near);section.classList.toggle('is-current',distance<.13&&!openPhoto);
    section.inert=distance>=.13||!!openPhoto;section.setAttribute('aria-hidden',String(!near));
    if(near){style(section,'--index-alpha',indexAlpha.toFixed(4));style(section,'--title-alpha',titleAlpha.toFixed(4));style(section,'--object-alpha',objectAlpha.toFixed(4));style(section,'--index-y',(-d*(limited?4:18)).toFixed(2)+'px');style(section,'--title-y',(-d*(limited?4:30)).toFixed(2)+'px');style(section,'--object-y',(-d*(limited?4:35)).toFixed(2)+'px');style(section,'--scene-y',shift.toFixed(2)+'px');style(section,'--scene-x',(limited?0:d*[0,-18,28,-22,0,12][index]).toFixed(2)+'px');style(section,'--scene-scale',scale.toFixed(4));style(section,'--photo-depth',limited||mobileQuery.matches?'0px':(distance*5).toFixed(2)+'px');}
  }
  if(lastNavScene!==current){lastNavScene=current;navLinks.forEach(link=>{if(link.hash==='#'+current)link.setAttribute('aria-current','location');else link.removeAttribute('aria-current');});}
  const targetRect=navRects[ids.indexOf(travel?worldState.targetScene:current)];
  if(targetRect){const f=immediate?1:1-Math.exp(-10*dt);indicator.x+=(targetRect.x-indicator.x)*f;indicator.width+=(targetRect.width-indicator.width)*f;indicator.alpha+=(1-indicator.alpha)*f;}else indicator.alpha*=immediate?0:Math.exp(-8*dt);
  css('--nav-x',indicator.x.toFixed(2)+'px');css('--nav-width',Math.max(.01,indicator.width).toFixed(3));css('--nav-alpha',indicator.alpha.toFixed(4));
  if(!limited&&quality==='high'&&travel&&!travel.reduced&&travel.progress>.36&&travel.progress<.75&&occlusionTravel!==travel.id&&(travel.to===4||Math.round(travel.from)===4)){
    occlusionTravel=travel.id;occlusion={start:now,duration:220};
  }
  if(occlusion&&!limited&&quality==='high'){const t=clamp((now-occlusion.start)/220);style(leaf,'opacity',(Math.sin(t*Math.PI)*.78).toFixed(3));style(leaf,'transform',`translate3d(${24-44*t}%,${t*8}%,0)`);if(t===1)occlusion=null;}else style(leaf,'opacity','0');
  if(Math.abs(pointer.x-pointer.toX)>.08||Math.abs(pointer.y-pointer.toY)>.08||targetRect&&(Math.abs(indicator.x-targetRect.x)>.1||Math.abs(indicator.width-targetRect.width)>.1)||!targetRect&&indicator.alpha>.005)cameraDirty=true;
  settleScene();prefetchScene(p);
}

// A notebook lives on the desk. Its pages are not a modal or a second copy.
function setBook(open,restoreFocus=true){
  const book=worldState.book;if(book.target===Number(open)&&book.transition)return;
  book.target=Number(open);book.transition={from:book.value,to:book.target,start:performance.now(),duration:paused()?260:quality==='high'?780:480};
  $('#open-notebook').setAttribute('aria-expanded',String(open));$('#desk-book').classList.toggle('is-open',open);$('#book-pages').inert=!open;startFrames();
  if(open){renderBook(book.page,false);setTimeout(()=>{if(book.target)$('#book-close').focus({preventScroll:true});},paused()?270:quality==='high'?800:500);}else if(restoreFocus)$('#open-notebook').focus({preventScroll:true});
}
function updateBook(now){const b=worldState.book;if(b.transition){const tr=b.transition,t=clamp((now-tr.start)/tr.duration);b.value=tr.from+(tr.to-tr.from)*ease(t);if(t===1)b.transition=null;}css('--book-open',b.value.toFixed(4));}
function renderBook(index,animate=true){const b=worldState.book;b.page=clamp(index,0,WRITING.length-1);const page=WRITING[b.page];$('#book-page-number').textContent=String(b.page+1).padStart(2,'0');$('#book-title').textContent=page.title||'这一页暂时留白';$('#book-text').textContent=page.text||'还没有文字。';$('#book-prev').disabled=b.page===0;$('#book-next').disabled=b.page===WRITING.length-1;if(animate){const node=$('#book-pages');node.getAnimations().forEach(a=>a.cancel());node.animate(paused()||quality!=='high'?[{opacity:.65},{opacity:1}]:[{transform:'perspective(1200px) rotateY(-38deg)',opacity:.65},{transform:'none',opacity:1}],{duration:paused()||quality!=='high'?220:520,easing:'cubic-bezier(.22,1,.36,1)'}).finished.catch(()=>{});}}
$('#open-notebook').addEventListener('click',()=>setBook(true));$('#book-close').addEventListener('click',()=>setBook(false));$('#book-prev').addEventListener('click',()=>renderBook(worldState.book.page-1));$('#book-next').addEventListener('click',()=>renderBook(worldState.book.page+1));
$('#desk-book').addEventListener('keydown',e=>{if(!worldState.book.target)return;if(e.key==='Escape'){e.preventDefault();setBook(false);}if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();renderBook(worldState.book.page+(e.key==='ArrowRight'?1:-1));}});

// A genuine shared element: the same physical figure is reparented and returned.
const lightbox=$('#lightbox'),portal=$('#photo-portal');let openPhoto=null,photoIndex=0,photoClosing=false,photoAnimation=null;
const photoFigures=$$('.hanging-photo'),photoButtons=$$('[data-photo]');
function lockPhotoScroll(figure){
  const line=figure.parentElement,box=figure.getBoundingClientRect(),bounds=line.getBoundingClientRect(),horizontal=['auto','scroll'].includes(getComputedStyle(line).overflowX),fraction=horizontal?(box.left+box.width/2-bounds.left)/line.clientWidth:.5;
  const scroll={line,fraction:fraction>=0&&fraction<=1?fraction:.5,snap:line.style.scrollSnapType,anchor:line.style.overflowAnchor,behavior:line.style.scrollBehavior};
  line.style.scrollSnapType='none';line.style.overflowAnchor='none';line.style.scrollBehavior='auto';return scroll;
}
function syncPhotoScroll(item,node=item.seat){
  if(!node.isConnected)return;const {line,fraction}=item.scroll,box=node.getBoundingClientRect(),bounds=line.getBoundingClientRect();
  line.scrollLeft+=box.left+box.width/2-bounds.left-fraction*line.clientWidth;
}
function unlockPhotoScroll({line,snap,anchor,behavior}){line.style.scrollSnapType=snap;line.style.overflowAnchor=anchor;line.style.scrollBehavior=behavior;}
function restorePhoto(){if(!openPhoto)return;photoAnimation?.cancel();const item=openPhoto,{figure,seat}=item;figure.classList.add('is-restoring');seat.replaceWith(figure);figure.classList.remove('is-expanded');figure.style.removeProperty('transform');getComputedStyle(figure).transform;syncPhotoScroll(item,figure);figure.classList.remove('is-restoring');unlockPhotoScroll(item.scroll);openPhoto=null;}
window.addEventListener('resize',()=>{if(openPhoto&&!photoClosing)syncPhotoScroll(openPhoto);},{passive:true});
function flight(node,from,to,reverse=false){
  photoAnimation?.cancel();const dx=from.left+from.width/2-to.left-to.width/2,dy=from.top+from.height/2-to.top-to.height/2;
  const transform=`translate3d(${dx}px,${dy}px,0) rotate(${from.angle||0}deg) scale(${(from.layoutWidth||from.width)/to.width},${(from.layoutHeight||from.height)/to.height})`;
  photoAnimation=node.animate(paused()||quality!=='high'?[{opacity:.7},{opacity:1}]:reverse?[{transform:'none'},{transform}]:[{transform},{transform:'none'}],{duration:paused()?200:reverse?520:650,easing:'cubic-bezier(.22,1,.36,1)',fill:'both'});return photoAnimation.finished.catch(()=>{});
}
function updatePhotoText(){const p=PHOTOS[photoIndex];$('#lightbox-counter').textContent=`${String(photoIndex+1).padStart(2,'0')} / ${String(PHOTOS.length).padStart(2,'0')}`;$('#lightbox-caption').textContent=isReal(p.caption)?p.caption:'尚未放入照片';$('#lightbox-date').textContent=isReal(p.date)?p.date:'';$('#lightbox-place').textContent=isReal(p.place)?p.place:'';$('#lightbox-prev').disabled=photoIndex===0;$('#lightbox-next').disabled=photoIndex===PHOTOS.length-1;$('#lightbox-announcement').textContent=`第 ${photoIndex+1} 张，共 ${PHOTOS.length} 张。`;}
async function showPhoto(index){
  if(photoClosing)return;index=clamp(index,0,PHOTOS.length-1);const figure=photoFigures[index];if(openPhoto?.figure===figure)return;
  if(openPhoto)restorePhoto();photoIndex=index;
  const box=figure.getBoundingClientRect(),computed=getComputedStyle(figure),matrix=new DOMMatrix(computed.transform),from={left:box.left,top:box.top,width:box.width,height:box.height,layoutWidth:figure.offsetWidth,layoutHeight:figure.offsetHeight,angle:Math.atan2(matrix.b,matrix.a)*180/Math.PI},seat=document.createElement('div');seat.className='photo-seat';seat.style.height=figure.offsetHeight+'px';seat.style.marginTop=computed.marginTop;
  const scroll=lockPhotoScroll(figure);figure.before(seat);openPhoto={figure,seat,button:photoButtons[index],source:from,scroll};
  if(!lightbox.open){lightbox.showModal();document.body.classList.add('modal-open');}
  portal.append(figure);figure.classList.add('is-expanded');syncPhotoScroll(openPhoto);const img=figure.querySelector('img');if(img){warmImage(img);const full=PHOTOS[index].full;if(full&&img.dataset.fullLoaded!==full){const preload=new Image();preload.src=full;preload.decode().then(()=>{img.src=full;img.dataset.fullLoaded=full;img.hidden=false;img.classList.add('is-decoded');img.closest('.photo-button').querySelector('.empty-photo').hidden=true;}).catch(()=>{});}}updatePhotoText();
  const to=figure.getBoundingClientRect();css('--photo-ui','0');track('打开照片',{index:index+1});
  await flight(figure,from,to);if(openPhoto?.figure!==figure||photoClosing)return;photoAnimation?.cancel();css('--photo-ui','1');$('#lightbox-close').focus({preventScroll:true});
}
async function closePhoto(immediate=false){
  if(!openPhoto||photoClosing)return;photoClosing=true;css('--photo-ui','0');const item=openPhoto;
  const current=item.figure.getBoundingClientRect(),currentTransform=getComputedStyle(item.figure).transform;photoAnimation?.cancel();
  // Measure this exact object in its actual responsive slot, synchronously before the next paint.
  item.seat.replaceWith(item.figure);item.figure.classList.remove('is-expanded');item.figure.classList.add('is-measuring');syncPhotoScroll(item,item.figure);
  const slotBox=item.figure.getBoundingClientRect(),slotStyle=getComputedStyle(item.figure),slotMatrix=new DOMMatrix(slotStyle.transform);
  const target={left:slotBox.left,top:slotBox.top,width:slotBox.width,height:slotBox.height,layoutWidth:item.figure.offsetWidth,layoutHeight:item.figure.offsetHeight,angle:Math.atan2(slotMatrix.b,slotMatrix.a)*180/Math.PI};
  item.seat.style.height=target.layoutHeight+'px';item.figure.replaceWith(item.seat);portal.append(item.figure);item.figure.classList.remove('is-measuring');item.figure.classList.add('is-expanded');syncPhotoScroll(item);
  if(!immediate){const natural=item.figure.getBoundingClientRect();const endX=target.left+target.width/2-natural.left-natural.width/2,endY=target.top+target.height/2-natural.top-natural.height/2;photoAnimation=item.figure.animate(paused()?[{opacity:1},{opacity:.7}]:[{transform:currentTransform},{transform:`translate3d(${endX}px,${endY}px,0) rotate(${target.angle}deg) scale(${target.layoutWidth/natural.width},${target.layoutHeight/natural.height})`}],{duration:paused()||quality!=='high'?220:520,easing:'cubic-bezier(.22,1,.36,1)',fill:'both'});await photoAnimation.finished.catch(()=>{});}
  restorePhoto();lightbox.close();document.body.classList.remove('modal-open');photoClosing=false;renderCamera(performance.now(),0,true);item.button.focus({preventScroll:true});
}
photoButtons.forEach((button,index)=>{const p=PHOTOS[index];if(isReal(p.caption))button.nextElementSibling.textContent=p.caption;if(p.src||p.full){const img=new Image();img.alt=isReal(p.caption)?p.caption:'相册照片';img.decoding='async';img.dataset.src=p.src||p.full;img.addEventListener('error',()=>{img.hidden=true;button.querySelector('.empty-photo').hidden=false;});button.prepend(img);}button.addEventListener('click',()=>{if(openPhoto)return;showPhoto(index);});});
$('#lightbox-close').addEventListener('click',()=>closePhoto());$('#lightbox-prev').addEventListener('click',()=>showPhoto(photoIndex-1));$('#lightbox-next').addEventListener('click',()=>showPhoto(photoIndex+1));
lightbox.addEventListener('cancel',e=>{e.preventDefault();closePhoto();});lightbox.addEventListener('click',e=>{if(e.target===lightbox||e.target===portal)closePhoto();});lightbox.addEventListener('keydown',e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();showPhoto(photoIndex+(e.key==='ArrowRight'?1:-1));}});
let swipe=null;portal.addEventListener('touchstart',e=>{swipe=e.touches.length===1?{x:e.touches[0].clientX,y:e.touches[0].clientY}:null;},{passive:true});portal.addEventListener('touchend',e=>{if(!swipe||!e.changedTouches.length)return;const dx=e.changedTouches[0].clientX-swipe.x,dy=e.changedTouches[0].clientY-swipe.y;if(Math.abs(dx)>50&&Math.abs(dx)>Math.abs(dy)*1.4)showPhoto(photoIndex+(dx<0?1:-1));swipe=null;},{passive:true});

const menu=$('#chapter-menu'),timeDialog=$('#time-dialog'),openers=new WeakMap();
function openSmallDialog(dialog){openers.set(dialog,document.activeElement);dialog.showModal();document.body.classList.add('modal-open');if(dialog===menu)$('.menu-toggle').setAttribute('aria-expanded','true');}
function closeSmallDialog(dialog){dialog.close();document.body.classList.remove('modal-open');if(dialog===menu)$('.menu-toggle').setAttribute('aria-expanded','false');openers.get(dialog)?.focus({preventScroll:true});}
for(const dialog of [menu,timeDialog]){dialog.addEventListener('cancel',e=>{e.preventDefault();closeSmallDialog(dialog);});dialog.querySelector('[data-close-dialog]').addEventListener('click',()=>closeSmallDialog(dialog));dialog.addEventListener('click',e=>{if(e.target!==dialog)return;const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeSmallDialog(dialog);});}
$('.menu-toggle').addEventListener('click',()=>openSmallDialog(menu));$('#time-toggle').addEventListener('click',()=>openSmallDialog(timeDialog));
$$('[data-time]').forEach(b=>b.addEventListener('click',()=>{setTimeMode(b.dataset.time);closeSmallDialog(timeDialog);}));$$('[data-season]').forEach(b=>b.addEventListener('click',()=>{setSeason(b.dataset.season);closeSmallDialog(timeDialog);}));$$('[data-weather]').forEach(b=>b.addEventListener('click',()=>{setWeather(b.dataset.weather);closeSmallDialog(timeDialog);}));

// Audio nodes are created once on opt-in and only their room/weather gains change during travel.
let audioContext=null,windSource=null,windFilter=null,windGain=null,rustleGain=null,rainGain=null,soundBusy=false,audioCreations=0,nextAudioUpdate=0;
function createAudio(){const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)throw Error('Audio unavailable');audioContext=new Audio();audioCreations++;const buffer=audioContext.createBuffer(1,audioContext.sampleRate*3,audioContext.sampleRate),data=buffer.getChannelData(0);let brown=0;for(let i=0;i<data.length;i++){brown=(brown+Math.random()*.03-.015)/1.015;data[i]=brown*3;}windSource=audioContext.createBufferSource();windSource.buffer=buffer;windSource.loop=true;windFilter=audioContext.createBiquadFilter();windFilter.type='lowpass';windFilter.frequency.value=450;windGain=audioContext.createGain();windGain.gain.value=.13;const rustle=audioContext.createBiquadFilter();rustle.type='bandpass';rustle.frequency.value=1400;rustle.Q.value=.4;rustleGain=audioContext.createGain();rustleGain.gain.value=.025;const rain=audioContext.createBiquadFilter();rain.type='highpass';rain.frequency.value=800;rainGain=audioContext.createGain();rainGain.gain.value=0;windSource.connect(windFilter).connect(windGain).connect(audioContext.destination);windSource.connect(rustle).connect(rustleGain).connect(audioContext.destination);windSource.connect(rain).connect(rainGain).connect(audioContext.destination);windSource.start();}
function updateAudioEnvironment(){if(!audioContext)return;const t=audioContext.currentTime,state=worldState.time,room=1-windowPresence*.64;windFilter.frequency.setTargetAtTime((230+state.ambientLight*260)*room,t,.5);windGain.gain.setTargetAtTime((.10+state.ambientLight*.035)*room,t,.5);rustleGain.gain.setTargetAtTime((.012+state.ambientLight*.013)*room,t,.5);rainGain.gain.setTargetAtTime(worldState.weather.values.rain*.75*room,t,.6);}
function playEnvironmentDetail(){if(!worldState.soundEnabled||audioContext?.state!=='running')return;const night=worldState.time.nightMix>.65,t=audioContext.currentTime;for(let i=0;i<(night?3:2);i++){const osc=audioContext.createOscillator(),gain=audioContext.createGain(),start=t+i*(night?.23:.28),duration=night?.08:.18;osc.type='sine';osc.frequency.setValueAtTime(night?2600:1700+i*170,start);osc.frequency.exponentialRampToValueAtTime(night?2550:2550+i*240,start+duration*.6);gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime((night?.004:.006)*(1-windowPresence*.7),start+.016);gain.gain.exponentialRampToValueAtTime(.0001,start+duration);osc.connect(gain).connect(audioContext.destination);osc.start(start);osc.stop(start+duration+.03);osc.onended=()=>{osc.disconnect();gain.disconnect();};}}
function syncSound(){const enabled=worldState.soundEnabled;$('#sound-toggle').textContent=enabled?'声音开':'声音关';$('#sound-toggle').setAttribute('aria-pressed',String(enabled));}
async function turnSoundOff(){worldState.soundEnabled=false;syncSound();if(audioContext?.state==='running')await audioContext.suspend().catch(()=>{});}
$('#sound-toggle').addEventListener('click',async()=>{if(soundBusy)return;soundBusy=true;try{if(worldState.soundEnabled)await turnSoundOff();else{if(!audioContext)createAudio();await audioContext.resume();if(document.hidden){await turnSoundOff();return;}worldState.soundEnabled=audioContext.state==='running';syncSound();updateAudioEnvironment();if(worldState.soundEnabled)track('sound_toggle',{enabled:true});}}catch{worldState.soundEnabled=false;syncSound();notify('暂时无法开启声音，请再试一次');}finally{soundBusy=false;}});

// Sparse precipitation: one world scheduler, batched paths, no empty daytime redraws.
let canvasHasContent=false;
function activeParticles(){const w=worldState.weather.values;return !paused()&&(w.rain>.01||w.snow>.01||worldState.particles.petals.length>0);}
function drawEnvironment(){
  const w=viewport.width,h=viewport.height,t=worldState.elapsed,state=worldState.time,weather=worldState.weather.values,particles=worldState.particles;
  const stars=state.starOpacity>.005&&weather.cloud<.8,precip=weather.rain>.005||weather.snow>.005,petals=particles.petals.length>0;
  if(!canvasHasContent&&!stars&&!precip&&!petals)return;
  ctx.clearRect(0,0,w,h);canvasHasContent=stars||precip||petals;worldState.metrics.environmentFrames++;
  const count=Math.round(80*config.particleScale),phase=paused()?0:t;
  if(stars){ctx.fillStyle=`rgba(236,239,221,${state.starOpacity*(1-weather.cloud*.94)*.65})`;ctx.beginPath();for(const star of worldState.stars.slice(0,count)){ctx.moveTo(star.x*w+star.r,star.y*h);ctx.arc(star.x*w,star.y*h,star.r,0,Math.PI*2);}ctx.fill();}
  if(precip){ctx.save();if(windowPresence>.8){ctx.beginPath();ctx.rect(w*.05,h*.035,w*.90,h*.735);ctx.clip();}
    if(weather.rain>.005){ctx.strokeStyle=`rgba(215,229,233,${weather.rain*.62})`;ctx.lineWidth=.8;ctx.beginPath();for(const drop of worldState.precipitation.slice(0,count)){const x=((drop.x+phase*.000022*drop.speed)%1.1-.05)*w,y=((drop.y+phase*.00065*drop.speed)%1)*h;ctx.moveTo(x,y);ctx.lineTo(x+3*drop.speed,y+13*drop.speed);}ctx.stroke();}
    if(weather.snow>.005){ctx.fillStyle=`rgba(242,247,247,${weather.snow*.84})`;ctx.beginPath();for(const drop of worldState.precipitation.slice(0,count)){const x=(drop.x+Math.sin(phase*.00022+drop.phase)*.025)*w,y=((drop.y+phase*.00003*drop.speed)%1)*h;ctx.moveTo(x+drop.size,y);ctx.arc(x,y,drop.size,0,Math.PI*2);}ctx.fill();}ctx.restore();
    if(weather.rain>.005&&windowPresence>.05){ctx.strokeStyle=`rgba(216,231,234,${weather.rain*windowPresence*.55})`;ctx.lineWidth=1.4;ctx.beginPath();for(let i=0;i<(quality==='high'?9:4);i++){const x=(.18+i*.073)*w,y=(.12+(i*.153+phase*.000016)% .47)*h;ctx.moveTo(x,y);ctx.lineTo(x-1,y+6);}for(let i=0;i<(quality==='high'?7:3);i++){const x=(.10+i*.123)*w,y=(.04+phase*.0004% .12)*h;ctx.moveTo(x,y);ctx.lineTo(x,y+5);}ctx.stroke();}
  }
  if(!paused())for(const p of particles.petals){const q=(t-p.start)/p.duration;if(q<0||q>1)continue;const x=(-.05+q*1.1)*w,y=(p.y+Math.sin(q*Math.PI)*.12)*h;ctx.fillStyle=`rgba(${worldState.season.name==='spring'?'235,190,190':'192,126,55'},${Math.sin(q*Math.PI)*.75*(1-windowPresence)})`;ctx.beginPath();ctx.ellipse(x,y,p.size,p.size*.4,q*5,0,Math.PI*2);ctx.fill();}
  particles.petals=particles.petals.filter(p=>t-p.start<p.duration);
}
function needsFrames(){return camera.moving||cameraDirty||pendingScroll!==null||reducedView?.progress<1||worldState.book.transition||worldState.timeTransition||worldState.weather.transition||worldState.season.transition||painter.transition||occlusion;}
function tick(now){
  frame=0;if(document.hidden)return;const dt=Math.max(0,(now-lastFrame)/1000);lastFrame=now;worldState.metrics.frames++;
  if(!paused())worldState.elapsed+=dt*1000;
  if(pendingScroll!==null){const p=pendingScroll/viewport.height;pendingScroll=null;camera.input(p);if(worldState.book.target&&Math.abs(p-4)>.06)setBook(false,false);worldState.targetScene=ids[Math.round(camera.target)];prefetchScene(camera.target);cameraDirty=true;}
  const cameraActive=camera.moving||cameraDirty||worldState.book.transition||occlusion||reducedView?.progress<1;
  const wasTravel=!!camera.travel;camera.sample(now,Math.min(dt,.05));if(wasTravel)writeScroll(camera.position);
  if(worldState.timeTransition||worldState.weather.transition||worldState.season.transition){updateTime(now);WorldEnvironment.updateClimate(worldState,now);applyTime();}
  if(worldState.book.transition)updateBook(now);
  if(painter.transition)painter.update(now);
  if(cameraActive){cameraDirty=false;renderCamera(now,Math.min(dt,.05));environmentDirty=canvasHasContent;}
  if((environmentDirty||activeParticles())&&now-lastEnvironmentFrame>=1000/config.canvasFps){drawEnvironment();environmentDirty=false;lastEnvironmentFrame=now;}
  if(worldState.soundEnabled&&now-nextAudioUpdate>150){updateAudioEnvironment();nextAudioUpdate=now;}
  if(needsFrames())frame=requestAnimationFrame(tick);else if(activeParticles()){wakeTimer=setTimeout(()=>{wakeTimer=0;startFrames();},1000/config.canvasFps);}
}
function startFrames(){if(wakeTimer){clearTimeout(wakeTimer);wakeTimer=0;}if(!frame&&!document.hidden)frame=requestAnimationFrame(tick);}
function stopFrames(){if(frame)cancelAnimationFrame(frame);clearTimeout(wakeTimer);frame=wakeTimer=0;}
function syncMotion(){document.body.classList.toggle('motion-paused',paused());$('#motion-toggle').textContent=paused()?'动效关':'动效开';$('#motion-toggle').setAttribute('aria-pressed',String(paused()));if(paused()){finishIntro();occlusion=null;photoAnimation?.finish();$('#book-pages').getAnimations().forEach(a=>a.cancel());if(camera.travel)camera.go(camera.target,performance.now(),{source:camera.travel.source,reduced:true});}environmentDirty=true;cameraDirty=true;startFrames();}
$('#motion-toggle').addEventListener('click',()=>{if(reduceQuery.matches){notify('已遵循系统的减少动态效果设置');return;}manualPaused=!manualPaused;syncMotion();});reduceQuery.addEventListener('change',()=>{measure();syncMotion();});
let introTimer;
function finishIntro(){clearTimeout(introTimer);document.body.classList.remove('intro-running','intro-short');$('.skip-intro').hidden=true;}
function beginIntro(){if(paused()||boot!=='home')return;let returning=false;try{returning=localStorage.getItem('yi-world-visited')==='1';localStorage.setItem('yi-world-visited','1');}catch{}document.body.classList.add('intro-running');if(returning)document.body.classList.add('intro-short');$('.skip-intro').hidden=false;introTimer=setTimeout(finishIntro,returning?700:1600);}
$('.skip-intro').addEventListener('click',finishIntro);
document.addEventListener('visibilitychange',()=>{document.body.classList.toggle('is-hidden',document.hidden);if(document.hidden){hiddenAt=performance.now();stopFrames();finishIntro();turnSoundOff();}else{const now=performance.now(),gap=hiddenAt===null?0:now-hiddenAt;hiddenAt=null;for(const transition of [camera.travel,reducedView,worldState.book.transition,worldState.timeTransition,worldState.weather.transition,worldState.season.transition,painter.transition,occlusion])if(transition)transition.start+=gap;worldState.wind.nextGust+=gap;worldState.particles.nextAudioDetail+=gap;worldState.weather.nextAt+=gap;lastFrame=now;updateTime(now,true);applyTime();startFrames();}});
setInterval(()=>{if(document.hidden)return;const now=performance.now();
  if(!worldState.timeTransition){updateTime(now);applyTime();if(worldState.timeMode==='auto'&&!appearancePending&&now-lastPaintClock>30000)requestAppearance({});}
  if(worldState.weather.mode==='auto'&&now>=worldState.weather.nextAt&&!appearancePending){worldState.weather.nextAt=now+600000;const r=Math.random();requestAppearance({weather:r<.44?'clear':r<.69?'cloudy':r<.84?'overcast':worldState.season.name==='winter'?'snow':'rain'},{source:'auto'});}
  if(worldState.season.mode==='auto'&&worldState.season.name!==WorldEnvironment.seasonForMonth(new Date().getMonth())&&!appearancePending)requestAppearance({season:'auto'});
  if(!paused()&&now>=worldState.wind.nextGust){worldState.wind.nextGust=now+random(45000,110000);worldState.wind.gustStart=worldState.elapsed;worldState.metrics.gusts++;if(quality==='high'){$('.foreground-decor').classList.add('wind-gust');setTimeout(()=>$('.foreground-decor').classList.remove('wind-gust'),2100);}if(quality!=='low'&&['spring','autumn'].includes(worldState.season.name)&&worldState.weather.values.rain<.1&&worldState.weather.values.snow<.1)worldState.particles.petals=Array.from({length:quality==='high'?3:1},()=>({start:worldState.elapsed,duration:random(9000,13000),y:random(.2,.6),size:random(2,4)}));}
  if(worldState.soundEnabled&&now>=worldState.particles.nextAudioDetail){worldState.particles.nextAudioDetail=now+random(16000,32000);playEnvironmentDetail();}
  if(!camera.moving&&now-lastUserScroll>400&&now-lastUserScroll<1500){const n=Math.round(camera.target);if(Math.abs(n-camera.target)>.012&&Math.abs(n-camera.target)<.075){camera.go(n,now,{source:'snap',reduced:paused(),duration:config.cameraDuration(n-camera.position)});cameraDirty=true;}}
  if(environmentDirty||needsFrames()||activeParticles())startFrames();
},1000);
window.addEventListener('pagehide',()=>{stopFrames();turnSoundOff();});window.addEventListener('pageshow',()=>{if(!document.hidden){lastFrame=performance.now();startFrames();}});
window.YI_WORLD={getState:()=>({identity:worldState.identity,mode:worldState.timeMode,phase:worldState.time.id,environment:structuredClone(worldState.time),season:structuredClone(worldState.season),weather:structuredClone(worldState.weather),cloudPositions:{...worldState.cloudPositions},starsSignature:worldState.stars.slice(0,4).map(s=>[s.x,s.y]),wind:{...worldState.wind},catState:{mode:'removed',location:null},elapsed:worldState.elapsed,currentScene:worldState.currentScene,activeChapter:worldState.currentScene,targetScene:worldState.targetScene,camera:{position:camera.position,velocity:camera.velocity,target:camera.target,travel:camera.travel?{...camera.travel}:null,lastRequest:camera.lastRequest},book:{...worldState.book},motionPaused:paused(),animationRunning:!!frame,soundOn:worldState.soundEnabled,audioState:audioContext?.state||'not-created',audioCreations,room:windowPresence,rainGain:rainGain?.gain.value||0,metrics:{...worldState.metrics},canvas:{width:canvas.width,height:canvas.height},openPhoto:openPhoto?photoIndex:null,quality,paint:{ready:painter.ready,count:painter.paints,pending:appearancePending,transition:!!painter.transition,windowReady:painter.windowReady,season:painter.lastPaint?.season,effectiveSeason:painter.lastPaint?.effective,weather:painter.lastPaint?.weather}})};
applyTime();measure();prefetchScene(camera.position);syncSound();syncMotion();renderBook(0,false);requestAppearance({});
initializing=false;root.classList.add('world-ready');renderCamera(performance.now(),0,true);beginIntro();startFrames();
