// ---------- helpers shared by the scenes ----------

const GLYPH = {
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
};

// A word of pixel letters: returns the little squares so each one can pop in on its own.
function pixelWord(parent, text, x, y, s, color, shadow) {
  const out = [];
  let cx = x;
  for (const ch of text) {
    GLYPH[ch].forEach((row, ry) => [...row].forEach((v, rx) => {
      if (v !== '1') return;
      const e = el(parent, 'div', 'abs', { left: cx + rx * s + 'px', top: y + ry * s + 'px', width: s + 0.5 + 'px', height: s + 0.5 + 'px', background: color, boxShadow: shadow ? `${s * 0.3}px ${s * 0.3}px 0 ${shadow}` : 'none' });
      out.push({ e, col: (cx - x) / s + rx, row: ry });
    }));
    cx += 6 * s;
  }
  return out;
}

function hills(w, base, step, amp, seed, fill) {
  let out = '';
  for (let x = 0; x < w; x += step) {
    const h = Math.round((amp * (0.55 + 0.45 * Math.sin(x / 190 + seed) * Math.cos(x / 97 + seed * 2))) / step) * step;
    out += `<rect x="${x}" y="${base - h}" width="${step + 0.5}" height="${h + 400}" fill="${fill}"/>`;
  }
  return out;
}
function landscape(parent, { ground = 1030, dark = false } = {}) {
  const svg = el(parent, 'div', 'abs', { left: 0, top: 0, width: '1920px', height: '1080px' });
  const c1 = dark ? '#16301f' : '#dcebd9', c2 = dark ? '#1c3a29' : '#c9e0cd';
  let tufts = '';
  for (let x = 0; x < W; x += 24) tufts += `<rect x="${x}" y="${ground - 9 - ((x / 24) % 3 === 0 ? 6 : 0)}" width="12" height="${9 + ((x / 24) % 3 === 0 ? 6 : 0)}" fill="#3b9370"/>`;
  svg.innerHTML = `<svg width="1920" height="1080" viewBox="0 0 1920 1080" shape-rendering="crispEdges">${hills(W, ground - 40, 18, 190, 1, c1)}${hills(W, ground, 18, 130, 3.7, c2)}${tufts}<rect y="${ground}" width="1920" height="${1080 - ground}" fill="#2f7d5b"/><rect y="${ground}" width="1920" height="9" fill="#3b9370"/></svg>`;
  return svg;
}

// avatar tile with the company's letter
const AV = [['#2f7d5b', '#4a9c78'], ['#0a66c2', '#3b8bd9'], ['#d6552a', '#f08a52'], ['#6b3fd0', '#9b73ee'], ['#d6a400', '#f2cd3a'], ['#1d7a8c', '#4bb0c2']];
function avatar(parent, letter, size, i = 0) {
  const [a, b] = AV[i % AV.length];
  const e = el(parent, 'div', 'abs', { width: size + 'px', height: size + 'px', borderRadius: size * 0.28 + 'px', background: `linear-gradient(140deg, ${b}, ${a})`, boxShadow: `0 ${size * 0.1}px ${size * 0.2}px -${size * 0.05}px ${a}99, inset 0 2px 0 rgba(255,255,255,.35)`, display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 800, fontSize: size * 0.46 + 'px', fontFamily: "'Bricolage Grotesque', Inter, sans-serif" });
  e.textContent = letter;
  return e;
}

function ring(parent, size, color = '#2f7d5b', fs = 0.34) {
  const r = el(parent, 'div', 'ring abs', { width: size + 'px', height: size + 'px' });
  r.style.setProperty('--c', color);
  const b = el(r, 'b', '', { fontSize: size * fs + 'px' });
  r.setScore = (v, col) => { r.style.setProperty('--v', v); if (col) r.style.setProperty('--c', col); b.textContent = Math.round(v); };
  return r;
}

const mix = (a, b, t) => {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return '#' + pa.map((v, i) => Math.round(lerp(v, pb[i], t)).toString(16).padStart(2, '0')).join('');
};
const scoreColor = (v) => (v < 60 ? mix('#d8a900', '#2f7d5b', clamp((v - 50) / 10)) : '#2f7d5b');

// a deterministic burst of pixel confetti
function confetti(parent, n, colors) {
  const items = Array.from({ length: n }, (_, i) => {
    const a = rnd() * Math.PI * 2;
    const v = 500 + rnd() * 700;
    return { e: el(parent, 'div', 'abs', { width: 14 + rnd() * 14 + 'px', height: 14 + rnd() * 14 + 'px', background: colors[i % colors.length], opacity: 0 }), vx: Math.cos(a) * v, vy: Math.sin(a) * v - 300, rot: rnd() * 720 - 360 };
  });
  return {
    items,
    update(tau, x, y) {
      for (const c of items) {
        if (tau < 0 || tau > 1.8) { c.e.style.opacity = 0; continue; }
        const px = x + c.vx * tau * Math.exp(-tau * 0.9);
        const py = y + c.vy * tau * Math.exp(-tau * 0.9) + 1400 * tau * tau * 0.5;
        put(c.e, { x: px, y: py, r: c.rot * tau, o: 1 - P(tau, 1.1, 1.8, E.lin) });
      }
    },
  };
}

function cursor(parent) {
  const c = el(parent, 'div', 'abs', { left: 0, top: 0, width: '64px', height: '64px', zIndex: 20, filter: 'drop-shadow(0 8px 10px rgba(0,0,0,.35))' });
  c.innerHTML = '<svg viewBox="0 0 24 24" width="64" height="64"><path d="M4 2l15 9-7 1.6L9.2 20 4 2z" fill="#fff" stroke="#14281f" stroke-width="1.4" stroke-linejoin="round"/></svg>';
  return { c, rip: mkRip(parent) };
}
const mkRip = (parent) => el(parent, 'div', 'abs', { left: 0, top: 0, width: '90px', height: '90px', marginLeft: '-45px', marginTop: '-45px', borderRadius: '50%', border: '5px solid #ffcd00', opacity: 0, zIndex: 19 });
const clickAt = (rip, lt, t0, x, y) => {
  const k = P(lt, t0, t0 + 0.5, E.out);
  put(rip, { x, y, s: lerp(0.3, 1.5, k), o: k > 0 && k < 1 ? 1 - k : 0 });
};
// a point that eases through [time, x, y] waypoints (the cursor path)
function track(lt, pts) {
  if (lt <= pts[0][0]) return [pts[0][1], pts[0][2]];
  for (let i = 1; i < pts.length; i++) {
    if (lt <= pts[i][0]) {
      const k = E.inout(clamp((lt - pts[i - 1][0]) / (pts[i][0] - pts[i - 1][0])));
      return [lerp(pts[i - 1][1], pts[i][1], k), lerp(pts[i - 1][2], pts[i][2], k)];
    }
  }
  const l = pts[pts.length - 1];
  return [l[1], l[2]];
}
const centerMask = (parent, htmlStr, y, size, color) => {
  const i = wordMask(parent, htmlStr, 110, y, size, color, 1700);
  i.parentNode.style.textAlign = 'center';
  return i;
};
// a block of lines that rise in at t0 and out at t1 (left-aligned, stacked)
function textBlock(parent, lines, x, y, size, gap) {
  const parts = lines.map(([txt, color, sz], i) => {
    const s = sz || size;
    const yy = y + lines.slice(0, i).reduce((a, [, , z]) => a + (z || size) * 1.22 + gap, 0);
    return wordMask(parent, txt, x, yy, s, color, 1000);
  });
  return (lt, t0, t1) => parts.forEach((p, i) => put(p, { y: (1 - P(lt, t0 + i * 0.1, t0 + 0.8 + i * 0.1, E.out5)) * 170 - P(lt, t1 + i * 0.05, t1 + 0.6 + i * 0.05, E.in) * 170 }));
}

const wordMask = (parent, html, x, y, size, color, w = 1700) => {
  const m = el(parent, 'div', 'wm abs disp', { left: x + 'px', top: y + 'px', width: w + 'px', height: size * 1.22 + 'px', fontSize: size + 'px', color, whiteSpace: 'nowrap' });
  const i = el(m, 'div', '', { paddingTop: size * 0.1 + 'px' });
  i.innerHTML = html;
  return i;
};

// ---------- 0. intro ----------

