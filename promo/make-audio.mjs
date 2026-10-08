// Synthesises the soundtrack of the presentation (no samples, no dependencies): a 120 BPM chiptune groove in
// C major, plus sound effects placed on the on-screen events. Every scene boundary falls on a beat.
// Run: node promo/make-audio.mjs   → promo/assets/theme.mp3 (needs ffmpeg for the MP3 encoding)
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const SR = 44100, DUR = 72, N = SR * DUR, BEAT = 0.5; // 120 BPM
const TAU = Math.PI * 2;
let seed = 20261008;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const mtof = (m) => 440 * 2 ** ((m - 69) / 12);
const bus = () => ({ L: new Float32Array(N), R: new Float32Array(N) });
const B = { kick: bus(), drum: bus(), bass: bus(), arp: bus(), pad: bus(), lead: bus(), sfx: bus(), rev: bus() };
const kicks = [];

const gains = (pan, v) => [Math.cos(((pan + 1) * Math.PI) / 4) * v, Math.sin(((pan + 1) * Math.PI) / 4) * v];

// one oscillator note with an ADSR envelope
function note(b, t0, dur, f, o = {}) {
  const { w = 'sine', v = 0.2, a = 0.004, d = 0.1, s = 0.7, r = 0.06, duty = 0.5, slide = 0, pan = 0, vib = 0, send = 0, harm = 0 } = o;
  const i0 = Math.round(t0 * SR), n = Math.round((dur + r) * SR);
  const [gL, gR] = gains(pan, v);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const idx = i0 + i;
    if (idx < 0 || idx >= N) continue;
    const t = i / SR;
    let e = t < a ? t / a : t < a + d ? 1 - (1 - s) * ((t - a) / d) : s;
    if (t > dur) e *= Math.max(0, 1 - (t - dur) / r);
    ph += (f * 2 ** (slide * t) * (vib ? 1 + vib * Math.sin(TAU * 5.5 * t) : 1)) / SR;
    const x = ph - Math.floor(ph);
    let y = w === 'sine' ? Math.sin(TAU * x) : w === 'tri' ? 4 * Math.abs(x - 0.5) - 1 : w === 'saw' ? 2 * x - 1 : x < duty ? 1 : -1;
    if (harm) y += harm * Math.sin(TAU * x * 3);
    y *= e;
    b.L[idx] += y * gL; b.R[idx] += y * gR;
    if (send) B.rev.L[idx] += y * send;
  }
}

// filtered noise burst (hi-hats, claps, clicks)
function noise(b, t0, dur, o = {}) {
  const { v = 0.2, hp = 0.5, decay = 0.05, pan = 0, send = 0 } = o;
  const i0 = Math.round(t0 * SR), n = Math.round(dur * SR);
  const [gL, gR] = gains(pan, v);
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const idx = i0 + i;
    if (idx < 0 || idx >= N) continue;
    const x = rnd() * 2 - 1;
    lp += hp * (x - lp); // high-pass: the noise minus its own low-pass (hp ≈ cutoff, 0.1 = 700 Hz, 0.3 = 2 kHz)
    const y = (x - lp) * Math.exp(-(i / SR) / decay);
    b.L[idx] += y * gL; b.R[idx] += y * gR;
    if (send) B.rev.L[idx] += y * send;
  }
}

// band-passed noise whose centre frequency glides: whooshes, risers, falls
function sweep(t0, t1, f0, f1, o = {}) {
  const { v = 0.2, q = 1.4, shape = 'bell', p0 = 0, p1 = 0, send = 0.25 } = o;
  const i0 = Math.round(t0 * SR), n = Math.round((t1 - t0) * SR);
  let low = 0, band = 0;
  for (let i = 0; i < n; i++) {
    const idx = i0 + i;
    if (idx < 0 || idx >= N) continue;
    const p = i / n;
    const F = 2 * Math.sin((Math.PI * f0 * (f1 / f0) ** p) / SR);
    const high = rnd() * 2 - 1 - low - band / q;
    band += F * high; low += F * band;
    const env = shape === 'bell' ? Math.sin(Math.PI * p) ** 1.6 : shape === 'rise' ? p * p * (p > 0.97 ? (1 - p) / 0.03 : 1) : (1 - p) ** 2;
    const pan = p0 + (p1 - p0) * p;
    const [gL, gR] = gains(pan, v * env * 1.6);
    B.sfx.L[idx] += band * gL; B.sfx.R[idx] += band * gR;
    B.rev.L[idx] += band * env * v * send;
  }
}

