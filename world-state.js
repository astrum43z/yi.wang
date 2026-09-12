/* The world is constructed once. Navigation has no access to environment initialization. */
(function(root){
  'use strict';
  const {clamp,ease}=WorldCamera;
  const seasonForMonth=m=>m>=2&&m<=4?'spring':m>=5&&m<=7?'summer':m>=8&&m<=10?'autumn':'winter';
  const climates=Object.freeze(Object.fromEntries(Object.entries({
    clear:{cloud:.08,rain:0,snow:0,wind:.30,desaturate:0,dark:0,fog:0,wet:0,sunVeil:0},
    cloudy:{cloud:.55,rain:0,snow:0,wind:.40,desaturate:.16,dark:.13,fog:.06,wet:0,sunVeil:.45},
    overcast:{cloud:.95,rain:0,snow:0,wind:.44,desaturate:.42,dark:.30,fog:.25,wet:0,sunVeil:.88},
    rain:{cloud:1,rain:1,snow:0,wind:.62,desaturate:.52,dark:.43,fog:.40,wet:1,sunVeil:.96},
    snow:{cloud:.82,rain:0,snow:1,wind:.25,desaturate:.20,dark:.10,fog:.22,wet:0,sunVeil:.78}
  }).map(([name,profile])=>[name,Object.freeze(profile)])));
  const seasons=['spring','summer','autumn','winter'];
  const blend=(a,b,t)=>Object.fromEntries(Object.keys(b).map(k=>[k,a[k]+(b[k]-a[k])*t]));
  const seasonWeights=name=>Object.fromEntries(seasons.map(s=>[s,Number(s===name)]));
  const number=(value,fallback=0)=>Number.isFinite(value)?value:fallback;
  const unit=(value,fallback=0)=>clamp(number(value,fallback));
  const rgb=(value,fallback)=>fallback.map((channel,i)=>clamp(number(value?.[i],channel),0,255));
  const mixRGB=(from,to,amount)=>from.map((value,i)=>value+(to[i]-value)*clamp(amount));
  const qualityConfigs=Object.freeze({
    high:Object.freeze({particleScale:1,canvasFps:24,canvasDpr:1,cameraDuration:(distance,source='navigation')=>source==='home'?clamp(1000+Math.abs(number(distance))*70,1000,1400):clamp(720+Math.abs(number(distance))*185,720,1760)}),
    medium:Object.freeze({particleScale:.4,canvasFps:12,canvasDpr:1,cameraDuration:distance=>clamp(560+Math.abs(number(distance))*90,650,1000)}),
    low:Object.freeze({particleScale:.2,canvasFps:8,canvasDpr:.75,cameraDuration:distance=>clamp(525+Math.abs(number(distance))*75,600,900)})
  });
  function selectQuality({width=1440,dpr=1,cores=8,reduced=false}={}){
    width=number(width,1440);dpr=number(dpr,1);cores=number(cores,8);
    if(reduced||cores>0&&cores<=4||dpr>=3&&width<=430&&cores>0&&cores<=6)return 'low';
    return width<=760?'medium':'high';
  }
  // One inexpensive composition step owns the final climate colors and strengths.
  // It never changes a weather/season selection or the camera's position.
  function deriveAppearance(time={},weather=climates.clear,weights={}){
    const total=seasons.reduce((sum,name)=>sum+unit(weights[name]),0);
    const season=Object.fromEntries(seasons.map(name=>[name,total?unit(weights[name])/total:Number(name==='summer')]));
    const w=Object.fromEntries(Object.keys(climates.clear).map(key=>[key,unit(weather[key],climates.clear[key])]));
    const night=unit(time.nightMix),day=1-night;
    const seasonal=(values)=>values[0].map((_,channel)=>seasons.reduce((sum,name,i)=>sum+values[i][channel]*season[name],0));
    const tint=seasonal([[100,156,173],[43,127,176],[132,143,150],[142,164,184]]);
    const tintAmount=(.05+season.summer*.10+season.autumn*.08+season.winter*.14)*day;
    const clearTop=mixRGB(rgb(time.skyTop,[52,124,164]),tint,tintAmount);
    const clearBottom=mixRGB(rgb(time.skyBottom,[220,235,221]),tint,tintAmount*.4);
    const cloudyTop=mixRGB(mixRGB([79,105,122],[143,166,186],w.snow),[17,28,45],night);
    const cloudyBottom=mixRGB(mixRGB([154,173,179],[211,225,231],w.snow),[35,49,66],night);
    const veil=clamp(w.cloud*.45+w.desaturate*.6+w.dark*.4);
    const snowCover=1-(1-season.winter*.48)*(1-w.snow);
    const grassBase=mixRGB(seasonal([[127,166,104],[59,112,72],[147,139,91],[161,176,167]]),[219,229,222],snowCover);
    const grassGray=grassBase[0]*.2126+grassBase[1]*.7152+grassBase[2]*.0722;
    return {
      skyTop:mixRGB(clearTop,cloudyTop,veil),skyBottom:mixRGB(clearBottom,cloudyBottom,veil),
      cloudColor:mixRGB(mixRGB([251,249,232],[145,163,177],w.cloud*.72),[62,77,98],night),
      lightColor:mixRGB(seasonal([[252,232,190],[255,234,182],[246,205,144],[204,226,242]]),[97,122,162],night),
      fogColor:mixRGB([183,200,200],[39,56,75],night),wetColor:mixRGB([65,87,85],[15,27,35],night),
      grassColor:mixRGB(mixRGB(mixRGB(grassBase,[grassGray,grassGray,grassGray],w.desaturate*.8),[49,73,67],w.wet*.35+w.dark*.3),[22,41,42],night*.78),
      light:clamp(unit(time.ambientLight,1)*(1-w.dark*.74)),
      fog:clamp(unit(time.mistOpacity)+w.fog*(1-unit(time.mistOpacity))),wet:w.wet,
      cloud:w.cloud,dark:w.dark,desaturate:w.desaturate,sunVeil:w.sunVeil,
      rain:w.rain,snow:w.snow,wind:w.wind,snowCover,
      flowerDensity:clamp((season.spring+season.summer*.58+season.autumn*.22+season.winter*.04)*(1-snowCover*.93))
    };
  }
  let seed=197603;
  const seeded=()=>{seed=seed*16807%2147483647;return(seed-1)/2147483646;};
  function create(now,scene){
    const season=seasonForMonth(new Date().getMonth());
    return {
      identity:'yi-world-'+Math.random().toString(36).slice(2),time:WorldTime.sample(new Date()),timeMode:'auto',timeTransition:null,
      season:{mode:'auto',name:season,weights:seasonWeights(season),transition:null,request:0},
      weather:{mode:'auto',name:'clear',values:{...climates.clear},transition:null,request:0,nextAt:now+600000},
      wind:{gustStart:-Infinity,nextGust:now+30000+Math.random()*60000},
      cloudPositions:{far:0,mid:0,near:0},
      stars:Array.from({length:80},()=>({x:seeded(),y:seeded()*.55,r:.4+seeded()*.9,phase:seeded()*7,speed:.00012+seeded()*.00015})),
      precipitation:Array.from({length:80},()=>({x:seeded(),y:seeded(),phase:seeded()*7,speed:.65+seeded()*.8,size:.6+seeded()*1.3})),
      catState:{mode:'removed',location:null},currentScene:scene,targetScene:scene,cameraProgress:0,soundEnabled:false,elapsed:0,book:{value:0,target:0,page:0,transition:null},
      metrics:{frames:0,environmentFrames:0,gusts:0,birds:0,meteors:0,navigation:0,retargets:0,assetLoads:0},
      particles:{petals:[],bird:null,meteor:null,nextBird:now+110000,nextMeteor:now+90000,nextAudioDetail:now+16000}
    };
  }
  function advanceClimate(world,now){
    for(const [part,key] of [[world.weather,'values'],[world.season,'weights']])if(part.transition){const b=part.transition,t=clamp((now-b.start)/b.duration);part[key]=blend(b.from,b.to,ease(t));if(t===1)part.transition=null;}
  }
  function setWeather(world,name,now,{source='manual'}={}){
    if(!Object.hasOwn(climates,name))return false;
    advanceClimate(world,now);
    const weather=world.weather;weather.mode=source==='auto'?'auto':'manual';weather.name=name;weather.request=(weather.request||0)+1;
    weather.transition={from:{...weather.values},to:{...climates[name]},start:now,duration:1200};weather.nextAt=now+600000+Math.random()*300000;
    return true;
  }
  function setSeason(world,name,now){
    const season=name==='auto'?seasonForMonth(new Date().getMonth()):name;if(!seasons.includes(season))return false;
    advanceClimate(world,now);world.season.mode=name;world.season.name=season;
    world.season.transition={from:{...world.season.weights},to:seasonWeights(season),start:now,duration:1200};return true;
  }
  function updateClimate(world,now){
    advanceClimate(world,now);
    if(world.weather.mode!=='manual'&&now>=world.weather.nextAt){const r=Math.random();setWeather(world,r<.44?'clear':r<.69?'cloudy':r<.84?'overcast':world.season.name==='winter'?'snow':'rain',now,{source:'auto'});}
  }
  root.WorldEnvironment={create,setWeather,setSeason,updateClimate,seasonForMonth,climates,selectQuality,qualityConfigs,deriveAppearance};
})(window);