function sceneIntro() {
  const root = el(null, 'div', '', { background: 'radial-gradient(120% 90% at 50% 40%, #16301f 0%, #0b1511 68%)' });
  for (let i = 0; i < 70; i++) {
    const s = el(root, 'div', 'abs tw', { left: rnd() * 1880 + 'px', top: rnd() * 1040 + 'px', width: '8px', height: '8px', background: rnd() < 0.3 ? '#ffcd00' : '#7fdcae', opacity: 0.55 });
    s.style.setProperty('--d', rnd() * 2.6 + 's');
  }
  const logo = el(root, 'div', 'abs', { left: '810px', top: '110px', width: '300px', height: '300px' });
  logo.innerHTML = ASSETS.logoSvg.replace('<svg ', '<svg width="300" height="300" style="display:block;filter:drop-shadow(0 30px 40px rgba(0,0,0,.55))" ');
  const sparks = [[-90, 40, 52], [330, 10, 40], [350, 230, 56], [-60, 250, 36], [150, -70, 38]].map(([dx, dy, h], i) => {
    const s = sprite('scenery', 'star', h);
    place(s, root, 810 + dx, 110 + dy);
    return { s, i };
  });
  const S = 22, word = pixelWord(root, 'MITADY', (1920 - (36 * S - S)) / 2, 520, S, '#f4f1e8', '#ffcd00');
  word.forEach((p) => { p.d = rnd() * 0.8 + p.col * 0.012; });
  const sub = el(root, 'div', 'abs disp', { left: 0, top: '770px', width: '1920px', textAlign: 'center', fontSize: '62px', fontWeight: 600, letterSpacing: '-0.02em', color: '#cfe3d6', whiteSpace: 'nowrap' });
  const words = 'Cherche un poste sans t’épuiser.'.split(' ').map((w) => {
    const sp = el(sub, 'span', '', { display: 'inline-block', marginRight: '0.28em' });
    sp.textContent = w;
    return sp;
  });
  return {
    root,
    update(lt) {
      const p = P(lt, 0.2, 1.1, E.back);
      put(logo, { s: lerp(0.2, 1, p), r: lerp(-16, 0, p), o: P(lt, 0.2, 0.5), y: lerp(60, 0, p) + Math.sin(lt * 2.2) * 8 * P(lt, 1.4, 1.8) });
      sparks.forEach(({ s, i }) => {
        const k = P(lt, 1.0 + i * 0.13, 1.5 + i * 0.13, E.back);
        put(s, { s: k, r: (1 - k) * 90, o: k * (1 - P(lt, 3.6, 4.4)) });
      });
      word.forEach((q) => {
        const k = P(lt, 1.15 + q.d, 1.5 + q.d, E.back);
        put(q.e, { s: k, o: k > 0 ? 1 : 0, y: k >= 1 ? Math.sin(lt * 3.4 + q.col * 0.45) * 5 * P(lt, 2.4, 3) : 0 });
      });
      words.forEach((w, i) => {
        const k = P(lt, 2.5 + i * 0.16, 3.1 + i * 0.16, E.out5);
        put(w, { y: (1 - k) * 70, o: k, b: (1 - k) * 8 });
      });
      put(root.firstChild, {});
    },
  };
}

// ---------- 1. headline ----------

function sceneHeadline() {
  const root = el(null, 'div', '', { background: '#f4f1e8' });
  const blob = el(root, 'div', 'abs', { left: '1000px', top: '-300px', width: '1100px', height: '1100px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(47,125,91,.28), transparent 65%)' });
  const blob2 = el(root, 'div', 'abs', { left: '-300px', top: '500px', width: '900px', height: '900px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,205,0,.28), transparent 65%)' });
  const dots = el(root, 'div', 'abs', { inset: 0, backgroundImage: 'radial-gradient(rgba(20,40,31,.10) 3px, transparent 3.5px)', backgroundSize: '48px 48px', opacity: 0.6 });
  const land = landscape(root, { ground: 1020 });
  const l1 = wordMask(root, 'Décroche ton', 130, 150, 132, '#14281f');
  const WORDS = ['alternance', 'stage', 'premier poste', 'CDI'];
  const box = el(root, 'div', 'wm abs disp', { left: '130px', top: '320px', width: '1100px', height: '170px', fontSize: '132px', color: '#2f7d5b' });
  const ws = WORDS.map((w) => { const d = el(box, 'div', 'abs', { left: 0, top: '14px', whiteSpace: 'nowrap' }); d.textContent = w; return d; });
  const bar = el(root, 'div', 'abs', { left: '136px', top: '494px', width: '460px', height: '16px', background: '#ffcd00', transformOrigin: '0 50%' });
  const l3 = wordMask(root, 'sans t’épuiser.', 130, 550, 132, '#14281f');
  const cards = [['Analyste SOC', 'Thales', 91, 1], ['Développeur web', 'Doctolib', 76, 3], ['Stage Data Analyst', 'Alan', 84, 1], ['Chargé de projet', 'Capgemini', 68, 4]].map(([t, c, sc, i], k) => {
    const card = el(root, 'div', 'abs card', { left: '1250px', top: 150 + k * 195 + 'px', width: '600px', height: '165px' });
    avatar(card, c[0], 96, i).style.cssText += ';left:30px;top:34px';
    const tt = el(card, 'div', 'abs', { left: '150px', top: '36px', fontWeight: 700, fontSize: '32px', color: '#14281f', whiteSpace: 'nowrap' }); tt.textContent = t;
    const cc = el(card, 'div', 'abs', { left: '150px', top: '86px', fontSize: '25px', color: '#6a7b72' }); cc.textContent = c + ' · Lyon';
    const r = ring(card, 104, '#2f7d5b'); r.style.left = '466px'; r.style.top = '30px';
    return { card, r, sc };
  });
  const trees = [['gum', 40, 300], ['bush', 330, 100], ['tree', 470, 260], ['flower', 760, 90], ['mushroom', 880, 70], ['tree', 1200, 280], ['bush', 1480, 110], ['gum', 1600, 400], ['flower', 1810, 90]].map(([n, x, h], i) => {
    const s = sprite('scenery', n, h);
    place(s, root, x, 1030 - h + 6);
    s.style.transformOrigin = '50% 100%';
    return { s, i };
  });
  const koala = place(sprite('pet', 'koala', 190), root, 1000, 830);
  cards.forEach((c) => root.appendChild(c.card));
  const bf = place(sprite('scenery', 'butterfly', 70), root, 0, 0);
  return {
    root,
    update(lt) {
      put(blob, { x: Math.sin(lt * 0.5) * 40, y: Math.cos(lt * 0.4) * 30 });
      put(blob2, { x: Math.cos(lt * 0.5) * 40, y: Math.sin(lt * 0.4) * 30 });
      const e1 = P(lt, 0.15, 0.95, E.out5);
      put(l1, { y: (1 - e1) * 190 });
      const e3 = P(lt, 1.3, 2.1, E.out5);
      put(l3, { y: (1 - e3) * 190 });
      // the rolling word
      const step = 1.25, start = 0.55;
      ws.forEach((w, i) => {
        const a = start + i * step;
        const inK = P(lt, a, a + 0.5, E.out5);
        const outK = i < WORDS.length - 1 ? P(lt, a + step - 0.05, a + step + 0.45, E.inout) : 0;
        put(w, { y: (1 - inK) * 230 - outK * 230, o: i === 0 && lt < a ? 0 : 1 });
      });
      put(bar, { sx: P(lt, 0.9, 1.6, E.out5), sy: 1 });
      cards.forEach(({ card, r, sc }, k) => {
        const a = 0.8 + k * 0.22;
        const p = P(lt, a, a + 0.8, E.out5);
        put(card, { x: (1 - p) * 900, y: Math.sin(lt * 1.3 + k) * 8 * p, r: (1 - p) * 6, o: p });
        r.setScore(sc * P(lt, a + 0.3, a + 1.4, E.out), '#2f7d5b');
      });
      trees.forEach(({ s, i }) => {
        const k = P(lt, 1.6 + i * 0.12, 2.3 + i * 0.12, E.back);
        put(s, { sy: k, sx: lerp(0.6, 1, k), o: k > 0 ? 1 : 0, r: Math.sin(lt * 1.2 + i) * 1.5 });
      });
      const hop = Math.max(0, Math.sin(((lt * 1.1) % 1) * Math.PI)) * 40;
      put(koala, { y: -hop, o: P(lt, 2.2, 2.6) });
      put(bf, { x: 200 + lt * 230, y: 140 + Math.sin(lt * 2) * 60, r: Math.sin(lt * 4) * 12, o: P(lt, 1.5, 2) });
    },
  };
}

// ---------- 2. search: one query, every site ----------

const SITES = [['hellowork', 'Hellowork', 38], ['linkedin', 'LinkedIn', 52], ['indeed', 'Indeed', 41], ['wttj', 'WTTJ', 27], ['jtms', 'JTMS', 63], ['francetravail', 'France Travail', 29], ['jobteaser', 'JobTeaser', 22], ['letudiant', 'L’Étudiant', 18], ['jobijoba', 'Jobijoba', 22]];
const QUERY = 'alternance cybersécurité Lyon';

