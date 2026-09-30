const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
(async()=>{
let checks=0;
for(const file of ['index.html','404.html']){
 const html=fs.readFileSync(file,'utf8');
 assert.equal((html.match(/data-copy-wechat aria-label/g)||[]).length,1);checks++;
 assert(html.includes('role="status" aria-live="polite" aria-atomic="true"'));checks++;
 const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
 scripts.forEach(s=>new vm.Script(s));checks++;
 const code=scripts.find(s=>s.includes("querySelectorAll('[data-copy-wechat]')"));
 for(const scenario of ['clipboard','denied-legacy','denied-manual','unsupported-manual']){
  let callback,written,selected=0,focused=0;
  const status={textContent:''},fallback={hidden:true,focus(){focused++},select(){selected++}},button={disabled:false,focus(){},closest:()=>({querySelector:s=>s.includes('status')?status:fallback}),addEventListener:(e,cb)=>callback=cb};
  const document={querySelectorAll:()=>[button],execCommand:()=>scenario==='denied-legacy'};
  const navigator=scenario==='unsupported-manual'?{}:{clipboard:{writeText:async value=>{written=value;if(scenario!=='clipboard')throw Error('denied')}}};
  vm.runInNewContext(code,{document,navigator,window:{isSecureContext:true}});await callback();
  assert.equal(button.disabled,false);checks++;
  const success=['clipboard','denied-legacy'].includes(scenario);
  assert.equal(fallback.hidden,success);checks++;
  assert.equal(status.textContent,success?'微信号已复制':'自动复制未成功，请长按或选中微信号手动复制');checks++;
  if(scenario==='clipboard'){assert.equal(written,'goodmorning2you');checks++;}
  else{assert(selected>0&&focused>0);checks++;}
 }
}
console.log(`${checks} footer markup, syntax, clipboard and fallback assertions passed`);
})().catch(e=>{console.error(e);process.exitCode=1});
