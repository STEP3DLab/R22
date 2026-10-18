const assert=require('assert'),fs=require('fs'),path=require('path');
const prefix=fs.existsSync(path.join(__dirname,'../dist/sim-core.js'))?'../dist/':'../';
const C=require(prefix+'sim-core.js'),R=require(prefix+'sim-render.js');
const close=(a,b,e=1e-5)=>assert(Math.abs(a-b)<=e,`${a} != ${b}`);

// Closed procedural parts must not split along shared triangle vertices after deformation.
for(const def of C.definitions){
  const m=C.makeModel(def.id),d=C.deform(m,{defect:.6,noise:.1,bow:.4,layer:.2});
  const shared=new Map();
  for(let i=0;i<m.count;i++){
    const key=m.groups[i]+':'+Array.from(m.p.subarray(i*3,i*3+3)).map(x=>x.toFixed(5)).join(',');
    if(shared.has(key)){const j=shared.get(key);for(let k=0;k<3;k++)close(d.actual[i*3+k],d.actual[j*3+k]);}
    else shared.set(key,i);
  }
  const raw=C.deform(m,{shift:.5,basis:'raw'}),datum=C.deform(m,{shift:.5,basis:'datum'}),centroid=C.deform(m,{shift:.5,basis:'centroid'});
  assert.deepStrictEqual(datum.alignment,[.5,0,0]);
  for(let i=0;i<m.p.length;i++){close(datum.rawActual[i],raw.actual[i]);close(datum.actual[i],m.p[i]);close(centroid.actual[i],m.p[i]);}
  const bounds=C.displayedBounds(m,d.actual,8,1.4);
  let maxRadius=0;
  for(let i=0;i<m.p.length;i+=3){
    const p=[0,1,2].map(k=>m.p[i+k]+(d.actual[i+k]-m.p[i+k])*8+m.offsets[i+k]*1.4);
    maxRadius=Math.max(maxRadius,C.len(C.sub(p,bounds.center)));
    for(let k=0;k<3;k++)assert(p[k]>=bounds.min[k]-1e-9&&p[k]<=bounds.max[k]+1e-9);
  }
  close(maxRadius,bounds.radius,1e-9);
}
// A raw displacement is removed from the geometry used by inspection and picking.
const builder=new C.Builder();builder.box([0,0,0],[10,10,10]);const cube=builder.finish('cube');
const moved=C.deform(cube,{shift:2,basis:'datum'}),raw=C.deform(cube,{shift:2,basis:'raw'});
close(C.pick(cube,moved.actual,[20,0,0],[-1,0,0]).real[0],5);
close(C.pick(cube,raw.actual,[20,0,0],[-1,0,0]).real[0],7);

// Coverage uses the Z extent even when X is much wider, and clips crossing segments.
const wide=new C.Builder();wide.box([0,0,0],[100,20,10]);const wm=wide.finish('wide'),wd=C.deform(wm,{});
close(C.scanThreshold(wm,.6),1);assert.equal(C.scanThreshold(wm,1),Infinity);
const sec=C.sections(wm,wd.actual,0,0,1,0,.6);
assert(sec.length>0);let touchesBoundary=false;
for(let i=2;i<sec.length;i+=3){assert(sec[i]<=1+1e-6);if(Math.abs(sec[i]-1)<1e-6)touchesBoundary=true;}
assert(touchesBoundary);
assert.equal(C.pick(wm,wd.actual,[100,0,3],[-1,0,0],{scan:.6}),null);
assert(C.pick(wm,wd.actual,[100,0,0],[-1,0,0],{scan:.6}));
const blade=C.makeModel('blade'),bd=C.deform(blade,{}),bs=C.sections(blade,bd.actual,0,0,1,0,.58);
for(let i=2;i<bs.length;i+=3)assert(bs[i]<=C.scanThreshold(blade,.58)+1e-5);

// Display normals follow amplified geometry; the original normals remain unchanged.
const shaft=C.makeModel('shaft'),sd=C.deform(shaft,{bow:.7}),before=new Float32Array(shaft.n),dn=C.displayedNormals(shaft,sd.actual,8,0);
let changed=0;
for(let i=0;i<shaft.p.length;i+=9){
  const vs=[0,1,2].map(j=>[0,1,2].map(k=>shaft.p[i+j*3+k]+(sd.actual[i+j*3+k]-shaft.p[i+j*3+k])*8));
  const edge1=C.sub(vs[1],vs[0]),edge2=C.sub(vs[2],vs[0]),n=Array.from(dn.subarray(i,i+3));
  close(C.len(n),1,1e-6);close(C.dot(n,edge1),0,1e-4);close(C.dot(n,edge2),0,1e-4);
  if(C.len(C.sub(n,Array.from(shaft.n.subarray(i,i+3))))>.05)changed++;
}
assert(changed>0);assert.deepStrictEqual(shaft.n,before);
assert.deepStrictEqual(R.heatColor(0),[.22,.58,.95]);assert.deepStrictEqual(R.heatColor(.5),[.42,.87,.65]);
R.heatColor(.75).forEach((v,i)=>close(v,[.98,.83,.34][i],1e-12));
assert.deepStrictEqual(R.heatColor(2),R.heatColor(1));assert.deepStrictEqual(R.heatColor(-1),R.heatColor(0));