function sceneSearch() {
  const root = el(null, 'div', '', { background: 'radial-gradient(110% 90% at 50% 25%, #17331f 0%, #0b1511 70%)' });
  el(root, 'div', 'abs', { inset: 0, backgroundImage: 'radial-gradient(rgba(127,220,174,.13) 3px, transparent 3.5px)', backgroundSize: '48px 48px' });
  const t1 = centerMask(root, 'Une recherche.', 60, 104, '#f4f1e8');
  const t2 = centerMask(root, 'Tous les sites.', 172, 104, '#7fdcae');
  const bar = el(root, 'div', 'abs card', { left: '360px', top: '340px', width: '1200px', height: '124px', borderRadius: '62px' });
  const mag = el(bar, 'div', 'abs', { left: '44px', top: '34px', width: '56px', height: '56px' });
  mag.innerHTML = '<svg viewBox="0 0 24 24" width="56" height="56" fill="none" stroke="#2f7d5b" stroke-width="2.4" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/></svg>';
  const txt = el(bar, 'div', 'abs', { left: '124px', top: 0, height: '124px', lineHeight: '124px', fontSize: '46px', fontWeight: 500, color: '#14281f', whiteSpace: 'nowrap' });
  const typedEl = el(txt, 'span');
  const caret = el(txt, 'span', '', { display: 'inline-block', width: '4px', height: '52px', background: '#2f7d5b', marginLeft: '3px', verticalAlign: 'middle' });
  const btn = el(bar, 'div', 'abs disp', { left: '956px', top: '14px', width: '220px', height: '96px', borderRadius: '48px', background: '#ffcd00', color: '#2a2438', fontSize: '36px', display: 'grid', placeItems: 'center' });
  btn.textContent = 'Chercher';

  const tiles = SITES.map(([id, name, n], i) => {
    const x = 157 + i * 182;
    const tile = el(root, 'div', 'abs', { left: x + 'px', top: '570px', width: '150px', height: '150px', borderRadius: '38px', background: '#fff', boxShadow: '0 24px 50px -12px rgba(0,0,0,.6)', display: 'grid', placeItems: 'center' });
    const img = el(tile, 'img', '', { width: '96px', height: '96px', objectFit: 'contain' });
    img.src = ASSETS.logos[id];
    const prog = el(tile, 'div', 'abs', { left: '22px', top: '132px', height: '7px', width: '0px', borderRadius: '4px', background: '#ffcd00' });
    const lab = el(root, 'div', 'abs', { left: x - 16 + 'px', top: '736px', width: '182px', textAlign: 'center', fontSize: '22px', fontWeight: 600, color: '#9fc1af', whiteSpace: 'nowrap' });
    lab.textContent = name;
    const badge = el(root, 'div', 'abs badge', { left: x + 36 + 'px', top: '526px' });
    badge.textContent = '+' + n;
    const dots = [0, 1, 2].map((j) => el(root, 'div', 'abs', { left: 0, top: 0, width: '14px', height: '14px', background: j === 1 ? '#ffcd00' : '#7fdcae', opacity: 0 }));
    return { tile, prog, lab, badge, dots, x: x + 75 };
  });
  const num = el(root, 'div', 'abs disp', { left: 0, top: '790px', width: '1920px', textAlign: 'center', fontSize: '170px', color: '#f4f1e8' });
  const nlab = el(root, 'div', 'abs disp', { left: 0, top: '965px', width: '1920px', textAlign: 'center', fontSize: '44px', fontWeight: 600, color: '#7fdcae', letterSpacing: 0 });
  const chip = el(root, 'div', 'abs badge', { left: '1200px', top: '850px', fontSize: '34px', padding: '12px 26px' });
  chip.textContent = '− 47 doublons';
  const koala = place(sprite('pet', 'koala', 190), root, 1570, 800);
  const cur = cursor(root);
  let lastLab = '';

  return {
    root,
    update(lt) {
      put(t1, { y: (1 - P(lt, 0.1, 0.9, E.out5)) * 150 });
      put(t2, { y: (1 - P(lt, 0.3, 1.1, E.out5)) * 150 });
      const bp = P(lt, 0.7, 1.5, E.out5);
      const press = P(lt, 3.85, 3.95, E.lin) * (1 - P(lt, 3.95, 4.2, E.lin));
      put(bar, { y: (1 - bp) * 120, o: bp, s: lerp(0.9, 1, bp) });
      typedEl.textContent = QUERY.slice(0, Math.floor(clamp((lt - 1.0) / 2.0) * QUERY.length));
      caret.style.opacity = lt < 4 ? ((lt * 2.4) % 1 < 0.6 ? 1 : 0) : 0;
      put(btn, { s: 1 - 0.08 * press });

      tiles.forEach(({ tile, prog, lab, badge, dots, x }, i) => {
        const pop = P(lt, 1.5 + i * 0.08, 2.1 + i * 0.08, E.back);
        put(tile, { y: (1 - pop) * 140, s: Math.max(pop, 0.001), o: pop > 0 ? 1 : 0 });
        put(lab, { y: (1 - pop) * 140, o: pop > 0 ? 1 : 0 });
        prog.style.width = 104 * P(lt, 4.0 + i * 0.1, 5.0 + i * 0.1, E.out) + 'px';
        const kb = P(lt, 4.9 + i * 0.1, 5.3 + i * 0.1, E.back);
        put(badge, { s: Math.max(kb, 0.001), y: -14 * (1 - kb), o: kb > 0 ? 1 : 0 });
        dots.forEach((d, j) => {
          const a = 4.1 + i * 0.1 + j * 0.2;
          const k = P(lt, a, a + 0.8, E.inout);
          const arc = Math.sin(k * Math.PI);
          put(d, { x: lerp(x, 960, k) + (x < 960 ? -1 : 1) * arc * 50, y: lerp(660, 880, k) - arc * 90, r: k * 180, o: k > 0 && k < 1 ? 1 : 0 });
        });
      });
      const n = lt < 6.2 ? 312 * P(lt, 4.2, 5.9, E.out) : lerp(312, 265, P(lt, 6.2, 6.9, E.inout));
      const label = lt < 6.2 ? 'offres trouvées' : 'offres uniques';
      if (label !== lastLab) { nlab.textContent = label; lastLab = label; }
      num.textContent = money(n);
      num.style.color = mix('#f4f1e8', '#ffcd00', P(lt, 6.9, 7.4));
      put(num, { o: P(lt, 4.0, 4.4), s: 1 + 0.04 * Math.sin(P(lt, 6.9, 7.5, E.lin) * Math.PI) });
      put(nlab, { o: P(lt, 4.1, 4.5) });
      const kc = P(lt, 6.0, 6.5, E.back);
      put(chip, { s: Math.max(kc, 0.001), x: (1 - kc) * -60, o: kc > 0 ? 1 : 0 });
      put(koala, { y: -Math.sin(P(lt, 6.9, 7.5, E.lin) * Math.PI) * 60, o: P(lt, 5.8, 6.2) });

      const [cx, cy] = track(lt, [[2.8, 1760, 820], [3.85, 1436, 408], [4.3, 1436, 408], [5.2, 1700, 600]]);
      put(cur.c, { x: cx - 10, y: cy - 5, o: P(lt, 2.8, 3.1) * (1 - P(lt, 5.0, 5.4)) });
      clickAt(cur.rip, lt, 3.9, 1436, 408);
    },
  };
}

// ---------- 3. score ----------

