/* The world is constructed once. Navigation has no access to environment initialization. */
(function(root){
  'use strict';
  const {clamp,ease}=WorldCamera;
  const seasonForMonth=m=>m>=2&&m<=4?'spring':m>=5&&m<=7?'summer':m>=8&&m<=10?'autumn':'winter';
  const climates={clear:{cloud:0,rain:0,snow:0,wind:.3},cloudy:{cloud:.8,rain:0,snow:0,wind:.48},rain:{cloud:1,rain:1,snow:0,wind:.62},snow:{cloud:.7,rain:0,snow:1,wind:.25}};
  const blend=(a,b,t)=>Object.fromEntries(Object.keys(b).map(k=>[k,a[k]+(b[k]-a[k])*t]));
  const seasonWeights=name=>Object.fromEntries(['spring','summer','autumn','winter'].map(s=>[s,Number(s===name)]));
  let seed=197603;
  const seeded=()=>{seed=seed*16807%2147483647;return(seed-1)/2147483646;};
  class CatStateMachine{
    constructor(){this.mode='sleeping';this.location='hillside';this.position={x:.68,y:.80};this.age=0;this.next=100;this.transitions=0;}
    update(dt){this.age+=dt;if(this.age>=this.next){this.mode=this.mode==='sleeping'?'stirring':'sleeping';this.next=this.age+(this.mode==='stirring'?3:90+Math.random()*90);this.transitions++;}}
  }
  function create(now,scene){
    const season=seasonForMonth(new Date().getMonth());
    return {
      identity:'yi-world-'+Math.random().toString(36).slice(2),time:WorldTime.sample(new Date()),timeMode:'auto',timeTransition:null,
      season:{mode:'auto',name:season,weights:seasonWeights(season),transition:null,request:0},
      weather:{name:'clear',values:{...climates.clear},transition:null,nextAt:now+600000},
      wind:{gustStart:-Infinity,nextGust:now+30000+Math.random()*60000},
      cloudPositions:{far:0,mid:0,near:0},
      stars:Array.from({length:130},()=>({x:seeded(),y:seeded()*.55,r:.4+seeded()*.9,phase:seeded()*7,speed:.00012+seeded()*.00015})),
      precipitation:Array.from({length:120},()=>({x:seeded(),y:seeded(),phase:seeded()*7,speed:.65+seeded()*.8,size:.6+seeded()*1.3})),
      catState:new CatStateMachine(),currentScene:scene,targetScene:scene,cameraProgress:0,soundEnabled:false,elapsed:0,book:{value:0,target:0,page:0,transition:null},
      metrics:{frames:0,environmentFrames:0,gusts:0,birds:0,meteors:0,navigation:0,retargets:0,assetLoads:0},
      particles:{petals:[],bird:null,meteor:null,nextBird:now+110000,nextMeteor:now+90000,nextAudioDetail:now+16000}
    };
  }
  function setWeather(world,name,now){if(!(name in climates))return;world.weather.name=name;world.weather.transition={from:{...world.weather.values},to:{...climates[name]},start:now,duration:45000};world.weather.nextAt=now+600000+Math.random()*300000;}
  function setSeason(world,name,now){const s=name==='auto'?seasonForMonth(new Date().getMonth()):name;if(!['spring','summer','autumn','winter'].includes(s))return;world.season.mode=name;world.season.name=s;world.season.transition={from:{...world.season.weights},to:seasonWeights(s),start:now,duration:12000};}
  function updateClimate(world,now){
    for(const [part,key] of [[world.weather,'values'],[world.season,'weights']])if(part.transition){const b=part.transition,t=clamp((now-b.start)/b.duration);part[key]=blend(b.from,b.to,ease(t));if(t===1)part.transition=null;}
    if(now>=world.weather.nextAt){const r=Math.random();setWeather(world,r<.55?'clear':r<.82?'cloudy':world.season.name==='winter'?'snow':'rain',now);}
  }
  root.WorldEnvironment={create,setWeather,setSeason,updateClimate,seasonForMonth};
})(window);