// drums
function kick(t, v = 0.9) {
  const i0 = Math.round(t * SR), n = Math.round(0.42 * SR);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const idx = i0 + i;
    if (idx >= N) break;
    const x = i / SR;
    ph += (46 + 120 * Math.exp(-x / 0.03)) / SR;
    const y = (Math.sin(TAU * ph) * Math.exp(-x / 0.16) + (x < 0.004 ? (rnd() - 0.5) * 0.6 : 0)) * v;
    B.kick.L[idx] += y; B.kick.R[idx] += y;
  }
  kicks.push(t);
}
const clap = (t, v = 0.5) => { [0, 0.011, 0.022].forEach((d, i) => noise(B.drum, t + d, 0.16, { v: v * (i === 2 ? 1 : 0.6), hp: 0.12, decay: i === 2 ? 0.07 : 0.02, pan: 0.05, send: 0.18 })); note(B.drum, t, 0.1, 190, { v: v * 0.35, a: 0.001, d: 0.06, s: 0, slide: -4, r: 0.02 }); };
const hat = (t, v = 0.15, open = false) => noise(B.drum, t, open ? 0.2 : 0.06, { v: v * 1.4, hp: 0.3, decay: open ? 0.07 : 0.018, pan: open ? -0.25 : 0.25 });

// ---------- the score ----------
const PROG = [
  { root: 36, notes: [60, 64, 67] }, // C
  { root: 43, notes: [59, 62, 67] }, // G
  { root: 45, notes: [57, 60, 64] }, // Am
  { root: 41, notes: [57, 60, 65] }, // F
];
const ARP = [0, 1, 2, 3, 2, 1, 2, 3, 0, 1, 2, 3, 2, 1, 3, 2];
const LEAD = [
  [76, 0, 79, 0, 81, 79, 76, 0],
  [74, 0, 79, 0, 83, 81, 79, 0],
  [72, 0, 76, 0, 81, 79, 76, 72],
  [72, 0, 77, 0, 81, 0, 79, 77],
];
// what plays when
const SECTIONS = [
  { a: 0, b: 5, pad: 0.8, arp: 0.5, arpStep: 2 },
  { a: 5, b: 12, kick: 1, clap: 1, hat: 1, bass: 1, arp: 0.85, pad: 0.6 },
  { a: 12, b: 20, kick: 1, clap: 1, hat: 1, ohat: 1, bass: 1, arp: 1, pad: 0.6 },
  { a: 20, b: 28, kick: 1, clap: 1, hat: 1, ohat: 1, bass: 1, arp: 1, pad: 0.7, lead: 1 },
  { a: 28, b: 32, pad: 1, arp: 0.8, arpStep: 2, bass: 0.5, long: 1 },
  { a: 32, b: 38.5, kick: 1, clap: 1, hat: 1, ohat: 1, bass: 1, arp: 1, pad: 0.7, lead: 1 },
  { a: 38.5, b: 40, pad: 1, arp: 0.9, bass: 0.6, long: 1 },
  { a: 40, b: 46, pad: 1, arp: 0.7, arpStep: 2, lead: 0.7, hat: 0.5, bass: 0.5, long: 1 },
  { a: 46, b: 53, kick: 1, clap: 1, hat: 1, ohat: 1, bass: 1, arp: 1, pad: 0.7, lead: 1 },
  { a: 53, b: 58, kick: 0.8, half: 1, hat: 1, bass: 0.8, stacc: 1, arp: 0.6, pad: 0.5 },
  { a: 58, b: 63.9, kick: 0.55, half: 1, pad: 1.1, arp: 0.6, arpStep: 2, bass: 0.7, long: 1 },
  { a: 63.9, b: 65, pad: 1.1, arp: 0.5, arpStep: 2 },
  { a: 65, b: 70, kick: 1, clap: 1, hat: 1, ohat: 1, bass: 1, arp: 1.1, pad: 0.8, lead: 1.1 },
  { a: 70, b: 72, pad: 1, arp: 0.5, arpStep: 4 },
];
const secAt = (t) => SECTIONS.find((s) => t >= s.a && t < s.b) || {};