function sceneScore() {
  const root = el(null, 'div', '', { background: '#f4f1e8', perspective: '2600px' });
  const blob = el(root, 'div', 'abs', { left: '1100px', top: '-300px', width: '1000px', height: '1000px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(47,125,91,.26), transparent 65%)' });
  const blob2 = el(root, 'div', 'abs', { left: '-300px', top: '520px', width: '900px', height: '900px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,205,0,.26), transparent 65%)' });
  landscape(root, { ground: 1010 });
  const lines = textBlock(root, [['Chaque offre', '#14281f'], ['a son score,', '#2f7d5b'], ['calculé pour toi.', '#14281f']], 130, 190, 96, 0);
  const sub = el(root, 'div', 'abs', { left: '130px', top: '590px', width: '780px', fontSize: '38px', lineHeight: 1.35, color: '#5d6f65', fontWeight: 500 });
  sub.textContent = 'Compétences, lieu, contrat : ton profil fait le tri pour toi.';

  const card = el(root, 'div', 'abs card', { left: '1020px', top: '110px', width: '780px', height: '860px', zIndex: 5 });
  const av = avatar(card, 'T', 100, 1); av.style.left = '44px'; av.style.top = '44px';
  const tt = el(card, 'div', 'abs disp', { left: '170px', top: '46px', fontSize: '42px', color: '#14281f', whiteSpace: 'nowrap', letterSpacing: '-0.02em' }); tt.textContent = 'Analyste SOC H/F';
  const cc = el(card, 'div', 'abs', { left: '170px', top: '102px', fontSize: '28px', color: '#6a7b72' }); cc.textContent = 'Thales · Lyon';
  const ct = el(card, 'div', 'abs badge', { left: '170px', top: '146px', fontSize: '22px' }); ct.textContent = 'Alternance · 24 mois';
  const rg = ring(card, 150, '#e0a800', 0.36); rg.style.left = '600px'; rg.style.top = '34px';
  el(card, 'div', 'abs', { left: '44px', top: '214px', width: '692px', height: '2px', background: '#e8ebe4' });
  const lab = el(card, 'div', 'abs', { left: '44px', top: '240px', fontSize: '22px', fontWeight: 700, letterSpacing: '0.12em', color: '#7b8a82' }); lab.textContent = 'COMPÉTENCES DEMANDÉES';
  const CH = [['Python', 0], ['Linux', 0], ['Réseaux', 0], ['Wireshark', 0], ['Splunk', 1], ['SIEM', 1], ['ATT&CK', 0], ['Docker', 2]];
  const chips = CH.map(([name, kind], i) => {
    const w = el(card, 'div', 'abs', { left: 44 + (i % 3) * 244 + 'px', top: 292 + Math.floor(i / 3) * 80 + 'px', width: '228px', height: '62px' });
    const mk = (cls, txtc) => { const c = el(w, 'span', 'chip abs ' + cls, { inset: 0, width: '100%', height: '100%', justifyContent: 'center', fontSize: '27px', padding: 0 }); c.textContent = txtc; return c; };
    const base = kind ? mk(kind === 1 ? 'miss' : 'miss', '+ ' + name) : mk('', '✓ ' + name);
    const ok = kind === 1 ? mk('ok', '✓ ' + name) : null;
    return { w, ok, kind };
  });
  const meters = [['Compétences', 0], ['Localisation', 1], ['Contrat', 1]].map(([n, fixed], i) => {
    const y = 560 + i * 62;
    const l = el(card, 'div', 'abs', { left: '44px', top: y + 'px', fontSize: '26px', color: '#5d6f65', fontWeight: 600 }); l.textContent = n;
    el(card, 'div', 'abs', { left: '250px', top: y + 8 + 'px', width: '380px', height: '14px', borderRadius: '7px', background: '#e8ebe4' });
    const f = el(card, 'div', 'abs', { left: '250px', top: y + 8 + 'px', width: '0px', height: '14px', borderRadius: '7px', background: '#2f7d5b' });
    const v = el(card, 'div', 'abs', { left: '650px', top: y + 'px', fontSize: '26px', fontWeight: 700, color: '#14281f' });
    return { f, v, fixed };
  });
  const win = el(card, 'div', 'abs disp', { left: '44px', top: '770px', padding: '16px 34px', borderRadius: '999px', background: '#2f7d5b', color: '#fff', fontSize: '38px', letterSpacing: '-0.01em' });
  win.textContent = 'Excellent match';
  const plus1 = el(root, 'div', 'abs badge', { left: '1380px', top: '560px', zIndex: 8, fontSize: '30px' }); plus1.textContent = '+16 pts';
  const plus2 = el(root, 'div', 'abs badge', { left: '1624px', top: '560px', zIndex: 8, fontSize: '30px' }); plus2.textContent = '+17 pts';
  const koala = place(sprite('pet', 'koala', 190), root, 150, 790);
  const conf = confetti(root, 40, ['#ffcd00', '#2f7d5b', '#7fdcae', '#d6552a', '#6b3fd0']);
  conf.items.forEach((c) => (c.e.style.zIndex = 9));
  const cur = cursor(root); cur.c.style.zIndex = 12;
  const rip2 = mkRip(root);
  const CUR = [[2.2, 1760, 880], [3.2, 1432, 514], [3.55, 1432, 514], [4.6, 1676, 514], [6.0, 1676, 514], [6.7, 1500, 820]];

  return {
    root,
    update(lt) {
      put(blob, { x: Math.sin(lt * 0.5) * 40, y: Math.cos(lt * 0.4) * 30 });
      put(blob2, { x: Math.cos(lt * 0.5) * 40, y: Math.sin(lt * 0.4) * 30 });
      lines(lt, 0.2, 99);
      put(sub, { y: (1 - P(lt, 0.8, 1.5, E.out5)) * 40, o: P(lt, 0.8, 1.4) });
      const cp = P(lt, 0.3, 1.2, E.out5);
      put(card, { y: (1 - cp) * 160 + Math.sin(lt * 1.1) * 4 * cp, s: lerp(0.94, 1, cp), o: cp, ry: lerp(-6, 0, cp), r: 0 });

      const v = lt < 3.3 ? 58 * P(lt, 0.8, 1.8, E.out) : lt < 4.7 ? lerp(58, 74, P(lt, 3.35, 4.0, E.out)) : lerp(74, 91, P(lt, 4.75, 5.5, E.out));
      rg.setScore(v, mix('#e0a800', '#2f7d5b', clamp((v - 56) / 18)));
      chips.forEach((c, i) => {
        const pp = P(lt, 1.2 + i * 0.07, 1.7 + i * 0.07, E.back);
        const flip = c.kind === 1 ? P(lt, i === 4 ? 3.3 : 4.7, (i === 4 ? 3.3 : 4.7) + 0.2) : 0;
        const bump = c.kind === 1 ? Math.sin(flip * Math.PI) * 0.14 : 0;
        put(c.w, { s: Math.max(pp, 0.001) * (1 + bump), o: pp > 0 ? 1 : 0 });
        if (c.ok) c.ok.style.opacity = flip;
      });
      const comp = Math.min(98, v + 5);
      meters.forEach((m, i) => {
        const pct = m.fixed ? 100 * P(lt, 1.6 + i * 0.1, 2.4 + i * 0.1, E.out) : comp * P(lt, 0.8, 1.8, E.out);
        m.f.style.width = 3.8 * pct + 'px';
        m.v.textContent = Math.round(pct) + ' %';
      });
      const kw = P(lt, 5.5, 6.0, E.back);
      put(win, { s: Math.max(kw, 0.001), x: (1 - kw) * -40, o: kw > 0 ? 1 : 0 });
      put(plus1, { y: -90 * P(lt, 3.35, 4.2, E.out), o: P(lt, 3.35, 3.5) * (1 - P(lt, 3.9, 4.3)) });
      put(plus2, { y: -90 * P(lt, 4.75, 5.6, E.out), o: P(lt, 4.75, 4.9) * (1 - P(lt, 5.3, 5.7)) });
      conf.update(lt - 5.5, 1695, 219);
      put(koala, { y: -Math.sin(P(lt, 5.5, 6.2, E.lin) * Math.PI) * 80, o: P(lt, 0.9, 1.3) });

      const [cx, cy] = track(lt, CUR);
      put(cur.c, { x: cx - 10, y: cy - 5, o: P(lt, 2.2, 2.5) * (1 - P(lt, 6.4, 6.8)) });
      clickAt(cur.rip, lt, 3.3, 1432, 514);
      clickAt(rip2, lt, 4.7, 1676, 514);
    },
  };
}

// ---------- 4. the CV ----------

// a sheet of paper: the CV rendered by the app's own templates, inside an iframe
function pageEl(parent, htmlStr) {
  const w = el(parent, 'div', 'abs', { left: '563px', top: '-21px', width: '794px', height: '1123px', background: '#fff', borderRadius: '6px', boxShadow: '0 50px 100px -20px rgba(0,0,0,.65)', overflow: 'hidden' });
  const f = el(w, 'iframe', '', { width: '794px', height: '1123px', border: '0', display: 'block', pointerEvents: 'none' });
  f.setAttribute('scrolling', 'no');
  f.srcdoc = htmlStr;
  return w;
}

