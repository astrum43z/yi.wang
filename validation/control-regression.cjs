// Focused, dependency-free logic regression. This does not simulate a browser.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '..', 'script.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const line = prefix => source.split(/\r?\n/).find(value => value.startsWith(prefix));
let assertions = 0;
function equal(actual, expected) { assert.deepEqual(actual, expected); assertions++; }
for (const available of [[], [0], [1], [0, 1], [0, 3, 5], [2, 5]]) {
  const context = vm.createContext({ PHOTOS: Array.from({length: 6}, (_, i) => available.includes(i) ? {full: `image-${i}.jpg`,caption: `photo ${i}`} : {src: '', full: ''}), isReal: value => typeof value === 'string' && !!value.trim() && !/^\[.*\]$/.test(value.trim()), opened: [], photoIndex: 0 });
  context.showPhoto = index => context.opened.push(index);
  const nodes = {};
  context.$ = id => nodes[id] ||= {};
  vm.runInContext(line('const availablePhotoIndices=') + '\n' + line('function stepPhoto(') + '\n' + line('function updatePhotoText('), context);
  equal(Array.from(vm.runInContext('availablePhotoIndices', context)), available);
  for (let p = 0; p < available.length; p++) {
    context.photoIndex = available[p]; context.opened = [];
    vm.runInContext('stepPhoto(-1);stepPhoto(1);updatePhotoText();', context);
    equal(context.opened, [available[p-1], available[p+1]].filter(i => i !== undefined));
    equal(nodes['#lightbox-prev'].disabled, p === 0);
    equal(nodes['#lightbox-next'].disabled, p === available.length - 1);
    equal(nodes['#lightbox-counter'].textContent, `${String(p+1).padStart(2, '0')} / ${String(available.length).padStart(2, '0')}`);
  }
}
const attributes = {};
const button = {setAttribute: (name, value) => attributes[name] = value, getAnimations: () => []};
const context = vm.createContext({ paused: () => false, reduceQuery: {matches:false}, $: () => button, document:{body:{classList:{toggle:()=>{}}}}, startFrames:()=>{}, worldState:{soundEnabled:false}, finishIntro:()=>{}, photoAnimation:null, camera:{travel:null}, occlusion:null });
vm.runInContext(line('function syncMotion(') + '\n' + line('function syncSound('), context);
for (const reduced of [false, true]) for (const manual of [false, true]) {
  context.reduceQuery.matches = reduced; context.paused = () => reduced || manual;
  vm.runInContext('syncMotion()', context);
  equal(attributes['aria-pressed'], String(!(reduced || manual)));
  equal(attributes['aria-disabled'], String(reduced));
  equal(button.textContent, reduced || manual ? '动效关' : '动效开');
}
for (const enabled of [false, true]) {
  context.worldState.soundEnabled = enabled; vm.runInContext('syncSound()', context);
  equal(attributes['aria-pressed'], String(enabled)); equal(button.textContent, enabled ? '声音开' : '声音关');
}
equal((html.match(/data-photo="\d"/g) || []).length, 6);
equal((html.match(/data-photo="[2-5]" disabled/g) || []).length, 4);
assert.match(html, /id="motion-toggle"[^>]*aria-label="动效"/); assertions++;
assert.match(html, /id="sound-toggle"[^>]*aria-label="声音"/); assertions++;
assert.match(html, /class="environment-label">光线·季节·天气/); assertions++;
assert.match(source, /if\(photoClosing\|\|!availablePhotoIndices.includes\(index\)\)return/); assertions++;
console.log(`${assertions} focused logic and markup assertions passed. Browser rendering, focus, touch, and physical-device behavior are not covered.`);
