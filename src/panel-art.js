(() => {
  const canvases = [...document.querySelectorAll('canvas.panel-art')];
  if (!canvases.length) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const grid = 10;
  const items = canvases.map(canvas => ({canvas,ctx:canvas.getContext('2d'),visible:false})).filter(item=>item.ctx);
  let frame = 0, last = -Infinity;
  const capsule = (x,y,ax,ay,bx,by,r) => {
    const dx=bx-ax,dy=by-ay,t=Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy)));
    return Math.hypot(x-ax-t*dx,y-ay-t*dy)-r;
  };
  function paint(item, now) {
    const {canvas,ctx}=item, bounds=canvas.getBoundingClientRect();
    const width=bounds.width,height=bounds.height,dpr=Math.min(devicePixelRatio||1,2);
    const w=Math.round(width*dpr),h=Math.round(height*dpr);
    if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
    // Match the actual backing-store scale even at fractional CSS sizes.
    ctx.setTransform(w/width,0,0,h/height,0,0);ctx.clearRect(0,0,width,height);ctx.fillStyle='#8d2c25';
    const phase=reduced.matches?0:now/1300;
    // Anchor cells to the viewport origin, exactly as cursor.js does.
    const startX=Math.floor(bounds.left/grid)*grid-bounds.left;
    const startY=Math.floor(bounds.top/grid)*grid-bounds.top;
    // Fill the union once. Separate antialiased fillRect calls can leave
    // translucent hairlines where fractional backing-store edges meet.
    ctx.beginPath();
    for(let y=startY;y<height;y+=grid)for(let x=startX;x<width;x+=grid){
      const px=x+grid/2-width/2,py=y+grid/2-height/2;
      let inside;
      if(canvas.dataset.art==='arrow'){
        const size=Math.min(width,height)*.44;
        const dx=px/(1+Math.sin(phase)*.035),dy=py/(1-Math.sin(phase)*.025);
        const stroke=size*.27;
        const shaft=capsule(dx,dy,0,-size*.72,0,size*.72,stroke);
        const left=capsule(dx,dy,-size*.64,size*.08,0,size*.75,stroke);
        const right=capsule(dx,dy,size*.64,size*.08,0,size*.75,stroke);
        const shape=Math.min(shaft,left,right);
        inside=shape+Math.sin(dx*.06+phase)*.8+Math.cos(dy*.05-phase)*.6<0;
      }else{
        const qx=px/(width*.39),qy=py/(height*.39),angle=Math.atan2(qy,qx);
        const radius=.84+.14*Math.cos(3*angle+.45)+.09*Math.sin(2*angle-.7)+.035*Math.sin(angle+1.1)+.035*Math.sin(2*angle+phase*.6);
        inside=Math.hypot(qx,qy)<radius;
      }
      if(inside)ctx.rect(x,y,grid,grid);
    }
    ctx.fill();
  }
  function tick(now){
    frame=0;
    if(document.hidden)return;
    if(now-last>=1000/30||reduced.matches){items.filter(item=>item.visible).forEach(item=>paint(item,now));last=now;}
    if(!reduced.matches&&items.some(item=>item.visible))frame=requestAnimationFrame(tick);
  }
  function wake(){last=-Infinity;if(!frame)frame=requestAnimationFrame(tick);}
  const observer=new IntersectionObserver(entries=>{
    for(const entry of entries){const item=items.find(item=>item.canvas===entry.target);item.visible=entry.isIntersecting;}
    wake();
  },{root:document.querySelector('.reel'),threshold:0});
  items.forEach(item=>observer.observe(item.canvas));
  new ResizeObserver(wake).observe(document.documentElement);
  // Re-anchor immediately as the containing panel scrolls; animation cadence
  // must not leave cells between viewport grid lines during a scroll.
  document.querySelector('.reel')?.addEventListener('scroll',()=>{
    if(!document.hidden)items.filter(item=>item.visible).forEach(item=>paint(item,performance.now()));
  },{passive:true});
  reduced.addEventListener('change',wake);
  document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(frame);frame=0;}else wake();});
})();