for (let bar = 0; bar * 2 < DUR; bar++) {
  const t0 = bar * 2, ch = PROG[bar % 4];
  const sec = secAt(t0 + 0.01);
  // pad: two detuned saw voices per note
  if (sec.pad) {
    ch.notes.forEach((m, k) => [-1, 1].forEach((side) => note(B.pad, t0, 1.9, mtof(m - 12 + (k === 2 ? 12 : 0)) * (1 + side * 0.004), { w: 'saw', v: 0.018 * sec.pad, a: 0.35, d: 0.4, s: 0.8, r: 0.5, pan: side * 0.6, send: 0.5 })));
  }
  for (let st = 0; st < 16; st++) {
    const t = t0 + st * 0.125, s = secAt(t);
    const beat = Math.floor(st / 4), sub = st % 4;
    if (s.arp && st % (s.arpStep || 1) === 0) {
      const m = [ch.notes[0] + 12, ch.notes[1] + 12, ch.notes[2] + 12, ch.notes[0] + 24][ARP[st]];
      note(B.arp, t, 0.09, mtof(m), { w: 'pulse', duty: 0.25, v: 0.03 * s.arp * (sub === 0 ? 1.25 : 1), a: 0.002, d: 0.08, s: 0.2, r: 0.04, pan: st % 2 ? 0.35 : -0.35, send: 0.15 });
    }
    if (s.hat) {
      if (s.half) hat(t, sub % 2 ? 0.05 : 0.09);
      else if (sub % 2 === 0) hat(t, 0.1 * s.hat);
      else if (s.kick) hat(t, 0.045 * s.hat);
    }
    if (s.ohat && sub === 2) hat(t, 0.12, true);
    if (s.kick && (s.half ? sub === 0 && beat % 2 === 0 : sub === 0)) kick(t, 0.85 * Math.min(1, s.kick));
    if (s.clap && sub === 0 && beat % 2 === 1) clap(t, 0.5);
    if (s.half && s.hat && sub === 0 && beat % 2 === 1) clap(t, 0.32);
    if (s.bass && !s.long && (sub === 0 || sub === 2)) {
      const m = ch.root + (sub === 2 && !s.stacc ? 12 : 0);
      note(B.bass, t, s.stacc ? 0.1 : 0.2, mtof(m), { w: 'saw', v: 0.17 * s.bass * (sub === 2 ? 0.7 : 1), a: 0.003, d: 0.12, s: 0.5, r: 0.04 });
    }
    if (s.bass && s.long && st === 0) note(B.bass, t, 1.9, mtof(ch.root), { w: 'sine', v: 0.2 * s.bass, a: 0.05, d: 0.5, s: 0.8, r: 0.3 });
  }
}
// the lead melody, 8th notes over the 4-bar phrase
for (let bar = 0; bar * 2 < DUR; bar++) {
  for (let k = 0; k < 8; k++) {
    const t = bar * 2 + k * 0.25, s = secAt(t), m = LEAD[bar % 4][k];
    if (!s.lead || !m) continue;
    note(B.lead, t, 0.2, mtof(m), { w: 'pulse', duty: 0.125, v: 0.04 * s.lead, a: 0.004, d: 0.1, s: 0.5, r: 0.06, vib: 0.004, pan: 0.15, send: 0.3 });
    note(B.lead, t, 0.2, mtof(m - 12), { w: 'tri', v: 0.04 * s.lead, a: 0.004, d: 0.1, s: 0.6, r: 0.06, pan: -0.15 });
  }
}
// snare rolls and risers before the scene changes
function roll(t0, t1) {
  let t = t0, gap = 0.25;
  while (t < t1 - 0.03) {
    clap(t, 0.15 + (0.45 * (t - t0)) / (t1 - t0));
    t += gap;
    gap = Math.max(0.0625, gap * 0.82);
  }
}
[[4, 5], [27, 28], [39, 40], [45, 46], [52, 53]].forEach(([a, b]) => roll(a, b));