function sceneCv() {
  const root = el(null, 'div', '', { background: 'radial-gradient(110% 90% at 70% 40%, #17331f 0%, #0b1511 70%)', perspective: '2600px' });
  el(root, 'div', 'abs', { inset: 0, backgroundImage: 'radial-gradient(rgba(127,220,174,.11) 3px, transparent 3.5px)', backgroundSize: '48px 48px' });
  const KEYS = ['classique', 'atlantique', 'mercure', 'safran', 'ruban', 'argent'];
  const NAMES = ['Classique', 'Atlantique', 'Mercure', 'Safran', 'Ruban', 'Argent'];
  const ACC = ['#2f7d5b', '#1f4fd1', '#b24a1d', '#0f6b73', '#7a3fb0', '#b0306a'];
  // the sheets (centred on the stage, moved with transforms)
  const fan = KEYS.map((k) => pageEl(root, ASSETS.cv[k]));
  const acc = ACC.map((c, i) => (i === 0 ? fan[1] : pageEl(root, ASSETS.cvAccent[c])));
  const tags = NAMES.map((n) => { const t = el(root, 'div', 'abs disp', { left: '-100px', top: '0px', width: '200px', textAlign: 'center', fontSize: '34px', fontWeight: 700, color: '#cfe3d6', letterSpacing: 0 }); t.textContent = n; return t; });

  // titles
  const h1 = centerMask(root, '21 modèles.', 56, 118, '#f4f1e8');
  const h2 = centerMask(root, 'Ton CV, sur mesure.', 196, 64, '#7fdcae');
  const blockA = textBlock(root, [['Tes couleurs,', '#f4f1e8'], ['partout.', '#7fdcae']], 130, 190, 100, 4);
  const subA = el(root, 'div', 'abs', { left: '130px', top: '450px', width: '760px', fontSize: '36px', color: '#9fc1af', fontWeight: 500 });
  subA.textContent = 'Un accent, et tout le CV suit.';
  const blockB = textBlock(root, [['Un autre style,', '#f4f1e8'], ['en un clic.', '#7fdcae']], 130, 190, 100, 4);

  const sw = ACC.map((c, i) => el(root, 'div', 'abs', { left: 130 + i * 110 + 'px', top: '560px', width: '84px', height: '84px', borderRadius: '50%', background: c, border: '4px solid rgba(255,255,255,.25)' }));
  const pills = ['Atlantique', 'Mercure', 'Safran', 'Argent'].map((n, j) => {
    const p = el(root, 'div', 'abs disp', { left: '130px', top: 470 + j * 84 + 'px', width: '360px', height: '66px', borderRadius: '33px', display: 'flex', alignItems: 'center', padding: '0 30px', fontSize: '30px', letterSpacing: 0, fontWeight: 700, whiteSpace: 'nowrap' });
    p.textContent = n;
    return p;
  });
  const pdf = el(root, 'div', 'abs badge', { left: '130px', top: '850px', fontSize: '32px', padding: '14px 30px' });
  pdf.textContent = 'PDF · compatible ATS';
  const cur = cursor(root); cur.c.style.zIndex = 99;
  const ripple = mkRip(root); ripple.style.zIndex = 98;
  const picks = [[5.5, 1], [6.2, 2], [6.9, 4], [7.6, 5], [8.2, 0]];
  const swXY = (i) => [130 + i * 110 + 42, 602];
  const flips = [8.7, 9.6, 10.5]; // → mercure, safran, argent
  const seqPages = [acc[0], fan[2], fan[3], fan[5]];

  const fanPose = (i, lt) => {
    const d = i - 2.5;
    const e = P(lt, 0.5 + i * 0.12, 1.5 + i * 0.12, E.out5);
    return { x: d * 270, y: 90 + d * d * 12 + (1 - e) * 900 + Math.sin(lt * 1.3 + i) * 8 * e, r: d * 6 + (1 - e) * 24, s: 0.5, o: e };
  };

  return {
    root,
    update(lt) {
      // titles
      put(h1, { y: (1 - P(lt, 0.15, 0.95, E.out5)) * 170 - P(lt, 3.7, 4.3, E.in) * 170 });
      put(h2, { y: (1 - P(lt, 0.35, 1.15, E.out5)) * 120 - P(lt, 3.75, 4.3, E.in) * 150 });
      blockA(lt, 4.5, 8.4);
      blockB(lt, 8.6, 99);
      put(subA, { y: (1 - P(lt, 4.8, 5.4, E.out5)) * 40 - P(lt, 8.3, 8.8) * 30, o: P(lt, 4.8, 5.3) * (1 - P(lt, 8.3, 8.7)) });

      const big = P(lt, 4.0, 5.0, E.inout);
      let curI = 0, prevI = 0, tCur = -9, order = 0;
      picks.forEach(([t, k], n) => { if (lt >= t) { prevI = curI; curI = k; tCur = t; order = n + 1; } });
      const fade = P(lt, tCur, tCur + 0.22, E.lin);
      const flipOut0 = P(lt, flips[0], flips[0] + 0.25, E.in);
      fan.forEach((p, i) => {
        const f = fanPose(i, lt);
        let pose = { x: f.x, y: f.y, r: f.r, s: f.s, o: f.o, ry: 0 };
        let z = i + 1;
        if (i === 1 && lt >= 4.0) {
          // the Atlantique sheet comes forward, becomes the "green" colour variant, then flips to other models
          pose = { x: lerp(f.x, 370, big), y: lerp(f.y, 0, big), r: lerp(f.r, 0, big), s: lerp(0.5, 0.88, big), o: 1, ry: 0 };
          if (lt >= 5.0) {
            pose.ry = -flipOut0 * 90;
            pose.o = lt < flips[0] + 0.25 ? (curI === 0 && order > 0 ? fade : 1) : 0;
            z = curI === 0 ? 60 + order : 50;
          }
        } else if (i !== 1 && lt >= 4.0) {
          const d = P(lt, 4.0, 4.8, E.in);
          pose.y = f.y + d * 900; pose.r = f.r + (i < 2.5 ? -1 : 1) * d * 30; pose.o = 1 - d;
        }
        const j = seqPages.indexOf(p);
        if (j > 0 && lt >= 8.0) {
          const t = flips[j - 1];
          const inK = P(lt, t + 0.25, t + 0.5, E.out);
          const outK = j < seqPages.length - 1 ? P(lt, flips[j], flips[j] + 0.25, E.in) : 0;
          const vis = lt >= t + 0.25 && (j === seqPages.length - 1 || lt < flips[j] + 0.25);
          pose = { x: 370, y: 0, r: 0, s: 0.88, o: vis ? 1 : 0, ry: (1 - inK) * 90 - outK * 90 };
          z = 70;
        }
        p.style.zIndex = z;
        put(p, pose);
      });
      // the other colour variants sit on the big sheet; the newest one fades in on top of the previous
      acc.forEach((p, k) => {
        if (k === 0) return;
        let o = 0;
        if (lt >= 5.0 && lt < 8.7) {
          if (k === curI) o = fade;
          else if (k === prevI && lt < tCur + 0.22) o = 1;
        }
        p.style.zIndex = k === curI ? 60 + order : 55;
        put(p, { x: 370, y: 0, s: 0.88, o });
      });

      // labels under the fan
      tags.forEach((t, i) => {
        const f = fanPose(i, lt);
        put(t, { x: 960 + f.x, y: 540 + f.y + 330, o: P(lt, 1.8 + i * 0.1, 2.3 + i * 0.1) * (1 - P(lt, 3.5, 3.9)) });
      });

      // swatches, template pills
      sw.forEach((e, i) => {
        const k = P(lt, 4.6 + i * 0.06, 5.1 + i * 0.06, E.back);
        const on = lt >= 5.5 ? curI === i : i === 0;
        put(e, { s: Math.max(k, 0.001) * (on ? 1.14 : 1), o: (k > 0 ? 1 : 0) * (1 - P(lt, 8.3, 8.7)) });
        const sh = on && k > 0.9 ? '0 0 0 6px #0b1511, 0 0 0 10px #f4f1e8' : 'none';
        if (e.style.boxShadow !== sh) e.style.boxShadow = sh;
      });
      const active = flips.filter((t) => lt >= t + 0.25).length;
      pills.forEach((p, j) => {
        const k = P(lt, 8.9 + j * 0.08, 9.4 + j * 0.08, E.out5);
        put(p, { x: (1 - k) * -120, o: k });
        const on = j === active;
        p.style.background = on ? '#ffcd00' : 'rgba(255,255,255,.1)';
        p.style.color = on ? '#2a2438' : '#cfe3d6';
      });
      const kp = P(lt, 10.9, 11.4, E.back);
      put(pdf, { s: Math.max(kp, 0.001), o: kp > 0 ? 1 : 0 });

      // cursor
      const pts = [[5.0, 900, 780]];
      picks.forEach(([t, k]) => { const [x, y] = swXY(k); pts.push([t - 0.05, x, y]); pts.push([t + 0.1, x, y]); });
      pts.push([9.2, 700, 940]);
      const [cx, cy] = track(lt, pts);
      put(cur.c, { x: cx - 10, y: cy - 5, o: P(lt, 5.0, 5.3) * (1 - P(lt, 8.7, 9.2)) });
      let rk = null;
      picks.forEach((pk) => { if (lt >= pk[0]) rk = pk; });
      if (rk) { const [x, y] = swXY(rk[1]); clickAt(ripple, lt, rk[0], x, y); } else put(ripple, { o: 0 });
    },
  };
}

// ---------- 5. the cover letter ----------

