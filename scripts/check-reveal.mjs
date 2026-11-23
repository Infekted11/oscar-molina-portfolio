import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const source=readFileSync(new URL('../src/reveal.js',import.meta.url),'utf8');
function fixture({reduced=false,canvasAvailable=true}={}){
  const events={},frames=new Map(),timers=new Map(),erased=[];
  let time=0,id=0,removed=false,resolveFonts;
  const ready=new Promise(resolve=>{resolveFonts=resolve;});
  const ctx={setTransform(){},fillRect(){},clearRect:(...rect)=>erased.push(rect)};
  const canvas={getContext:()=>canvasAvailable?ctx:null};
  const overlay={style:{},querySelector:()=>canvas,remove:()=>{removed=true;}};
  const document={readyState:'loading',fonts:{ready},querySelector:()=>overlay,
    documentElement:{classList:{remove(){}}},body:{inert:false,setAttribute(){},removeAttribute(){}}};
  const window={addEventListener:(name,fn)=>{events[name]=fn;},removeEventListener:name=>delete events[name]};
  vm.runInNewContext(source,{document,window,innerWidth:100,innerHeight:80,devicePixelRatio:2,performance:{now:()=>time},
    matchMedia:()=>({matches:reduced,addEventListener(){},removeEventListener(){}}),
    requestAnimationFrame:fn=>{frames.set(++id,fn);return id;},cancelAnimationFrame:key=>frames.delete(key),
    setTimeout:(fn,delay)=>{timers.set(++id,{fn,delay});return id;},clearTimeout:key=>timers.delete(key)});
  return {document,events,frames,timers,erased,get removed(){return removed;},resolveFonts,
    step(ms){time=ms;const pending=[...frames.values()];frames.clear();pending.forEach(fn=>fn(ms));}};
}
const f=fixture();
assert.equal(f.frames.size,0,'No deterioration before window load');
assert.equal(f.document.body.inert,true);
const loaded=f.events.load();
await Promise.resolve();
assert.equal(f.frames.size,0,'Wait for fonts after window load');
f.resolveFonts();await loaded;
f.step(450);
assert.equal(f.erased.length,40,'Half the grid clears at half duration');
assert.ok(f.erased.every(([x,y,w,h])=>x%10===0&&y%10===0&&w===10&&h===10),'Grid uses solid 10px cells');
assert.equal(new Set(f.erased.map(([x,y])=>`${x},${y}`)).size,40,'Each random cell clears only once');
f.step(900);
assert.equal(f.erased.length,80);
assert.equal(f.removed,true,'Reveal finishes before one second');
assert.equal(f.document.body.inert,false,'Page is interactive after reveal');
assert.equal(f.frames.size,0);assert.equal(f.timers.size,0);
const fallback=fixture();fallback.resolveFonts();await fallback.events.load();
const deadline=[...fallback.timers.values()][0];assert.equal(deadline.delay,1000);
deadline.fn();assert.equal(fallback.removed,true,'Deadline clears stalled animation');
for(const options of [{reduced:true},{canvasAvailable:false}]){
  const safe=fixture(options);safe.resolveFonts();await safe.events.load();
  assert.equal(safe.removed,true);assert.equal(safe.frames.size,0);
}
console.log('Reveal waits for load/fonts, clears random 10px cells within 900ms, and handles reduced motion/fallbacks.');