// transitions: a whoosh across the pixel wipe, and an impact when the screen is fully covered
[5, 12, 20, 28, 40, 46, 53, 58, 65].forEach((c, i) => {
  sweep(c - 1.2, c - 0.02, 250, 7000, { v: 0.1, shape: 'rise', p0: -0.5, p1: 0.5 });
  sweep(c - 0.4, c + 0.45, 3500, 500, { v: 0.12, shape: 'bell', p0: -0.7, p1: 0.7 });
  note(B.sfx, c, 1.3, 55, { v: i === 8 ? 0.6 : 0.4, a: 0.002, d: 0.5, s: 0, slide: -0.35, r: 0.1, send: 0.15 });
  noise(B.sfx, c, 1.4, { v: i === 8 ? 0.2 : 0.12, hp: 0.2, decay: 0.5, send: 0.4 });
});

// ---------- sound effects, placed on the on-screen events ----------
const PENTA = [72, 74, 76, 79, 81, 84, 86, 88, 91, 93];
const bell = (t, m, v = 0.12, len = 0.7) => { note(B.sfx, t, len, mtof(m), { v, a: 0.002, d: len, s: 0, r: 0.1, pan: ((m * 7) % 5) / 6 - 0.35, send: 0.4, harm: 0.15 }); note(B.sfx, t, 0.25, mtof(m + 12), { v: v * 0.3, a: 0.002, d: 0.25, s: 0, r: 0.05, send: 0.3 }); };
const pluck = (t, m, v = 0.1) => note(B.sfx, t, 0.25, mtof(m), { w: 'tri', v, a: 0.002, d: 0.25, s: 0, r: 0.05, pan: ((m * 3) % 7) / 8 - 0.4, send: 0.3 });
const pop = (t, m = 84, v = 0.14) => note(B.sfx, t, 0.09, mtof(m), { v, a: 0.002, d: 0.09, s: 0, slide: 6, r: 0.03, send: 0.2 });
const tick = (t, v = 0.05) => note(B.sfx, t, 0.02, 1800 + rnd() * 900, { w: 'pulse', duty: 0.3, v, a: 0.001, d: 0.02, s: 0, r: 0.01, pan: rnd() - 0.5 });
const click = (t) => { noise(B.sfx, t, 0.03, { v: 0.35, hp: 0.3, decay: 0.008 }); note(B.sfx, t, 0.05, 1500, { v: 0.1, a: 0.001, d: 0.05, s: 0, r: 0.01 }); };
const thud = (t, v = 0.35) => note(B.sfx, t, 0.22, 95, { v, a: 0.002, d: 0.2, s: 0, slide: -5, r: 0.03 });
const glide = (t0, t1, m0, m1, v = 0.07) => note(B.sfx, t0, t1 - t0, mtof(m0), { v, a: 0.05, d: t1 - t0, s: 1, slide: (m1 - m0) / 12 / (t1 - t0), r: 0.12, send: 0.3, pan: 0.1 });
const swish = (t, d = 0.5, up = true, v = 0.09) => sweep(t, t + d, up ? 600 : 3000, up ? 3500 : 500, { v, shape: 'bell', p0: up ? -0.5 : 0.5, p1: up ? 0.5 : -0.5 });
const sparkle = (t, n = 14, v = 0.08) => { for (let i = 0; i < n; i++) bell(t + i * 0.045 + rnd() * 0.02, PENTA[(i * 3 + 4) % PENTA.length] + 12 * (i % 2), v, 0.5); };
const stab = (t, notes, v = 0.07, len = 0.6) => notes.forEach((m) => note(B.sfx, t, len, mtof(m), { w: 'saw', v: v / notes.length * 2, a: 0.004, d: len, s: 0, r: 0.2, send: 0.5 }));
const run = (t, n, step, from = 0, v = 0.1) => { for (let i = 0; i < n; i++) pluck(t + i * step, PENTA[(from + i) % PENTA.length], v); };

