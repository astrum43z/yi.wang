const PHOTOS = [
  { src: "", full: "", caption: "[照片说明]", date: "[日期]", place: "[地点]" },
  { src: "", full: "", caption: "[照片说明]", date: "[日期]", place: "[地点]" },
  { src: "", full: "", caption: "[照片说明]", date: "[日期]", place: "[地点]" },
  { src: "", full: "", caption: "[照片说明]", date: "[日期]", place: "[地点]" },
  { src: "", full: "", caption: "[照片说明]", date: "[日期]", place: "[地点]" },
  { src: "", full: "", caption: "[照片说明]", date: "[日期]", place: "[地点]" }
];
'use strict';
// PHOTOS above is the original user-content entry point; no personal content is invented.
const WRITING=[{title:'',text:''},{title:'',text:''},{title:'',text:''}];
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const root=document.documentElement,reduceQuery=matchMedia('(prefers-reduced-motion: reduce)'),mobileQuery=matchMedia('(max-width:760px)'),finePointer=matchMedia('(hover:hover) and (pointer:fine)');
const {clamp,ease}=WorldCamera,smooth=WorldTime.smooth,random=(a,b)=>a+Math.random()*(b-a);
const ids=['home','recent','gallery','things','notes','about'],chapters=ids.map(id=>$('#'+id));
const boot=ids.includes(root.dataset.initialScene)?root.dataset.initialScene:'home';
const worldState=WorldEnvironment.create(performance.now(),boot);
const camera=new WorldCamera.CameraController(ids.indexOf(boot));worldState.camera=camera;worldState.cameraProgress=camera.position;
const styleCache=new WeakMap();
function style(el,name,value){let cache=styleCache.get(el);if(!cache){cache=new Map();styleCache.set(el,cache);}if(cache.get(name)!==value){cache.set(name,value);el.style.setProperty(name,value);}}
const css=(k,v)=>style(root,k,v),color=a=>`rgb(${a.map(Math.round).join(' ')})`,isReal=t=>typeof t==='string'&&t.trim()&&!/^\[.*\]$/.test(t.trim());
let frame=0,lastFrame=performance.now(),lastEnvironmentFrame=0,lastClock=0,lastClimate=0,manualPaused=false;
let viewport={width:innerWidth,height:innerHeight},writtenY=-1,lastUserScroll=-Infinity,hiddenAt=null,initializing=true;
let pointer={x:0,y:0,toX:0,toY:0},indicator={x:0,width:0,alpha:0},navRects=[];
let occlusion=null,occlusionTravel=0,wasMoving=false,lastSettled=boot;
const paused=()=>manualPaused||reduceQuery.matches;
const canvas=$('#environment-canvas'),ctx=canvas.getContext('2d'),nav=$('.desktop-nav'),wipe=$('.camera-wipe');
const cameraKeys=[{x:0,y:0,s:1},{x:-2.5,y:-4,s:1.20},{x:4,y:-7,s:1.36},{x:-8,y:-12,s:1.48},{x:-17,y:-17,s:1.66},{x:3,y:-1,s:1.03}];
let windowPresence=boot==='notes'?1:0;
const scenePresentation=ids.map(id=>({indexAlpha:Number(id===boot),titleAlpha:Number(id===boot),objectAlpha:Number(id===boot)}));
let reducedView=null;
const tracked=new Set(),eventQueue=[];let metricTries=0;
function track(name,data={}){if(typeof window.umami?.track==='function'){try{Promise.resolve(window.umami.track(name,data)).catch(()=>{});}catch{}}else if(eventQueue.length<20)eventQueue.push([name,data]);}
const metricsTimer=setInterval(()=>{if(typeof window.umami?.track==='function'){for(const e of eventQueue.splice(0))track(...e);clearInterval(metricsTimer);}else if(++metricTries>=25){eventQueue.length=0;clearInterval(metricsTimer);}},1000);
let toastTimer;
function notify(text){clearTimeout(toastTimer);$('#status-message').textContent=text;$('#status-message').classList.add('visible');toastTimer=setTimeout(()=>$('#status-message').classList.remove('visible'),3000);}

