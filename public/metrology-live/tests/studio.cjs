// DOM/lifecycle integration checks; renderer is stubbed, not browser visual QA.
const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const dir=fs.existsSync(path.join(__dirname,'../dist/index.html'))?path.join(__dirname,'../dist'):path.join(__dirname,'..');
const html=fs.readFileSync(path.join(dir,'index.html'),'utf8');
const els={},g=new Proxy({},{get:(o,k)=>o[k]||(()=>{}),set:(o,k,v)=>(o[k]=v,true)});
class E{
 constructor(tag='div',attrs=''){this.tagName=tag.toUpperCase();this.style={};this.dataset={};this.events={};this.children=[];this.value='';this.clientHeight=570;this.clientWidth=800;this.classes=new Set();this.classList={add:(...v)=>v.forEach(x=>this.classes.add(x)),remove:(...v)=>v.forEach(x=>this.classes.delete(x)),contains:v=>this.classes.has(v),toggle:(v,b)=>{b=b===undefined?!this.classes.has(v):b;b?this.classes.add(v):this.classes.delete(v);return b}};for(const m of attrs.matchAll(/([\w-]+)="([^"]*)"/g)){if(m[1].startsWith('data-'))this.dataset[m[1].slice(5)]=m[2];else this[m[1]]=m[2]}if(this.id)els[this.id]=this}
 set innerHTML(s){this.html=s;this.children=parse(s)}get innerHTML(){return this.html||''}
 insertAdjacentHTML(_,s){this.html=(this.html||'')+s;this.children.push(...parse(s))}
 querySelectorAll(q){const out=[];function go(e){for(const a of e.children){if(q.startsWith('[data-')&&a.dataset[q.slice(6,-1)]!==undefined)out.push(a);else if(q==='input[type="range"],select'&&(a.type==='range'||a.tagName==='SELECT'))out.push(a);go(a)}}go(this);return out}
 setAttribute(k,v){this[k]=v}getBoundingClientRect(){return {width:800,height:570,left:0,top:0}}getContext(){return g}
 addEventListener(k,f){(this.events[k]??=[]).push(f)}fire(k,extra={}){const e={target:this,preventDefault(){},...extra};this['on'+k]?.(e);for(const f of this.events[k]||[])f(e)}click(){this.fire('click')}focus(){}scrollIntoView(){}setPointerCapture(){}
}
function parse(s){const root={children:[]},stack=[root];for(const m of s.matchAll(/<\/?([\w-]+)([^>]*)>/g)){const tag=m[1].toLowerCase();if(m[0].startsWith('</')){if(stack.length>1)stack.pop();continue}const e=new E(tag,m[2]);stack.at(-1).children.push(e);if(!['input','br','hr','meta','link','img','source'].includes(tag)&&!m[0].endsWith('/>'))stack.push(e)}return root.children}
parse(html);let draws=0,disposed=0;
class Renderer{constructor(){}setData(mesh,data){assert(mesh.count>0);assert(Number.isFinite(data.rms))}render(vp,eye,s,sec){assert(vp.every(Number.isFinite));assert(eye.every(Number.isFinite));assert(sec.every(Number.isFinite));draws++}dispose(){disposed++}}
const sandbox={console,SimCore:require(path.join(dir,'sim-core.js')),SimRender:{Renderer},document:{body:new E(),getElementById:id=>els[id]||null,querySelector:()=>null,activeElement:null,addEventListener(){},createElement:tag=>new E(tag)},location:{hash:'#simulator'},window:{addEventListener(){},removeEventListener(){},scrollTo(){}},matchMedia:()=>({matches:true}),requestAnimationFrame:()=>1,cancelAnimationFrame(){},ResizeObserver:class{observe(){}disconnect(){}},devicePixelRatio:1,setTimeout(){},URL,Blob,localStorage:{getItem(){},setItem(){}}};vm.createContext(sandbox);const run=s=>vm.runInContext(s,sandbox);
run(html.match(/<script>([\s\S]*?)<\/script>/)[1]);run(fs.readFileSync(path.join(dir,'simulator.js'),'utf8'));
assert.equal(run('modules.length'),10);assert.equal(run('current'),'simulator');assert(els['sim-models'].querySelectorAll('[data-model]').length===8);
for(let i=0;i<12;i++){els['sim-scene-select'].value=String(i);els['sim-scene-select'].fire('change');assert(els['sim-meta'].textContent.includes('треугольников'));assert(!Number.isNaN(parseFloat(els['sim-rms'].textContent)));for(const b of els['sim-modes'].querySelectorAll('[data-mode]'))b.click();for(const b of els.lab.querySelectorAll('[data-tool]'))b.click();els['sim-fit'].click();els['sim-ortho'].click();els['sim-ortho'].click()}
for(const e of els.lab.querySelectorAll('[data-prop]')){e.value=e.max;e.fire('input');e.value=e.min;e.fire('input')}
els['sim-axis'].value='0';els['sim-axis'].fire('change');els['sim-section'].value='0';els['sim-section'].fire('input');
for(const v of ['raw','datum','centroid']){els['sim-basis'].value=v;els['sim-basis'].fire('change')}
els['sim-complete'].click();assert(run('saved.completed.simulator'));
run("render('precision');render('simulator');render('home');render('simulator')");assert(disposed>=2);assert(draws>100);
console.log('PASS: studio startup, ten-section integration, 12 scene presets, five render modes, instruments, sliders, bases, section, progress and lifecycle cleanup. Renderer stub only.');