// 0 · intro
pop(0.35, 79); bell(0.5, 91, 0.1); [1.0, 1.13, 1.26, 1.39, 1.52].forEach((t, i) => bell(t, PENTA[5 + i], 0.07, 0.6));
run(1.15, 12, 0.07, 0, 0.08); stab(2.1, [72, 76, 79, 84], 0.09, 1.2);
[2.5, 2.66, 2.82, 2.98, 3.14].forEach((t, i) => pluck(t, PENTA[2 + i], 0.09));
// 5 · headline
[5.15, 6.3].forEach((t) => swish(t, 0.5, true, 0.07));
[5.8, 6.02, 6.24, 6.46].forEach((t, i) => { pop(t, 72 + i * 4, 0.1); });
[6.75, 8.0, 9.25].forEach((t) => { swish(t, 0.45, false, 0.06); tick(t + 0.3, 0.06); });
for (let i = 0; i < 9; i++) pluck(6.6 + i * 0.12, PENTA[i], 0.08);
// 12 · search
[12.1, 12.3].forEach((t) => swish(t, 0.5, true, 0.07)); swish(12.75, 0.6, true, 0.08);
for (let i = 0; i < 29; i++) tick(13 + (i * 2) / 29, 0.05);
for (let i = 0; i < 9; i++) pop(13.5 + i * 0.08, 72 + i * 2, 0.09);
click(15.9); glide(16.1, 17.7, 60, 84, 0.05);
for (let i = 0; i < 9; i++) bell(16.9 + i * 0.1, PENTA[i % 10], 0.07, 0.4);
glide(16.2, 17.9, 72, 96, 0.04); pop(18.0, 60, 0.18); swish(18.0, 0.5, true, 0.08); glide(18.2, 18.9, 84, 72, 0.05); pluck(18.9, 91, 0.12); pluck(19.0, 96, 0.1);
// 20 · score
[20.2, 20.3].forEach((t) => swish(t, 0.6, true, 0.07));
glide(20.8, 21.8, 64, 79, 0.05); for (let i = 0; i < 8; i++) tick(21.2 + i * 0.07, 0.05);
click(23.3); bell(23.35, 88, 0.14); glide(23.35, 24.0, 72, 80, 0.045);
click(24.7); bell(24.75, 91, 0.14); glide(24.75, 25.5, 76, 88, 0.05);
sparkle(25.5, 18, 0.09); stab(25.5, [72, 76, 79, 84, 88], 0.12, 1.4);
// 28 · CV
[28.15, 28.35].forEach((t) => swish(t, 0.5, true, 0.07));
for (let i = 0; i < 6; i++) { swish(28.5 + i * 0.12, 0.45, true, 0.045); pluck(28.8 + i * 0.12, PENTA[i], 0.07); }
swish(32.0, 0.8, false, 0.08); swish(32.0, 1.0, true, 0.06);
for (let i = 0; i < 6; i++) pop(32.6 + i * 0.06, 76 + i * 2, 0.07);
[[33.5, 79], [34.2, 84], [34.9, 88], [35.6, 91], [36.2, 84]].forEach(([t, m]) => { click(t); pluck(t + 0.02, m, 0.13); bell(t + 0.02, m + 12, 0.06, 0.4); });
[36.7, 37.6, 38.5].forEach((t, i) => { swish(t, 0.5, i % 2 === 0, 0.09); thud(t + 0.25, 0.15); pluck(t + 0.3, PENTA[3 + i], 0.1); });
for (let i = 0; i < 4; i++) pop(36.9 + i * 0.08, 76 + i * 3, 0.07);
pop(38.9, 88, 0.16); bell(38.95, 96, 0.1, 0.9);
// 40 · letter
[40.2, 40.3].forEach((t) => swish(t, 0.6, true, 0.07)); swish(40.3, 0.8, true, 0.08);
glide(41.0, 44.2, 67, 91, 0.025); sweep(41.0, 44.2, 900, 3200, { v: 0.05, shape: 'bell', p0: -0.4, p1: 0.4 });
[42.14, 42.58, 42.98].forEach((t, i) => bell(t, [88, 91, 96][i], 0.13, 0.9));
swish(43.0, 0.5, true, 0.05); pop(43.8, 84, 0.1); thud(44.6, 0.45); bell(44.62, 84, 0.16, 1.2); bell(44.68, 91, 0.12, 1.2);
// 46 · board
[46.15, 46.25].forEach((t) => swish(t, 0.5, true, 0.07));
for (let i = 0; i < 4; i++) pop(46.3 + i * 0.1, 72 + i * 4, 0.08);
for (let i = 0; i < 3; i++) pop(46.7 + i * 0.15, 79 + i * 2, 0.08);
[[47.4, 48.3], [48.9, 49.8], [50.4, 51.3]].forEach(([a, b], i) => { click(a); swish(a + 0.05, 0.8, true, 0.07); thud(b, 0.3); bell(b + 0.02, [79, 84, 91][i], 0.13, 0.8); });
swish(47.8, 0.5, true, 0.04);
sparkle(51.3, 20, 0.09); pop(51.4, 91, 0.18); stab(51.4, [72, 76, 79, 84], 0.13, 1.2); pluck(51.5, 96, 0.1);
// 53 · pets
[53.1, 53.3].forEach((t) => swish(t, 0.5, true, 0.07));
for (let i = 0; i < 9; i++) { const t = 53.3 + i * 0.16; swish(t, 0.5, i % 2 === 0, 0.035); [0.25, 0.45, 0.65, 0.85].forEach((d) => pluck(t + d, PENTA[(i + 2) % 10] - 12, 0.05)); pluck(t + 1.0, PENTA[i], 0.1); }
note(B.sfx, 55.0, 0.5, 110, { v: 0.05, a: 0.1, d: 0.5, s: 0, r: 0.2 });
click(56.5); note(B.sfx, 56.55, 0.25, 760, { v: 0.12, a: 0.01, d: 0.25, s: 0.3, slide: -0.8, vib: 0.03, r: 0.05, send: 0.2 }); sparkle(56.7, 10, 0.08); pop(56.7, 88, 0.12);
// 58 · the app
swish(58.3, 0.6, true, 0.07); sweep(58.0, 59.3, 300, 3000, { v: 0.1, shape: 'rise' }); thud(59.3, 0.35);
swish(60.5, 0.6, true, 0.09); swish(60.6, 0.5, true, 0.06); swish(62.6, 0.6, true, 0.09); swish(62.7, 0.5, true, 0.06);
click(63.7); sweep(63.9, 64.85, 4500, 120, { v: 0.14, shape: 'out' }); glide(63.9, 64.85, 96, 55, 0.04);
// 65 · outro
for (let i = 0; i < 7; i++) pluck(65.1 + i * 0.1, PENTA[i], 0.08);
pop(65.3, 79, 0.16); bell(65.45, 91, 0.12, 1); sparkle(65.6, 12, 0.07);
run(65.9, 16, 0.045, 0, 0.07); swish(66.6, 0.6, true, 0.07); swish(67.3, 0.6, true, 0.06);
for (let i = 0; i < 26; i++) tick(67.9 + i * 0.058, 0.05);
[69.6, 69.75, 69.9].forEach((t, i) => { pop(t, 84 + i * 4, 0.14); bell(t + 0.02, [84, 88, 91][i], 0.1, 0.9); });
stab(70.0, [60, 64, 67, 72, 76, 79], 0.2, 2.0); bell(70.05, 96, 0.08, 1.8); bell(70.05, 91, 0.08, 1.8);

