import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const source=readFileSync(new URL('../src/panel-art.js',import.meta.url),'utf8');
for(const dpr of [1,1.25,2])for(const kind of ['arrow','blob']){
  const bounds={left:kind==='arrow'?107.35:24.5,top:246.75,width:kind==='arrow'?260:483.7,height:kind==='arrow'?260:530};
  let cells=[],transform,frame,fills=0;const events={};
  const ctx={setTransform:(...args)=>{transform=args;},clearRect:()=>{cells=[];fills=0;},beginPath(){},rect:(...args)=>cells.push(args),fill:()=>{fills++;}};
  const canvas={dataset:{art:kind},width:300,height:150,getContext:()=>ctx,getBoundingClientRect:()=>bounds};
  vm.runInNewContext(source,{
    document:{hidden:false,documentElement:{},querySelectorAll:()=>[canvas],querySelector:()=>({addEventListener:(name,fn)=>{events[name]=fn;}}),addEventListener(){}},
    devicePixelRatio:dpr,performance:{now:()=>1000},matchMedia:()=>({matches:false,addEventListener(){}}),
    IntersectionObserver:class{constructor(fn){this.fn=fn;}observe(target){this.fn([{target,isIntersecting:true}]);}},
    ResizeObserver:class{observe(){}},requestAnimationFrame:fn=>(frame=fn,1),cancelAnimationFrame(){}
  });
  const verify=()=>{
    assert.ok(cells.length>0,'Artwork draws cells');
    assert.equal(fills,1,'All adjacent cells are rasterized as one solid union, without separately blended seams');
    for(const [x,y,w,h] of cells){
      assert.ok(Math.abs((bounds.left+x)/10-Math.round((bounds.left+x)/10))<1e-8,'Cell X matches viewport grid');
      assert.ok(Math.abs((bounds.top+y)/10-Math.round((bounds.top+y)/10))<1e-8,'Cell Y matches viewport grid');
      assert.equal(w,10);assert.equal(h,10);
    }
    assert.ok(Math.abs(transform[0]*bounds.width-canvas.width)<1e-8,'Backing-store scale matches fractional canvas width');
  };
  frame(1000);verify();
  bounds.top=-83.65;events.scroll();verify();
}
console.log('Arrow and footer cells share the viewport 10px grid at fractional positions, while scrolling, and across pixel ratios.');
