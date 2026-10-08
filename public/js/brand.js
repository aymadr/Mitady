// Mitady — brand mark and the 3D icon set.
// Icons are 24-grid stroke glyphs set on a glossy, extruded tile (see .i3d in styles.css).
import { raw } from './lib.js';
import { siteLogo } from './logos.js';

export const NAME = 'Mitady';

// A pixel koala with a magnifier, on the signature gradient (drawn by scripts/koala-logo.js).
export function logo(size = 32) {
  return raw(`<svg class="logo" width="${size}" height="${size}" viewBox="0 0 28 28" aria-hidden="true"><defs><linearGradient id="mt-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4a5cf6"/><stop offset=".55" stop-color="#8b5cf6"/><stop offset="1" stop-color="#ee5fa7"/></linearGradient></defs><rect width="28" height="28" rx="8" fill="url(#mt-g)"/><g transform="translate(2 2.4)" shape-rendering="crispEdges"><path fill="#2a2438" d="M2 1h5v1h-5zM15 1h5v1h-5zM1 2h1v1h-1zM7 2h1v1h-1zM14 2h1v1h-1zM20 2h1v1h-1zM0 3h1v1h-1zM8 3h1v1h-1zM13 3h1v1h-1zM21 3h1v1h-1zM8 4h1v1h-1zM13 4h1v1h-1zM22 4h1v1h-1zM9 5h4v1h-4zM22 5h1v1h-1zM22 6h1v1h-1zM22 7h1v1h-1zM22 8h1v1h-1zM0 9h1v1h-1zM21 9h1v1h-1zM1 10h2v1h-2zM19 10h2v1h-2zM2 11h1v1h-1zM19 11h1v1h-1zM2 12h1v1h-1zM19 12h1v1h-1zM2 13h1v1h-1zM20 13h1v1h-1zM2 14h1v1h-1zM21 14h1v1h-1zM2 15h1v1h-1zM21 15h1v1h-1zM3 16h1v1h-1zM22 16h1v1h-1zM3 17h1v1h-1zM22 17h1v1h-1zM4 18h2v1h-2zM21 18h1v1h-1zM6 19h1v1h-1zM21 19h1v1h-1zM7 20h8v1h-8zM22 20h1v1h-1zM15 21h5v1h-5zM23 21h1v1h-1zM20 22h1v1h-1zM21 23h1v1h-1zM23 23h1v1h-1z"/><path fill="#a3a9c2" d="M2 2h5v1h-5zM15 2h5v1h-5zM1 3h2v1h-2zM5 3h3v1h-3zM14 3h3v1h-3zM19 3h2v1h-2zM0 4h2v1h-2zM7 4h1v1h-1zM14 4h1v1h-1zM20 4h2v1h-2zM0 5h1v1h-1zM7 5h2v1h-2zM13 5h2v1h-2zM21 5h1v1h-1zM0 6h1v1h-1zM7 6h8v1h-8zM21 6h1v1h-1zM0 7h2v1h-2zM6 7h10v1h-10zM20 7h2v1h-2zM0 8h2v1h-2zM4 8h14v1h-14zM20 8h2v1h-2zM1 9h5v1h-5zM8 9h6v1h-6zM16 9h5v1h-5zM3 10h3v1h-3zM8 10h6v1h-6zM16 10h3v1h-3zM3 11h6v1h-6zM13 11h6v1h-6zM3 12h5v1h-5zM14 12h1v1h-1zM3 13h4v1h-4zM3 14h3v1h-3zM3 15h3v1h-3zM4 16h2v1h-2zM4 17h3v1h-3zM6 18h3v1h-3zM7 19h6v1h-6z"/><path fill="#e9ebf5" d="M3 3h2v1h-2zM17 3h2v1h-2zM2 4h5v1h-5zM15 4h5v1h-5zM1 5h2v1h-2zM6 5h1v1h-1zM15 5h1v1h-1zM19 5h2v1h-2zM1 6h2v1h-2zM6 6h1v1h-1zM15 6h1v1h-1zM19 6h2v1h-2zM2 7h1v1h-1zM19 7h1v1h-1zM2 8h2v1h-2zM18 8h2v1h-2zM7 13h1v1h-1zM6 14h2v1h-2zM6 15h3v1h-3zM6 16h6v1h-6zM7 17h5v1h-5zM9 18h4v1h-4z"/><path fill="#ffb3cc" d="M3 5h3v1h-3zM16 5h3v1h-3zM3 6h3v1h-3zM16 6h3v1h-3zM3 7h3v1h-3zM16 7h3v1h-3z"/><path fill="#ffffff" d="M6 9h1v1h-1zM14 9h1v1h-1z"/><path fill="#2a2438" d="M7 9h1v1h-1zM15 9h1v1h-1zM6 10h2v1h-2zM14 10h2v1h-2z"/><path fill="#2a2438" d="M9 11h4v1h-4zM8 12h2v1h-2zM11 12h3v1h-3zM8 13h6v1h-6zM8 14h5v1h-5zM9 15h4v1h-4z"/><path fill="#ffffff" d="M10 12h1v1h-1zM15 15h2v1h-2zM15 16h1v1h-1z"/><path fill="#ffcd00" d="M15 12h4v1h-4zM14 13h2v1h-2zM18 13h2v1h-2zM13 14h2v1h-2zM19 14h2v1h-2zM13 15h1v1h-1zM20 15h1v1h-1zM12 16h2v1h-2zM20 16h2v1h-2zM12 17h2v1h-2zM20 17h2v1h-2zM13 18h1v1h-1zM20 18h1v1h-1zM13 19h3v1h-3zM18 19h3v1h-3zM15 20h4v1h-4z"/><path fill="#dff3ff" d="M16 13h2v1h-2zM15 14h4v1h-4zM14 15h1v1h-1zM17 15h3v1h-3zM14 16h1v1h-1zM16 16h4v1h-4zM14 17h6v1h-6zM14 18h6v1h-6zM16 19h2v1h-2z"/><path fill="#a8672d" d="M19 20h3v1h-3zM20 21h3v1h-3zM21 22h3v1h-3zM22 23h1v1h-1z"/></g></svg>`);
}

