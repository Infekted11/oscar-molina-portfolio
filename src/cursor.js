(() => {
  const pointer = matchMedia('(hover: hover) and (pointer: fine)');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let canvas, gl, programs, velocity, dye, pressure, curl, divergence;
  let frame = 0, clock = 0, activeUntil = 0, last = null, queue = [], color = [0, 0, 0], failed = false;
  const targets = [];
  const enabled = () => pointer.matches && !motion.matches && !document.hidden && !failed;
  const vertex = `#version 300 es
    layout(location=0) in vec2 position;
    out vec2 uv;
    void main(){uv=position*.5+.5;gl_Position=vec4(position,0.,1.);}`;
  const header = `#version 300 es
    precision highp float;
    in vec2 uv;out vec4 result;
    uniform sampler2D source, flow, auxiliary;
    uniform vec2 texel, point, force;
    uniform float dt, decay, aspect, radius, amount;
    uniform vec3 ink;
  `;
  const fragments = {
    splat: `vec2 p=uv-point;p.x*=aspect;float s=exp(-dot(p,p)/radius);
      result=texture(source,uv)+vec4(force,amount,0.)*s;`,
    advect: `vec2 p=uv-dt*texture(flow,uv).xy;
      result=texture(source,p)*exp(-decay*dt);`,
    curl: `float l=texture(source,uv-vec2(texel.x,0)).y;
      float r=texture(source,uv+vec2(texel.x,0)).y;
      float b=texture(source,uv-vec2(0,texel.y)).x;
      float t=texture(source,uv+vec2(0,texel.y)).x;
      result=vec4(.5*(r-l-t+b),0,0,1);`,
    vortex: `float l=abs(texture(auxiliary,uv-vec2(texel.x,0)).x);
      float r=abs(texture(auxiliary,uv+vec2(texel.x,0)).x);
      float b=abs(texture(auxiliary,uv-vec2(0,texel.y)).x);
      float t=abs(texture(auxiliary,uv+vec2(0,texel.y)).x);
      float c=texture(auxiliary,uv).x;
      vec2 f=vec2(t-b,r-l);f/=length(f)+.0001;f*=c*28.;f.y*=-1.;
      result=vec4(clamp(texture(source,uv).xy+f*dt,vec2(-4),vec2(4)),0,1);`,
    divergence: `vec2 l=texture(source,uv-vec2(texel.x,0)).xy;
      vec2 r=texture(source,uv+vec2(texel.x,0)).xy;
      vec2 b=texture(source,uv-vec2(0,texel.y)).xy;
      vec2 t=texture(source,uv+vec2(0,texel.y)).xy;
      result=vec4(.5*(r.x-l.x+t.y-b.y),0,0,1);`,
    pressure: `float l=texture(source,uv-vec2(texel.x,0)).x;
      float r=texture(source,uv+vec2(texel.x,0)).x;
      float b=texture(source,uv-vec2(0,texel.y)).x;
      float t=texture(source,uv+vec2(0,texel.y)).x;
      result=vec4((l+r+b+t-texture(auxiliary,uv).x)*.25,0,0,1);`,
    project: `float l=texture(auxiliary,uv-vec2(texel.x,0)).x;
      float r=texture(auxiliary,uv+vec2(texel.x,0)).x;
      float b=texture(auxiliary,uv-vec2(0,texel.y)).x;
      float t=texture(auxiliary,uv+vec2(0,texel.y)).x;
      result=vec4(texture(source,uv).xy-.5*vec2(r-l,t-b),0,1);`,
    display: `float density=max(texture(source,uv).z,0.);
      float alpha=(1.-exp(-density*1.6))*.88;
      result=vec4(ink,alpha);`
  };
  function compile(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
    return shader;
  }
  function program(body) {
    const p = gl.createProgram();
    const v = compile(gl.VERTEX_SHADER, vertex), f = compile(gl.FRAGMENT_SHADER, header + 'void main(){' + body + '}');
    gl.attachShader(p, v);gl.attachShader(p, f);gl.linkProgram(p);
    gl.deleteShader(v);gl.deleteShader(f);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const uniforms = {};
    for (const name of ['source','flow','auxiliary','texel','point','force','dt','decay','aspect','radius','amount','ink']) uniforms[name] = gl.getUniformLocation(p, name);
    return { p, uniforms };
  }
  function target(width, height) {
    const texture = gl.createTexture();gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, width, height, 0, gl.RGBA, gl.HALF_FLOAT, null);
    const buffer = gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER, buffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('Float render target unavailable');
    const result = { texture, buffer, width, height };targets.push(result);return result;
  }
  const pair = (w,h) => ({ read:target(w,h), write:target(w,h), swap(){[this.read,this.write]=[this.write,this.read];} });
  function clear() {
    cancelAnimationFrame(frame);frame=0;queue=[];last=null;
    if (!gl || gl.isContextLost()) return;
    for (const t of targets) {gl.bindFramebuffer(gl.FRAMEBUFFER,t.buffer);gl.clear(gl.COLOR_BUFFER_BIT);}
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.clear(gl.COLOR_BUFFER_BIT);
  }
  function resize() {
    clear();if (!gl || failed) return;
    const scale=Math.min(devicePixelRatio||1,1.5);
    canvas.width=Math.round(innerWidth*scale);canvas.height=Math.round(innerHeight*scale);
    for(const t of targets){gl.deleteTexture(t.texture);gl.deleteFramebuffer(t.buffer);}targets.length=0;
    const aspect=innerWidth/innerHeight;
    const size=n=>aspect>1?[Math.min(1024,Math.round(n*aspect)),n]:[n,Math.min(1024,Math.round(n/aspect))];
    const [w,h]=size(128),[dw,dh]=size(384);
    velocity=pair(w,h);pressure=pair(w,h);curl=target(w,h);divergence=target(w,h);dye=pair(dw,dh);
  }
  function palette() {
    const hex=getComputedStyle(document.documentElement).getPropertyValue('--ink').trim().replace('#','');
    color=[0,2,4].map(i=>parseInt(hex.slice(i,i+2),16)/255);clear();
  }
  function configure() {
    if(!enabled()){clear();return;}
    if(!canvas){
      canvas=document.createElement('canvas');canvas.className='cursor-flow';canvas.setAttribute('aria-hidden','true');
      gl=canvas.getContext('webgl2',{alpha:true,premultipliedAlpha:false,antialias:false,depth:false,stencil:false,powerPreference:'low-power'});
      try{
        if(!gl || !gl.getExtension('EXT_color_buffer_float')) throw new Error('WebGL fluid unavailable');
        gl.disable(gl.BLEND);gl.disable(gl.DEPTH_TEST);gl.clearColor(0,0,0,0);
        programs=Object.fromEntries(Object.entries(fragments).map(([name,body])=>[name,program(body)]));
        const vao=gl.createVertexArray();gl.bindVertexArray(vao);
        const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
        gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
        gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
        resize();canvas.dataset.renderer='webgl2';document.body.append(canvas);
        canvas.addEventListener('webglcontextlost',()=>{failed=true;clear();canvas.remove();});
      }catch{failed=true;canvas.remove();canvas=null;return;}
    }
    palette();
  }
  function draw(name, output, textures={}, values={}) {
    const {p,uniforms:u}=programs[name];gl.useProgram(p);
    let unit=0;
    for(const [name,t] of Object.entries(textures)){
      gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,t.texture);gl.uniform1i(u[name],unit++);
    }
    gl.uniform2f(u.texel,1/velocity.read.width,1/velocity.read.height);
    gl.uniform1f(u.aspect,innerWidth/innerHeight);
    for(const [name,value] of Object.entries(values)){
      if(Array.isArray(value)) gl[value.length===3?'uniform3f':'uniform2f'](u[name],...value);
      else gl.uniform1f(u[name],value);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER,output?.buffer||null);
    gl.viewport(0,0,output?.width||canvas.width,output?.height||canvas.height);
    gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
  }
  function tick(now) {
    frame=0;if(!enabled() || now>activeUntil){clear();return;}
    const dt=Math.min((now-clock)/1000,.025);clock=now;
    for(const s of queue){
      draw('splat',velocity.write,{source:velocity.read},{point:s.point,force:s.force,radius:.0012,amount:0});velocity.swap();
      draw('splat',dye.write,{source:dye.read},{point:s.point,force:[0,0],radius:.00085,amount:1.2});dye.swap();
    }queue=[];
    draw('curl',curl,{source:velocity.read});
    draw('vortex',velocity.write,{source:velocity.read,auxiliary:curl},{dt});velocity.swap();
    draw('divergence',divergence,{source:velocity.read});
    for(let i=0;i<14;i++){draw('pressure',pressure.write,{source:pressure.read,auxiliary:divergence});pressure.swap();}
    draw('project',velocity.write,{source:velocity.read,auxiliary:pressure.read});velocity.swap();
    draw('advect',velocity.write,{source:velocity.read,flow:velocity.read},{dt,decay:1.6});velocity.swap();
    draw('advect',dye.write,{source:dye.read,flow:velocity.read},{dt,decay:2.1});dye.swap();
    draw('display',null,{source:dye.read},{ink:color});
    frame=requestAnimationFrame(tick);
  }
  document.addEventListener('pointermove',event=>{
    if(event.pointerType!=='mouse'||!enabled()||!gl)return;
    const now=performance.now(),x=event.clientX/innerWidth,y=1-event.clientY/innerHeight;
    if(!last||now-last.time>180){last={x,y,time:now};return;}
    const dx=x-last.x,dy=y-last.y;
    if(Math.abs(dx)+Math.abs(dy)<.0002)return;
    const elapsed=Math.max((now-last.time)/1000,.008);
    const force=[Math.max(-3,Math.min(3,dx/elapsed*.55)),Math.max(-3,Math.min(3,dy/elapsed*.55))];
    const steps=Math.min(6,Math.ceil(Math.hypot(dx*innerWidth,dy*innerHeight)/12));
    for(let i=1;i<=steps;i++)queue.push({point:[last.x+dx*i/steps,last.y+dy*i/steps],force});
    if(queue.length>6)queue=queue.slice(-6);
    last={x,y,time:now};activeUntil=now+2600;
    if(!frame){clock=now;frame=requestAnimationFrame(tick);}
  },{passive:true});
  document.documentElement.addEventListener('pointerleave',()=>{last=null;});
  document.addEventListener('visibilitychange',configure);
  window.addEventListener('resize',()=>{try{resize();}catch{failed=true;clear();canvas?.remove();}},{passive:true});
  pointer.addEventListener('change',configure);motion.addEventListener('change',configure);
  new MutationObserver(palette).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
  configure();
})();
