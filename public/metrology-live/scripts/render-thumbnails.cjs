// Build static previews from the same geometry as the interactive scene.
// No browser, GPU, external assets or dependencies are required.
const fs = require('fs');
const path = require('path');
const source = fs.existsSync(path.join(__dirname, '../dist/sim-core.js'))
  ? path.join(__dirname, '../dist') : path.join(__dirname, '..');
const C = require(path.join(source, 'sim-core.js'));
const target = path.join(source, 'models');
fs.mkdirSync(target, { recursive: true });
for (const { id } of C.definitions) {
  const mesh = C.makeModel(id);
  const c = Math.cos(.65), s = Math.sin(.65), p = Math.sin(.45), q = Math.cos(.45);
  const scale = 44 / mesh.r;
  const project = v => [
    (s*v[0] - c*v[1])*scale + 64,
    (p*(c*v[0] + s*v[1]) - q*v[2])*scale + 48,
    q*(c*v[0] + s*v[1]) + p*v[2]
  ];
  const faces = [];
  for (let i = 0; i < mesh.p.length; i += 9) {
    const normal = mesh.n.slice(i, i + 3);
    const light = normal[0]*c*q + normal[1]*s*q + normal[2]*p;
    if (light < -.05) continue;
    const points = [0, 3, 6].map(j => project(mesh.p.slice(i+j, i+j+3)));
    const tone = Math.round(36 + Math.max(0, light)*44);
    const color = `hsl(174 30% ${tone}%)`;
    faces.push({
      depth: points.reduce((a, b) => a + b[2], 0),
      svg: `<polygon points="${points.map(v => v.slice(0, 2).map(x => x.toFixed(1)).join(',')).join(' ')}" fill="${color}" stroke="${color}" stroke-width=".3"/>`
    });
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 96"><ellipse cx="64" cy="83" rx="35" ry="6" fill="#071219" opacity=".3"/>${faces.sort((a,b) => a.depth - b.depth).map(f => f.svg).join('')}</svg>`;
  fs.writeFileSync(path.join(target, id + '.svg'), svg);
}
console.log('8 model previews generated from SimCore.');
