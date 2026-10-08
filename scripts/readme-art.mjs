// Draws the animated pixel-art images of the README (docs/*.svg), from the same sprites as the app.
// Run: node --experimental-default-type=module scripts/readme-art.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { petSvg, defaultPet, ANIMALS } from '../public/js/pet.js';
import { scene } from '../public/js/scenery.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'docs');
fs.mkdirSync(path.join(OUT, 'pix'), { recursive: true });

const INK = '#1f6045';
const GOLD = '#ffcd00';
const FONT = "font-family=\"'Segoe UI', 'Helvetica Neue', Arial, sans-serif\"";

// ---- sprites as nested <svg> pieces ----

// { vb, inner } from the markup the app builds.
function parts(markup) {
  const s = String(markup);
  const m = s.match(/<svg[^>]*viewBox="([^"]+)"[^>]*>([\s\S]*)<\/svg>/);
  return { vb: m[1], inner: m[2].replace(/<i class="pet-sh"><\/i>[\s\S]*$/, '') };
}
const dims = (vb) => vb.split(' ').slice(2).map(Number);

function piece(markup, x, y, h, cls = '') {
  const { vb, inner } = parts(markup);
  const [w0, h0] = dims(vb);
  const w = (h * w0) / h0;
  return { w, h, x, y, svg: `<svg x="${x}" y="${y}" width="${w.toFixed(1)}" height="${h}" viewBox="${vb}" shape-rendering="crispEdges" class="${cls}">${inner}</svg>` };
}
const px = (name, x, y, h, cls = '') => piece(scene(name, { size: h }), x, y, h, cls);
const pet = (animal, x, y, h, { mood = 'idle', color, accessory } = {}) => {
  const p = { ...defaultPet(animal), ...(color ? { color } : {}), ...(accessory ? { accessory } : {}) };
  return piece(petSvg(p, { size: h, mood }), x, y, h, 'pet-b');
};

const CSS = `
  .pet-b { overflow: visible; }
  .pet-body { transform-box: view-box; animation: bob 1.3s steps(2, jump-none) infinite; }
  .pet-open { animation: blink 4.6s steps(1) infinite; }
  .pet-closed { opacity: 0; animation: blinkc 4.6s steps(1) infinite; }
  .zz .pet-open { opacity: 0; animation: none; } .zz .pet-closed { opacity: 1; animation: none; }
  .sw { animation: sway 5.5s ease-in-out infinite alternate; }
  .sws { animation: sways 4s ease-in-out infinite alternate; }
  .wing { transform-box: fill-box; animation: flap .42s steps(3) infinite alternate; }
  .wl { transform-origin: 100% 50%; } .wr { transform-origin: 0 50%; }
  .float { animation: float 3.4s ease-in-out infinite alternate; }
  .drift { animation: drift 16s ease-in-out infinite alternate; }
  .twinkle { animation: twinkle 2.6s steps(1) infinite; }
  @keyframes bob { 0% { transform: translateY(0); } 100% { transform: translateY(-0.5px); } }
  @keyframes blink { 0%, 93%, 100% { opacity: 1; } 94%, 98% { opacity: 0; } }
  @keyframes blinkc { 0%, 93%, 100% { opacity: 0; } 94%, 98% { opacity: 1; } }
  @keyframes sway { from { transform: rotate(-1.8deg); } to { transform: rotate(1.8deg); } }
  @keyframes sways { from { transform: rotate(-1deg); } to { transform: rotate(1deg); } }
  @keyframes flap { from { transform: scaleX(1); } to { transform: scaleX(0.22); } }
  @keyframes float { from { transform: translateY(0); } to { transform: translateY(-7px); } }
  @keyframes drift { from { transform: translateX(-24px); } to { transform: translateX(24px); } }
  @keyframes twinkle { 0%, 60% { opacity: 1; } 61%, 100% { opacity: 0.25; } }
  @keyframes hop { 0%, 14%, 100% { transform: translateY(0); } 7% { transform: translateY(-16px); } }
  @keyframes pop { 0%, 6% { opacity: 0; transform: translateY(0); } 9% { opacity: 1; } 22% { opacity: 0; transform: translateY(-14px); } 100% { opacity: 0; } }
  @keyframes zed { 0% { opacity: 0; transform: translate(0, 4px); } 40% { opacity: 1; } 100% { opacity: 0; transform: translate(8px, -12px); } }
  @media (prefers-reduced-motion: reduce) { * { animation: none !important; } }
`;