function sceneLetter() {
  const root = el(null, 'div', '', { background: '#f4f1e8', perspective: '2600px' });
  const blob = el(root, 'div', 'abs', { left: '900px', top: '-300px', width: '1100px', height: '1100px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,205,0,.30), transparent 65%)' });
  const blob2 = el(root, 'div', 'abs', { left: '-300px', top: '500px', width: '900px', height: '900px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(47,125,91,.24), transparent 65%)' });
  el(root, 'div', 'abs', { inset: 0, backgroundImage: 'radial-gradient(rgba(20,40,31,.10) 3px, transparent 3.5px)', backgroundSize: '48px 48px', opacity: 0.6 });
  const lines = textBlock(root, [['Et la lettre ?', '#14281f'], ['Déjà écrite.', '#2f7d5b']], 130, 150, 112, 0);
  const sub = el(root, 'div', 'abs', { left: '130px', top: '440px', width: '760px', fontSize: '40px', lineHeight: 1.3, color: '#5d6f65', fontWeight: 500 });
  sub.textContent = 'À partir de ton profil et de l’offre, adressée à la bonne personne.';
  const rc = el(root, 'div', 'abs card', { left: '130px', top: '620px', width: '700px', height: '150px' });
  const rav = avatar(rc, 'T', 90, 1); rav.style.left = '30px'; rav.style.top = '30px';
  const rn = el(rc, 'div', 'abs', { left: '144px', top: '34px', fontSize: '34px', fontWeight: 700, color: '#14281f' }); rn.textContent = 'Mme Dupont';
  const rr = el(rc, 'div', 'abs', { left: '144px', top: '84px', fontSize: '26px', color: '#6a7b72' }); rr.textContent = 'Responsable recrutement · Thales';
  const steps = ['Accroche', 'Parcours', 'Motivation'].map((n, i) => {
    const e = el(root, 'div', 'abs chip', { left: 130 + i * 232 + 'px', top: '830px', width: '216px', justifyContent: 'center', fontSize: '28px', background: '#fff', boxShadow: '0 8px 24px -10px rgba(10,40,25,.3)' });
    e.textContent = n;
    return e;
  });
  // the sheet, revealed from the top like it is being written
  const page = pageEl(root, ASSETS.letter);
  const clip = page;
  const scan = el(root, 'div', 'abs', { left: '1125px', top: 0, width: '690px', height: '6px', borderRadius: '3px', background: '#ffcd00', boxShadow: '0 0 28px 6px rgba(255,205,0,.7)', zIndex: 30 });
  const stamp = el(root, 'div', 'abs disp', { left: '1560px', top: '70px', padding: '14px 30px', border: '6px solid #2f7d5b', borderRadius: '18px', color: '#2f7d5b', fontSize: '48px', background: 'rgba(244,241,232,.9)', zIndex: 31, letterSpacing: 0 });
  stamp.textContent = 'PDF prêt';
  const pet = place(sprite('pet', 'chat', 170), root, 820, 850);

  return {
    root,
    update(lt) {
      put(blob, { x: Math.sin(lt * 0.5) * 40, y: Math.cos(lt * 0.4) * 30 });
      put(blob2, { x: Math.cos(lt * 0.5) * 40, y: Math.sin(lt * 0.4) * 30 });
      lines(lt, 0.2, 99);
      put(sub, { y: (1 - P(lt, 0.7, 1.4, E.out5)) * 40, o: P(lt, 0.7, 1.3) });
      const rp = P(lt, 0.9, 1.7, E.out5);
      put(rc, { x: (1 - rp) * -140, o: rp });
      const pp = P(lt, 0.2, 1.2, E.out5);
      const k = P(lt, 1.0, 4.2, E.lin);
      const ky = E.inout(k);
      put(page, { x: 510, y: (1 - pp) * 200 - 12, s: 0.87, o: pp, ry: lerp(-16, -4, P(lt, 0.2, 6, E.lin)), rx: lerp(6, 0, pp) });
      page.style.clipPath = `inset(0 0 ${(100 - ky * 100).toFixed(2)}% 0)`;
      put(scan, { y: 36 + ky * 977, o: k > 0 && k < 1 ? 1 : 0 });
      steps.forEach((e, i) => {
        const on = ky > 0.18 + i * 0.3;
        const pp2 = P(lt, 1.2 + i * 0.1, 1.7 + i * 0.1, E.back);
        put(e, { s: Math.max(pp2, 0.001), o: pp2 > 0 ? 1 : 0 });
        const bg = on ? '#2f7d5b' : '#fff', fg = on ? '#fff' : '#1d5e3a';
        if (e.style.background !== bg && e.dataset.on !== String(on)) { e.dataset.on = String(on); e.style.background = bg; e.style.color = fg; e.textContent = (on ? '✓ ' : '') + ['Accroche', 'Parcours', 'Motivation'][i]; }
      });
      const ks = P(lt, 4.6, 5.1, E.spring);
      put(stamp, { s: Math.max(ks, 0.001) * 1.0, r: -8, o: P(lt, 4.6, 4.8) });
      put(pet, { y: -Math.max(0, Math.sin(((lt * 1.2) % 1) * Math.PI)) * 30 * P(lt, 4.4, 4.7), o: P(lt, 3.8, 4.2) });
    },
  };
}

// ---------- 6. the board ----------

function sceneBoard() {
  const root = el(null, 'div', '', { background: 'radial-gradient(110% 90% at 30% 20%, #17331f 0%, #0b1511 70%)' });
  el(root, 'div', 'abs', { inset: 0, backgroundImage: 'radial-gradient(rgba(127,220,174,.11) 3px, transparent 3.5px)', backgroundSize: '48px 48px' });
  const lines = textBlock(root, [['Suis tout.', '#f4f1e8'], ['Rien ne se perd.', '#7fdcae']], 118, 36, 92, 0);
  const COLS = [['À traiter', '#9a9bb3', 'bush', 92], ['Envoyées', '#4aa883', 'flower', 100], ['Entretiens', '#e0a800', 'mushroom', 96], ['Offres reçues', '#14b87d', 'tree', 150]];
  const colX = (c) => 118 + c * 428;
  const cols = COLS.map(([title, color, deco, h], c) => {
    const col = el(root, 'div', 'abs', { left: colX(c) + 'px', top: '290px', width: '400px', height: '660px', borderRadius: '30px', background: 'rgba(255,255,255,.06)', border: '2px solid rgba(255,255,255,.08)' });
    el(col, 'div', 'abs', { left: '28px', top: '38px', width: '16px', height: '16px', borderRadius: '50%', background: color });
    const t = el(col, 'div', 'abs', { left: '58px', top: '26px', fontSize: '34px', fontWeight: 700, color: '#f4f1e8' }); t.textContent = title;
    const n = el(col, 'div', 'abs', { right: '28px', top: '28px', minWidth: '46px', height: '42px', padding: '0 14px', borderRadius: '21px', background: 'rgba(255,255,255,.12)', color: '#cfe3d6', fontSize: '26px', fontWeight: 700, display: 'grid', placeItems: 'center' });
    const d = sprite('scenery', deco, h);
    place(d, col, 200 - parseFloat(d.style.width) / 2, 300);
    return { col, n, d };
  });
  const DATA = [['Analyste SOC', 'Thales', 91, 1], ['Dév. web', 'Doctolib', 76, 3], ['Data Analyst', 'Alan', 84, 2]];
  const slotXY = (c, sl) => [colX(c) + 20, 290 + 96 + sl * 176];
  // each card: waypoints [time, column, slot]
  const WP = [
    [[0, 0, 0], [1.4, 0, 0], [2.3, 1, 0], [2.9, 1, 0], [3.8, 2, 0], [4.4, 2, 0], [5.3, 3, 0]],
    [[0, 0, 1], [1.8, 0, 1], [2.3, 0, 0]],
    [[0, 0, 2], [1.8, 0, 2], [2.3, 0, 1]],
  ];
  const cards = DATA.map(([t, c, sc, av]) => {
    const e = el(root, 'div', 'abs card', { left: 0, top: 0, width: '360px', height: '156px', borderRadius: '24px', zIndex: 5 });
    avatar(e, c[0], 80, av).style.cssText += ';left:22px;top:38px';
    const tt = el(e, 'div', 'abs', { left: '118px', top: '40px', fontSize: '25px', fontWeight: 700, color: '#14281f', whiteSpace: 'nowrap' }); tt.textContent = t;
    const cc = el(e, 'div', 'abs', { left: '118px', top: '84px', fontSize: '23px', color: '#6a7b72' }); cc.textContent = c + ' · Lyon';
    const r = ring(e, 62, sc >= 80 ? '#2f7d5b' : '#e0a800', 0.34); r.style.left = '288px'; r.style.top = '46px'; r.setScore(sc);
    return e;
  });
  const wow = el(root, 'div', 'abs disp', { left: colX(3) + 70 + 'px', top: '690px', padding: '14px 28px', borderRadius: '999px', background: '#ffcd00', color: '#2a2438', fontSize: '34px', letterSpacing: 0, zIndex: 12 });
  wow.textContent = 'Offre reçue !';
  const koala = place(sprite('pet', 'koala', 150), root, colX(3) + 125, 770);
  koala.style.zIndex = 11;
  const conf = confetti(root, 44, ['#ffcd00', '#2f7d5b', '#7fdcae', '#d6552a', '#6b3fd0']);
  conf.items.forEach((c) => (c.e.style.zIndex = 15));
  const cur = cursor(root); cur.c.style.zIndex = 20;
  const cache = [-1, -1, -1, -1];

  const state = (wps, lt) => {
    // returns [x, y, from-col, to-col, progress]
    for (let i = 1; i < wps.length; i++) {
      if (lt <= wps[i][0]) {
        const k = clamp((lt - wps[i - 1][0]) / (wps[i][0] - wps[i - 1][0]));
        const e = E.inout(k);
        const [x0, y0] = slotXY(wps[i - 1][1], wps[i - 1][2]);
        const [x1, y1] = slotXY(wps[i][1], wps[i][2]);
        return { x: lerp(x0, x1, e), y: lerp(y0, y1, e), a: wps[i - 1][1], b: wps[i][1], k, moving: wps[i][1] !== wps[i - 1][1] && k > 0 && k < 1, dx: x1 - x0 };
      }
    }
    const l = wps[wps.length - 1];
    const [x, y] = slotXY(l[1], l[2]);
    return { x, y, a: l[1], b: l[1], k: 1, moving: false, dx: 0 };
  };

  return {
    root,
    update(lt) {
      lines(lt, 0.15, 99);
      cols.forEach((c, i) => put(c.col, { y: (1 - P(lt, 0.3 + i * 0.1, 1.1 + i * 0.1, E.out5)) * 140, o: P(lt, 0.3 + i * 0.1, 0.8 + i * 0.1) }));
      const counts = [0, 0, 0, 0];
      const st = cards.map((card, i) => {
        const s = state(WP[i], lt);
        const enter = P(lt, 0.7 + i * 0.15, 1.3 + i * 0.15, E.out5);
        counts[s.k < 0.5 ? s.a : s.b]++;
        const tilt = s.moving ? Math.sin(s.k * Math.PI) * (s.dx > 0 ? 5 : -5) : 0;
        const lift = s.moving ? Math.sin(s.k * Math.PI) : 0;
        card.style.zIndex = s.moving ? 9 : 5;
        card.style.boxShadow = lift > 0.05 ? `0 ${20 + lift * 40}px ${50 + lift * 40}px -12px rgba(0,0,0,${0.35 + lift * 0.25})` : '';
        put(card, { x: s.x, y: s.y + (1 - enter) * 70, r: tilt, s: 1 + lift * 0.05, o: enter });
        return s;
      });
      cols.forEach((c, i) => {
        if (cache[i] !== counts[i]) { cache[i] = counts[i]; c.n.textContent = counts[i]; }
        const empty = counts[i] === 0 ? 1 : 0;
        put(c.d, { o: empty * P(lt, 0.9, 1.4), s: 1 });
      });
      const a = st[0];
      const [cx, cy] = track(lt, [[0.9, 1750, 160], [1.35, a.x + 190, a.y + 80]]);
      const follow = lt >= 1.35;
      const exit = P(lt, 5.8, 6.4, E.inout);
      const px = follow ? a.x + 190 : cx, py = follow ? a.y + 80 : cy;
      put(cur.c, { x: lerp(px, 1740, exit) - 10, y: lerp(py, 940, exit) - 5, o: P(lt, 0.9, 1.2) * (1 - P(lt, 6.3, 6.7)) });
      conf.update(lt - 5.3, a.x + 180, a.y + 70);
      const kw = P(lt, 5.4, 5.9, E.back);
      put(wow, { s: Math.max(kw, 0.001), y: (1 - kw) * 30, o: kw > 0 ? 1 : 0 });
      put(koala, { y: -Math.max(0, Math.sin(P(lt, 5.5, 6.3, E.lin) * Math.PI * 2)) * 40, o: P(lt, 5.4, 5.7) });
    },
  };
}

