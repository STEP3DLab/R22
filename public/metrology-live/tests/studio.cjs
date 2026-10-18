// DOM/lifecycle integration checks; renderer is stubbed, not browser visual QA.
const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const dir=fs.existsSync(path.join(__dirname,'../dist/index.html'))?path.join(__dirname,'../dist'):path.join(__dirname,'..');
const html=fs.readFileSync(path.join(dir,'index.html'),'utf8');
const windowEvents={};const els={},g=new Proxy({createLinearGradient(){return {addColorStop(){}}}},{get:(o,k)=>o[k]||(()=>{}),set:(o,k,v)=>(o[k]=v,true)});
class E{
 constructor(tag='div',attrs=''){this.tagName=tag.toUpperCase();this.style={};this.dataset={};this.events={};this.children=[];this.value='';this.textContent='';this.clientHeight=570;this.clientWidth=800;this.classes=new Set();this.classList={add:(...v)=>v.forEach(x=>this.classes.add(x)),remove:(...v)=>v.forEach(x=>this.classes.delete(x)),contains:v=>this.classes.has(v),toggle:(v,b)=>{b=b===undefined?!this.classes.has(v):b;b?this.classes.add(v):this.classes.delete(v);return b}};for(const m of attrs.matchAll(/([\w-]+)="([^"]*)"/g)){if(m[1].startsWith('data-'))this.dataset[m[1].slice(5)]=m[2];else this[m[1]]=m[2]}if(this.id)els[this.id]=this}
 set innerHTML(s){this.html=s;this.children=parse(s)}get innerHTML(){return this.html||''}
 insertAdjacentHTML(_,s){this.html=(this.html||'')+s;this.children.push(...parse(s))}
 querySelectorAll(q){const out=[];function go(e){for(const a of e.children){if(q.split(',').includes(a.tagName.toLowerCase()))out.push(a);else if(q.startsWith('[data-')&&a.dataset[q.slice(6,-1)]!==undefined)out.push(a);else if(q==='input[type="range"],select'&&(a.type==='range'||a.tagName==='SELECT'))out.push(a);go(a)}}go(this);return out}
 setAttribute(k,v){this[k]=v}getBoundingClientRect(){return {width:800,height:570,left:0,top:0}}getContext(){return g}
 addEventListener(k,f){(this.events[k]??=[]).push(f)}fire(k,extra={}){const e={target:this,preventDefault(){},...extra};this['on'+k]?.(e);for(const f of this.events[k]||[])f(e)}click(){this.fire('click')}focus(){sandbox.document.activeElement=this}scrollIntoView(){}setPointerCapture(){}toBlob(callback){callback(new Blob(['png']))}
}
function parse(s){const root={children:[]},stack=[root];for(const m of s.matchAll(/<\/?([\w-]+)([^>]*)>/g)){const tag=m[1].toLowerCase();if(m[0].startsWith('</')){if(stack.length>1)stack.pop();continue}const e=new E(tag,m[2]);stack.at(-1).children.push(e);if(!['input','br','hr','meta','link','img','source'].includes(tag)&&!m[0].endsWith('/>'))stack.push(e)}return root.children}
parse(html);let draws=0,disposed=0,lastDraw=null,lastData=null,failRenderer=false;const exported=[];
class Renderer{constructor(){if(failRenderer)throw Error('Test WebGL unavailable')}setData(mesh,data){lastData={mesh,data};assert(mesh.count>0);assert(Number.isFinite(data.rms))}render(vp,eye,s,sec){lastDraw={vp,eye,s:{...s},sec};assert(vp.every(Number.isFinite));assert(eye.every(Number.isFinite));assert(sec.every(Number.isFinite));draws++}dispose(){disposed++}}
const sandbox={console,SimCore:require(path.join(dir,'sim-core.js')),SimRender:{...require(path.join(dir,'sim-render.js')),Renderer},document:{body:new E(),getElementById:id=>els[id]||null,querySelector:()=>null,activeElement:null,addEventListener(){},createElement:tag=>new E(tag)},location:{hash:'#simulator'},window:{addEventListener(k,fn){(windowEvents[k]??=[]).push(fn)},removeEventListener(k,fn){windowEvents[k]=(windowEvents[k]||[]).filter(f=>f!==fn)},scrollTo(){}},matchMedia:()=>({matches:true}),requestAnimationFrame:()=>1,cancelAnimationFrame(){},ResizeObserver:class{observe(){}disconnect(){}},devicePixelRatio:1,setTimeout(){},URL:{createObjectURL(blob){exported.push(blob);return 'blob:test'},revokeObjectURL(){}},Blob,localStorage:{getItem(){},setItem(){}}};vm.createContext(sandbox);const run=s=>vm.runInContext(s,sandbox);
run(html.match(/<script>([\s\S]*?)<\/script>/)[1]);run(fs.readFileSync(path.join(dir,'simulator.js'),'utf8'));
assert.equal(run('modules.length'),10);assert.equal(run('current'),'simulator');assert(els['sim-models'].querySelectorAll('[data-model]').length===8);
for(let i=0;i<12;i++){els['sim-scene-select'].value=String(i);els['sim-scene-select'].fire('change');assert(els['sim-meta'].textContent.includes('треугольников'));assert(!Number.isNaN(parseFloat(els['sim-rms'].textContent)));for(const b of els['sim-modes'].querySelectorAll('[data-mode]'))b.click();for(const b of els.lab.querySelectorAll('[data-tool]'))b.click();els['sim-fit'].click();els['sim-ortho'].click();els['sim-ortho'].click()}
for(const e of els.lab.querySelectorAll('[data-prop]')){e.value=e.max;e.fire('input');e.value=e.min;e.fire('input')}
els['sim-axis'].value='0';els['sim-axis'].fire('change');els['sim-section'].value='0';els['sim-section'].fire('input');
for(const v of ['raw','datum','centroid']){els['sim-basis'].value=v;els['sim-basis'].fire('change')}
els['sim-complete'].click();assert(run('saved.completed.simulator'));
run("render('precision');render('simulator');render('home');render('simulator')");assert(disposed>=2);assert(draws>100);
console.log('PASS: studio startup, ten-section integration, 12 scene presets, five render modes, instruments, sliders, bases, section, progress and lifecycle cleanup. Renderer stub only.');
// Regressions raised by the five-role audit.
(async()=>{
 const C=sandbox.SimCore;
 const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve}};
 const bytes=new TextEncoder().encode('solid test\nfacet normal 0 0 1\nouter loop\nvertex 0 0 0\nvertex 10 0 0\nvertex 0 10 0\nendloop\nendfacet\nendsolid').buffer;
 const file=(name,wait)=>({name,size:bytes.byteLength,arrayBuffer:()=>wait.promise});
 const upload=(f)=>{els['sim-file'].files=[f];return els['sim-file'].onchange({target:els['sim-file']})};
 // Navigation restores an edited model, not the first preset.
 els['sim-models'].querySelectorAll('[data-model]').find(e=>e.dataset.model==='gear').click();
 els['sim-bow'].value='.32';els['sim-bow'].fire('input');
 const previousCanvas=els['sim-gl'];run("render('home');render('simulator')");
 assert.equal(lastDraw.s.model,'gear');assert.equal(els['sim-bow'].value,'0.32');
 previousCanvas.fire('webglcontextlost');assert(!els['sim-readout'].textContent.includes('приостановлена'));
 // Latest import wins, including after leaving and re-entering the module.
 const old=deferred(),recent=deferred(),pa=upload(file('old.stl',old)),pb=upload(file('new.stl',recent));recent.resolve(bytes);await pb;old.resolve(bytes);await pa;assert.equal(lastData.mesh.name,'new.stl');
 const stale=deferred(),pc=upload(file('stale.stl',stale));run("render('home');render('simulator')");stale.resolve(bytes);await pc;assert.equal(lastData.mesh.name,'new.stl');
 // Read the current import unit after the asynchronous file read.
 const scaled=deferred(),pd=upload(file('scaled.stl',scaled));els['sim-units'].value='10';els['sim-units'].fire('change');scaled.resolve(bytes);await pd;assert.equal(lastData.mesh.name,'scaled.stl');assert.equal(lastData.mesh.size[0],100);assert.equal(els['sim-units'].value,'10');
 // The formerly empty discretization scene must produce a measurable effect.
 els['sim-scene-select'].value='7';els['sim-scene-select'].fire('change');assert(lastData.data.rms>1e-4);
 // The reset button restores the selected scene, not an empty free experiment.
 els['sim-layer'].value='0';els['sim-layer'].fire('input');els['sim-reset'].click();assert.equal(els['sim-layer'].value,'0.5');assert.equal(els['sim-scene-select'].value,'7');
 // After fit, actual displayed vertices of the exploded model lie in frame.
 els['sim-scene-select'].value='10';els['sim-scene-select'].fire('change');els['sim-fit'].click();
 for(let i=0;i<lastData.mesh.p.length;i+=3){const {mesh,data}=lastData,s=lastDraw.s,p=[0,1,2].map(k=>mesh.p[i+k]+(data.actual[i+k]-mesh.p[i+k])*s.amp+mesh.offsets[i+k]*s.explode),v=C.transform(lastDraw.vp,p);assert(Math.abs(v[0])<.95&&Math.abs(v[1])<.95)}
 // Two selected barycentric surface locations persist when shrink changes.
 els['sim-models'].querySelectorAll('[data-model]').find(e=>e.dataset.model==='bracket').click();
 els.lab.querySelectorAll('[data-tool]').find(e=>e.dataset.tool==='measure').click();
 const clickAt=(x,y,id=1)=>{const c=els['sim-gl'];c.fire('pointerdown',{clientX:x,clientY:y,pointerId:id});c.fire('pointerup',{clientX:x,clientY:y,pointerId:id})};
 const targets=[];for(let y=160;y<420&&targets.length<2;y+=30)for(let x=180;x<620&&targets.length<2;x+=40){const ndc=[x/800*2-1,1-y/570*2],inv=C.invert(lastDraw.vp),a=C.transform(inv,[...ndc,-1]),b=C.transform(inv,[...ndc,1]);if(C.pick(lastData.mesh,lastData.data.actual,a,C.norm(C.sub(b,a))))targets.push([x,y])}
 assert.equal(targets.length,2);targets.forEach(p=>clickAt(...p));assert(els['sim-readout'].innerHTML.includes('Прямое расстояние'));
 els['sim-shrink'].value='1';els['sim-shrink'].fire('input');assert(els['sim-readout'].innerHTML.includes('-1,00%'));
 els['sim-report'].click();const csv=await exported.at(-1).text();assert(csv.includes('Расстояние A–B'));assert(csv.includes('Исходный центр XYZ'));assert(csv.includes('Вычтенный перенос'));
 els['sim-shot'].click();assert(exported.length>=2);
 // A real context loss stops the studio and offers recovery; old events cannot do so.
 els['sim-gl'].fire('webglcontextlost');assert(els['sim-readout'].textContent.includes('приостановлена'));assert(els['sim-retry']);els['sim-retry'].click();assert(els['sim-rms'].textContent);
 run("render('home')");failRenderer=true;run("render('simulator')");assert(els['sim-stage'].innerHTML.includes('Test WebGL unavailable'));assert(els['sim-shot'].disabled);failRenderer=false;els['sim-retry'].click();assert(lastDraw);
 // Audit round 2: model-unit rollback must leave both geometry and report coherent.
 els['sim-units'].value='1';els['sim-units'].fire('change');
 const largeBytes=new TextEncoder().encode('solid large\nfacet normal 0 0 1\nouter loop\nvertex 0 0 0\nvertex 3000 0 0\nvertex 0 10 0\nendloop\nendfacet\nendsolid').buffer;
 await upload({name:'large.stl',size:largeBytes.byteLength,arrayBuffer:async()=>largeBytes});
 els['sim-units'].value='1000';els['sim-units'].fire('change');assert.equal(els['sim-units'].value,1);assert.equal(lastData.mesh.size[0],3000);
 els['sim-report'].click();assert((await exported.at(-1).text()).includes('"Единицы файла STL";"мм"'));
 // Route explicitly sequences three teaching cases, then ends.
 els['sim-guide'].click();assert.equal(els['sim-scene-select'].value,8);els['sim-next'].click();assert.equal(els['sim-scene-select'].value,1);els['sim-next'].click();assert.equal(els['sim-scene-select'].value,4);els['sim-next'].click();assert.equal(els['sim-guide'].textContent,'Показ за 5 минут');
 // Mode/model controls retain keyboard focus after rebuilding their markup.
 let modelButton=els['sim-models'].querySelectorAll('[data-model]').find(e=>e.dataset.model==='shaft');modelButton.focus();modelButton.click();assert.equal(sandbox.document.activeElement.dataset.model,'shaft');
 let modeButton=els['sim-modes'].querySelectorAll('[data-mode]').find(e=>e.dataset.mode==='deviation');modeButton.focus();modeButton.click();assert.equal(sandbox.document.activeElement.dataset.mode,'deviation');
 const keyboard=(key,shiftKey=false)=>{for(const fn of windowEvents.keydown||[])fn({key,shiftKey,preventDefault(){}})};
 els['sim-gl'].focus();keyboard('i');keyboard('Enter');assert(els['sim-readout'].innerHTML.includes('точке P'));
 keyboard('ArrowRight',true);keyboard('Enter');keyboard('Escape');keyboard('+');keyboard('-');keyboard('ArrowUp');
 // Enlarged UI leaves modes outside the viewport, so wrapping never covers the model.
 assert(els.lab.innerHTML.indexOf('sim-toolbar')<els.lab.innerHTML.indexOf('id="sim-stage"'));
 assert(els.lab.innerHTML.indexOf('id="sim-lesson"')<els.lab.innerHTML.indexOf('class="sim-inspector"'));
 els['sim-focus'].click();assert(sandbox.document.body.classList.contains('studio-focus'));els['sim-focus'].click();assert(!sandbox.document.body.classList.contains('studio-focus'));
 els['sim-gl'].fire('wheel',{deltaY:100000});let visible=0;for(let i=0;i<lastData.mesh.p.length;i+=3){const p=[...lastData.data.actual.slice(i,i+3)],v=C.transform(lastDraw.vp,p);if(v[2]>=-1&&v[2]<=1)visible++}assert(visible>0);
 els['sim-fit'].click();els['sim-shot'].click();assert(exported.length>=4);
 console.log('PASS: round 2 unit rollback, latest filename, three-scene guide, focus restore, keyboard probe, focus layout, far-zoom depth and heatmap PNG legend path.');
 console.log('PASS: edited-state restore, stale-context isolation, import ordering/navigation/units, nonzero layer scene, scene reset, fit bounds, persistent A–B shrink, CSV/PNG handlers and renderer recovery.');
})().catch(e=>{console.error(e);process.exitCode=1});