const PATH = {
  search: '<circle cx="11" cy="11" r="6.500"/><path d="m16 16 4.500 4.500"/>',
  doc: '<path d="M7 3h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
  target: '<circle cx="12" cy="12" r="8.500"/><circle cx="12" cy="12" r="4.500"/><path d="M12 12h.01"/>',
  send: '<path d="M21 3 10 14M21 3l-7 18-4-7-7-4 18-7Z"/>',
  chat: '<path d="M4 5h16v11H9l-5 4V5Z"/>',
  inbox: '<path d="M3 13h5l1.500 3h5L16 13h5M5 5h14l2 8v6H3v-6l2-8Z"/>',
  pulse: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.500v3M12 18.500v3M2.500 12h3M18.500 12h3M5.300 5.300l2.100 2.100M16.600 16.600l2.100 2.100M18.700 5.300l-2.100 2.100M7.400 16.600l-2.100 2.100"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 7 8 6 8-6"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.400 3.600-8 8-8s8 3.600 8 8"/>',
  sparkles: '<path d="m12 3 1.800 5.200L19 10l-5.200 1.800L12 17l-1.800-5.200L5 10l5.200-1.800L12 3ZM19 16l.8 2.200L22 19l-2.200.8L19 22l-.8-2.200L16 19l2.200-.8L19 16Z"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M16 7l3 3M14 9l2 2"/>',
  bell: '<path d="M6 17v-6a6 6 0 0 1 12 0v6l1.500 2h-15L6 17ZM10 21h4"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5 9-5ZM3 12.500l9 5 9-5"/>',
  briefcase: '<rect x="3" y="7" width="18" height="13" rx="3"/><path d="M8 7V5.500A2.500 2.500 0 0 1 10.500 3h3A2.500 2.500 0 0 1 16 5.500V7M3 13h18"/>',
  rocket: '<path d="M5 15c-1.500 1.500-2 5-2 5s3.500-.5 5-2M14 4c3-1 6-1 7-1 0 1 0 4-1 7l-6 6-5-5 5-7ZM9 10l-4-1 2.500-2.500L11 7M14 15l1 4 2.500-2.500L17 13"/>',
  Alternance: '<path d="M4 8h13l-3-3M20 16H7l3 3"/><circle cx="12" cy="12" r="1.200"/>',
  Stage: '<path d="M12 3 3 8l9 5 9-5-9-5Z"/><path d="M7 11v5c0 1.400 2.200 3 5 3s5-1.600 5-3v-5"/>',
  CDI: '<path d="M8 8c-3 0-5 1.800-5 4s2 4 5 4c4 0 4-8 8-8 3 0 5 1.800 5 4s-2 4-5 4c-4 0-4-8-8-8Z"/>',
  CDD: '<rect x="3.500" y="5" width="17" height="15" rx="3"/><path d="M8 3v4M16 3v4M3.500 10h17"/>',
  Freelance: '<path d="m12 3 2.200 5.300L20 9l-4.300 3.700L17 18.500 12 15.500 7 18.500l1.300-5.800L4 9l5.800-.7L12 3Z"/>',
  cyber: '<path d="M12 3 4.500 6v5.500c0 4.500 3.200 7.700 7.500 9.500 4.300-1.800 7.500-5 7.500-9.500V6L12 3Z"/><path d="m9 12 2.200 2.200L15.500 10"/>',
  finance: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  data: '<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.700 3.100 3 7 3s7-1.300 7-3V6M5 12v6c0 1.700 3.100 3 7 3s7-1.300 7-3v-6"/>',
  dev: '<path d="m8 8-5 4 5 4M16 8l5 4-5 4M14 5l-4 14"/>',
  infra: '<rect x="3" y="4" width="18" height="6" rx="2"/><rect x="3" y="14" width="18" height="6" rx="2"/><path d="M7 7h.01M7 17h.01"/>',
  marketing: '<path d="M4 10v4l12 5V5L4 10Z"/><path d="M8 14v4a2 2 0 0 0 4 0M19 9.500a4 4 0 0 1 0 5"/>',
  rh: '<circle cx="9" cy="8" r="3.200"/><path d="M3 20c0-3.300 2.700-6 6-6s6 2.700 6 6M16 5.200a3.200 3.200 0 0 1 0 5.600M18 14.500c1.800.8 3 2.600 3 5.500"/>',
  commerce: '<rect x="3" y="7" width="18" height="13" rx="3"/><path d="M8 7V5.500A2.500 2.500 0 0 1 10.500 3h3A2.500 2.500 0 0 1 16 5.500V7M3 13h18"/>',
  autre: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="m5 12.500 4.500 4.500L19 7"/>',
};

