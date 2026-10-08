// Pixel-art scenery (trees, bushes, flowers, mushrooms, clouds, a butterfly…) drawn like the
// animals: crisp SVG squares from small shapes. It decorates empty states, the onboarding and
// the strip of forest at the bottom of every page, so the pet is not the only thing on screen.
import { raw } from './lib.js';

const COL = {
  G: '#25694b', g: '#3b8f69', l: '#8fd0a6', T: '#8a5a3b', t: '#6b4329',
  Y: '#ffcd00', O: '#ff9a3d', R: '#e5484d', P: '#ff8fae', W: '#ffffff', w: '#e3ecf5',
  S: '#a9b0c4', s: '#8a91a8', K: '#2a2438', M: '#fff3df', m: '#e6d4b8', B: '#9ad7ff',
};

const inC = (x, y, cx, cy, r) => (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r;
const inE = (x, y, cx, cy, rx, ry) => ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1;

// Recipes: [shape, colour, ...numbers]. Later ones paint over earlier ones.
const SHAPES = {
  c: (x, y, [cx, cy, r]) => inC(x, y, cx, cy, r),
  e: (x, y, [cx, cy, rx, ry]) => inE(x, y, cx, cy, rx, ry),
  r: (x, y, [x0, y0, x1, y1]) => x >= x0 && x <= x1 && y >= y0 && y <= y1,
  p: (x, y, [px, py]) => x === px && y === py,
};

const SPRITES = {
  tree: {
    w: 22, h: 28,
    ops: [
      ['r', 't', 10, 14, 11, 27], ['r', 'T', 10, 14, 10, 27], ['p', 'T', 8, 18], ['p', 'T', 9, 17], ['p', 'T', 12, 21], ['p', 'T', 13, 20],
      ['c', 'G', 11, 9, 8.6], ['c', 'G', 6, 12.5, 5.6], ['c', 'G', 16, 12.5, 5.6],
      ['c', 'g', 10.4, 8, 7], ['c', 'g', 6.2, 11.6, 4], ['c', 'g', 15.4, 11.6, 4],
      ['c', 'l', 8, 6, 2.8], ['c', 'l', 13, 5.2, 1.9], ['c', 'l', 4.6, 10, 1.5],
    ],
  },
  gum: {
    w: 16, h: 28,
    ops: [
      ['r', 't', 8, 16, 8, 27], ['r', 'T', 7, 16, 7, 27], ['p', 'T', 5, 20], ['p', 'T', 6, 19], ['p', 'T', 9, 22],
      ['e', 'G', 8, 9, 5.4, 9], ['e', 'g', 7.4, 8.4, 4, 7.6], ['e', 'l', 6, 5, 1.5, 3],
      ['c', 'G', 4, 14.5, 2.6], ['c', 'g', 3.7, 14, 1.8], ['c', 'G', 12.4, 13.5, 2.4], ['c', 'g', 12, 13, 1.6],
    ],
  },
  bush: {
    w: 20, h: 11,
    ops: [
      ['c', 'G', 5, 7, 4.6], ['c', 'G', 10, 5.6, 5.4], ['c', 'G', 15, 7, 4.6], ['r', 'G', 3, 7, 17, 10],
      ['c', 'g', 5, 6.4, 3.2], ['c', 'g', 10, 5, 4], ['c', 'g', 15, 6.4, 3.2], ['c', 'l', 8.6, 3.4, 1.5],
      ['p', 'R', 4, 7], ['p', 'R', 11, 7], ['p', 'Y', 14, 5], ['p', 'P', 7, 8], ['p', 'R', 16, 8],
    ],
  },
  flower: {
    w: 9, h: 14,
    ops: [
      ['r', 'G', 4, 7, 4, 13], ['p', 'g', 3, 11], ['p', 'g', 2, 10], ['p', 'g', 5, 9], ['p', 'g', 6, 8],
      ['p', 'P', 4, 1], ['p', 'P', 4, 5], ['p', 'P', 2, 3], ['p', 'P', 6, 3], ['p', 'P', 3, 2], ['p', 'P', 5, 2], ['p', 'P', 3, 4], ['p', 'P', 5, 4], ['p', 'Y', 4, 3],
    ],
  },
  mushroom: {
    w: 14, h: 12,
    grid: [
      '....RRRRRR....',
      '..RRRRWWRRRR..',
      '.RRWWRRRRWWRR.',
      '.RRWWRRRRRRRR.',
      'RRRRRRRRRRRRRR',
      'RRRRRWWRRRRRRR',
      '.mmmmmmmmmmmm.',
      '.....MMMm.....',
      '.....MMMm.....',
      '....MMMMmm....',
      '....MMMMmm....',
      '..............',
    ],
  },
  cloud: {
    w: 24, h: 11,
    ops: [
      ['c', 'B', 7, 7, 4.4], ['c', 'B', 12, 5, 5.4], ['c', 'B', 17.4, 7, 4.4], ['r', 'B', 6, 7, 18, 10.4],
      ['c', 'W', 7, 7, 3.4], ['c', 'W', 12, 5, 4.4], ['c', 'W', 17.4, 7, 3.4], ['r', 'W', 6, 7, 18, 9],
      ['r', 'w', 6, 9, 18, 9],
    ],
  },
  rock: {
    w: 14, h: 8,
    ops: [['e', 's', 7, 5.2, 6.6, 3.2], ['e', 'S', 6.6, 4.6, 5.6, 2.6], ['p', 'W', 4, 3], ['p', 'W', 5, 3]],
  },
  star: {
    w: 7, h: 7,
    ops: [['r', 'Y', 3, 0, 3, 6], ['r', 'Y', 0, 3, 6, 3], ['r', 'W', 3, 3, 3, 3]],
  },
  leaf: {
    w: 8, h: 8,
    grid: ['......GG', '....GGgG', '...GggGG', '..GggGG.', '.GgGGG..', 'GgGG....', 'TG......', 'T.......'],
  },
  butterfly: {
    w: 12, h: 9,
    // wings are separate groups so they can flap
    left: [['e', 'O', 3, 3, 3.2, 2.8], ['e', 'Y', 3.2, 6.2, 2.2, 2], ['p', 'W', 2, 2]],
    right: [['e', 'O', 8, 3, 3.2, 2.8], ['e', 'Y', 7.8, 6.2, 2.2, 2], ['p', 'W', 9, 2]],
    ops: [['r', 'K', 5, 2, 6, 7], ['p', 'K', 4, 1], ['p', 'K', 7, 1]],
  },
};

function raster(def, ops) {
  const { w, h } = def;
  const grid = Array.from({ length: h }, () => Array(w).fill(''));
  for (const [shape, c, ...n] of ops) {
    const f = SHAPES[shape];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (f(x, y, n)) grid[y][x] = c;
  }
  return grid;
}

function rects(grid) {
  const by = {};
  grid.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const c = row[x];
      if (!c) { x++; continue; }
      let n = 1;
      while (row[x + n] === c) n++;
      (by[c] ||= []).push(`M${x} ${y}h${n}v1h-${n}z`);
      x += n;
    }
  });
  return Object.entries(by).map(([c, d]) => `<path fill="${COL[c]}" d="${d.join('')}"/>`).join('');
}

