// Mitady's little 3D-style creatures. One drawing, several moods (idle, wave, sleep, think,
// party, search, write), used for empty states, loading, celebrations and the search screen.
import { raw } from './lib.js';
import { celebrate } from './fx.js';

// Body colours, light → dark.
export const BODIES = [
  ['#9fa4ff', '#5b5bf0', '#3a36b8'],
  ['#ffa3cf', '#ee5fa7', '#b8307a'],
  ['#8cf0cd', '#22c08b', '#0f8a63'],
  ['#ffd88a', '#f5a524', '#c4741a'],
  ['#8fd8ff', '#2fa6f0', '#1c6fb8'],
  ['#d4a8ff', '#9b5cf6', '#6a32c4'],
];
// A little something on top of each head, for personality.
const TOPS = ['curl', 'ears', 'antenna', 'horns', 'leaf', 'tuft'];

let uid = 0;

export function creatureSvg(i = 0) {
  const id = ++uid;
  const [c1, c2, c3] = BODIES[i % BODIES.length];
  const top = TOPS[i % TOPS.length];
  const tops = {
    curl: `<path d="M60 16c-2-10 8-14 12-8 3 5-3 9-6 6" fill="none" stroke="${c3}" stroke-width="5" stroke-linecap="round"/>`,
    ears: `<path d="M24 34 14 8l26 14Z" fill="${c2}"/><path d="M96 34 106 8 80 22Z" fill="${c2}"/><path d="M26 30 20 16l12 8Z" fill="#ffc2dc"/><path d="M94 30 100 16 88 24Z" fill="#ffc2dc"/>`,
    antenna: `<path d="M60 18V4" stroke="${c3}" stroke-width="4" stroke-linecap="round"/><circle cx="60" cy="4" r="6" fill="url(#hl${id})" stroke="${c3}" stroke-width="1.5"/>`,
    horns: `<path d="M34 24C26 14 28 4 36 0c2 8 8 12 12 14Z" fill="#fff" opacity=".92"/><path d="M86 24c8-10 6-20-2-24-2 8-8 12-12 14Z" fill="#fff" opacity=".92"/>`,
    leaf: `<path d="M60 18C56 6 66 -2 80 2c0 12-10 18-20 16Z" fill="#35d39a"/><path d="M60 18C66 12 72 8 78 4" stroke="#0f8a63" stroke-width="2" fill="none" stroke-linecap="round"/>`,
    tuft: `<path d="M48 18c-4-8 0-14 6-12 2-6 10-6 12 0 6-2 10 4 6 12" fill="${c3}"/>`,
  };
  return `<svg class="mon-svg" viewBox="0 0 120 130" width="100%" height="100%" aria-hidden="true">
    <defs>
      <radialGradient id="bd${id}" cx=".34" cy=".26" r=".95"><stop offset="0" stop-color="${c1}"/><stop offset=".55" stop-color="${c2}"/><stop offset="1" stop-color="${c3}"/></radialGradient>
      <radialGradient id="hl${id}" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="${c1}"/></radialGradient>
      <linearGradient id="gl${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".75"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
    </defs>
    <g class="mon-feet"><ellipse cx="38" cy="118" rx="15" ry="9" fill="${c3}"/><ellipse cx="82" cy="118" rx="15" ry="9" fill="${c3}"/></g>
    <g class="mon-arm l"><ellipse cx="9" cy="74" rx="9" ry="14" fill="url(#bd${id})"/></g>
    <g class="mon-arm r"><ellipse cx="111" cy="74" rx="9" ry="14" fill="url(#bd${id})"/></g>
    ${tops[top]}
    <path d="M60 14C94 14 112 42 112 74c0 30-22 44-52 44S8 104 8 74C8 42 26 14 60 14Z" fill="url(#bd${id})"/>
    <path d="M18 92c8 20 26 26 42 26 22 0 40-10 46-30-10 14-26 22-46 22-18 0-34-6-42-18Z" fill="${c1}" opacity=".35"/>
    <ellipse cx="38" cy="38" rx="20" ry="11" transform="rotate(-28 38 38)" fill="url(#gl${id})"/>
    <g class="mon-eyes">
      <ellipse cx="42" cy="62" rx="11" ry="13" fill="#fff"/><ellipse cx="78" cy="62" rx="11" ry="13" fill="#fff"/>
      <g class="mon-pupils"><ellipse cx="44" cy="64" rx="6" ry="8" fill="#241a3a"/><ellipse cx="80" cy="64" rx="6" ry="8" fill="#241a3a"/>
      <circle cx="46.500" cy="60" r="2.500" fill="#fff"/><circle cx="82.500" cy="60" r="2.500" fill="#fff"/></g>
    </g>
    <g class="mon-closed" fill="none" stroke="#241a3a" stroke-width="3.600" stroke-linecap="round"><path d="M31 63q11 9 22 0"/><path d="M67 63q11 9 22 0"/></g>
    <ellipse cx="25" cy="82" rx="8" ry="5" fill="#ff6f9c" opacity=".35"/><ellipse cx="95" cy="82" rx="8" ry="5" fill="#ff6f9c" opacity=".35"/>
    <path class="mon-smile" d="M50 84q10 9 20 0" fill="none" stroke="#241a3a" stroke-width="3.400" stroke-linecap="round"/>
    <ellipse class="mon-o" cx="60" cy="88" rx="6" ry="7" fill="#241a3a"/>
  </svg>`;
}

