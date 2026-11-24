// Generate a local-only browser check from the production shaders.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
const source=readFileSync(new URL('../src/cursor.js',import.meta.url),'utf8');
const vertex=source.match(/const vertex = `([\s\S]*?)`;/)[1];
const header=source.match(/const header = `([\s\S]*?)`;/)[1];
const advect=source.match(/advect: `([\s\S]*?)`,/)[1];
const baseline=advect.replace(/if\(all\(greaterThanEqual[\s\S]*?transported=texture\(source,p\);/,'transported=texture(source,p);');
const html=`<!doctype html><title>Fluid GPU boundary regression</title><canvas width="1" height="1"></canvas><pre id="results">Running</pre><script>
const gl=document.querySelector('canvas').getContext('webgl2');
function compile(type,code){const s=gl.createShader(type);gl.shaderSource(s,code);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
function program(body){const p=gl.createProgram();gl.attachShader(p,compile(gl.VERTEX_SHADER,${JSON.stringify(vertex)}));gl.attachShader(p,compile(gl.FRAGMENT_SHADER,${JSON.stringify(header)}+'void main(){'+body+'}'));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));return p;}
function texture(unit,rgba){gl.activeTexture(gl.TEXTURE0+unit);const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(rgba));}
try{
const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);texture(0,[255,0,0,255]);
const output=[];
for(const [name,body] of [['old boundary',${JSON.stringify(baseline)}],['fixed boundary',${JSON.stringify(advect)}]]){
const p=program(body);gl.useProgram(p);gl.uniform1i(gl.getUniformLocation(p,'source'),0);gl.uniform1i(gl.getUniformLocation(p,'flow'),1);gl.uniform2f(gl.getUniformLocation(p,'viewportSize'),1,1);
for(const [edge,flow,dt] of [['left',[255,0,0,255],1],['right',[255,0,0,255],-1],['bottom',[0,255,0,255],1],['top',[0,255,0,255],-1],['inside',[0,0,0,255],0]]){
texture(1,flow);gl.uniform1f(gl.getUniformLocation(p,'dt'),dt);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);const pixel=new Uint8Array(4);gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);const expected=name==='old boundary'||edge==='inside'?255:0;if(pixel[0]!==expected)throw Error(name+' '+edge+' expected '+expected+' got '+pixel[0]);output.push(name+' '+edge+': '+pixel[0]);}
}
if(gl.getError()!==gl.NO_ERROR)throw Error('WebGL error');document.querySelector('#results').textContent='PASS: GPU verifies all four fixed edges and reproduces the old border extrusion.\\n'+output.join('\\n');
}catch(error){document.querySelector('#results').textContent='FAIL: '+error.stack;}
</script>`;
mkdirSync(new URL('../.preview/',import.meta.url),{recursive:true});
writeFileSync(new URL('../.preview/fluid-gpu-check.html',import.meta.url),html);
console.log('Local GPU check: http://127.0.0.1:4193/fluid-gpu-check.html');
