// Rasterises the Mitady mark (a koala holding a magnifier) on a 24 x 24 pixel grid.
// Writes public/favicon.svg and prints the markup pasted into logo() in public/js/brand.js.
// Run: node scripts/koala-logo.js
const N = 24;
const grid = Array.from({ length: N }, () => Array(N).fill('.'));
const inCircle = (x, y, cx, cy, r) => (x + .5 - cx) ** 2 + (y + .5 - cy) ** 2 <= r * r;
const inEll = (x, y, cx, cy, rx, ry) => ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2 <= 1;
const set = (x, y, c) => { if (x >= 0 && y >= 0 && x < N && y < N) grid[y][x] = c; };
const paint = (test, c) => { for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (test(x, y)) set(x, y, c); };

// ears: fur, white fluff, pink centre
paint((x, y) => inCircle(x, y, 4.4, 6.4, 4.5) || inCircle(x, y, 17.6, 6.4, 4.5), 'B');
paint((x, y) => inCircle(x, y, 4.4, 6.4, 3.1) || inCircle(x, y, 17.6, 6.4, 3.1), 'L');
paint((x, y) => inCircle(x, y, 4.4, 6.4, 1.6) || inCircle(x, y, 17.6, 6.4, 1.6), 'P');
// head
paint((x, y) => inEll(x, y, 11, 13, 8.4, 7.2), 'B');
paint((x, y) => inEll(x, y, 11, 15.6, 4.8, 3.2), 'L');
// big koala nose
paint((x, y) => inEll(x, y, 11, 13.4, 2.9, 2.5), 'N');
set(10, 12, 'S');
// eyes
paint((x, y) => (x === 6 || x === 7 || x === 14 || x === 15) && (y === 9 || y === 10), 'K');
set(6, 9, 'W'); set(14, 9, 'W');
// magnifier: handle, ring, glass
const seg = (x, y, ax, ay, bx, by, w) => {
  const px = x + .5, py = y + .5, dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return (px - (ax + t * dx)) ** 2 + (py - (ay + t * dy)) ** 2 <= (w / 2) ** 2;
};
paint((x, y) => seg(x, y, 19.8, 19.6, 22.6, 22.6, 2.4), 'H');
paint((x, y) => inCircle(x, y, 17, 16.6, 4.6), 'R');
paint((x, y) => inCircle(x, y, 17, 16.6, 3.2), 'G');
set(15, 15, 'S'); set(16, 15, 'S'); set(15, 16, 'S');

// outline
const out = grid.map((r) => [...r]);
for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
  if (grid[y][x] !== '.') continue;
  const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => (grid[y + dy]?.[x + dx] ?? '.') !== '.');
  if (nb) out[y][x] = 'O';
}
const COL = { B: '#a3a9c2', P: '#ffb3cc', L: '#e9ebf5', N: '#2a2438', K: '#2a2438', W: '#ffffff', H: '#a8672d', R: '#ffcd00', G: '#dff3ff', S: '#ffffff', O: '#2a2438' };
const paths = {};
out.forEach((row, y) => { let x = 0; while (x < N) { const c = row[x]; if (c === '.') { x++; continue; } let w = 1; while (row[x + w] === c) w++; (paths[c] ||= []).push(`M${x} ${y}h${w}v1h-${w}z`); x += w; } });
const body = Object.entries(paths).map(([c, d]) => `<path fill="${COL[c]}" d="${d.join('')}"/>`).join('');
const TILE = '#2f7d5b'; // eucalyptus
const svg = () => `<rect width="28" height="28" rx="8" fill="${TILE}"/><g transform="translate(2 2.4)" shape-rendering="crispEdges">${body}</g>`;
require('fs').writeFileSync(require('path').join(__dirname, '..', 'public', 'favicon.svg'), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28">${svg()}</svg>`);
console.log(svg());
