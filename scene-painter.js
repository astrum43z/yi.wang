/* Paint static artwork only when appearance changes. Travel never repaints these canvases. */
(function (root) {
  'use strict';
  const clamp = WorldCamera.clamp;
  const sources = { summer: 'world', spring: 'spring', autumn: 'autumn', winter: 'winter' };
  const imageCache = new Map();
  const surface = (w, h) => Object.assign(document.createElement('canvas'), { width: Math.round(w), height: Math.round(h) });
  async function load(name, mobile) {
    const url = `assets/${mobile ? 'mobile/' : ''}${name}.webp`;
    if (imageCache.has(url)) return imageCache.get(url);
    const promise = new Promise((resolve, reject) => {
      const img = new Image(); img.decoding = 'async'; img.onload = () => img.decode().then(() => resolve(img), reject);
      img.onerror = () => reject(new Error(`Artwork unavailable: ${name}`)); img.src = url;
    }).catch(error => { imageCache.delete(url); throw error; });
    imageCache.set(url, promise); return promise;
  }
  function cover(ctx, img, w, h, position = .5) {
    const scale = Math.max(w / img.width, h / img.height), iw = img.width * scale, ih = img.height * scale;
    ctx.drawImage(img, -(iw - w) * position, -(ih - h) * .5, iw, ih);
  }
  function grade(ctx, w, h, appearance, time) {
    // One-off bitmap compositing replaces inherited, full-screen CSS filters.
    ctx.save(); ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = `rgba(31,49,69,${appearance.dark * .48})`; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = `rgba(147,158,161,${appearance.desaturate * .28})`; ctx.fillRect(0, 0, w, h);
    if (time.sceneTemperature > 0) { ctx.fillStyle = `rgba(241,173,95,${time.sceneTemperature * .14})`; ctx.fillRect(0, 0, w, h); }
    ctx.restore();
  }
  class ScenePainter {
    constructor({ width, height, quality }) {
      this.width = width; this.height = height; this.quality = quality; this.mobile = width <= 760;
      this.groups = Object.fromEntries(['main', 'far', 'foreground', 'window','cloudfar','cloudmid','cloudnear'].map(name => [name, [...document.querySelectorAll(`[data-paint="${name}"]`)]]));
      this.front = 0; this.value = 1; this.transition = null; this.ready = false; this.paints = 0;
      this.leaf = document.querySelector('.camera-leaf canvas');
      this.prepareCount = 0;
    }
    async prepare({ season, weather, time, needWindow = false }) {
      const appearance = WorldEnvironment.deriveAppearance(time, WorldEnvironment.climates[weather], Object.fromEntries(Object.keys(sources).map(s => [s, Number(s === season)])));
      const effective = weather === 'snow' ? 'winter' : season, prefix = sources[effective];
      const [day, night, plants, windowArt, cloudArt] = await Promise.all([
        time.nightMix<.999?load(prefix + '-day', this.mobile):null, time.nightMix>.001?load(prefix + '-night', this.mobile):null,
        effective === 'winter' ? null : load('foreground', this.mobile), needWindow || this.windowReady ? load('window', this.mobile) : null,load('clouds',this.mobile)
      ]);
      this.prepareCount++;
      const mw = this.mobile ? 1100 : 1672, mh = Math.round(mw * 941 / 1672);
      const main = surface(mw, mh), ctx = main.getContext('2d');
      ctx.filter=`saturate(${1-appearance.desaturate*.95}) brightness(${1-appearance.dark*.6}) contrast(${1-appearance.dark*.22})`;
      if(day)ctx.drawImage(day, 0, 0, mw, mh);if(night){ctx.globalAlpha = day?time.nightMix:1;ctx.drawImage(night, 0, 0, mw, mh);}ctx.globalAlpha = 1;ctx.filter='none';
      if(effective==='summer'){
        const foliage=ctx.createLinearGradient(0,mh*.56,0,mh*.83);foliage.addColorStop(0,'transparent');foliage.addColorStop(1,`rgba(87,147,88,${.23*(1-time.nightMix)})`);
        ctx.globalCompositeOperation='multiply';ctx.fillStyle=foliage;ctx.fillRect(0,mh*.56,mw,mh*.44);ctx.globalCompositeOperation='source-over';
      }
      grade(ctx, mw, mh, appearance, time);
      // Fog and wet reflections are static pixels, not live filter layers.
      if (appearance.fog > 0) {
        const mist = ctx.createLinearGradient(0, mh * .39, 0, mh * .79);
        const rgb = time.nightMix > .5 ? '85,105,123' : '179,191,193';
        mist.addColorStop(0, `rgba(${rgb},0)`); mist.addColorStop(.45, `rgba(${rgb},${appearance.fog * .37})`); mist.addColorStop(1, `rgba(${rgb},0)`);
        ctx.fillStyle = mist; ctx.fillRect(0, 0, mw, mh);
      }
      if (appearance.wet > 0) {
        const wet = ctx.createLinearGradient(0, mh * .65, 0, mh); wet.addColorStop(0, 'transparent'); wet.addColorStop(1, `rgba(104,152,165,${appearance.wet * .14})`);
        ctx.fillStyle = wet; ctx.fillRect(0, mh * .65, mw, mh * .35);
      }
      // Baked alpha horizon: mountains fully cover the celestial layer on approach.
      ctx.globalCompositeOperation = 'destination-in';
      const horizon = ctx.createLinearGradient(0, 0, 0, mh); horizon.addColorStop(0, 'transparent'); horizon.addColorStop(.33, 'transparent'); horizon.addColorStop(.445, '#000'); horizon.addColorStop(1, '#000');
      ctx.fillStyle = horizon; ctx.fillRect(0, 0, mw, mh); ctx.globalCompositeOperation = 'source-over';
      const scale = Math.min(1, 1600 / this.width), vw = Math.round(this.width * scale), vh = Math.round(this.height * scale);
      const foreground = surface(vw, vh), fg = foreground.getContext('2d');
      const leaf = surface(640, 420), lc = leaf.getContext('2d');
      if (plants) {
        // Filtering is baked once into small bitmaps. No CSS filter runs during a journey.
        const weatherFilter=` saturate(${1-appearance.desaturate*.95}) brightness(${1-appearance.dark*.6}) contrast(${1-appearance.dark*.22})`;
        fg.filter = (effective === 'autumn' ? 'sepia(1) saturate(1.7) hue-rotate(-18deg)' : effective === 'spring' ? 'saturate(.85) brightness(1.08)' : 'saturate(1.1)')+weatherFilter;
        if(effective==='autumn'){
          if(this.mobile)fg.drawImage(plants,plants.width*.53,0,plants.width*.47,plants.height*.48,vw*.46,0,vw*.58,vw*.58*.58);
          else fg.drawImage(plants,plants.width*.53,0,plants.width*.47,plants.height*.48,vw*.53,0,vw*.47,vh*.48);
        }else if (this.mobile) {
          fg.save(); fg.beginPath(); fg.rect(0, vh * .64, vw, vh * .36); fg.clip(); cover(fg, plants, vw, vh, .16); fg.restore();
          fg.drawImage(plants, plants.width * .53, 0, plants.width * .47, plants.height * .42, vw * .46, 0, vw * .58, vw * .58 * .5);
        } else fg.drawImage(plants, 0, 0, vw, vh);
        if (effective === 'summer') { fg.globalCompositeOperation = 'destination-in'; const fade = fg.createLinearGradient(0, 0, 0, vh); fade.addColorStop(0, '#000'); fade.addColorStop(.5, '#000'); fade.addColorStop(1, '#0009'); fg.fillStyle = fade; fg.fillRect(0, 0, vw, vh); fg.globalCompositeOperation = 'source-over'; }
        fg.filter = 'none';
        lc.filter = (effective === 'autumn' ? 'sepia(1) saturate(1.7) hue-rotate(-18deg)' : 'saturate(1)')+weatherFilter;
        lc.drawImage(plants, plants.width * .75, 0, plants.width * .25, plants.height * .29, 0, 0, 640, 420); lc.filter = 'none';
        for (const [context, w, h] of [[fg, vw, vh], [lc, 640, 420]]) {
          context.globalCompositeOperation = 'source-atop'; context.fillStyle = `rgba(9,23,44,${time.nightMix * .63})`; context.fillRect(0, 0, w, h); context.globalCompositeOperation = 'source-over'; grade(context, w, h, appearance, time);
        }
        lc.globalCompositeOperation='destination-in';
        const leafEdge=lc.createLinearGradient(0,0,76,0);leafEdge.addColorStop(0,'transparent');leafEdge.addColorStop(1,'#000');lc.fillStyle=leafEdge;lc.fillRect(0,0,640,420);
        const leafBase=lc.createLinearGradient(0,354,0,420);leafBase.addColorStop(0,'#000');leafBase.addColorStop(1,'transparent');lc.fillStyle=leafBase;lc.fillRect(0,0,640,420);lc.globalCompositeOperation='source-over';
      }
      const windowFrame = surface(vw, vh), wc = windowFrame.getContext('2d');
      if (windowArt && this.mobile) {
        const iw = windowArt.width * vh / windowArt.height;
        wc.drawImage(windowArt, 0, 0, iw, vh);
        // Keep the original cup/table once; add only the right fabric silhouette.
        // Its static crop follows the curtain, so there is no second tabletop seam.
        const rw=iw*.6,rx=vw-rw;
        const outline=[[.833,0],[1,0],[1,.863],[.944,.84],[.946,.77],[.945,.70],[.949,.63],[.946,.59],[.918,.51],[.89,.38],[.863,.25],[.843,.11]];
        wc.save();wc.beginPath();outline.forEach(([x,y],i)=>i?wc.lineTo(rx+x*rw,y*vh):wc.moveTo(rx+x*rw,y*vh));wc.closePath();wc.clip();wc.drawImage(windowArt,rx,0,rw,vh);wc.restore();
      } else if (windowArt) wc.drawImage(windowArt, 0, 0, vw, vh);
      wc.globalCompositeOperation = 'source-atop'; wc.fillStyle = `rgba(9,24,42,${time.nightMix * .49 + appearance.dark * .42})`; wc.fillRect(0, 0, vw, vh); wc.globalCompositeOperation = 'source-over';
      const cloud=surface(this.mobile?800:1200,this.mobile?400:600), cc=cloud.getContext('2d');
      cc.drawImage(cloudArt,0,0,cloud.width,cloud.height);cc.globalCompositeOperation='source-atop';cc.fillStyle=`rgba(${appearance.cloudColor.map(Math.round).join(',')},${.22+appearance.cloud*.6+time.nightMix*.16})`;cc.fillRect(0,0,cloud.width,cloud.height);
      return { main, foreground, window: windowFrame, cloud, leaf, appearance, season, effective, weather, windowReady: !!windowArt };
    }
    commit(paint, now, duration = 1200) {
      const previousFront = this.front, incoming = 1 - previousFront;
      for (const [name, nodes] of Object.entries(this.groups)) {
        if (!nodes.length || ['far','cloudmid'].includes(name) && this.quality !== 'high'||name==='cloudnear'&&this.quality==='low') continue;
        const artwork = name === 'far' ? paint.main : name.startsWith('cloud')?paint.cloud:paint[name];
        if (this.ready && this.transition) {
          const snapshot = surface(nodes[0].width, nodes[0].height), sc = snapshot.getContext('2d');
          sc.globalAlpha=name==='foreground'||name.startsWith('cloud')?1-this.value:1;sc.drawImage(nodes[1 - previousFront], 0, 0); sc.globalAlpha = this.value; sc.drawImage(nodes[previousFront], 0, 0); sc.globalAlpha = 1;
          nodes[previousFront].getContext('2d').clearRect(0, 0, snapshot.width, snapshot.height); nodes[previousFront].getContext('2d').drawImage(snapshot, 0, 0);
        }
        const target = nodes[incoming]; target.width = artwork.width; target.height = artwork.height; target.getContext('2d').drawImage(artwork, 0, 0);
        nodes[previousFront].style.opacity = '1'; nodes[previousFront].style.zIndex = '1'; target.style.zIndex = '2'; target.style.opacity = this.ready && duration>0 ? '0' : '1';
      }
      if (this.leaf) { this.leaf.width = 640; this.leaf.height = 420; this.leaf.getContext('2d').drawImage(paint.leaf, 0, 0); }
      this.front = incoming; this.value = this.ready && duration>0 ? 0 : 1; this.transition = this.ready && duration>0 ? { start: now, duration } : null; this.ready = true; this.windowReady = paint.windowReady; this.lastPaint = paint; this.paints++;
      if (!this.transition) this.update(now);
    }
    update(now) {
      if (this.transition) { this.value = WorldCamera.ease(clamp((now - this.transition.start) / this.transition.duration)); if (this.value === 1) this.transition = null; }
      for (const [name, nodes] of Object.entries(this.groups)) {
        if (['far','cloudmid'].includes(name) && this.quality !== 'high'||name==='cloudnear'&&this.quality==='low') continue;
        if (nodes.length) { nodes[this.front].style.opacity = this.value.toFixed(4); nodes[1 - this.front].style.opacity = this.transition ? (name==='foreground'||name.startsWith('cloud')?(1-this.value).toFixed(4):'1') : '0'; }
      }
    }
    resize(width, height, quality) { this.width = width; this.height = height; this.quality = quality; this.mobile = width <= 760; }
  }
  root.ScenePainter = ScenePainter;
})(window);
