const PHOTOS = [
  { src: "", full: "", caption: "[照片说明]", date: "[日期]", place: "[地点]" },
  { src: "", full: "", caption: "[照片说明]", date: "[日期]", place: "[地点]" },
  { src: "", full: "", caption: "[照片说明]", date: "[日期]", place: "[地点]" },
  { src: "", full: "", caption: "[照片说明]", date: "[日期]", place: "[地点]" },
  { src: "", full: "", caption: "[照片说明]", date: "[日期]", place: "[地点]" },
  { src: "", full: "", caption: "[照片说明]", date: "[日期]", place: "[地点]" }
];
'use strict';
// Existing PHOTOS data is prepended unchanged. Fill real content there only.
const WRITING = [{title:'',text:''},{title:'',text:''},{title:'',text:''}];
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const root = document.documentElement;
const reduceQuery = matchMedia('(prefers-reduced-motion: reduce)');
const mobileQuery = matchMedia('(max-width: 760px)');
const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
const clamp = WorldTime.clamp, smooth = WorldTime.smooth;
const random = (a,b) => a+Math.random()*(b-a);
const isReal = text => typeof text==='string' && text.trim() && !/^\[.*\]$/.test(text.trim());
const metrics = {frames:0,gusts:0,birds:0,meteors:0};
const trackedChapters = new Set(), eventQueue = [];
let metricsRetries = 0;
function track(name,data={}) {
  // Only fixed action names, enum choices and numeric photo positions. No identity, text or paths.
  if (typeof window.umami?.track === 'function') {
    try { Promise.resolve(window.umami.track(name,data)).catch(()=>{}); } catch {}
  } else if (eventQueue.length<16) eventQueue.push([name,data]);
}
const metricsTimer = setInterval(()=>{
  if (typeof window.umami?.track === 'function') {
    for(const [name,data] of eventQueue.splice(0)) track(name,data);
    clearInterval(metricsTimer);
  } else if(++metricsRetries>=25) { eventQueue.length=0; clearInterval(metricsTimer); }
},1000);

