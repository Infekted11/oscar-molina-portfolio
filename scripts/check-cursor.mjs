import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const source=readFileSync(new URL('../src/cursor.js',import.meta.url),'utf8');
export function fixture({fine=true,reduced=false,gpu=true}={}){
  const handlers={},windowHandlers={},pending=new Map(),colors=[],scalars=[],records=[];
  let currentProgram,uniforms={};
  let time=0,id=0,canvases=0,removed=0,draws=0,clears=0,observer;
  const pointer={matches:fine,addEventListener(){}},motion={matches:reduced,addEventListener(){}};
  const noop=()=>{};
  const gl=new Proxy({
    COMPILE_STATUS:1,LINK_STATUS:2,FRAMEBUFFER_COMPLETE:3,
    getExtension:()=>({}),getShaderParameter:()=>true,getProgramParameter:()=>true,
    getUniformLocation:(_,name)=>name,checkFramebufferStatus:()=>3,isContextLost:()=>false,
    shaderSource:(shader,text)=>{shader.source=text;},
    attachShader:(program,shader)=>{(program.shaders??=[]).push(shader);},
    useProgram:program=>{currentProgram=program;uniforms={};},
    uniform2f:(name,...values)=>{uniforms[name]=values;},
    clear:()=>{clears++;},
    uniform1f:(name,value)=>{scalars.push([name,value]);uniforms[name]=value;},
    uniform3f:(name,r,g,b)=>{if(name==='ink')colors.push([r,g,b]);},drawArrays:()=>{draws++;records.push({shader:currentProgram.shaders[1].source,uniforms:{...uniforms}});}
  },{get:(obj,key)=>key in obj?obj[key]:String(key).startsWith('create')?()=>({}):/^[A-Z_0-9]+$/.test(key)?0:noop});
  const root={dataset:{},addEventListener:(name,fn)=>{handlers[name]=fn;}};
  const document={hidden:false,documentElement:root,body:{append(){}},
    addEventListener:(name,fn)=>{handlers[name]=fn;},
    createElement:()=>{canvases++;return {dataset:{},setAttribute(){},getContext:()=>gpu?gl:null,remove(){removed++;},addEventListener(){}};}};
  vm.runInNewContext(source,{document,window:{addEventListener:(name,fn)=>{windowHandlers[name]=fn;}},innerWidth:1280,innerHeight:800,devicePixelRatio:2,
    performance:{now:()=>time},matchMedia:query=>query.includes('reduced')?motion:pointer,
    getComputedStyle:()=>({getPropertyValue:()=>root.dataset.theme==='dark'?'#fa382b':'#20201f'}),
    MutationObserver:class{constructor(fn){observer=fn;}observe(){}},
    requestAnimationFrame:fn=>{pending.set(++id,fn);return id;},cancelAnimationFrame:key=>pending.delete(key)});
  return {document,root,handlers,windowHandlers,pending,colors,scalars,records,get clears(){return clears;},
observer:()=>observer(),get canvases(){return canvases;},get removed(){return removed;},get draws(){return draws;},
    move(ms,x,pointerType='mouse'){time=ms;handlers.pointermove({pointerType,clientX:x,clientY:100});},
    step(ms){time=ms;const callbacks=[...pending.values()];pending.clear();callbacks.forEach(fn=>fn(ms));}};
}
assert.equal(fixture({fine:false}).canvases,0,'Touch devices do not create GPU contexts');
assert.equal(fixture({reduced:true}).canvases,0,'Reduced motion disables the simulation');
assert.equal(fixture({gpu:false}).removed,1,'Unsupported WebGL fails gracefully');
const f=fixture();
f.move(0,10,'touch');f.move(16,20,'touch');assert.equal(f.pending.size,0);
f.move(32,10);f.move(48,60);f.step(64);
assert.ok(f.draws>20,'Pointer movement runs the fluid solver');
assert.ok(f.scalars.some(([name,value])=>name==='pixelSize'&&value===10),'Pixelation uses 10 CSS-pixel cells');
assert.ok(f.scalars.some(([name,value])=>name==='decay'&&value===3),'Lower density diffusion reaches the GPU');
assert.ok(f.scalars.some(([name,value])=>name==='decay'&&value===4),'Velocity diffusion is preserved');
assert.ok(f.scalars.some(([name,value])=>name==='amount'&&value===.13),'Pressure retention reaches the GPU');
assert.ok(f.scalars.filter(([name])=>name==='radius').every(([,value])=>value===.21/100),'Splat radius uses the requested control scale');
assert.ok(!f.scalars.some(([name,value])=>name==='amount'&&value===28),'Previous vorticity force is disabled');
assert.deepEqual(f.colors.at(-1),[141/255,44/255,37/255],'Light mode uses the palette midpoint');
f.root.dataset.theme='dark';f.observer();assert.equal(f.pending.size,0);
f.move(80,60);f.move(96,100);f.step(112);
assert.deepEqual(f.colors.at(-1),[141/255,44/255,37/255],'Dark mode uses the same solid midpoint color');
for(let ms=128;ms<=2200;ms+=16)f.step(ms);
assert.equal(f.pending.size,0,'A short stroke decays and stops rendering');
f.move(3100,10);f.move(3116,60);f.document.hidden=true;f.handlers.visibilitychange();
assert.equal(f.pending.size,0,'Hidden tabs stop rendering');
console.log('WebGL fluid pipeline, theme colors, idle cleanup, motion/touch guards, and GPU fallback checks passed.');