// What a creature holds or shows for each mood.
const PROPS = {
  search: `<svg class="mon-prop glass" viewBox="0 0 40 44"><circle cx="16" cy="16" r="11" fill="rgba(255,255,255,.35)" stroke="#fff" stroke-width="4"/><path d="m25 25 11 12" stroke="#fff" stroke-width="5" stroke-linecap="round"/><path d="M9 12a8 8 0 0 1 7-5" stroke="#fff" stroke-width="2.600" fill="none" stroke-linecap="round" opacity=".8"/></svg>`,
  write: `<svg class="mon-prop pad" viewBox="0 0 44 52"><rect x="3" y="3" width="38" height="46" rx="6" fill="#fff"/><path d="M11 16h22M11 25h22M11 34h14" stroke="#c9c6ec" stroke-width="3.400" stroke-linecap="round"/><path d="M11 16h14" stroke="#8b5cf6" stroke-width="3.400" stroke-linecap="round"/></svg>`,
  think: `<span class="mon-bubble">?</span>`,
  sleep: `<span class="mon-z z1">z</span><span class="mon-z z2">z</span><span class="mon-z z3">Z</span>`,
  send: `<svg class="mon-prop plane" viewBox="0 0 48 48"><path d="M44 4 20 28M44 4 30 44l-8-16-16-8L44 4Z" fill="#fff" stroke="#5b5bf0" stroke-width="3" stroke-linejoin="round"/></svg>`,
  party: `<span class="mon-spark a"></span><span class="mon-spark b"></span><span class="mon-spark c"></span>`,
};

// HTML for one creature: mascot(2, { size: 120, mood: 'wave' }).
export function mascot(i = 0, { size = 110, mood = 'idle' } = {}) {
  return raw(`<span class="mon ${mood}" style="--mon:${size}px" aria-hidden="true">${creatureSvg(i)}${PROPS[mood] || ''}<i class="mon-sh"></i></span>`);
}

// A creature pops in at a point, jumps for joy, and goes away. Optionally with a message.
export function popCreature({ x = innerWidth / 2, y = innerHeight * 0.55, mood = 'party', i = Math.floor(Math.random() * 6), size = 120, text = '', confetti = true } = {}) {
  const el = document.createElement('div');
  el.className = 'pop-mon';
  el.style.cssText = `left:${x}px;top:${y}px`;
  el.innerHTML = `${mascot(i, { size, mood })}${text ? `<span class="pop-text">${text}</span>` : ''}`;
  document.body.append(el);
  if (confetti) celebrate({ x, y: y - size * 0.6, count: 70 });
  setTimeout(() => el.classList.add('bye'), text ? 2600 : 1700);
  setTimeout(() => el.remove(), text ? 3100 : 2200);
}

// A small working card for slow actions: "Je prépare ton CV…". Returns { done(msg), fail(msg) }.
export function working({ text = 'Je m’en occupe…', mood = 'write', i = 3 } = {}) {
  const el = document.createElement('div');
  el.className = 'working';
  el.innerHTML = `${mascot(i, { size: 64, mood })}<div><b>${text}</b><span class="dots"><i></i><i></i><i></i></span></div>`;
  document.body.append(el);
  requestAnimationFrame(() => el.classList.add('open'));
  const close = (delay) => {
    setTimeout(() => el.classList.remove('open'), delay);
    setTimeout(() => el.remove(), delay + 500);
  };
  return {
    done(msg = 'C’est prêt !') {
      el.querySelector('.mon').className = 'mon party';
      el.querySelector('b').textContent = msg;
      el.querySelector('.dots').remove();
      const r = el.getBoundingClientRect();
      celebrate({ x: r.left + 40, y: r.top, count: 50 });
      close(1500);
    },
    fail(msg = 'Oups.') {
      el.querySelector('.mon').className = 'mon think';
      el.querySelector('b').textContent = msg;
      el.querySelector('.dots')?.remove();
      close(2600);
    },
  };
}

// Milestones: the first application, then 5, 10, 25… get a little party.
const MILESTONES = { 1: 'Première candidature envoyée !', 5: '5 candidatures : tu es lancé !', 10: '10 candidatures, bravo !', 25: '25 candidatures : quelle énergie !', 50: '50 candidatures ! Impressionnant.' };
export function milestone(sentCount, at) {
  const text = MILESTONES[sentCount];
  if (text) popCreature({ ...at, text, size: 140 });
  return Boolean(text);
}

// Shared by the board and the offer sheet: what to celebrate when an application changes status.
const SENT_STATUSES = ['applied', 'interview', 'offer', 'rejected'];
export function cheerStatus(target, { wasSent, sent, at }) {
  if (target === 'offer') return popCreature({ ...at, text: 'Une offre ! Félicitations !', size: 150 });
  if (target === 'interview') return popCreature({ ...at, text: 'Entretien décroché !', size: 130 });
  if (target === 'applied' && !wasSent && !milestone(sent, at)) celebrate({ ...at, count: 60 });
}
export const isSent = (status) => SENT_STATUSES.includes(status);