// ---------- 7. the pets ----------

function scenePets() {
  const root = el(null, 'div', '', { background: '#f4f1e8' });
  const blob = el(root, 'div', 'abs', { left: '1000px', top: '-400px', width: '1100px', height: '1100px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,205,0,.34), transparent 65%)' });
  const blob2 = el(root, 'div', 'abs', { left: '-300px', top: '300px', width: '900px', height: '900px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(47,125,91,.22), transparent 65%)' });
  const clouds = [[200, 420, 120], [1300, 380, 150], [800, 500, 100]].map(([x, y, h]) => place(sprite('scenery', 'cloud', h), root, x, y));
  landscape(root, { ground: 880 });
  const t1 = centerMask(root, 'Un compagnon', 70, 112, '#14281f');
  const t2 = centerMask(root, 'qui veille.', 192, 112, '#2f7d5b');
  const sub = el(root, 'div', 'abs', { left: 0, top: '360px', width: '1920px', textAlign: 'center', fontSize: '44px', color: '#5d6f65', fontWeight: 500 });
  sub.textContent = 'Il saute, il dort, il t’encourage.';
  const trees = [['tree', 40, 300], ['gum', 1760, 330], ['bush', 1620, 90], ['flower', 20, 80]].map(([n, x, h], i) => { const s = place(sprite('scenery', n, h), root, x, 890 - h + 6); s.style.transformOrigin = '50% 100%'; return { s, i }; });
  const IDS = ['koala', 'chat', 'chien', 'renard', 'lapin', 'ours', 'grenouille', 'pingouin', 'hibou'];
  const NAMES = ['Koala', 'Chat', 'Chien', 'Renard', 'Lapin', 'Ours', 'Grenouille', 'Pingouin', 'Hibou'];
  const pets = IDS.map((id, i) => {
    const sl = id === 'hibou';
    const s = place(sprite('pet', id, 190, { sleep: sl }), root, 105 + i * 190, 712);
    const l = el(root, 'div', 'abs', { left: 105 + i * 190 - 10 + 'px', top: '912px', width: '210px', textAlign: 'center', fontSize: '28px', fontWeight: 700, color: '#fff', letterSpacing: 0 });
    l.textContent = NAMES[i];
    return { s, l, sl };
  });
  const zs = [0, 1].map((j) => { const z = el(root, 'div', 'abs disp', { left: 105 + 8 * 190 + 150 + 'px', top: '720px', fontSize: 40 - j * 10 + 'px', color: '#14281f', letterSpacing: 0 }); z.textContent = 'z'; return z; });
  const stars = Array.from({ length: 6 }, (_, i) => place(sprite('scenery', 'star', 44), root, 105 + 190 + 75, 700));
  const bubble = el(root, 'div', 'abs disp', { left: '230px', top: '590px', padding: '14px 28px', borderRadius: '999px 999px 999px 8px', background: '#fff', color: '#14281f', fontSize: '40px', boxShadow: '0 16px 40px -12px rgba(10,40,25,.4)', letterSpacing: 0, zIndex: 8 });
  bubble.textContent = 'Miaou !';
  const cur = cursor(root);

  return {
    root,
    update(lt) {
      put(blob, { x: Math.sin(lt * 0.5) * 40, y: Math.cos(lt * 0.4) * 30 });
      put(blob2, { x: Math.cos(lt * 0.5) * 40, y: Math.sin(lt * 0.4) * 30 });
      clouds.forEach((c, i) => put(c, { x: ((lt * (14 + i * 6) + i * 500) % 2400) - 300 - [200, 1300, 800][i] + [200, 1300, 800][i], o: 0.9 }));
      put(t1, { y: (1 - P(lt, 0.1, 0.9, E.out5)) * 170 });
      put(t2, { y: (1 - P(lt, 0.3, 1.1, E.out5)) * 170 });
      put(sub, { y: (1 - P(lt, 0.8, 1.5, E.out5)) * 40, o: P(lt, 0.8, 1.4) });
      trees.forEach(({ s, i }) => { const k = P(lt, 0.2 + i * 0.12, 0.9 + i * 0.12, E.back); put(s, { sy: Math.max(k, 0.001), sx: lerp(0.6, 1, k), o: k > 0 ? 1 : 0 }); });
      const jump = P(lt, 3.55, 4.4, E.lin);
      pets.forEach(({ s, l, sl }, i) => {
        const from = i % 2 ? 2200 : -400;
        const a = 0.3 + i * 0.16;
        const k = P(lt, a, a + 1.0, E.out5);
        const hop = k < 1 ? Math.abs(Math.sin(k * Math.PI * 5)) * 60 * (1 - k) : 0;
        let y = -hop;
        if (i === 1) y -= Math.sin(jump * Math.PI) * 150 + (jump > 0 && jump < 1 ? Math.abs(Math.sin(jump * Math.PI * 2)) * 30 : 0);
        const x = (1 - k) * (from - (105 + i * 190));
        put(s, { x, y, sx: k < 1 && i % 2 ? -1 : 1, o: k > 0 ? 1 : 0 });
        put(l, { y: (1 - k) * 30, o: P(lt, a + 0.7, a + 1.2) });
      });
      zs.forEach((z, j) => { const q = (lt * 0.5 + j * 0.5) % 1; put(z, { x: q * 40, y: -q * 70, o: P(lt, 2.0, 2.5) * Math.sin(q * Math.PI), r: q * 20 }); });
      stars.forEach((st, i) => {
        const q = P(lt, 3.7, 4.5, E.out);
        const ang = (i / stars.length) * Math.PI * 2 + 0.4;
        put(st, { x: Math.cos(ang) * 130 * q, y: Math.sin(ang) * 110 * q - 60, s: Math.max(q, 0.001) * (1 - q * 0.4), o: q > 0 && q < 1 ? 1 - q * q : 0, r: q * 90 });
      });
      const kb = P(lt, 3.7, 4.0, E.back);
      put(bubble, { s: Math.max(kb, 0.001), y: -Math.sin(jump * Math.PI) * 150, o: kb > 0 ? 1 - P(lt, 4.5, 4.8) : 0 });
      const [cx, cy] = track(lt, [[2.6, 1500, 700], [3.45, 105 + 190 + 130, 790], [4.3, 105 + 190 + 130, 790], [5.0, 700, 600]]);
      put(cur.c, { x: cx - 10, y: cy - 5, o: P(lt, 2.6, 2.9) * (1 - P(lt, 4.7, 5.0)) });
      clickAt(cur.rip, lt, 3.5, 105 + 190 + 130, 790);
    },
  };
}

// ---------- 8. the real app ----------

