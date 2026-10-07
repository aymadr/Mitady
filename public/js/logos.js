// Job-board logos on 3D tiles. Mitady draws a stylised tile for each site; a file dropped in
// public/logos/<id>.svg (or .png) replaces it automatically (see public/logos/README.md).
import { raw } from './lib.js';

const SITES = {
  'HelloWork': { id: 'hellowork', color: '#6a4cf5', glyph: 'H' },
  'LinkedIn': { id: 'linkedin', color: '#0a66c2', glyph: 'in', tight: true },
  'Indeed': { id: 'indeed', color: '#2557a7', glyph: 'i', tight: true },
  'Welcome to the Jungle': { id: 'wttj', color: '#ffcd00', glyph: 'W', dark: true },
  'Jobs That Make Sense': { id: 'jtms', color: '#e8475f', glyph: 'm' },
  'France Travail': { id: 'francetravail', color: '#2d4ac4', glyph: 'FT', tight: true },
  'Jobijoba': { id: 'jobijoba', color: '#002977', glyph: 'J' },
  'JobTeaser': { id: 'jobteaser', color: '#7c3aed', glyph: 'JT', tight: true },
  "L'Étudiant": { id: 'letudiant', color: '#e5484d', glyph: 'É' },
};

const slug = (s) => String(s).toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, '');

// The official logos shipped in public/logos/, with their width / height ratio.
// A wide logo (a word, not an icon) sits on a wider white tile.
const FILES = {
  linkedin: ['svg', 1],
  francetravail: ['svg', 0.9],
  jobteaser: ['svg', 1],
  hellowork: ['svg', 2.2],
  indeed: ['svg', 3.7],
  letudiant: ['svg', 5.2],
  wttj: ['png', 3],
  jtms: ['png', 1.18],
  jobijoba: ['png', 1, 'full'], // icon with its own background: fills the whole tile
};

// Width / height of a site's logo tile (1 for an icon), to lay wide logos out without overlap.
export function logoRatio(name) {
  const id = SITES[name]?.id;
  const r = FILES[id]?.[1] ?? 1;
  return r > 1.3 ? r * 0.82 + 0.5 : 1;
}

export function siteLogo(name, size = 28) {
  const known = SITES[name];
  const id = known?.id || slug(name) || 'site';
  const hue = [...String(name)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);
  const color = known?.color || `hsl(${hue} 70% 52%)`;
  const glyph = known?.glyph || String(name || '?')[0].toUpperCase();
  const file = FILES[id];
  const drawnOnly = false; // every site now has an official file; the drawn tile only backs up a missing one
  // Shipped logo: shown at once. Otherwise try a dropped-in file (.svg then .png) over the drawn tile.
  const src = file ? `/logos/${id}.${file[0]}` : `/logos/${id}.svg`;
  const ratio = file ? file[1] : 1;
  const wide = ratio > 1.3;
  const onerror = file
    ? `this.parentNode.classList.remove('has-img','wide');this.remove()`
    : `this.dataset.t?this.remove():(this.dataset.t=1,this.src='/logos/${id}.png')`;
  const onload = `this.parentNode.classList.add('has-img')`;
  return raw(
    `<span class="slogo ${known?.dark ? 'dark' : ''} ${known?.tight ? 'tight' : ''} ${file ? 'has-img' : ''} ${wide ? 'wide' : ''} ${file?.[2] || ''}" style="--s:${size}px;--c:${color};--r:${ratio}" title="${name}" aria-hidden="true"><b>${glyph}</b>${drawnOnly ? '' : `<img src="${src}" alt="" onload="${onload}" onerror="${onerror}">`}</span>`,
  );
}
