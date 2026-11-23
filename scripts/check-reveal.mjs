import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const source=readFileSync(new URL('../src/reveal.js',import.meta.url),'utf8');
function fixture({reduced=false,canvasAvailable=true}={}){
  const events={},frames=new Map(),timers=new Map(),erased=[];
  let time=0,id=0,removed=false,resolveFonts,seed=12345;
  const ready=new Promise(resolve=>{resolveFonts=resolve;});
  const ctx={setTransform(){},fillRect(){},clearRect:(...rect)=>erased.push(rect)};
  const canvas={getContext:()=>canvasAvailable?ctx:null};
  const message={hidden:false};
  const overlay={style:{},querySelector:selector=>selector==='canvas'?canvas:message,remove:()=>{removed=true;}};
  const document={readyState:'loading',fonts:{ready},querySelector:()=>overlay,
    documentElement:{classList:{remove(){}}},body:{inert:false,setAttribute(){},removeAttribute(){}}};
  const window={addEventListener:(name,fn)=>{events[name]=fn;},removeEventListener:name=>delete events[name]};
  const randomMath=Object.create(Math);randomMath.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  vm.runInNewContext(source,{Math:randomMath,document,window,innerWidth:100,innerHeight:80,devicePixelRatio:2,performance:{now:()=>time},
    matchMedia:()=>({matches:reduced,addEventListener(){},removeEventListener(){}}),
    requestAnimationFrame:fn=>{frames.set(++id,fn);return id;},cancelAnimationFrame:key=>frames.delete(key),
    setTimeout:(fn,delay)=>{timers.set(++id,{fn,delay});return id;},clearTimeout:key=>timers.delete(key)});
  return {document,events,frames,timers,erased,message,get removed(){return removed;},resolveFonts,
    advance(ms){time=ms;for(const [key,timer] of [...timers]){if(timer.delay<=ms){timers.delete(key);timer.fn();}}},
    step(ms){time=ms;const pending=[...frames.values()];frames.clear();pending.forEach(fn=>fn(ms));}};
}
const f=fixture();
assert.equal(f.frames.size,0,'No deterioration before window load');
assert.equal(f.document.body.inert,true);
const loaded=f.events.load();
await Promise.resolve();
assert.equal(f.frames.size,0,'Wait for fonts after window load');
f.resolveFonts();await loaded;
assert.equal(f.frames.size,0,'Hold after load and fonts');
assert.equal([...f.timers.values()][0].delay,1000,'Hold lasts one second');
f.advance(999);assert.equal(f.erased.length,0);assert.equal(f.frames.size,0);
assert.equal(f.message.hidden,false,'Logo and loading text stay visible during hold');
f.advance(1000);
assert.equal(f.message.hidden,true,'Loading message hides as dissolution begins');
f.step(1450);
assert.equal(f.erased.length,40,'Half the grid clears at half duration');
assert.ok(f.erased.every(([x,y,w,h])=>x%10===0&&y%10===0&&w===10&&h===10),'Grid uses solid 10px cells');
assert.equal(new Set(f.erased.map(([x,y])=>`${x},${y}`)).size,40,'Each random cell clears only once');
const holes=new Set(f.erased.map(([x,y])=>`${x},${y}`));
let neighbours=0;for(const [x,y] of f.erased){if(holes.has(`${x+10},${y}`))neighbours++;if(holes.has(`${x},${y+10}`))neighbours++;}
assert.ok(neighbours>=40,'Pixels disappear in connected clumps rather than scattered noise');
f.step(1900);
assert.equal(f.erased.length,80);
assert.equal(f.removed,true,'Reveal finishes before one second');
assert.equal(f.document.body.inert,false,'Page is interactive after reveal');
assert.equal(f.frames.size,0);assert.equal(f.timers.size,0);
const fallback=fixture();fallback.resolveFonts();await fallback.events.load();
fallback.advance(1000);
const deadline=[...fallback.timers.values()][0];assert.equal(deadline.delay,1000);
deadline.fn();assert.equal(fallback.removed,true,'Deadline clears stalled animation');
for(const options of [{reduced:true},{canvasAvailable:false}]){
  const safe=fixture(options);safe.resolveFonts();await safe.events.load();
  assert.equal(safe.removed,true);assert.equal(safe.frames.size,0);
}
console.log('Reveal waits for load/fonts and a one-second hold, clears rough clustered 10px cells within 900ms, and handles reduced motion/fallbacks.');