let toastTimer;
function notify(text) { clearTimeout(toastTimer); const el=$('#status-message');el.textContent=text;el.classList.add('visible');toastTimer=setTimeout(()=>el.classList.remove('visible'),3200); }
let mode='auto', state=WorldTime.sample(new Date()), transition=null;
let manualPaused=false, frame=0, lastFrame=0, lastTimeUpdate=0, lastWindUpdate=0;
let scrollY=window.scrollY, lastScrollAt=-1000, pointerX=0,pointerY=0;
let viewport={width:innerWidth,height:innerHeight}, chapterBounds=[], activeChapter='';
const chapters=$$('main>.chapter');
const activeLinks=$$('.desktop-nav a,.scene-rail a');
const cameraKeys=[{x:0,y:0,s:1},{x:-1.5,y:-2.5,s:1.08},{x:2,y:-4,s:1.14},{x:-4,y:-5.5,s:1.20},{x:-7,y:-7,s:1.22},{x:3,y:-3,s:1.10},{x:5,y:-2,s:1.07}];
let targetProgress=0,cameraProgress=0;
const paused=()=>manualPaused||reduceQuery.matches;
const styleCache=new Map();
const css = (name,value) => {if(styleCache.get(name)!==value){styleCache.set(name,value);root.style.setProperty(name,value);}};
const color = value => `rgb(${value.map(v=>Math.round(v)).join(' ')})`;
function applyTime() {
  css('--sky-top',color(state.skyTop));css('--sky-bottom',color(state.skyBottom));css('--sun-color',color(state.sunColor));
  css('--sun-x',state.sunPosition[0]+'%');css('--sun-y',state.sunPosition[1]+'%');css('--sun-opacity',state.sunOpacity.toFixed(4));
  css('--moon-x',state.moonPosition[0]+'%');css('--moon-y',state.moonPosition[1]+'%');css('--moon-opacity',state.moonOpacity.toFixed(4));
  for(const [name,key] of Object.entries({'--ambient':'ambientLight','--grass':'grassBrightness','--cloud-brightness':'cloudBrightness','--star-opacity':'starOpacity','--window-light':'windowLight','--night':'nightMix','--mist':'mistOpacity','--nebula':'nebulaOpacity','--dew':'dewOpacity','--wind-length':'shadowLength'})) css(name,state[key].toFixed(4));
  css('--warmth',Math.max(0,state.sceneTemperature).toFixed(4));
  const dayInk=[30,57,66], nightInk=[242,239,220], light=clamp((state.nightMix-.2)/.6);
  css('--world-ink',color(dayInk.map((n,i)=>n+(nightInk[i]-n)*light)));
  $('#time-label').textContent=state.label;
  $('#time-mode-label').textContent=mode==='auto'?'AUTO':'预览';
  $('.time-symbol').textContent=state.moonOpacity>.45?'☾':'☀';
  document.querySelector('meta[name="theme-color"]').content=color(state.skyTop);
  if(audioContext) updateAudioEnvironment();
}
function setTimeMode(next,emit=true) {
  if(next!=='auto' && !(next in WorldTime.previewTimes)) return;
  mode=next;
  const to=next==='auto'?WorldTime.sample(new Date()):WorldTime.sample(WorldTime.previewTimes[next]);
  transition={from:structuredClone(state),to,start:performance.now(),duration:paused()?0:2400};
  $$('.time-options button').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.time===mode)));
  if(emit)track('切换昼夜预览',{mode:next});
  if(paused()){state=to;transition=null;applyTime();drawEnvironment(performance.now());}else startFrames();
}
function updateClock(now) {
  if(transition){
    const t=transition.duration?clamp((now-transition.start)/transition.duration):1;
    state=WorldTime.mix(transition.from,transition.to,smooth(t));
    if(t===1)transition=null;
    applyTime();
  }else if(now-lastTimeUpdate>=1000){
    state=WorldTime.sample(mode==='auto'?new Date():WorldTime.previewTimes[mode]);
    lastTimeUpdate=now;applyTime();
  }
}
function measure(){
  viewport={width:innerWidth,height:innerHeight};
  chapterBounds=chapters.map(el=>({id:el.id,top:el.offsetTop,height:el.offsetHeight}));
  resizeCanvas(); readScroll(); renderCamera(true);
}
function readScroll(){
  scrollY=window.scrollY;
  let idx=0;chapterBounds.forEach((entry,i)=>{if(entry.top<=scrollY)idx=i;});
  const entry=chapterBounds[idx];
  targetProgress=idx+clamp((scrollY-entry.top)/entry.height);
  const marker=scrollY+viewport.height*.43;
  let current=chapterBounds[0];chapterBounds.forEach(entry=>{if(entry.top<=marker)current=entry;});
  if(scrollY+viewport.height>=document.documentElement.scrollHeight-3)current=chapterBounds.at(-1);
  if(current.id!==activeChapter){
    activeChapter=current.id;
    activeLinks.forEach(a=>{if(a.hash==='#'+activeChapter)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current');});
    const label=chapters.find(el=>el.id===current.id).dataset.chapter;
    if(current.id!=='home'&&!trackedChapters.has(current.id)){trackedChapters.add(current.id);track('进入'+label);}
  }
}
function renderCamera(immediate=false){
  cameraProgress=paused()||immediate?targetProgress:cameraProgress+(targetProgress-cameraProgress)*.105;
  const i=Math.min(5,Math.floor(cameraProgress)), t=smooth(cameraProgress-i);
  const a=cameraKeys[i],b=cameraKeys[i+1];
  css('--camera-x',(paused()?0:a.x+(b.x-a.x)*t).toFixed(3)+'%');
  css('--camera-y',(paused()?0:a.y+(b.y-a.y)*t).toFixed(3)+'%');
  css('--camera-scale',(paused()?1:a.s+(b.s-a.s)*t).toFixed(4));
  const windowPresence=smooth(clamp((cameraProgress-3.5)/.30))*(1-smooth(clamp((cameraProgress-4.62)/.28)));
  css('--window-presence',windowPresence.toFixed(4));css('--near-presence',(1-windowPresence).toFixed(4));
  css('--pointer-x',(paused()||mobileQuery.matches?0:pointerX).toFixed(2)+'px');css('--pointer-y',(paused()||mobileQuery.matches?0:pointerY).toFixed(2)+'px');
  css('--mobile-pan',mobileQuery.matches&&!paused()?(-Math.max(0,cameraProgress-2)*viewport.width*.09).toFixed(1)+'px':'0px');
  const boundary=Math.round(cameraProgress), wipe=(cameraProgress-boundary+.12)/.24;
  const active=boundary>0&&boundary<6&&wipe>0&&wipe<1&&performance.now()-lastScrollAt<280&&!paused();
  $('.camera-wipe').style.opacity=active?(Math.sin(wipe*Math.PI)*.9).toFixed(3):'0';
  if(active)$('.camera-wipe').style.transform=`translate3d(${(1-2*wipe)*130}%,${Math.sin(wipe*Math.PI)*6}%,0)`;
}

// One sparse environmental canvas, independent of layout and real content.
const canvas=$('#environment-canvas'), ctx=canvas.getContext('2d');
let stars=[],petals=[],bird=null,meteor=null,gustStart=-Infinity;
let nextGust=0,nextBird=0,nextMeteor=0,nextAudioDetail=0;
const fireflies=Array.from({length:6},(_,i)=>({x:.08+i*.157,y:.66+(i%3)*.065,phase:i*2.41,speed:.11+i*.015}));
function reseedEvents(now){nextGust=now+random(30000,90000);nextBird=now+random(90000,170000);nextMeteor=now+random(60000,180000);nextAudioDetail=now+random(10000,26000);petals=[];bird=null;meteor=null;gustStart=-Infinity;}
function resizeCanvas(){
  const dpr=Math.min(devicePixelRatio||1,mobileQuery.matches?1:1.5);
  canvas.width=Math.round(viewport.width*dpr);canvas.height=Math.round(viewport.height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);
  let seed=197603;const rng=()=>{seed=(seed*16807)%2147483647;return(seed-1)/2147483646;};
  stars=Array.from({length:mobileQuery.matches?55:130},()=>({x:rng(),y:rng()*.55,r:.4+rng()*.9,phase:rng()*7,speed:.00012+rng()*.00015}));
}
function scheduleEnvironment(now){
  if(now>=nextGust){
    nextGust=now+random(30000,90000);gustStart=now;metrics.gusts++;
    const count=mobileQuery.matches?Math.floor(random(1,3)):Math.floor(random(1,5));
    petals=Array.from({length:count},()=>({start:now+random(0,1900),duration:random(13000,21000),y:random(.2,.72),bend:random(-.13,.2),size:random(2,5.5),phase:random(0,7)}));
  }
  if(now>=nextBird){nextBird=now+random(90000,170000);if(state.starOpacity<.12&&state.minute>=315&&state.minute<1110){bird={start:now,y:random(.18,.35),count:Math.random()>.55?2:1};metrics.birds++;}}
  if(now>=nextMeteor){nextMeteor=now+random(60000,180000);if(state.id==='night'){meteor={start:now,x:random(.18,.72),y:random(.07,.21)};metrics.meteors++;}}
  if(now-lastWindUpdate>45){
    const pulse=delay=>{const t=(now-gustStart-delay)/1000;return t>0&&t<7?Math.sin(t*1.5)*Math.exp(-t*.4)*1.6:0;};
    css('--gust-near',pulse(0).toFixed(3)+'deg');css('--gust-mid',pulse(600).toFixed(3)+'deg');css('--gust-tree',pulse(1350).toFixed(3)+'deg');lastWindUpdate=now;
  }
}
function drawEnvironment(now){
  const w=viewport.width,h=viewport.height,t=paused()?0:now;
  ctx.clearRect(0,0,w,h);
  if(state.starOpacity>.005){
    for(const s of stars){const alpha=state.starOpacity*(.48+.25*Math.sin(t*s.speed+s.phase));ctx.fillStyle=`rgba(236,239,221,${alpha})`;ctx.beginPath();ctx.arc(s.x*w,s.y*h,s.r,0,Math.PI*2);ctx.fill();}
  }
  if(state.nightMix>.6){
    for(const f of fireflies.slice(0,mobileQuery.matches?3:6)){
      const x=(f.x+Math.sin(t*.00009+f.phase)*.035)*w,y=(f.y+Math.sin(t*.00012+f.phase*2)*.027)*h;
      const alpha=(state.nightMix-.6)*(.45+.55*(Math.sin(t*.0008+f.phase)+1)/2);
      const g=ctx.createRadialGradient(x,y,0,x,y,6);g.addColorStop(0,`rgba(236,232,151,${alpha})`);g.addColorStop(.3,`rgba(224,226,153,${alpha*.35})`);g.addColorStop(1,'rgba(215,235,142,0)');ctx.fillStyle=g;ctx.fillRect(x-6,y-6,12,12);
    }
  }
  if(paused())return;
  for(const p of petals){
    const q=(now-p.start)/p.duration;if(q<0||q>1)continue;
    const x=(-.08+q*1.18)*w,y=(p.y+Math.sin(q*Math.PI)*p.bend+q*.12)*h;
    ctx.save();ctx.translate(x,y);ctx.rotate(q*8+p.phase+Math.sin(q*5)*.5);ctx.scale(1,.5+Math.abs(Math.sin(q*9+p.phase))*.5);ctx.fillStyle=`rgba(239,225,190,${Math.sin(Math.PI*q)*.7})`;if(p.size>4&&!mobileQuery.matches){ctx.shadowBlur=2;ctx.shadowColor='#ece4c8';}ctx.beginPath();ctx.ellipse(0,0,p.size,p.size*.4,0,0,Math.PI*2);ctx.fill();ctx.restore();
  }
  petals=petals.filter(p=>now-p.start<p.duration);
  if(bird){
    const q=(now-bird.start)/14000;if(q>1)bird=null;else{for(let i=0;i<bird.count;i++){const x=(-.05+q*1.15)*w-i*22,y=(bird.y+Math.sin(q*3)*.025)*h+i*10,s=mobileQuery.matches?2.2:3.3,flap=Math.sin(now*.004+i)*1.2;ctx.strokeStyle=`rgba(45,65,64,${Math.sin(Math.PI*q)*.48})`;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x-s*2,y+flap);ctx.quadraticCurveTo(x-s,y-2,x,y);ctx.quadraticCurveTo(x+s,y-2,x+s*2,y+flap);ctx.stroke();}}
  }
  if(meteor){const q=(now-meteor.start)/780;if(q>1)meteor=null;else{const x=(meteor.x+q*.17)*w,y=(meteor.y+q*.12)*h;ctx.strokeStyle=`rgba(229,235,224,${Math.sin(Math.PI*q)*.7})`;ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(x-q*65,y-q*35);ctx.lineTo(x,y);ctx.stroke();}}
}
function tick(now){
  frame=0;if(document.hidden||paused())return;
  if(now-lastFrame<(mobileQuery.matches?32:15)){frame=requestAnimationFrame(tick);return;}
  metrics.frames++;updateClock(now);renderCamera();scheduleEnvironment(now);drawEnvironment(now);lastFrame=now;
  frame=requestAnimationFrame(tick);
}
function startFrames(){if(!frame&&!document.hidden&&!paused())frame=requestAnimationFrame(tick);}
function stopFrames(){if(frame)cancelAnimationFrame(frame);frame=0;}
function syncMotion(){
  document.body.classList.toggle('motion-paused',paused());
  $('#motion-toggle').textContent=paused()?'动效关':'动效开';$('#motion-toggle').setAttribute('aria-pressed',String(paused()));
  $('#motion-toggle').setAttribute('aria-label',paused()?'开启动效':'暂停动效');
  if(paused()){stopFrames();finishIntro();$$('.lightbox-sheet,.book-spread,.book-page').forEach(stopAnimations);state=WorldTime.sample(mode==='auto'?new Date():WorldTime.previewTimes[mode]);transition=null;applyTime();renderCamera(true);drawEnvironment(performance.now());}
  else{reseedEvents(performance.now());startFrames();}
}
$('#motion-toggle').addEventListener('click',()=>{if(reduceQuery.matches){notify('已遵循系统的减少动态效果设置');return;}manualPaused=!manualPaused;syncMotion();});
reduceQuery.addEventListener('change',syncMotion);
window.addEventListener('scroll',()=>{lastScrollAt=performance.now();readScroll();if(paused())renderCamera(true);else startFrames();},{passive:true});
let resizePending;
window.addEventListener('resize',()=>{clearTimeout(resizePending);resizePending=setTimeout(()=>{measure();drawEnvironment(performance.now());},120);},{passive:true});
document.addEventListener('pointermove',event=>{if(!finePointer.matches||paused()||document.body.classList.contains('modal-open'))return;pointerX=(event.clientX/innerWidth-.5)*26;pointerY=(event.clientY/innerHeight-.5)*15;},{passive:true});
document.documentElement.addEventListener('pointerleave',()=>{pointerX=pointerY=0;});

// Audio is synthesized locally. No music, microphone access, network or autoplay.
let audioContext=null,windSource=null,windFilter=null,windGain=null,rustleGain=null,soundOn=false,soundBusy=false;
function createAudio(){
  const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)throw Error('Audio unavailable');
  audioContext=new Audio();
  const buffer=audioContext.createBuffer(1,audioContext.sampleRate*3,audioContext.sampleRate), data=buffer.getChannelData(0);
  let brown=0;for(let i=0;i<data.length;i++){brown=(brown+Math.random()*.03-.015)/1.015;data[i]=brown*3;}
  windSource=audioContext.createBufferSource();windSource.buffer=buffer;windSource.loop=true;
  windFilter=audioContext.createBiquadFilter();windFilter.type='lowpass';windFilter.frequency.value=450;
  windGain=audioContext.createGain();windGain.gain.value=.13;
  const rustle=audioContext.createBiquadFilter();rustle.type='bandpass';rustle.frequency.value=1400;rustle.Q.value=.4;
  rustleGain=audioContext.createGain();rustleGain.gain.value=.025;
  windSource.connect(windFilter).connect(windGain).connect(audioContext.destination);windSource.connect(rustle).connect(rustleGain).connect(audioContext.destination);windSource.start();
}
function updateAudioEnvironment(){if(!audioContext)return;const t=audioContext.currentTime;windFilter.frequency.setTargetAtTime(230+state.ambientLight*260,t,3);windGain.gain.setTargetAtTime(.10+state.ambientLight*.035,t,3);rustleGain.gain.setTargetAtTime(.012+state.ambientLight*.013,t,3);}
function playEnvironmentDetail(){
  if(!soundOn||audioContext?.state!=='running')return;
  const night=state.nightMix>.65, count=night?3:2, t=audioContext.currentTime;
  for(let i=0;i<count;i++){
    const oscillator=audioContext.createOscillator(),gain=audioContext.createGain(),start=t+i*(night?.23:.28),duration=night?.08:.18;
    oscillator.type='sine';oscillator.frequency.setValueAtTime(night?2600:1700+i*170,start);oscillator.frequency.exponentialRampToValueAtTime(night?2550:2550+i*240,start+duration*.6);
    gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(night?.004:.006,start+.016);gain.gain.exponentialRampToValueAtTime(.0001,start+duration);oscillator.connect(gain).connect(audioContext.destination);oscillator.start(start);oscillator.stop(start+duration+.03);oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};
  }
}
function syncSoundButton(){ $('#sound-toggle').textContent=soundOn?'声音开':'声音关';$('#sound-toggle').setAttribute('aria-pressed',String(soundOn)); }
async function turnSoundOff(){soundOn=false;syncSoundButton();if(audioContext?.state==='running')await audioContext.suspend().catch(()=>{});}
$('#sound-toggle').addEventListener('click',async()=>{
  if(soundBusy)return;soundBusy=true;
  try{if(soundOn){await turnSoundOff();}else{if(!audioContext)createAudio();await audioContext.resume();if(document.hidden){await turnSoundOff();return;}soundOn=audioContext.state==='running';syncSoundButton();if(soundOn){updateAudioEnvironment();track('开启声音');}}}
  catch{soundOn=false;syncSoundButton();notify('暂时无法开启声音，请再试一次');}
  finally{soundBusy=false;}
});

