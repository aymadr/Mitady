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
  'Jobijoba': { id: 'jobijoba', color: '#16a085', glyph: 'J' },
  'JobTeaser': { id: 'jobteaser', color: '#7c3aed', glyph: 'JT', tight: true },
  "L'Étudiant": { id: 'letudiant', color: '#e5484d', glyph: 'É' },
};

const slug = (s) => String(s).toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, '');

export function siteLogo(name, size = 28) {
  const known = SITES[name];
  const id = known?.id || slug(name) || 'site';
  const hue = [...String(name)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);
  const color = known?.color || `hsl(${hue} 70% 52%)`;
  const glyph = known?.glyph || String(name || '?')[0].toUpperCase();
  const fallback = `this.dataset.t?this.remove():(this.dataset.t=1,this.src='/logos/${id}.png')`;
  return raw(
    `<span class="slogo ${known?.dark ? 'dark' : ''} ${known?.tight ? 'tight' : ''}" style="--s:${size}px;--c:${color}" title="${name}" aria-hidden="true"><b>${glyph}</b><img src="/logos/${id}.svg" alt="" onload="this.parentNode.classList.add('has-img')" onerror="${fallback}"></span>`,
  );
}