function sceneApp() {
  const root = el(null, 'div', '', { background: 'radial-gradient(90% 80% at 50% 55%, #1c3a29 0%, #0b1511 72%)', perspective: '2800px' });
  el(root, 'div', 'abs', { inset: 0, backgroundImage: 'radial-gradient(rgba(127,220,174,.11) 3px, transparent 3.5px)', backgroundSize: '48px 48px' });
  const heads = [['Aujourd’hui', 0.3, 2.3], ['Offres', 2.6, 4.4], ['Suivi', 4.7, 5.7], ['Mode sombre', 5.9, 99]].map(([t, a, b], i) => ({ e: centerMask(root, t, 44, 92, i === 3 ? '#ffcd00' : '#f4f1e8'), a, b }));
  const lap = el(root, 'div', 'abs', { left: '300px', top: '215px', width: '1320px', height: '804px' });
  const lid = el(lap, 'div', 'abs', { left: 0, top: 0, width: '1320px', height: '776px', borderRadius: '30px 30px 8px 8px', background: '#0a0f0d', border: '3px solid #2c3a33', boxShadow: '0 60px 120px -20px rgba(0,0,0,.7)' });
  const scr = el(lid, 'div', 'abs', { left: '20px', top: '20px', width: '1280px', height: '753px', borderRadius: '10px', overflow: 'hidden', background: '#111' });
  const base = el(lap, 'div', 'abs', { left: '-90px', top: '774px', width: '1500px', height: '28px', borderRadius: '0 0 30px 30px', background: 'linear-gradient(#d3d9d5, #9aa39e)', boxShadow: '0 30px 60px -10px rgba(0,0,0,.6)' });
  el(base, 'div', 'abs', { left: '640px', top: 0, width: '220px', height: '10px', borderRadius: '0 0 12px 12px', background: '#7f8985' });
  const mkImg = (k) => { const i = el(scr, 'img', 'abs', { left: 0, top: 0, width: '1280px', height: '753px', objectFit: 'cover' }); i.src = ASSETS.shots[k]; return i; };
  const imgs = [mkImg('accueil-clair'), mkImg('offres-clair'), mkImg('suivi-clair')];
  const dark = mkImg('suivi-sombre');
  const SPAN = [[0, 2.5], [2.5, 4.6], [4.6, 99]];
  const koala = place(sprite('pet', 'koala', 150), lap, 1060, -138);
  const chat = place(sprite('pet', 'chat', 130), lap, 120, -118);
  const toggle = el(scr, 'div', 'abs', { left: '1190px', top: '14px', width: '56px', height: '56px', borderRadius: '50%', border: '5px solid #ffcd00', opacity: 0 });

  return {
    root,
    update(lt) {
      heads.forEach(({ e, a, b }) => put(e, { y: (1 - P(lt, a, a + 0.7, E.out5)) * 150 - P(lt, b, b + 0.5, E.in) * 150 }));
      const ent = P(lt, 0.0, 1.3, E.out5);
      const zoom = 1 + 0.07 * P(lt, 6.3, 7.0, E.inout);
      put(lap, { y: (1 - ent) * 320 + Math.sin(lt * 0.9) * 6, s: lerp(0.78, 1, ent) * zoom, ry: (1 - ent) * 26 + Math.sin(lt * 0.5) * 1.2, rx: (1 - ent) * 10, o: P(lt, 0, 0.3) });
      imgs.forEach((im, i) => {
        const [a, b] = SPAN[i];
        const inK = i === 0 ? 1 : P(lt, a, a + 0.75, E.out5);
        const outK = P(lt, b, b + 0.75, E.out5);
        const vis = inK > 0 && outK < 1;
        im.style.display = vis ? 'block' : 'none';
        const kb = 1 + 0.05 * P(lt, a, b < 90 ? b + 0.6 : 7, E.lin);
        put(im, { x: (1 - inK) * 1280 - outK * 420, s: kb });
      });
      const r = P(lt, 5.9, 6.8, E.inout) * 1500;
      dark.style.display = r > 1 ? 'block' : 'none';
      dark.style.clipPath = `circle(${r.toFixed(0)}px at 1218px 42px)`;
      put(toggle, { s: 1 + 0.5 * P(lt, 5.7, 6.3), o: P(lt, 5.5, 5.7) * (1 - P(lt, 6.1, 6.5)) });
      put(koala, { y: -Math.max(0, Math.sin(((lt * 0.9) % 1) * Math.PI)) * 30, o: P(lt, 0.9, 1.3) });
      put(chat, { y: -Math.max(0, Math.sin(((lt * 0.9 + 0.5) % 1) * Math.PI)) * 24, o: P(lt, 1.0, 1.4) });
    },
  };
}

// ---------- 9. outro ----------

function sceneOutro() {
  const root = el(null, 'div', '', { background: 'radial-gradient(120% 90% at 50% 30%, #17331f 0%, #0b1511 70%)' });
  for (let i = 0; i < 60; i++) {
    const s = el(root, 'div', 'abs tw', { left: rnd() * 1880 + 'px', top: rnd() * 700 + 'px', width: '8px', height: '8px', background: rnd() < 0.3 ? '#ffcd00' : '#7fdcae', opacity: 0.5 });
    s.style.setProperty('--d', rnd() * 2.6 + 's');
  }
  landscape(root, { ground: 960, dark: true });
  const trees = [['gum', 60, 380], ['tree', 330, 280], ['bush', 600, 90], ['mushroom', 1330, 70], ['tree', 1500, 300], ['gum', 1740, 400], ['flower', 1250, 80]].map(([n, x, h], i) => { const s = place(sprite('scenery', n, h), root, x, 970 - h + 6); s.style.transformOrigin = '50% 100%'; return { s, i }; });
  const logo = el(root, 'div', 'abs', { left: '845px', top: '50px', width: '230px', height: '230px' });
  logo.innerHTML = ASSETS.logoSvg.replace('<svg ', '<svg width="230" height="230" style="display:block;filter:drop-shadow(0 26px 36px rgba(0,0,0,.55))" ');
  const S = 16, word = pixelWord(root, 'MITADY', (1920 - (35 * S)) / 2, 315, S, '#f4f1e8', '#ffcd00');
  word.forEach((p) => { p.d = rnd() * 0.5 + p.col * 0.01; });
  const tag = centerMask(root, 'Cherche un poste sans t’épuiser.', 465, 66, '#cfe3d6');
  const term = el(root, 'div', 'abs', { left: '560px', top: '590px', width: '800px', height: '96px', borderRadius: '24px', background: 'rgba(255,255,255,.07)', border: '2px solid rgba(127,220,174,.35)', fontFamily: "'SF Mono', Menlo, Consolas, monospace", fontSize: '36px', color: '#7fdcae', display: 'flex', alignItems: 'center', padding: '0 32px', whiteSpace: 'nowrap' });
  const prompt = el(term, 'span', '', { color: '#ffcd00', marginRight: '18px' }); prompt.textContent = '$';
  const typed = el(term, 'span');
  const caret = el(term, 'span', '', { display: 'inline-block', width: '18px', height: '40px', background: '#7fdcae', marginLeft: '4px' });
  const CMD = 'npm run setup && npm start';
  const badges = ['Gratuit', '100 % local', '9 sites d’emploi'].map((t, i) => { const b = el(root, 'div', 'abs badge', { top: '725px', fontSize: '30px', padding: '12px 28px', left: [620, 820, 1050][i] + 'px' }); b.textContent = t; return b; });
  const parade = ['koala', 'chat', 'chien', 'renard', 'lapin', 'ours', 'grenouille', 'pingouin'].map((id, i) => ({ s: place(sprite('pet', id, 130), root, 0, 940 - 130 + 10), i }));
  const fade = el(root, 'div', 'abs', { inset: 0, background: '#0b1511', zIndex: 40 });

  return {
    root,
    update(lt) {
      trees.forEach(({ s, i }) => { const k = P(lt, 0.1 + i * 0.1, 0.8 + i * 0.1, E.back); put(s, { sy: Math.max(k, 0.001), sx: lerp(0.6, 1, k), o: k > 0 ? 1 : 0 }); });
      const p = P(lt, 0.2, 1.1, E.back);
      put(logo, { s: lerp(0.2, 1, p), r: lerp(-16, 0, p), o: P(lt, 0.2, 0.5), y: lerp(60, 0, p) + Math.sin(lt * 2.2) * 6 * P(lt, 1.4, 1.8) });
      word.forEach((q) => { const k = P(lt, 0.9 + q.d, 1.25 + q.d, E.back); put(q.e, { s: Math.max(k, 0.001), o: k > 0 ? 1 : 0, y: k >= 1 ? Math.sin(lt * 3.4 + q.col * 0.45) * 4 * P(lt, 2, 2.6) : 0 }); });
      put(tag, { y: (1 - P(lt, 1.6, 2.3, E.out5)) * 120 });
      const tp = P(lt, 2.3, 2.9, E.out5);
      put(term, { y: (1 - tp) * 60, o: tp });
      typed.textContent = CMD.slice(0, Math.floor(P(lt, 2.9, 4.4, E.lin) * CMD.length));
      caret.style.opacity = (lt * 2.4) % 1 < 0.6 ? 1 : 0;
      badges.forEach((b, i) => { const k = P(lt, 4.6 + i * 0.15, 5.1 + i * 0.15, E.back); put(b, { s: Math.max(k, 0.001), y: (1 - k) * 30, o: k > 0 ? 1 : 0 }); });
      parade.forEach(({ s, i }) => {
        const x = ((lt * 150 + i * 240) % 2300) - 220;
        const hop = Math.abs(Math.sin(lt * 5 + i)) * 26;
        put(s, { x, y: -hop, o: P(lt, 0.5, 1.0) });
      });
      put(fade, { o: 1 - P(lt, 0, 0.1) * 0 - (1 - P(lt, 6.3, 7.0)) });
    },
  };
}

// ---------- timeline ----------
const PLAN = [
  [sceneIntro, 5], [sceneHeadline, 7], [sceneSearch, 8], [sceneScore, 8], [sceneCv, 12],
  [sceneLetter, 6], [sceneBoard, 7], [scenePets, 5], [sceneApp, 7], [sceneOutro, 7],
];
(() => {
  let t = 0;
  PLAN.forEach(([fn, dur], i) => {
    const s = fn();
    s.i = i; s.from = t; s.to = t + dur; t += dur;
    SCENES.push(s);
    if (i < PLAN.length - 1) TRANSITIONS.push([t, i % 2 === 1]);
  });
})();