// Asset warming never rebuilds world nodes or stops a journey.
const imagePromises=new WeakMap();
async function warmImage(img){
  if(imagePromises.has(img))return imagePromises.get(img);
  const p=(async()=>{if(img.dataset.src){img.src=img.dataset.src;delete img.dataset.src;worldState.metrics.assetLoads++;}else if(img.complete&&!img.naturalWidth&&img.getAttribute('src')){const retrySrc=img.getAttribute('src');img.removeAttribute('src');img.src=retrySrc;}try{await img.decode();img.hidden=false;img.classList.add('is-decoded');const empty=img.closest('.photo-button')?.querySelector('.empty-photo');if(empty)empty.hidden=true;return true;}catch{imagePromises.delete(img);return false;}})();
  imagePromises.set(img,p);return p;
}
async function prepareWinter(){const results=await Promise.all($$('.winter-art').map(warmImage));return results.every(Boolean);}
function prefetchScene(index){if(Math.abs(index-2)<1.6)$$('.photo-line img[data-src]').forEach(warmImage);if(Math.abs(index-4)<1.6)warmImage($('.window-corner img'));}
function updateTime(now,force=false){
  const tr=worldState.timeTransition;
  if(tr){const t=clamp((now-tr.start)/tr.duration);worldState.time=WorldTime.mix(tr.from,tr.to,ease(t));if(t===1)worldState.timeTransition=null;applyTime();}
  else if(force||now-lastClock>=1000){worldState.time=WorldTime.sample(worldState.timeMode==='auto'?new Date():WorldTime.previewTimes[worldState.timeMode]);lastClock=now;applyTime();}
}
function applyTime(){
  const state=worldState.time,weather=worldState.weather.values;
  css('--sky-top',color(state.skyTop));css('--sky-bottom',color(state.skyBottom));css('--sun-color',color(state.sunColor));
  css('--sun-x',state.sunPosition[0]+'%');css('--sun-y',state.sunPosition[1]+'%');css('--sun-opacity',state.sunOpacity.toFixed(4));
  css('--moon-x',state.moonPosition[0]+'%');css('--moon-y',state.moonPosition[1]+'%');css('--moon-opacity',state.moonOpacity.toFixed(4));
  for(const [name,key] of Object.entries({'--ambient':'ambientLight','--grass':'grassBrightness','--cloud-brightness':'cloudBrightness','--star-opacity':'starOpacity','--window-light':'windowLight','--night':'nightMix','--mist':'mistOpacity','--nebula':'nebulaOpacity','--dew':'dewOpacity','--wind-length':'shadowLength'}))css(name,state[key].toFixed(4));
  css('--warmth',Math.max(0,state.sceneTemperature).toFixed(4));
  const light=clamp((state.nightMix-.2)/.6);css('--world-ink',color([63,63,50].map((v,i)=>v+([242,239,220][i]-v)*light)));
  $('#time-label').textContent=state.label;$('#time-mode-label').textContent=worldState.timeMode==='auto'?'AUTO':'预览';$('.time-symbol').textContent=state.moonOpacity>.45?'☾':'☀';
  $('meta[name="theme-color"]').content=color(state.skyTop);
  for(const name of ['spring','autumn','winter'])css('--'+name,worldState.season.weights[name].toFixed(4));
  css('--weather-cloud',weather.cloud.toFixed(4));css('--rain',weather.rain.toFixed(4));css('--snow',weather.snow.toFixed(4));
}
function setTimeMode(mode){if(mode!=='auto'&&!(mode in WorldTime.previewTimes))return;worldState.timeMode=mode;worldState.timeTransition={from:structuredClone(worldState.time),to:WorldTime.sample(mode==='auto'?new Date():WorldTime.previewTimes[mode]),start:performance.now(),duration:paused()?260:2400};$$('[data-time]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.time===mode)));track('切换昼夜预览',{mode});startFrames();}
async function setSeason(mode){
  const request=++worldState.season.request;
  if(mode==='winter'||mode==='auto'&&WorldEnvironment.seasonForMonth(new Date().getMonth())==='winter'){
    const ready=await prepareWinter();if(!ready){notify('冬日风景暂未载入，可以稍后再试');return;}
  }
  if(request!==worldState.season.request)return;
  WorldEnvironment.setSeason(worldState,mode,performance.now());$$('[data-season]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.season===mode)));startFrames();
}
function setWeather(name){WorldEnvironment.setWeather(worldState,name,performance.now());$$('[data-weather]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.weather===name)));startFrames();}

// Navigation, history and native wheel/touch all feed this exact controller.
function writeScroll(position){writtenY=position*viewport.height;window.scrollTo({top:writtenY,behavior:'instant'});}
function navigate(id,{source='navigation',historyMode='push'}={}){
  if(!ids.includes(id))return;
  const target=ids.indexOf(id);
  if(camera.travel?.to===target&&source==='history')return;
  finishIntro();if(worldState.book.target)setBook(false);
  if(openPhoto)closePhoto(true);
  const now=performance.now();
  if(camera.travel)worldState.metrics.retargets++;
  worldState.metrics.navigation++;
  camera.go(target,now,{source:id==='home'&&source==='navigation'?'home':source,reduced:paused()});worldState.targetScene=id;
  if(historyMode==='push'&&location.hash!=='#'+id)history.pushState({scene:id},'','#'+id);
  prefetchScene(target);startFrames();
}
function interruptJourney(){if(!camera.travel)return;camera.input(camera.position);worldState.targetScene=ids[Math.round(camera.position)];writeScroll(camera.position);startFrames();}
window.addEventListener('wheel',event=>{if(event.target.closest('dialog[open],.desk-book-page'))return;interruptJourney();lastUserScroll=performance.now();},{passive:true});
window.addEventListener('touchstart',event=>{if(event.target.closest('dialog[open],.desk-book-page,button,a'))return;interruptJourney();lastUserScroll=performance.now();},{passive:true});
window.addEventListener('keydown',event=>{if(event.defaultPrevented||event.target.closest('input,textarea,dialog[open],.desk-book-page'))return;if(['PageDown','PageUp','Home','End','ArrowUp','ArrowDown',' '].includes(event.key)){interruptJourney();lastUserScroll=performance.now();}},{passive:true});
window.addEventListener('scroll',()=>{
  if(initializing)return;const y=window.scrollY;if(Math.abs(y-writtenY)<1.5)return;
  lastUserScroll=performance.now();camera.input(y/viewport.height);if(worldState.book.target&&Math.abs(y/viewport.height-4)>.06)setBook(false,false);worldState.targetScene=ids[Math.round(camera.target)];prefetchScene(camera.target);startFrames();
},{passive:true});
$$('a[href^="#"]').forEach(link=>{
  if(!ids.includes(link.hash.slice(1)))return;
  link.addEventListener('click',event=>{if(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;event.preventDefault();if(menu.open)closeSmallDialog(menu);navigate(link.hash.slice(1));});
});
$('.skip-link').addEventListener('click',e=>{e.preventDefault();const section=chapters[ids.indexOf(worldState.currentScene)];section.setAttribute('tabindex','-1');section.focus({preventScroll:true});});
function locationJourney(){const id=ids.includes(location.hash.slice(1))?location.hash.slice(1):'home';navigate(id,{source:'history',historyMode:'none'});}
window.addEventListener('popstate',locationJourney);window.addEventListener('hashchange',locationJourney);
function settleScene(){
  const nearest=ids[Math.round(camera.position)];
  if(Math.abs(camera.position-Math.round(camera.position))>.015)return;
  if(!camera.travel&&nearest!==lastSettled){lastSettled=nearest;if(location.hash!=='#'+nearest)history.replaceState({scene:nearest},'','#'+nearest);$('#journey-announcement').textContent='来到'+chapters[ids.indexOf(nearest)].dataset.chapter;}
  if(nearest!=='home'&&!tracked.has(nearest)){tracked.add(nearest);track('进入'+chapters[ids.indexOf(nearest)].dataset.chapter);}
}
function measure(){
  viewport={width:innerWidth,height:innerHeight};css('--journey-height',viewport.height*6+'px');
  const navBox=nav.getBoundingClientRect();navRects=ids.map(id=>{const a=nav.querySelector('a[href="#'+id+'"]');if(!a)return null;const r=a.getBoundingClientRect();return{x:r.left-navBox.left,width:r.width};});
  const dpr=Math.min(devicePixelRatio||1,mobileQuery.matches?1:1.5);canvas.width=Math.round(viewport.width*dpr);canvas.height=Math.round(viewport.height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);
  writeScroll(camera.position);renderCamera(performance.now(),0,true);drawEnvironment();
}
let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(measure,100);},{passive:true});
document.addEventListener('pointermove',e=>{if(!finePointer.matches||paused()||openPhoto)return;pointer.toX=(e.clientX/innerWidth-.5)*26;pointer.toY=(e.clientY/innerHeight-.5)*15;},{passive:true});
root.addEventListener('pointerleave',()=>{pointer.toX=pointer.toY=0;});
function renderCamera(now,dt,immediate=false){
  const p=camera.position,i=Math.min(4,Math.floor(p)),q=ease(p-i),a=cameraKeys[i],b=cameraKeys[i+1];
  worldState.cameraProgress=p;
  const current=ids[Math.round(p)];worldState.currentScene=current;
  const limited=paused(),book=worldState.book.value;
  let x=a.x+(b.x-a.x)*q,y=a.y+(b.y-a.y)*q,s=a.s+(b.s-a.s)*q;
  const travel=camera.travel;
  if(limited){x=y=0;s=1;}
  css('--camera-x',x.toFixed(4)+'%');css('--camera-y',y.toFixed(4)+'%');css('--camera-scale',(s*(1+(limited?0:.065)*book*clamp(1-Math.abs(p-4)*3))).toFixed(5));
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
  css('--window-presence',windowPresence.toFixed(4));css('--near-presence',(1-windowPresence).toFixed(4));css('--about-quiet',smooth(clamp((p-4.45)/.55)).toFixed(4));css('--header-presence',clamp(p).toFixed(4));
  const friction=immediate?1:1-Math.exp(-9*dt);pointer.x+=(pointer.toX-pointer.x)*friction;pointer.y+=(pointer.toY-pointer.y)*friction;
  css('--pointer-x',(limited||mobileQuery.matches?0:pointer.x).toFixed(2)+'px');css('--pointer-y',(limited||mobileQuery.matches?0:pointer.y).toFixed(2)+'px');
  css('--mobile-pan',mobileQuery.matches&&!limited?(-p*viewport.width*.15).toFixed(2)+'px':'0px');
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
  $$('.desktop-nav a,.scene-rail a').forEach(link=>{if(link.hash==='#'+current)link.setAttribute('aria-current','location');else link.removeAttribute('aria-current');});
  const targetRect=navRects[ids.indexOf(travel?worldState.targetScene:current)];
  if(targetRect){const f=immediate?1:1-Math.exp(-10*dt);indicator.x+=(targetRect.x-indicator.x)*f;indicator.width+=(targetRect.width-indicator.width)*f;indicator.alpha+=(1-indicator.alpha)*f;}else indicator.alpha*=immediate?0:Math.exp(-8*dt);
  css('--nav-x',indicator.x.toFixed(2)+'px');css('--nav-width',Math.max(.01,indicator.width).toFixed(3));css('--nav-alpha',indicator.alpha.toFixed(4));
  if(!limited){
    if(travel&&!travel.reduced&&travel.progress>.27&&travel.progress<.7&&occlusionTravel!==travel.id&&!occlusion){occlusionTravel=travel.id;occlusion={start:now,duration:Math.abs(travel.to-travel.from)>2?420:330,direction:Math.sign(travel.to-travel.from)||1,kind:travel.to===4||Math.round(travel.from)===4?'curtain':'leaf'};}
    if(!travel&&Math.abs(camera.velocity)>.2&&!occlusion){const fraction=p-Math.floor(p);if(fraction>.4&&fraction<.55&&!wasMoving){occlusion={start:now,duration:360,direction:Math.sign(camera.velocity),kind:Math.floor(p)===3?'curtain':'leaf'};wasMoving=true;}if(fraction<.2||fraction>.8)wasMoving=false;}
  }
  if(occlusion&&!limited){const t=clamp((now-occlusion.start)/occlusion.duration);wipe.dataset.kind=occlusion.kind;style(wipe,'opacity',(Math.sin(t*Math.PI)*.97).toFixed(4));style(wipe,'transform',`translate3d(${occlusion.direction*(120-240*t)}%,0,0)`);if(t===1)occlusion=null;}else style(wipe,'opacity','0');
  if(Math.abs(camera.velocity)<.03&&!travel&&now-lastUserScroll>220&&now-lastUserScroll<1100){const nearest=Math.round(camera.target);if(Math.abs(nearest-camera.target)>.012&&Math.abs(nearest-camera.target)<.075){camera.go(nearest,now,{source:'snap',reduced:limited});worldState.targetScene=ids[nearest];}}
  settleScene();prefetchScene(p);
}

// A notebook lives on the desk. Its pages are not a modal or a second copy.
function setBook(open,restoreFocus=true){
  const book=worldState.book;if(book.target===Number(open)&&book.transition)return;
  book.target=Number(open);book.transition={from:book.value,to:book.target,start:performance.now(),duration:paused()?260:780};
  $('#open-notebook').setAttribute('aria-expanded',String(open));$('#desk-book').classList.toggle('is-open',open);$('#book-pages').inert=!open;startFrames();
  if(open){renderBook(book.page,false);setTimeout(()=>{if(book.target)$('#book-close').focus({preventScroll:true});},paused()?270:800);}else if(restoreFocus)$('#open-notebook').focus({preventScroll:true});
}
function updateBook(now){const b=worldState.book;if(b.transition){const tr=b.transition,t=clamp((now-tr.start)/tr.duration);b.value=tr.from+(tr.to-tr.from)*ease(t);if(t===1)b.transition=null;}css('--book-open',b.value.toFixed(4));}
function renderBook(index,animate=true){const b=worldState.book;b.page=clamp(index,0,WRITING.length-1);const page=WRITING[b.page];$('#book-page-number').textContent=String(b.page+1).padStart(2,'0');$('#book-title').textContent=page.title||'这一页暂时留白';$('#book-text').textContent=page.text||'还没有文字。';$('#book-prev').disabled=b.page===0;$('#book-next').disabled=b.page===WRITING.length-1;if(animate){const node=$('#book-pages');node.getAnimations().forEach(a=>a.cancel());node.animate(paused()?[{opacity:.65},{opacity:1}]:[{transform:'perspective(1200px) rotateY(-38deg)',opacity:.65},{transform:'none',opacity:1}],{duration:paused()?200:520,easing:'cubic-bezier(.22,1,.36,1)'}).finished.catch(()=>{});}}
$('#open-notebook').addEventListener('click',()=>setBook(true));$('#book-close').addEventListener('click',()=>setBook(false));$('#book-prev').addEventListener('click',()=>renderBook(worldState.book.page-1));$('#book-next').addEventListener('click',()=>renderBook(worldState.book.page+1));
$('#desk-book').addEventListener('keydown',e=>{if(!worldState.book.target)return;if(e.key==='Escape'){e.preventDefault();setBook(false);}if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();renderBook(worldState.book.page+(e.key==='ArrowRight'?1:-1));}});

// A genuine shared element: the same physical figure is reparented and returned.
const lightbox=$('#lightbox'),portal=$('#photo-portal');let openPhoto=null,photoIndex=0,photoClosing=false,photoAnimation=null;
const photoFigures=$$('.hanging-photo'),photoButtons=$$('[data-photo]');
function restorePhoto(){if(!openPhoto)return;photoAnimation?.cancel();const {figure,seat}=openPhoto;figure.classList.add('is-restoring');seat.replaceWith(figure);figure.classList.remove('is-expanded');figure.style.removeProperty('transform');getComputedStyle(figure).transform;figure.classList.remove('is-restoring');openPhoto=null;}
function flight(node,from,to,reverse=false){
  photoAnimation?.cancel();const dx=from.left+from.width/2-to.left-to.width/2,dy=from.top+from.height/2-to.top-to.height/2;
  const transform=`translate3d(${dx}px,${dy}px,0) rotate(${from.angle||0}deg) scale(${(from.layoutWidth||from.width)/to.width},${(from.layoutHeight||from.height)/to.height})`;
  photoAnimation=node.animate(paused()?[{opacity:.7},{opacity:1}]:reverse?[{transform:'none'},{transform}]:[{transform},{transform:'none'}],{duration:paused()?200:reverse?520:650,easing:'cubic-bezier(.22,1,.36,1)',fill:'both'});return photoAnimation.finished.catch(()=>{});
}
function updatePhotoText(){const p=PHOTOS[photoIndex];$('#lightbox-counter').textContent=`${String(photoIndex+1).padStart(2,'0')} / ${String(PHOTOS.length).padStart(2,'0')}`;$('#lightbox-caption').textContent=isReal(p.caption)?p.caption:'尚未放入照片';$('#lightbox-date').textContent=isReal(p.date)?p.date:'';$('#lightbox-place').textContent=isReal(p.place)?p.place:'';$('#lightbox-prev').disabled=photoIndex===0;$('#lightbox-next').disabled=photoIndex===PHOTOS.length-1;$('#lightbox-announcement').textContent=`第 ${photoIndex+1} 张，共 ${PHOTOS.length} 张。`;}
async function showPhoto(index){
  if(photoClosing)return;index=clamp(index,0,PHOTOS.length-1);const figure=photoFigures[index];if(openPhoto?.figure===figure)return;
  if(openPhoto)restorePhoto();photoIndex=index;
  const box=figure.getBoundingClientRect(),computed=getComputedStyle(figure),matrix=new DOMMatrix(computed.transform),from={left:box.left,top:box.top,width:box.width,height:box.height,layoutWidth:figure.offsetWidth,layoutHeight:figure.offsetHeight,angle:Math.atan2(matrix.b,matrix.a)*180/Math.PI},seat=document.createElement('div');seat.className='photo-seat';seat.style.height=figure.offsetHeight+'px';seat.style.marginTop=computed.marginTop;
  figure.before(seat);openPhoto={figure,seat,button:photoButtons[index],source:from};
  if(!lightbox.open){lightbox.showModal();document.body.classList.add('modal-open');}
  portal.append(figure);figure.classList.add('is-expanded');const img=figure.querySelector('img');if(img){warmImage(img);const full=PHOTOS[index].full;if(full&&img.dataset.fullLoaded!==full){const preload=new Image();preload.src=full;preload.decode().then(()=>{img.src=full;img.dataset.fullLoaded=full;img.hidden=false;img.classList.add('is-decoded');img.closest('.photo-button').querySelector('.empty-photo').hidden=true;}).catch(()=>{});}}updatePhotoText();
  const to=figure.getBoundingClientRect();css('--photo-ui','0');track('打开照片',{index:index+1});
  await flight(figure,from,to);if(openPhoto?.figure!==figure||photoClosing)return;photoAnimation?.cancel();css('--photo-ui','1');$('#lightbox-close').focus({preventScroll:true});
}
async function closePhoto(immediate=false){
  if(!openPhoto||photoClosing)return;photoClosing=true;css('--photo-ui','0');const item=openPhoto;
  const current=item.figure.getBoundingClientRect(),currentTransform=getComputedStyle(item.figure).transform;photoAnimation?.cancel();
  // Measure this exact object in its actual responsive slot, synchronously before the next paint.
  item.seat.replaceWith(item.figure);item.figure.classList.remove('is-expanded');item.figure.classList.add('is-measuring');
  const slotBox=item.figure.getBoundingClientRect(),slotStyle=getComputedStyle(item.figure),slotMatrix=new DOMMatrix(slotStyle.transform);
  const target={left:slotBox.left,top:slotBox.top,width:slotBox.width,height:slotBox.height,layoutWidth:item.figure.offsetWidth,layoutHeight:item.figure.offsetHeight,angle:Math.atan2(slotMatrix.b,slotMatrix.a)*180/Math.PI};
  item.seat.style.height=target.layoutHeight+'px';item.figure.replaceWith(item.seat);portal.append(item.figure);item.figure.classList.remove('is-measuring');item.figure.classList.add('is-expanded');
  if(!immediate){const natural=item.figure.getBoundingClientRect();const endX=target.left+target.width/2-natural.left-natural.width/2,endY=target.top+target.height/2-natural.top-natural.height/2;photoAnimation=item.figure.animate(paused()?[{opacity:1},{opacity:.7}]:[{transform:currentTransform},{transform:`translate3d(${endX}px,${endY}px,0) rotate(${target.angle}deg) scale(${target.layoutWidth/natural.width},${target.layoutHeight/natural.height})`}],{duration:paused()?200:520,easing:'cubic-bezier(.22,1,.36,1)',fill:'both'});await photoAnimation.finished.catch(()=>{});}
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

// Persistent environmental simulation, sampled by the same master frame loop.
function updateEnvironment(dt,now){
  if(paused())return;worldState.elapsed+=dt*1000;worldState.catState.update(dt);
  const elapsed=worldState.elapsed,w=worldState.wind,p=worldState.particles;
  for(const [key,period,distance] of [['far',860000,-18],['mid',620000,24],['near',440000,-40]]){worldState.cloudPositions[key]=(1-Math.cos(elapsed/period*Math.PI*2))*.5*distance;css('--cloud-'+key+'-x',worldState.cloudPositions[key].toFixed(5)+'vw');}
  if(now>=w.nextGust){w.nextGust=now+random(30000,90000);w.gustStart=elapsed;worldState.metrics.gusts++;p.petals=Array.from({length:Math.floor(random(1,mobileQuery.matches?3:5))},()=>({start:elapsed+random(0,1900),duration:random(13000,21000),y:random(.2,.72),bend:random(-.13,.2),size:random(2,5.5),phase:random(0,7)}));}
  if(now>=p.nextBird){p.nextBird=now+random(90000,170000);if(worldState.time.starOpacity<.12&&worldState.weather.values.rain<.2){p.bird={start:elapsed,y:random(.18,.35),count:Math.random()>.5?2:1};worldState.metrics.birds++;}}
  if(now>=p.nextMeteor){p.nextMeteor=now+random(60000,180000);if(worldState.time.id==='night'&&worldState.weather.values.cloud<.4){p.meteor={start:elapsed,x:random(.18,.7),y:random(.07,.2)};worldState.metrics.meteors++;}}
  const pulse=delay=>{const t=(elapsed-w.gustStart-delay)/1000;return t>0&&t<7?Math.sin(t*1.5)*Math.exp(-t*.4)*1.6:0;};
  css('--gust-near',pulse(0).toFixed(3)+'deg');css('--gust-mid',pulse(600).toFixed(3)+'deg');css('--gust-tree',pulse(1350).toFixed(3)+'deg');
  css('--cat-breath',(1+Math.sin(elapsed*.0016)*.014+(worldState.catState.mode==='stirring'?Math.sin(worldState.catState.age*3)*.025:0)).toFixed(4));
  if(worldState.weather.values.rain>.001){css('--glass-drift',(elapsed*.002%16).toFixed(2)+'px');css('--eaves-y',(elapsed*.009%28).toFixed(2)+'px');}
}
function drawEnvironment(){
  const w=viewport.width,h=viewport.height,t=worldState.elapsed,state=worldState.time,weather=worldState.weather.values,particles=worldState.particles;ctx.clearRect(0,0,w,h);
  const skyAlpha=1-weather.cloud*.94;
  if(state.starOpacity>.005)for(const star of worldState.stars.slice(0,mobileQuery.matches?55:130)){ctx.fillStyle=`rgba(236,239,221,${state.starOpacity*skyAlpha*(.48+.25*Math.sin(t*star.speed+star.phase))})`;ctx.beginPath();ctx.arc(star.x*w,star.y*h,star.r,0,Math.PI*2);ctx.fill();}
  if(state.nightMix>.6&&!paused())for(let i=0;i<(mobileQuery.matches?3:6);i++){const x=(.08+i*.157+Math.sin(t*.00009+i*2.41)*.035)*w,y=(.66+i%3*.065+Math.sin(t*.00012+i*4.82)*.027)*h,alpha=(state.nightMix-.6)*(1-windowPresence*.9)*(1-weather.rain)*(.45+.55*(Math.sin(t*.0008+i*2.41)+1)/2);const g=ctx.createRadialGradient(x,y,0,x,y,6);g.addColorStop(0,`rgba(236,232,151,${alpha})`);g.addColorStop(1,'rgba(215,235,142,0)');ctx.fillStyle=g;ctx.fillRect(x-6,y-6,12,12);}
  // The same rain/snow field stays outside the window; its phase is never restarted by navigation.
  if(weather.rain>.001||weather.snow>.001){ctx.save();if(windowPresence>.8){ctx.beginPath();ctx.rect(w*.05,h*.035,w*.90,h*.735);ctx.clip();}
    for(const drop of worldState.precipitation.slice(0,mobileQuery.matches?45:100)){
      if(weather.rain>.001){const x=((drop.x+t*.000022*drop.speed)%1.1-.05)*w,y=((drop.y+t*.00065*drop.speed)%1)*h;ctx.strokeStyle=`rgba(216,229,230,${weather.rain*(.15+drop.size*.08)})`;ctx.lineWidth=.6;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+3*drop.speed,y+13*drop.speed);ctx.stroke();}
      if(weather.snow>.001){const x=(drop.x+Math.sin(t*.00022+drop.phase)*.03)*w,y=((drop.y+t*.00003*drop.speed)%1)*h;ctx.fillStyle=`rgba(240,243,235,${weather.snow*.72})`;ctx.beginPath();ctx.arc(x,y,drop.size,0,Math.PI*2);ctx.fill();}
    }ctx.restore();}
  if(paused())return;
  for(const petal of particles.petals){const q=(t-petal.start)/petal.duration;if(q<0||q>1)continue;const x=(-.08+q*1.18)*w,y=(petal.y+Math.sin(q*Math.PI)*petal.bend+q*.12)*h;ctx.save();ctx.translate(x,y);ctx.rotate(q*8+petal.phase+Math.sin(q*5)*.5);ctx.scale(1,.5+Math.abs(Math.sin(q*9+petal.phase))*.5);ctx.fillStyle=`rgba(${worldState.season.weights.spring>.5?'232,197,195':worldState.season.weights.autumn>.5?'210,168,104':'239,225,190'},${Math.sin(Math.PI*q)*.6*(1-windowPresence)})`;ctx.beginPath();ctx.ellipse(0,0,petal.size,petal.size*.4,0,0,Math.PI*2);ctx.fill();ctx.restore();}
  particles.petals=particles.petals.filter(p=>t-p.start<p.duration);
  if(particles.bird){const b=particles.bird,q=(t-b.start)/14000;if(q>1)particles.bird=null;else for(let i=0;i<b.count;i++){const x=(-.05+q*1.15)*w-i*22,y=(b.y+Math.sin(q*3)*.025)*h+i*10,s=mobileQuery.matches?2.2:3.3;ctx.strokeStyle=`rgba(45,65,64,${Math.sin(Math.PI*q)*.48})`;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x-s*2,y+Math.sin(t*.004+i));ctx.quadraticCurveTo(x-s,y-2,x,y);ctx.quadraticCurveTo(x+s,y-2,x+s*2,y+Math.sin(t*.004+i));ctx.stroke();}}
  if(particles.meteor){const m=particles.meteor,q=(t-m.start)/780;if(q>1)particles.meteor=null;else{const x=(m.x+q*.17)*w,y=(m.y+q*.12)*h;ctx.strokeStyle=`rgba(229,235,224,${Math.sin(Math.PI*q)*.7})`;ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(x-q*65,y-q*35);ctx.lineTo(x,y);ctx.stroke();}}
}

// Audio nodes are created once on opt-in and only their room/weather gains change during travel.
let audioContext=null,windSource=null,windFilter=null,windGain=null,rustleGain=null,rainGain=null,soundBusy=false,audioCreations=0,nextAudioUpdate=0;
function createAudio(){const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)throw Error('Audio unavailable');audioContext=new Audio();audioCreations++;const buffer=audioContext.createBuffer(1,audioContext.sampleRate*3,audioContext.sampleRate),data=buffer.getChannelData(0);let brown=0;for(let i=0;i<data.length;i++){brown=(brown+Math.random()*.03-.015)/1.015;data[i]=brown*3;}windSource=audioContext.createBufferSource();windSource.buffer=buffer;windSource.loop=true;windFilter=audioContext.createBiquadFilter();windFilter.type='lowpass';windFilter.frequency.value=450;windGain=audioContext.createGain();windGain.gain.value=.13;const rustle=audioContext.createBiquadFilter();rustle.type='bandpass';rustle.frequency.value=1400;rustle.Q.value=.4;rustleGain=audioContext.createGain();rustleGain.gain.value=.025;const rain=audioContext.createBiquadFilter();rain.type='highpass';rain.frequency.value=800;rainGain=audioContext.createGain();rainGain.gain.value=0;windSource.connect(windFilter).connect(windGain).connect(audioContext.destination);windSource.connect(rustle).connect(rustleGain).connect(audioContext.destination);windSource.connect(rain).connect(rainGain).connect(audioContext.destination);windSource.start();}
function updateAudioEnvironment(){if(!audioContext)return;const t=audioContext.currentTime,state=worldState.time,room=1-windowPresence*.64;windFilter.frequency.setTargetAtTime((230+state.ambientLight*260)*room,t,.5);windGain.gain.setTargetAtTime((.10+state.ambientLight*.035)*room,t,.5);rustleGain.gain.setTargetAtTime((.012+state.ambientLight*.013)*room,t,.5);rainGain.gain.setTargetAtTime(worldState.weather.values.rain*.75*room,t,.6);}
function playEnvironmentDetail(){if(!worldState.soundEnabled||audioContext?.state!=='running')return;const night=worldState.time.nightMix>.65,t=audioContext.currentTime;for(let i=0;i<(night?3:2);i++){const osc=audioContext.createOscillator(),gain=audioContext.createGain(),start=t+i*(night?.23:.28),duration=night?.08:.18;osc.type='sine';osc.frequency.setValueAtTime(night?2600:1700+i*170,start);osc.frequency.exponentialRampToValueAtTime(night?2550:2550+i*240,start+duration*.6);gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime((night?.004:.006)*(1-windowPresence*.7),start+.016);gain.gain.exponentialRampToValueAtTime(.0001,start+duration);osc.connect(gain).connect(audioContext.destination);osc.start(start);osc.stop(start+duration+.03);osc.onended=()=>{osc.disconnect();gain.disconnect();};}}
function syncSound(){const enabled=worldState.soundEnabled;$('#sound-toggle').textContent=enabled?'声音开':'声音关';$('#sound-toggle').setAttribute('aria-pressed',String(enabled));}
async function turnSoundOff(){worldState.soundEnabled=false;syncSound();if(audioContext?.state==='running')await audioContext.suspend().catch(()=>{});}
$('#sound-toggle').addEventListener('click',async()=>{if(soundBusy)return;soundBusy=true;try{if(worldState.soundEnabled)await turnSoundOff();else{if(!audioContext)createAudio();await audioContext.resume();if(document.hidden){await turnSoundOff();return;}worldState.soundEnabled=audioContext.state==='running';syncSound();updateAudioEnvironment();if(worldState.soundEnabled)track('开启声音');}}catch{worldState.soundEnabled=false;syncSound();notify('暂时无法开启声音，请再试一次');}finally{soundBusy=false;}});

// One master rAF: camera/UI every display frame, sparse environment at a lower mobile rate.
function needsFrames(){return !paused()||camera.moving||reducedView?.progress<1||worldState.book.transition||worldState.timeTransition||occlusion;}
function tick(now){frame=0;if(document.hidden)return;const dt=Math.min(.05,Math.max(0,(now-lastFrame)/1000));lastFrame=now;worldState.metrics.frames++;
  const wasTravel=!!camera.travel;camera.sample(now,dt);if(wasTravel)writeScroll(camera.position);
  updateTime(now);if(now-lastClimate>60){WorldEnvironment.updateClimate(worldState,now);applyTime();lastClimate=now;}updateBook(now);updateEnvironment(dt,now);renderCamera(now,dt);
  if(now-lastEnvironmentFrame>(mobileQuery.matches?32:15)){drawEnvironment();worldState.metrics.environmentFrames++;lastEnvironmentFrame=now;}
  if(now-nextAudioUpdate>150){updateAudioEnvironment();nextAudioUpdate=now;}
  if(needsFrames())frame=requestAnimationFrame(tick);
}
function startFrames(){if(!frame&&!document.hidden){lastFrame=performance.now();frame=requestAnimationFrame(tick);}}
function stopFrames(){if(frame)cancelAnimationFrame(frame);frame=0;}
function syncMotion(){document.body.classList.toggle('motion-paused',paused());$('#motion-toggle').textContent=paused()?'动效关':'动效开';$('#motion-toggle').setAttribute('aria-pressed',String(paused()));if(paused()){finishIntro();occlusion=null;photoAnimation?.finish();$('#book-pages').getAnimations().forEach(a=>a.cancel());if(camera.travel)camera.go(camera.target,performance.now(),{source:camera.travel.source,reduced:true});}startFrames();}
$('#motion-toggle').addEventListener('click',()=>{if(reduceQuery.matches){notify('已遵循系统的减少动态效果设置');return;}manualPaused=!manualPaused;syncMotion();});reduceQuery.addEventListener('change',syncMotion);
let introTimer;
function finishIntro(){clearTimeout(introTimer);document.body.classList.remove('intro-running','intro-short');$('.skip-intro').hidden=true;}
function beginIntro(){if(paused()||boot!=='home'){if(boot!=='home')chapters[ids.indexOf(boot)].animate([{opacity:.5,transform:'translateY(5px)'},{opacity:1,transform:'none'}],{duration:380,easing:'cubic-bezier(.22,1,.36,1)'});return;}let returning=false;try{returning=localStorage.getItem('yi-world-visited')==='1';localStorage.setItem('yi-world-visited','1');}catch{}document.body.classList.add('intro-running');if(returning)document.body.classList.add('intro-short');$('.skip-intro').hidden=false;introTimer=setTimeout(finishIntro,returning?700:2100);}
$('.skip-intro').addEventListener('click',finishIntro);
document.addEventListener('visibilitychange',()=>{document.body.classList.toggle('is-hidden',document.hidden);if(document.hidden){hiddenAt=performance.now();stopFrames();finishIntro();turnSoundOff();}else{const now=performance.now(),gap=hiddenAt===null?0:now-hiddenAt;hiddenAt=null;if(camera.travel)camera.travel.start+=gap;if(reducedView)reducedView.start+=gap;if(worldState.book.transition)worldState.book.transition.start+=gap;if(occlusion)occlusion.start+=gap;worldState.wind.nextGust+=gap;worldState.particles.nextBird+=gap;worldState.particles.nextMeteor+=gap;worldState.particles.nextAudioDetail+=gap;worldState.weather.nextAt+=gap;updateTime(now,true);startFrames();}});
setInterval(()=>{if(document.hidden)return;const now=performance.now();if(worldState.soundEnabled&&now>=worldState.particles.nextAudioDetail){worldState.particles.nextAudioDetail=now+random(10000,26000);playEnvironmentDetail();}if(paused()&&!frame){updateTime(now);WorldEnvironment.updateClimate(worldState,now);applyTime();drawEnvironment();}if(worldState.season.mode==='auto'&&worldState.season.name!==WorldEnvironment.seasonForMonth(new Date().getMonth()))setSeason('auto');},1000);
window.addEventListener('pagehide',()=>{stopFrames();turnSoundOff();});window.addEventListener('pageshow',()=>{if(!document.hidden)startFrames();});

window.YI_WORLD={getState:()=>({identity:worldState.identity,mode:worldState.timeMode,phase:worldState.time.id,environment:structuredClone(worldState.time),season:structuredClone(worldState.season),weather:structuredClone(worldState.weather),cloudPositions:{...worldState.cloudPositions},starsSignature:worldState.stars.slice(0,4).map(s=>[s.x,s.y]),wind:{...worldState.wind},catState:structuredClone(worldState.catState),elapsed:worldState.elapsed,currentScene:worldState.currentScene,activeChapter:worldState.currentScene,targetScene:worldState.targetScene,camera:{position:camera.position,velocity:camera.velocity,target:camera.target,travel:camera.travel?{...camera.travel}:null,lastRequest:camera.lastRequest},book:{...worldState.book},motionPaused:paused(),animationRunning:!!frame,soundOn:worldState.soundEnabled,audioState:audioContext?.state||'not-created',audioCreations,room:windowPresence,rainGain:rainGain?.gain.value||0,metrics:{...worldState.metrics},canvas:{width:canvas.width,height:canvas.height},openPhoto:openPhoto?photoIndex:null})};
applyTime();measure();prefetchScene(camera.position);syncSound();syncMotion();renderBook(0,false);
if(worldState.season.name==='winter')prepareWinter();
$$('#world img[src]').forEach(warmImage);
initializing=false;root.classList.add('world-ready');renderCamera(performance.now(),0,true);beginIntro();startFrames();