const cache = {};
function art(name) {
  if (cache[name]) return cache[name];
  const d = SPRITES[name];
  let inner;
  if (d.grid) inner = rects(d.grid.map((r) => [...r].map((ch) => (ch === '.' ? '' : ch))));
  else if (d.left) inner = `<g class="wing wl">${rects(raster(d, d.left))}</g><g class="wing wr">${rects(raster(d, d.right))}</g>${rects(raster(d, d.ops))}`;
  else inner = rects(raster(d, d.ops));
  return (cache[name] = { w: d.w, h: d.h, inner });
}

// A piece of scenery, `size` px tall. Trees sway, clouds drift, the butterfly flaps.
export function scene(name, { size = 64, cls = '' } = {}) {
  const a = art(name);
  return raw(
    `<span class="px px-${name} ${cls}" style="--h:${size}px;--w:${Math.round((size * a.w) / a.h)}px;--d:-${(Math.random() * 6).toFixed(2)}s" aria-hidden="true">` +
      `<svg viewBox="0 0 ${a.w} ${a.h}" width="100%" height="100%" shape-rendering="crispEdges">${a.inner}</svg></span>`,
  );
}

// A row of trees and flowers on a strip of grass, at the foot of the page.
const FOREST = [
  ['bush', 46], ['flower', 34], ['tree', 128], ['mushroom', 30], ['gum', 150], ['flower', 30], ['bush', 52], ['rock', 24], ['tree', 104], ['flower', 36],
  ['gum', 120], ['mushroom', 28], ['bush', 48], ['tree', 140], ['flower', 32], ['bush', 44], ['gum', 110], ['flower', 34], ['tree', 96], ['mushroom', 30],
];

export function forestHtml() {
  const n = FOREST.length;
  const items = FOREST.map(([name, size], i) => {
    const left = ((i + 0.5) / n) * 100 + ((i * 37) % 7) - 3;
    return `<span class="forest-item" style="left:${left.toFixed(1)}%;--i:${i}">${scene(name, { size })}</span>`;
  }).join('');
  return `<div class="forest-sky">${scene('cloud', { size: 30, cls: 'drift' })}${scene('butterfly', { size: 34, cls: 'fly' })}</div><div class="forest-items">${items}</div><div class="forest-ground"></div>`;
}