// Each icon has its own colour so a page full of them stays lively.
const HUE = {
  search: 252, doc: 214, target: 332, send: 168, chat: 282, inbox: 250, pulse: 22, gear: 218, mail: 196, user: 296, sparkles: 44,
  key: 36, bell: 18, layers: 262, briefcase: 205, rocket: 12, Alternance: 252, Stage: 290, CDI: 168, CDD: 200, Freelance: 40,
  cyber: 158, finance: 142, data: 205, dev: 262, infra: 222, marketing: 338, rh: 12, commerce: 32, autre: 250, check: 152,
};

// A 3D tile: gradient body, a lit top edge, a darker extruded bottom edge, a soft shadow.
export function tile(name, { size = 44, cls = '', hue } = {}) {
  const d = PATH[name] || PATH.autre;
  return raw(
    `<span class="i3d ${cls}" style="--h:${hue ?? HUE[name] ?? 250};--s:${size}px" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg></span>`,
  );
}

// A cluster of three floating tiles, used as the artwork of a page header.
export function art(names) {
  const spots = [
    [0, 8, 84, -10],
    [88, -6, 64, 12],
    [64, 74, 52, -6],
  ];
  return raw(
    `<div class="page-art" aria-hidden="true">${names
      .map((n, i) => `<span class="page-art-item" style="left:${spots[i][0]}px;top:${spots[i][1]}px;--r:${spots[i][3]}deg;animation-delay:${-i * 1.7}s">${tile(n, { size: spots[i][2], cls: 'float' })}</span>`)
      .join('')}</div>`,
  );
}

export { PATH as GLYPHS };

const SOURCES = ['HelloWork', 'LinkedIn', 'Indeed', 'Welcome to the Jungle', 'Jobs That Make Sense', 'France Travail', 'Jobijoba', 'JobTeaser', "L'Étudiant"];

// Endless strip of the job boards Mitady reads.
export function marquee() {
  const pill = (n) => `<span class="mq">${siteLogo(n, 26)}${n}</span>`;
  const row = SOURCES.map(pill).join('');
  return raw(`<div class="marquee" aria-hidden="true"><div class="marquee-track">${row}${row}</div></div>`);
}