// Exercise GPU buffer ownership without a browser: orbit frames must not reupload static data.
global.devicePixelRatio=1;let id=0,bound=null,uploads=[];const uniforms=new Map();
const noop=()=>{},attrs=new Map(),gl={
  ARRAY_BUFFER:1,DYNAMIC_DRAW:2,STATIC_DRAW:3,VERTEX_SHADER:4,FRAGMENT_SHADER:5,COMPILE_STATUS:6,LINK_STATUS:7,HIGH_FLOAT:8,
  DEPTH_TEST:9,LEQUAL:10,BLEND:11,FLOAT:12,LINES:13,TRIANGLES:14,POINTS:15,COLOR_BUFFER_BIT:16,DEPTH_BUFFER_BIT:32,
  createShader:()=>({id:++id}),shaderSource:noop,compileShader:noop,getShaderParameter:()=>true,deleteShader:noop,
  createProgram:()=>({id:++id}),attachShader:noop,linkProgram:noop,getProgramParameter:()=>true,
  getShaderPrecisionFormat:()=>({precision:23}),createBuffer:()=>({id:++id}),deleteBuffer:noop,deleteProgram:noop,
  getAttribLocation:(p,a)=>{if(!attrs.has(a))attrs.set(a,attrs.size);return attrs.get(a)},getUniformLocation:(p,u)=>u,
  enable:noop,disable:noop,depthFunc:noop,viewport:noop,useProgram:noop,enableVertexAttribArray:noop,disableVertexAttribArray:noop,
  vertexAttribPointer:noop,uniformMatrix4fv:noop,uniform4fv:noop,uniform3fv:(u,v)=>uniforms.set(u,Array.from(v)),uniform1f:(u,v)=>uniforms.set(u,v),uniform1i:noop,
  clearColor:noop,clear:noop,depthMask:noop,blendFunc:noop,drawArrays:noop,getExtension:()=>null,
  bindBuffer:(target,b)=>bound=b,bufferData:(target,data)=>uploads.push({buffer:bound,length:data.length})
};
const renderer=new R.Renderer({getContext:()=>gl,getBoundingClientRect:()=>({width:800,height:600})});renderer.setData(wm,wd);
const state={grid:true,amp:1,explode:0,pointSize:2,mode:'solid',axis:0,cut:0,scale:.25,scan:.6,density:1,nominal:true};
const vp=C.matMul(C.perspective(.8,4/3,.1,1000),C.lookAt([100,100,100],[0,0,0]));
renderer.render(vp,[100,100,100],state,sec);uploads=[];
renderer.render(vp,[105,100,100],state,sec);assert.equal(uploads.length,0,'orbit reuploaded static data');
renderer.render(vp,[105,100,100],{...state,amp:8},sec);assert.equal(uploads.length,1);assert.equal(uploads[0].buffer,renderer.buffers.aDisplayNormal);
// Density uses stable CPU samples, retaining approximately the requested fraction on mediump GPUs.
const lattice=C.makeModel('lattice');renderer.setData(lattice,C.deform(lattice,{}));
assert.equal(Object.keys(renderer.attrs).length,8);
const sampleRef=renderer.samples,unique=new Map();
for(let i=0;i<lattice.count;i++){
  const id=lattice.weldIds[i],sample=sampleRef[i];assert(sample>=0&&sample<=1);
  if(unique.has(id))assert.equal(unique.get(id),sample);else unique.set(id,sample);
}
const fraction=[...unique.values()].filter(v=>v<=.05).length/unique.size;
assert(fraction>.02&&fraction<.08,`5% density selected ${fraction*100}%`);
renderer.setData(lattice,C.deform(lattice,{noise:.1}));assert.strictEqual(renderer.samples,sampleRef);
renderer.render(vp,[100,100,100],state,new Float32Array());uploads=[];
renderer.render(vp,[100,100,100],{...state,density:.05},new Float32Array());assert.equal(uploads.length,0);
// All fragment-space coordinates use the same bounded scale for large permitted STL dimensions.
const largeBuilder=new C.Builder();largeBuilder.box([0,0,0],[2e6,1e6,1e6]);const large=largeBuilder.finish('large');
renderer.setData(large,C.deform(large,{}));renderer.render(vp,[3e6,3e6,3e6],{...state,cut:2e5,scan:.6},new Float32Array());
assert(Number.isFinite(renderer.coordScale));assert(renderer.coordScale>=1e6);
close(uniforms.get('uCoordScale'),renderer.coordScale);
close(uniforms.get('uCut'),2e5/renderer.coordScale);
close(uniforms.get('uScanLimit'),C.scanThreshold(large,.6)/renderer.coordScale);
close(uniforms.get('uRadius'),large.r/renderer.coordScale);
for(const v of uniforms.get('uEye'))assert(Number.isFinite(v)&&Math.abs(v)<4);
for(const p of large.p)assert(Math.abs(p/renderer.coordScale)<=1);
renderer.dispose();
console.log('PASS: continuous deformation, aligned display/picking, scan clipping, bounds/normals, palette, GPU caches, stable point density and normalized fragment coordinates. Numerical/mock-GL tests; no browser visual QA.');