// Original native-dialog behavior, extended with reversible object motion.
const openers=new WeakMap(), closing=new WeakSet();
const menu=$('#chapter-menu'),lightbox=$('#lightbox'),bookDialog=$('#book-dialog');
let photoIndex=0,bookIndex=0,photoOrigin=null;
function stopAnimations(element){element?.getAnimations().forEach(animation=>animation.cancel());}
function openDialog(dialog,opener=document.activeElement){
  $$('dialog[open]').forEach(other=>other.close());
  openers.set(dialog,opener);dialog.showModal();document.body.classList.add('modal-open');
  if(dialog===menu)$('.menu-toggle').setAttribute('aria-expanded','true');
}
function flightTransform(node,origin){
  const a=origin?.getBoundingClientRect(),b=node.getBoundingClientRect();
  if(!a||!a.width||!b.width)return 'scale(.94)';
  return `translate(${a.left+a.width/2-b.left-b.width/2}px,${a.top+a.height/2-b.top-b.height/2}px) scale(${Math.max(.06,a.width/b.width)},${Math.max(.06,a.height/b.height)}) rotate(-3deg)`;
}
function flyIn(node,origin){if(paused())return;stopAnimations(node);const from=flightTransform(node,origin);node.animate([{transform:from,opacity:.75},{transform:'none',opacity:1}],{duration:580,easing:'cubic-bezier(.2,.75,.2,1)'}).finished.catch(()=>{});}
async function closeDialog(dialog){
  if(!dialog.open||closing.has(dialog))return;closing.add(dialog);
  const node=dialog===lightbox?$('.lightbox-sheet'):dialog===bookDialog?$('.book-spread'):null;
  if(node&&!paused()){
    const current=getComputedStyle(node).transform;stopAnimations(node);
    await node.animate([{transform:current==='none'?'none':current,opacity:1},{transform:flightTransform(node,openers.get(dialog)),opacity:.2}],{duration:380,easing:'cubic-bezier(.5,0,.7,.4)'}).finished.catch(()=>{});
  }
  dialog.close();closing.delete(dialog);
  if(!document.querySelector('dialog[open]'))document.body.classList.remove('modal-open');
}
$$('dialog').forEach(dialog=>{
  dialog.addEventListener('cancel',event=>{event.preventDefault();closeDialog(dialog);});
  dialog.addEventListener('close',()=>{
    if(!document.querySelector('dialog[open]')){document.body.classList.remove('modal-open');const opener=openers.get(dialog);if(opener?.isConnected)opener.focus({preventScroll:true});}
    if(dialog===menu)$('.menu-toggle').setAttribute('aria-expanded','false');
    dialog.querySelectorAll('.lightbox-sheet,.book-spread,.book-page').forEach(stopAnimations);
  });
  dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(dialog.classList.contains('object-dialog')||event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)closeDialog(dialog);});
});
$$('[data-close-dialog]').forEach(button=>button.addEventListener('click',()=>closeDialog(button.closest('dialog'))));
$('.menu-toggle').addEventListener('click',()=>openDialog(menu));
$('#time-toggle').addEventListener('click',()=>openDialog($('#time-dialog')));
$$('[data-time]').forEach(button=>button.addEventListener('click',()=>{setTimeMode(button.dataset.time);closeDialog($('#time-dialog'));}));
menu.querySelectorAll('a').forEach(link=>link.addEventListener('click',async event=>{event.preventDefault();await closeDialog(menu);const target=$(link.hash);target.scrollIntoView({behavior:paused()?'auto':'smooth'});history.replaceState(null,'',link.hash);target.setAttribute('tabindex','-1');target.focus({preventScroll:true});}));
function renderPhoto(index){
  photoIndex=clamp(index,0,PHOTOS.length-1);const photo=PHOTOS[photoIndex];
  const image=$('#lightbox-image'),placeholder=$('#lightbox-placeholder');image.hidden=true;image.removeAttribute('src');placeholder.hidden=false;
  const caption=isReal(photo.caption)?photo.caption:'尚未放入照片';image.alt=caption;
  if(photo.full||photo.src)image.src=photo.full||photo.src;
  $('#lightbox-counter').textContent=`${String(photoIndex+1).padStart(2,'0')} / ${String(PHOTOS.length).padStart(2,'0')}`;
  $('#lightbox-caption').textContent=caption;$('#lightbox-date').textContent=isReal(photo.date)?photo.date:'';$('#lightbox-place').textContent=isReal(photo.place)?photo.place:'';
  $('#lightbox-prev').disabled=photoIndex===0;$('#lightbox-next').disabled=photoIndex===PHOTOS.length-1;
  $('#lightbox-announcement').textContent=`第 ${photoIndex+1} 张，共 ${PHOTOS.length} 张。${caption}`;
}
$('#lightbox-image').addEventListener('load',()=>{$('#lightbox-image').hidden=false;$('#lightbox-placeholder').hidden=true;});
$('#lightbox-image').addEventListener('error',()=>{$('#lightbox-image').hidden=true;$('#lightbox-placeholder').hidden=false;if($('#lightbox-image').getAttribute('src'))notify('这张照片暂时无法加载');});
$$('[data-photo]').forEach(button=>{
  const index=Number(button.dataset.photo),photo=PHOTOS[index];
  if(isReal(photo.caption))button.nextElementSibling.textContent=photo.caption;
  if(photo.src){const image=document.createElement('img');image.alt=isReal(photo.caption)?photo.caption:'相册照片';image.loading='lazy';image.decoding='async';image.onload=()=>button.querySelector('.empty-photo').hidden=true;image.onerror=()=>{image.hidden=true;button.querySelector('.empty-photo').hidden=false;};image.src=photo.src;button.prepend(image);}
  button.addEventListener('click',()=>{photoOrigin=button;renderPhoto(index);openDialog(lightbox,button);flyIn($('.lightbox-sheet'),button);track('打开照片',{index:index+1});});
});
$('#lightbox-close').addEventListener('click',()=>closeDialog(lightbox));
$('#lightbox-prev').addEventListener('click',()=>renderPhoto(photoIndex-1));$('#lightbox-next').addEventListener('click',()=>renderPhoto(photoIndex+1));
lightbox.addEventListener('keydown',event=>{if(event.key==='ArrowRight'||event.key==='ArrowLeft'){event.preventDefault();renderPhoto(photoIndex+(event.key==='ArrowRight'?1:-1));}});
let touchStart=null;
$('#lightbox-stage').addEventListener('touchstart',e=>{touchStart=e.touches.length===1?{x:e.touches[0].clientX,y:e.touches[0].clientY}:null;},{passive:true});
$('#lightbox-stage').addEventListener('touchend',e=>{if(!touchStart||!e.changedTouches.length)return;const dx=e.changedTouches[0].clientX-touchStart.x,dy=e.changedTouches[0].clientY-touchStart.y;if(Math.abs(dx)>50&&Math.abs(dx)>Math.abs(dy)*1.4)renderPhoto(photoIndex+(dx<0?1:-1));touchStart=null;},{passive:true});
$('#lightbox-stage').addEventListener('touchcancel',()=>touchStart=null,{passive:true});
function renderBook(index,animate=true){
  bookIndex=clamp(index,0,WRITING.length-1);const page=WRITING[bookIndex];
  $('#book-page-number').textContent=String(bookIndex+1).padStart(2,'0');$('#book-title').textContent=page.title||'这一页暂时留白';$('#book-text').textContent=page.text||'还没有文字。';
  $('#book-prev').disabled=bookIndex===0;$('#book-next').disabled=bookIndex===WRITING.length-1;
  if(animate&&!paused()){const el=$('.book-page');stopAnimations(el);el.animate([{transform:'rotateY(-72deg)',opacity:.5},{transform:'rotateY(0deg)',opacity:1}],{duration:600,easing:'cubic-bezier(.2,.7,.2,1)'}).finished.catch(()=>{});}
}
$('#open-notebook').addEventListener('click',event=>{renderBook(0,false);openDialog(bookDialog,event.currentTarget);flyIn($('.book-spread'),event.currentTarget);renderBook(0);});
$('#book-prev').addEventListener('click',()=>renderBook(bookIndex-1));$('#book-next').addEventListener('click',()=>renderBook(bookIndex+1));
bookDialog.addEventListener('keydown',event=>{if(event.key==='ArrowRight'||event.key==='ArrowLeft'){event.preventDefault();renderBook(bookIndex+(event.key==='ArrowRight'?1:-1));}});

