/* A single continuous camera. No DOM, native smooth scrolling or scene-local timelines. */
(function(root){
  'use strict';
  const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
  const ease=t=>t*t*t*(10+t*(-15+6*t));
  // A quintic is inside the interval whenever all six Bézier controls are inside it.
  // This gives a bound for the entire curve, not just for the sampled display frames.
  function segment(from,to,duration,velocity=0,acceleration=0,offset=0){
    const seconds=duration/1000,v=velocity*seconds,a=acceleration*seconds*seconds,d=to-from;
    return {from,to,duration,offset,velocity,acceleration,
      controls:[from,from+v/5,from+2*v/5+a/20,to,to,to],
      coefficients:[v,a/2,10*d-6*v-1.5*a,-15*d+8*v+1.5*a,6*d-3*v-.5*a]};
  }
  const inside=part=>part.controls.every(value=>Number.isFinite(value)&&value>=0&&value<=5);
  function plan(from,to,duration,velocity,acceleration){
    const direct=segment(from,to,duration,velocity,acceleration);
    if(inside(direct))return [direct];
    // Preserve incoming speed and acceleration while braking inside the remaining space.
    // Shorten the brake until its whole convex hull fits, then use the remaining time
    // for a zero-speed/zero-acceleration departure toward the new destination.
    let brakeDuration=Math.min(160,duration*.20),brake;
    for(let attempt=0;attempt<80;attempt++){
      const seconds=brakeDuration/1000;
      const stop=clamp(from+velocity*seconds/2+acceleration*seconds*seconds/12,0,5);
      brake=segment(from,stop,brakeDuration,velocity,acceleration);
      if(inside(brake))break;
      brakeDuration*=.5;
    }
    if(!inside(brake))throw new Error('Camera state cannot be continued inside the world bounds');
    return [brake,segment(brake.to,to,duration-brakeDuration,0,0,brakeDuration)];
  }
  function evaluate(parts,elapsed){
    const part=parts.find(item=>elapsed<item.offset+item.duration)||parts[parts.length-1];
    const t=clamp((elapsed-part.offset)/part.duration),seconds=part.duration/1000;
    if(t===0)return {position:part.from,velocity:part.velocity,acceleration:part.acceleration};
    if(t===1)return {position:part.to,velocity:0,acceleration:0};
    // de Casteljau evaluates the convex combination stably without clamping the result.
    const points=part.controls.slice();
    for(let remaining=5;remaining>0;remaining--)for(let i=0;i<remaining;i++)points[i]+=(points[i+1]-points[i])*t;
    const [v,a,b,c,d]=part.coefficients;
    return {position:points[0],velocity:(v+t*(2*a+t*(3*b+t*(4*c+t*5*d))))/seconds,
      acceleration:(2*a+t*(6*b+t*(12*c+t*20*d)))/(seconds*seconds)};
  }
  class CameraController{
    constructor(position=0){this.position=clamp(position,0,5);this.velocity=0;this.acceleration=0;this.target=this.position;this.travel=null;this.follow=null;this.serial=0;this.lastRequest=null;}
    duration(distance,source){return source==='home'?clamp(1000+distance*70,1000,1400):clamp(720+distance*185,720,1760);}
    go(target,now,{source='navigation',reduced=false}={}){
      target=clamp(target,0,5);
      const distance=Math.abs(target-this.position),duration=reduced?260:this.duration(distance,source);
      const id=++this.serial;
      this.target=target;this.follow=null;
      this.travel={id,from:this.position,to:target,start:now,duration,initialVelocity:this.velocity,initialAcceleration:this.acceleration,source,reduced,progress:0,
        segments:plan(this.position,target,duration,this.velocity,this.acceleration)};
      this.lastRequest={id,from:this.position,to:target,duration,source};
      return this.travel;
    }
    input(target){
      this.travel=null;this.target=clamp(target,0,5);
      const duration=clamp(180+Math.abs(this.target-this.position)*55,180,360);
      this.follow={elapsed:0,duration,segments:plan(this.position,this.target,duration,this.velocity,this.acceleration)};
    }
    sample(now,dt){
      const travel=this.travel;
      if(travel){
        const elapsed=clamp(now-travel.start,0,travel.duration),t=elapsed/travel.duration;
        Object.assign(this,evaluate(travel.segments,elapsed));
        travel.progress=t;
        if(t===1){this.travel=null;return {completed:travel};}
      }else if(this.follow){
        const follow=this.follow;follow.elapsed=Math.min(follow.duration,follow.elapsed+Math.max(0,dt)*1000);
        Object.assign(this,evaluate(follow.segments,follow.elapsed));
        if(follow.elapsed===follow.duration)this.follow=null;
      }
      return {};
    }
    get moving(){return !!this.travel||!!this.follow||Math.abs(this.position-this.target)>.0001||Math.abs(this.velocity)>.002;}
  }
  root.WorldCamera={CameraController,ease,clamp};
  if(typeof module!=='undefined')module.exports=root.WorldCamera;
})(typeof window==='undefined'?globalThis:window);