const svgDoc = (w, h, body, extra = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img">${extra}<style>${CSS}</style>${body}</svg>`;

// a sprite that sways around its base
const swayed = (p, cls = 'sw', delay = 0, dur = 0) =>
  `<g class="${cls}" style="transform-origin:${(p.x + p.w / 2).toFixed(1)}px ${(p.y + p.h).toFixed(1)}px;animation-delay:${delay}s${dur ? `;animation-duration:${dur}s` : ''}">${p.svg}</g>`;

// ---- pixel title ----

const GLYPH = {
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
};
function pixelText(text, x, y, s, fill, shadow) {
  let out = '';
  let cx = x;
  for (const ch of text) {
    const g = GLYPH[ch];
    g.forEach((row, ry) => [...row].forEach((v, rx) => {
      if (v !== '1') return;
      if (shadow) out += `<rect x="${cx + rx * s + s * 0.35}" y="${y + ry * s + s * 0.35}" width="${s}" height="${s}" fill="${shadow}"/>`;
    }));
    cx += 6 * s;
  }
  cx = x;
  for (const ch of text) {
    GLYPH[ch].forEach((row, ry) => [...row].forEach((v, rx) => {
      if (v === '1') out += `<rect x="${cx + rx * s}" y="${y + ry * s}" width="${s + 0.4}" height="${s + 0.4}" fill="${fill}"/>`;
    }));
    cx += 6 * s;
  }
  return out;
}

// ---- pixel hills ----

function hills(w, base, step, amp, seed, fill) {
  let out = '';
  for (let x = 0; x < w; x += step) {
    const h = Math.round((amp * (0.55 + 0.45 * Math.sin(x / 190 + seed) * Math.cos(x / 97 + seed * 2))) / step) * step;
    out += `<rect x="${x}" y="${base - h}" width="${step + 0.5}" height="${h + 40}" fill="${fill}"/>`;
  }
  return out;
}

const grass = (w, y, h = 22) => {
  let t = '';
  for (let x = 0; x < w; x += 16) t += `<rect x="${x}" y="${y - 6 - ((x / 16) % 3 === 0 ? 4 : 0)}" width="8" height="${6 + ((x / 16) % 3 === 0 ? 4 : 0)}" fill="#3b9370"/>`;
  return `${t}<rect x="0" y="${y}" width="${w}" height="${h}" fill="#2f7d5b"/><rect x="0" y="${y}" width="${w}" height="5" fill="#3b9370"/>`;
};

// ---- banner ----

function banner() {
  const W = 1200;
  const H = 400;
  const ground = 360;
  const sky = `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e4f0e4"/><stop offset=".7" stop-color="#f6f1e3"/><stop offset="1" stop-color="#f4edd9"/></linearGradient></defs>`;
  let b = `<rect width="${W}" height="${H}" fill="url(#sky)"/>`;
  // sun and twinkles
  b += `<g class="twinkle"><circle cx="1040" cy="92" r="46" fill="${GOLD}" opacity=".9" shape-rendering="crispEdges"/></g><circle cx="1040" cy="92" r="64" fill="${GOLD}" opacity=".16"/>`;
  [[610, 60], [740, 120], [180, 40], [880, 52], [470, 30]].forEach(([x, y], i) => {
    b += `<g class="twinkle" style="animation-delay:${i * 0.5}s"><rect x="${x}" y="${y}" width="6" height="6" fill="${GOLD}"/><rect x="${x - 6}" y="${y}" width="6" height="6" fill="${GOLD}" opacity=".55"/><rect x="${x + 6}" y="${y}" width="6" height="6" fill="${GOLD}" opacity=".55"/><rect x="${x}" y="${y - 6}" width="6" height="6" fill="${GOLD}" opacity=".55"/><rect x="${x}" y="${y + 6}" width="6" height="6" fill="${GOLD}" opacity=".55"/></g>`;
  });
  // clouds
  b += `<g class="drift">${px('cloud', 360, 50, 62).svg}</g><g class="drift" style="animation-delay:-8s;animation-duration:22s">${px('cloud', 880, 150, 44).svg}</g><g class="drift" style="animation-delay:-4s;animation-duration:19s">${px('cloud', 40, 160, 40).svg}</g>`;
  // hills + ground
  b += hills(W, ground - 20, 12, 120, 1, '#cfe3d0') + hills(W, ground, 12, 80, 3.7, '#b4d5bc');
  b += grass(W, ground);
  // forest
  const trees = [
    ['gum', 6, 175], ['bush', 296, 46], ['flower', 346, 40], ['mushroom', 392, 32],
    ['tree', 790, 150], ['bush', 880, 52], ['gum', 930, 205], ['flower', 1010, 44], ['tree', 1056, 120], ['mushroom', 1150, 32],
  ];
  trees.forEach(([name, x, h], i) => {
    const p = px(name, x, ground - h + 4, h);
    b += swayed(p, name === 'bush' || name === 'mushroom' ? 'sws' : 'sw', -i * 0.7);
  });
  // logo + title
  const logo = fs.readFileSync(path.join(ROOT, 'public', 'favicon.svg'), 'utf8');
  const logoInner = logo.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
  b += `<ellipse cx="190" cy="${ground - 34}" rx="84" ry="9" fill="#14281f" opacity=".16"/>`;
  b += `<g class="float"><svg x="96" y="86" width="190" height="190" viewBox="0 0 28 28" shape-rendering="crispEdges">${logoInner}</svg></g>`;
  b += pixelText('MITADY', 322, 92, 13, INK, GOLD);
  b += `<text x="326" y="226" ${FONT} font-size="25" font-weight="600" fill="#2c4b3d">Cherche un poste sans t’épuiser.</text>`;
  b += `<text x="326" y="262" ${FONT} font-size="18" fill="#58705f">Alternance · Stage · CDI · CDD · Freelance</text>`;
  // the gang, on the ground
  const gang = [['chat', 470], ['renard', 538], ['lapin', 606]];
  gang.forEach(([a, x], i) => {
    const p = pet(a, x, ground - 62, 62);
    b += `<g style="animation:hop 5.4s ease-in-out infinite;animation-delay:${i * 0.6}s">${p.svg}</g>`;
  });
  const sleeper = pet('hibou', 1100, ground - 60, 60, { mood: 'sleep' });
  b += `<g class="zz">${sleeper.svg}</g><text x="1154" y="${ground - 64}" ${FONT} font-size="16" font-weight="700" fill="${INK}" style="animation:zed 2.6s ease-in-out infinite">z</text><text x="1166" y="${ground - 78}" ${FONT} font-size="20" font-weight="700" fill="${INK}" style="animation:zed 2.6s ease-in-out infinite;animation-delay:1.2s">z</text>`;
  // butterfly and leaves
  const bf = px('butterfly', 0, 0, 34);
  b += `<g style="animation:fly 22s linear infinite"><g class="float">${bf.svg}</g></g>`;
  const leaf = (x, d) => `<g style="animation:leaf 14s linear infinite;animation-delay:${d}s">${px('leaf', x, -20, 18).svg}</g>`;
  b += leaf(420, 0) + leaf(760, -5) + leaf(1010, -9) + leaf(230, -12);
  const extra = `<style>@keyframes fly { 0% { transform: translate(-60px, 120px); } 30% { transform: translate(400px, 70px); } 60% { transform: translate(780px, 150px); } 100% { transform: translate(1280px, 60px); } } @keyframes leaf { 0% { transform: translate(0, 0) rotate(0); opacity: 0; } 10% { opacity: .9; } 50% { transform: translate(40px, 200px) rotate(160deg); } 100% { transform: translate(-30px, 400px) rotate(300deg); opacity: 0; } }</style>`;
  return svgDoc(W, H, sky + b, extra).replace('<style>' + CSS, `<style>${CSS}`);
}

// ---- divider ----

function divider() {
  const W = 1000;
  const H = 64;
  let b = `<rect y="${H - 14}" width="${W}" height="14" fill="#2f7d5b"/><rect y="${H - 14}" width="${W}" height="4" fill="#3b9370"/>`;
  for (let x = 0; x < W; x += 16) b += `<rect x="${x}" y="${H - 20 - ((x / 16) % 4 === 0 ? 4 : 0)}" width="8" height="${6 + ((x / 16) % 4 === 0 ? 4 : 0)}" fill="#3b9370"/>`;
  const items = [['flower', 60, 30], ['mushroom', 170, 24], ['bush', 270, 30], ['flower', 400, 34], ['gum', 480, 56], ['flower', 560, 30], ['mushroom', 640, 24], ['bush', 720, 30], ['flower', 830, 36], ['tree', 900, 52]];
  items.forEach(([n, x, h], i) => {
    const p = px(n, x, H - 12 - h, h);
    b += swayed(p, 'sws', -i * 0.6);
  });
  const bf = px('butterfly', 0, 0, 20);
  b += `<g style="animation:fly2 14s linear infinite"><g class="float">${bf.svg}</g></g>`;
  return svgDoc(W, H, b, `<style>@keyframes fly2 { 0% { transform: translate(-30px, 10px); } 50% { transform: translate(500px, 2px); } 100% { transform: translate(1030px, 12px); } }</style>`);
}

// ---- the animals ----

function gang() {
  const list = ANIMALS.map((a) => a.id);
  const W = 1000;
  const H = 190;
  const step = W / list.length;
  let b = '';
  b += `<rect y="${H - 38}" width="${W}" height="38" fill="#2f7d5b" opacity=".12"/>`;
  list.forEach((id, i) => {
    const cx = step * i + step / 2;
    const label = ANIMALS.find((a) => a.id === id).label;
    const sleeping = id === 'hibou';
    const p = pet(id, cx - 38, 52, 76, { mood: sleeping ? 'sleep' : 'idle', accessory: ['aucun', 'casquette', 'lunettes', 'noeud', 'couronne', 'echarpe', 'fete', 'aucun', 'aucun'][i] });
    b += `<ellipse cx="${cx}" cy="136" rx="30" ry="5" fill="#14281f" opacity=".18"/>`;
    b += `<g style="animation:hop 6s ease-in-out infinite;animation-delay:${i * 0.55}s" ${sleeping ? 'class="zz"' : ''}>${p.svg}</g>`;
    if (sleeping) b += `<text x="${cx + 28}" y="62" ${FONT} font-size="15" font-weight="700" fill="${INK}" style="animation:zed 2.6s ease-in-out infinite">z</text>`;
    b += `<text x="${cx}" y="170" text-anchor="middle" ${FONT} font-size="14" font-weight="600" fill="#2c4b3d">${label}</text>`;
  });
  return svgDoc(W, H, b);
}

// ---- the search screen ----

function search() {
  const W = 1000;
  const H = 230;
  const sites = [['HelloWork', '#0a7d4f'], ['LinkedIn', '#0a66c2'], ['Indeed', '#2557a7'], ['Welcome to the Jungle', '#d6a400'], ['France Travail', '#1d4ea3'], ['JobTeaser', '#6b3fd0']];
  const who = ['koala', 'renard', 'lapin', 'chat', 'pingouin', 'grenouille'];
  const step = W / sites.length;
  let b = `<rect y="${H - 20}" width="${W}" height="20" fill="#2f7d5b" opacity=".14"/>`;
  sites.forEach(([name, color], i) => {
    const cx = step * i + step / 2;
    b += `<g style="animation:hop 3.6s ease-in-out infinite;animation-delay:${i * 0.45}s">${pet(who[i], cx - 36, 52, 72).svg}</g>`;
    b += `<rect x="${cx - 70}" y="146" width="140" height="44" rx="12" fill="#fff" stroke="${color}" stroke-width="2.5"/>`;
    b += `<rect x="${cx - 62}" y="154" width="28" height="28" rx="8" fill="${color}"/>`;
    b += `<text x="${cx - 48}" y="174" text-anchor="middle" ${FONT} font-size="15" font-weight="800" fill="#fff">${name[0]}</text>`;
    const label = name.length > 12 ? name.split(' ').slice(0, 2).join(' ') : name;
    b += `<text x="${cx - 26}" y="173" ${FONT} font-size="${label.length > 11 ? 12 : 14}" font-weight="700" fill="#243b31">${label}</text>`;
    b += `<g style="animation:pop 3.6s ease-out infinite;animation-delay:${i * 0.45}s"><rect x="${cx + 18}" y="38" width="42" height="22" rx="11" fill="${GOLD}"/><text x="${cx + 39}" y="54" text-anchor="middle" ${FONT} font-size="13" font-weight="800" fill="#2a2438">+${2 + ((i * 3) % 5)}</text></g>`;
  });
  return svgDoc(W, H, b);
}

// ---- single pieces (feature table) ----

function single(name, h, kind = 'scene') {
  const p = kind === 'pet' ? pet(name, 8, 8, h) : px(name, 8, 8, h);
  const W = Math.round(p.w + 16);
  const H = h + 16;
  const body = kind === 'pet' ? p.svg : swayed(p, 'sw');
  return svgDoc(W, H, body);
}

const files = {
  'banner.svg': banner(),
  'divider.svg': divider(),
  'gang.svg': gang(),
  'search.svg': search(),
  'logo.svg': fs.readFileSync(path.join(ROOT, 'public', 'favicon.svg'), 'utf8'),
};
for (const [n, h] of [['tree', 84], ['gum', 90], ['bush', 60], ['flower', 78], ['mushroom', 70], ['cloud', 56], ['butterfly', 56]]) files[`pix/${n}.svg`] = single(n, h);
files['pix/koala.svg'] = single('koala', 84, 'pet');
for (const [name, content] of Object.entries(files)) fs.writeFileSync(path.join(OUT, name), content);
console.log('docs/', Object.keys(files).join(' '));