// ---------- mix ----------
const duck = new Float32Array(N).fill(1);
for (const k of kicks) {
  const i0 = Math.round(k * SR);
  for (let i = 0, n = Math.round(0.28 * SR); i < n && i0 + i < N; i++) duck[i0 + i] = Math.min(duck[i0 + i], 1 - 0.55 * Math.exp(-i / SR / 0.09));
}

// ping-pong echo (a dotted eighth) on the arpeggio and the lead
function pingpong(b, delay, fb, mix) {
  const D = Math.round(delay * SR), wl = new Float32Array(N), wr = new Float32Array(N);
  for (let i = D; i < N; i++) {
    wl[i] = (b.L[i - D] + b.R[i - D]) * 0.5 * mix + wr[i - D] * fb;
    wr[i] = wl[i - D] * fb;
  }
  for (let i = 0; i < N; i++) { b.L[i] += wl[i]; b.R[i] += wr[i]; }
}
// soften the square waves: a 2-pole low-pass at ~5 kHz
function lowpass(b, fc) {
  const c = 1 - Math.exp((-TAU * fc) / SR);
  for (const ch of [b.L, b.R]) { let y1 = 0, y2 = 0; for (let i = 0; i < N; i++) { y1 += c * (ch[i] - y1); y2 += c * (y1 - y2); ch[i] = y2; } }
}
lowpass(B.arp, 5000); lowpass(B.lead, 5000);
pingpong(B.arp, 0.375, 0.5, 0.45);
pingpong(B.lead, 0.375, 0.45, 0.35);