let introTimer;
function finishIntro(){clearTimeout(introTimer);document.body.classList.remove('intro-running','intro-short');$('.skip-intro').hidden=true;}
function beginIntro(){
  if(paused()||location.hash)return;
  let returning=false;try{returning=localStorage.getItem('yi-world-visited')==='1';localStorage.setItem('yi-world-visited','1');}catch{}
  document.body.classList.add('intro-running');if(returning)document.body.classList.add('intro-short');$('.skip-intro').hidden=false;
  introTimer=setTimeout(finishIntro,returning?700:2100);
}
$('.skip-intro').addEventListener('click',finishIntro);
document.addEventListener('visibilitychange',()=>{
  document.body.classList.toggle('is-hidden',document.hidden);
  if(document.hidden){stopFrames();finishIntro();turnSoundOff();$$('.lightbox-sheet,.book-spread,.book-page').forEach(stopAnimations);}
  else{state=WorldTime.sample(mode==='auto'?new Date():WorldTime.previewTimes[mode]);transition=null;lastTimeUpdate=performance.now();applyTime();reseedEvents(performance.now());readScroll();renderCamera(true);drawEnvironment(performance.now());startFrames();}
});
setInterval(()=>{if(document.hidden)return;const now=performance.now();if(soundOn&&now>=nextAudioDetail){nextAudioDetail=now+random(10000,26000);playEnvironmentDetail();}if(paused()){updateClock(now);drawEnvironment(now);}},1000);
window.addEventListener('pagehide',()=>{stopFrames();turnSoundOff();});
window.addEventListener('pageshow',()=>{if(!document.hidden){readScroll();startFrames();}});

// Read-only diagnostics for local QA; nothing here is sent to analytics.
window.YI_WORLD={getState:()=>({mode,phase:state.id,environment:structuredClone(state),motionPaused:paused(),animationRunning:!!frame,soundOn,audioState:audioContext?.state||'not-created',activeChapter,metrics:{...metrics},canvas:{width:canvas.width,height:canvas.height},scheduled:{gust:nextGust,bird:nextBird,meteor:nextMeteor}})};
applyTime();measure();reseedEvents(performance.now());syncSoundButton();syncMotion();beginIntro();drawEnvironment(performance.now());startFrames();

