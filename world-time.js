/* Continuous device-local time. No network, geolocation or time-zone assumption. */
(function (root) {
  'use strict';
  const keys = [
    // minute, sky top/bottom, sun, ambient, grass, clouds, stars, moon, windows, warmth, night, mist, nebula
    [0, '#080e28', '#263a57', '#b9cbeb', .39, .79, .33, 1, 1, .9, -.55, 1, .03, .7],
    [270, '#101b35', '#4c6877', '#c9cce2', .43, .81, .40, .82, .85, .62, -.36, .96, .13, .32],
    [300, '#425d7d', '#d3b5a2', '#ffcca0', .60, .91, .76, .22, .28, .22, .15, .55, .30, 0],
    [360, '#779fae', '#eee1bc', '#ffe6b8', .79, 1.04, 1.04, 0, 0, .04, .20, .13, .28, 0],
    [480, '#477fa4', '#d4e6d7', '#fff0c9', .99, 1.04, 1.08, 0, 0, 0, .05, 0, .06, 0],
    [720, '#347ca4', '#dcebdd', '#fff6d7', 1, 1.03, 1.10, 0, 0, 0, 0, 0, 0, 0],
    [990, '#638bac', '#efdcbb', '#ffe6b2', .94, 1.04, 1.06, 0, 0, .02, .30, 0, .01, 0],
    [1040, '#8d8da3', '#f1bc88', '#ffd28a', .82, .99, 1.04, .01, .03, .15, .66, .12, .04, 0],
    [1080, '#716987', '#e49b7d', '#ffb273', .68, .95, .86, .12, .20, .42, .78, .38, .05, 0],
    [1110, '#394865', '#af8287', '#ecad90', .54, .86, .66, .30, .55, .74, .27, .72, .06, .08],
    [1200, '#17263f', '#4d526c', '#a8c3df', .43, .80, .40, .75, .93, .94, -.25, .98, .04, .28],
    [1260, '#101a35', '#34455f', '#b9cbeb', .40, .79, .34, .96, 1, 1, -.50, 1, .03, .60],
    [1440, '#080e28', '#263a57', '#b9cbeb', .39, .79, .33, 1, 1, .9, -.55, 1, .03, .7]
  ];
  const fields = ['minute','skyTop','skyBottom','sunColor','ambientLight','grassBrightness','cloudBrightness','starOpacity','moonOpacity','windowLight','sceneTemperature','nightMix','mistOpacity','nebulaOpacity'];
  const rgb = hex => [1,3,5].map(i => parseInt(hex.slice(i,i+2),16));
  const frames = keys.map(row => Object.fromEntries(fields.map((key,i) => [key,i>0&&i<4?rgb(row[i]):row[i]])));
  const clamp = (n,a=0,b=1) => Math.max(a,Math.min(b,n));
  const smooth = t => t*t*(3-2*t);
  function phase(minute) {
    if (minute >= 300 && minute < 480) return {id:'morning',label:'清晨'};
    if (minute >= 480 && minute < 990) return {id:'day',label:'白昼'};
    if (minute >= 990 && minute < 1110) return {id:'sunset',label:'黄昏'};
    if (minute >= 1110 && minute < 1260) return {id:'dusk',label:'入夜'};
    return {id:'night',label:'深夜'};
  }
  function mix(a,b,t) {
    const result = {};
    for (const key of Object.keys(b)) {
      if (Array.isArray(b[key])) result[key] = b[key].map((v,i) => a[key][i]+(v-a[key][i])*t);
      else if (typeof b[key] === 'number') result[key] = a[key]+(b[key]-a[key])*t;
      else result[key] = b[key];
    }
    return result;
  }
  function sample(value = new Date()) {
    const raw = value instanceof Date ? value.getHours()*60+value.getMinutes()+value.getSeconds()/60+value.getMilliseconds()/60000 : Number(value);
    const minute = ((raw%1440)+1440)%1440;
    const i = frames.findIndex((f,index) => index<frames.length-1 && minute>=f.minute && minute<frames[index+1].minute);
    const from = frames[Math.max(0,i)], to = frames[Math.max(0,i)+1];
    const state = mix(from,to,smooth((minute-from.minute)/(to.minute-from.minute)));
    const sunProgress = clamp((minute-300)/810);
    const nightMinute = minute<300?minute+1440:minute;
    const sunAngle = minute>=300&&minute<=1110 ? (minute-300)/810*Math.PI : Math.PI+(nightMinute-1110)/630*Math.PI;
    const moonAngle = minute>=1110||minute<300 ? (nightMinute-1110)/630*Math.PI : Math.PI+(minute-300)/810*Math.PI;
    return Object.assign(state,phase(minute), {
      minute, timeProgress:minute/1440,
      sunPosition:[50-Math.cos(sunAngle)*34,58-Math.sin(sunAngle)*43],
      sunOpacity:smooth(clamp((minute-285)/55))*smooth(clamp((1130-minute)/45)),
      moonPosition:[50-Math.cos(moonAngle)*29,42-Math.sin(moonAngle)*25],
      dewOpacity:Math.max(0,1-Math.abs(minute-360)/180)*.45,
      shadowLength:.5+Math.abs(sunProgress-.5)*2.2
    });
  }
  const api = {sample,mix,phase,clamp,smooth,previewTimes:{morning:390,day:600,sunset:1040,dusk:1170,night:1380}};
  root.WorldTime = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