// Schroeder reverb fed by the send bus
function reverb(inp, out, delays, g) {
  const combs = delays.map((d) => ({ buf: new Float32Array(d), i: 0, lp: 0 }));
  const aps = [225, 341].map((d) => ({ buf: new Float32Array(d), i: 0 }));
  for (let n = 0; n < N; n++) {
    const x = inp[n];
    let y = 0;
    for (const c of combs) {
      const o = c.buf[c.i];
      c.lp += 0.35 * (o - c.lp);
      c.buf[c.i] = x + c.lp * g;
      if (++c.i >= c.buf.length) c.i = 0;
      y += o;
    }
    y /= combs.length;
    for (const a of aps) {
      const o = a.buf[a.i];
      const v = y + o * 0.5;
      a.buf[a.i] = v;
      y = o - v * 0.5;
      if (++a.i >= a.buf.length) a.i = 0;
    }
    out[n] += y;
  }
}
const revL = new Float32Array(N), revR = new Float32Array(N);
reverb(B.rev.L, revL, [1557, 1617, 1491, 1422, 1277, 1356], 0.84);
reverb(B.rev.L, revR, [1601, 1553, 1459, 1381, 1319, 1229], 0.84);

const L = new Float32Array(N), R = new Float32Array(N);
for (let i = 0; i < N; i++) {
  const d = duck[i];
  L[i] = B.kick.L[i] + B.drum.L[i] + B.sfx.L[i] + (B.bass.L[i] + B.pad.L[i] + B.arp.L[i] + B.lead.L[i]) * d + revL[i] * 0.55;
  R[i] = B.kick.R[i] + B.drum.R[i] + B.sfx.R[i] + (B.bass.R[i] + B.pad.R[i] + B.arp.R[i] + B.lead.R[i]) * d + revR[i] * 0.55;
}
// a gentle limiter, then fades
let peak = 0;
for (let i = 0; i < N; i++) { L[i] = Math.tanh(L[i] * 1.2); R[i] = Math.tanh(R[i] * 1.2); peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i])); }
const norm = 0.62 / peak;
const pcm = Buffer.alloc(N * 4);
for (let i = 0; i < N; i++) {
  const t = i / SR;
  const f = Math.min(1, t / 0.08) * (t > 69.8 ? Math.max(0, 1 - (t - 69.8) / 2.2) ** 1.5 : 1);
  pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i] * norm * f)) * 32767), i * 4);
  pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i] * norm * f)) * 32767), i * 4 + 2);
}
const header = Buffer.alloc(44);
header.write('RIFF', 0); header.writeUInt32LE(36 + pcm.length, 4); header.write('WAVEfmt ', 8);
header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(2, 22); header.writeUInt32LE(SR, 24);
header.writeUInt32LE(SR * 4, 28); header.writeUInt16LE(4, 32); header.writeUInt16LE(16, 34); header.write('data', 36); header.writeUInt32LE(pcm.length, 40);
const wav = path.join(os.tmpdir(), 'mitady-theme.wav');
fs.writeFileSync(wav, Buffer.concat([header, pcm]));
const outFile = path.join(here, 'assets', 'theme.mp3');
const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', wav, '-codec:a', 'libmp3lame', '-b:a', '160k', outFile], { stdio: 'inherit' });
if (r.status !== 0) { console.error('ffmpeg failed (is it installed?). The WAV is at', wav); process.exit(1); }
fs.rmSync(wav);
console.log('→', outFile, (fs.statSync(outFile).size / 1024).toFixed(0) + ' Ko');
