// A customizable 3D-style avatar (shaded face, glossy hair) and its editor.
// Drawn as SVG from a small config, so it stays crisp at any size and weighs nothing.
import { raw, html } from './lib.js';

export const SKINS = ['#ffdcc4', '#f7caa5', '#e6a97e', '#c98a5c', '#9c6339', '#6c4026'];
export const HAIR_COLORS = ['#2a1c14', '#4b2d1b', '#8c5a2c', '#c99a41', '#e8cd8e', '#b3381f', '#8e8e9c', '#3b3fb5'];
export const OUTFITS = ['#5b5bf0', '#0f6b73', '#1d5e3a', '#b24a1d', '#b3261e', '#ee5fa7', '#5b2a86', '#14274e', '#3c4a5c', '#a87b0a'];
export const BACKS = [250, 200, 160, 40, 20, 330, 290];
export const HAIRS = [
  ['court', 'Court'], ['quiff', 'Coiffé'], ['boucles', 'Bouclés'], ['long', 'Longs'], ['carre', 'Carré'], ['chignon', 'Chignon'], ['queue', 'Queue'], ['chauve', 'Rasé'],
];
export const BEARDS = [['aucune', 'Aucune'], ['legere', 'Légère'], ['barbe', 'Barbe']];
export const GLASSES = [['aucune', 'Aucune'], ['rondes', 'Rondes'], ['carrees', 'Carrées']];

const DEFAULTS = {
  masculin: { skin: 2, hair: 'quiff', hairColor: 1, beard: 'aucune', glasses: 'aucune', outfit: '#5b5bf0', bg: 250 },
  feminin: { skin: 1, hair: 'long', hairColor: 2, beard: 'aucune', glasses: 'aucune', outfit: '#ee5fa7', bg: 330 },
  neutre: { skin: 2, hair: 'court', hairColor: 3, beard: 'aucune', glasses: 'aucune', outfit: '#0f6b73', bg: 200 },
};
export const defaultAvatar = (gender = 'neutre') => ({ ...(DEFAULTS[gender] || DEFAULTS.neutre) });

const pick = (list) => list[Math.floor(Math.random() * list.length)];
export function randomAvatar(gender = 'neutre') {
  const hairs = gender === 'masculin' ? ['court', 'quiff', 'boucles', 'chauve'] : gender === 'feminin' ? ['long', 'carre', 'chignon', 'queue', 'boucles'] : HAIRS.map((h) => h[0]);
  return {
    skin: Math.floor(Math.random() * SKINS.length),
    hair: pick(hairs),
    hairColor: Math.floor(Math.random() * HAIR_COLORS.length),
    beard: gender === 'masculin' && Math.random() < 0.4 ? pick(['legere', 'barbe']) : 'aucune',
    glasses: Math.random() < 0.3 ? pick(['rondes', 'carrees']) : 'aucune',
    outfit: pick(OUTFITS),
    bg: pick(BACKS),
  };
}

// Colour helpers: mix a hex colour toward white (amt > 0) or black (amt < 0).
function mix(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const t = amt < 0 ? 0 : 255;
  const k = Math.abs(amt);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(v + (t - v) * k));
  return `rgb(${c.join(',')})`;
}

let uid = 0;

// Hair is drawn in two layers: behind the head, and in front of it.
function hairShapes(style, fill) {
  const front = {
    court: 'M71 108C66 64 94 50 122 50c30 0 52 16 47 58-8-20-24-30-48-30s-42 10-50 30Z',
    quiff: 'M69 108C56 62 96 32 132 42c32 4 48 30 38 66-8-22-22-32-50-32S80 86 69 108Z',
    long: 'M72 110C72 68 96 56 122 56s48 12 48 54c-10-22-26-30-48-30s-38 8-50 30Z',
    carre: 'M72 110C72 68 96 56 122 56s48 12 48 54c-10-22-26-30-48-30s-38 8-50 30Z',
    chignon: 'M71 108C66 64 94 50 122 50c30 0 52 16 47 58-8-20-24-30-48-30s-42 10-50 30Z',
    queue: 'M70 110C66 66 94 52 124 52c28 0 50 16 46 56-12-18-26-26-50-26-22 0-40 8-50 28Z',
  };
  const back = {
    long: 'M66 104C58 58 90 40 120 40s62 18 54 64l6 96c-18 10-100 10-120 0Z',
    carre: 'M64 100C58 56 90 40 120 40s62 16 56 60l-2 56c-14 8-94 8-108 0Z',
    queue: 'M160 84c34-4 48 40 30 84-4-24-14-42-30-52Z',
  };
  const circles = {
    boucles: [[88, 74, 20], [112, 62, 22], [138, 62, 22], [160, 76, 20], [76, 96, 16], [170, 98, 16], [100, 80, 18], [128, 78, 18], [150, 84, 16]],
    chignon: [[120, 38, 19]],
  };
  const grad = `url(#hg${uid})`;
  let out = '';
  const pathStyle = `fill="${grad}"`;
  const backPart = back[style] ? `<path d="${back[style]}" fill="${mix(fill, -0.25)}"/>` : '';
  if (style === 'chauve') return { back: '', front: `<path d="M72 96C80 68 164 68 168 96c-10-10-24-14-48-14s-38 4-48 14Z" fill="${fill}" opacity=".16"/>` };
  if (circles[style]) out += circles[style].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${grad}"/>`).join('');
  if (front[style]) out += `<path d="${front[style]}" ${pathStyle}/>`;
  if (style === 'boucles') out += `<path d="M72 108c4-24 24-34 48-34s44 10 48 34c-12-16-28-22-48-22s-36 6-48 22Z" fill="${grad}"/>`;
  return { back: backPart, front: out };
}

export function avatarSvg(cfg = {}, size = 120) {
  uid += 1;
  const a = { ...defaultAvatar('neutre'), ...cfg };
  const skin = SKINS[a.skin] || SKINS[2];
  const hair = HAIR_COLORS[a.hairColor] || HAIR_COLORS[1];
  const { back, front } = hairShapes(a.hair, hair);
  const id = uid;
  const bg = a.bg ?? 250;
  const beard =
    a.beard === 'legere'
      ? `<path d="M76 124c4 38 24 46 44 46s40-8 44-46c-8 20-22 26-44 26s-36-6-44-26Z" fill="${hair}" opacity=".32"/>`
      : a.beard === 'barbe'
        ? `<path d="M74 120c2 44 26 54 46 54s44-10 46-54c-6 22-20 30-46 30s-40-8-46-30Z" fill="${hair}" opacity=".95"/><path d="M103 142q17-9 34 0q-17 5-34 0Z" fill="${hair}"/>`
        : '';
  const glasses =
    a.glasses === 'rondes'
      ? `<g fill="rgba(255,255,255,.18)" stroke="#23202e" stroke-width="3.2"><circle cx="100" cy="115" r="15"/><circle cx="140" cy="115" r="15"/><path d="M115 114q5-4 10 0" fill="none"/><path d="M85 112 74 108M155 112l11-4" fill="none"/></g>`
      : a.glasses === 'carrees'
        ? `<g fill="rgba(255,255,255,.18)" stroke="#23202e" stroke-width="3.2"><rect x="84" y="102" width="31" height="24" rx="7"/><rect x="125" y="102" width="31" height="24" rx="7"/><path d="M115 112h10" fill="none"/><path d="M84 110 74 106M156 110l10-4" fill="none"/></g>`
        : '';
  const outfit = a.outfit || '#5b5bf0';
  return raw(`<svg class="avatar3d" width="${size}" height="${size}" viewBox="0 0 240 240" role="img" aria-label="Avatar">
  <defs>
    <linearGradient id="bg${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${bg} 90% 82%)"/><stop offset="1" stop-color="hsl(${bg + 40} 85% 64%)"/></linearGradient>
    <radialGradient id="face${id}" cx=".38" cy=".3" r=".85"><stop offset="0" stop-color="${mix(skin, 0.28)}"/><stop offset=".55" stop-color="${skin}"/><stop offset="1" stop-color="${mix(skin, -0.2)}"/></radialGradient>
    <linearGradient id="hg${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${mix(hair, 0.32)}"/><stop offset=".45" stop-color="${hair}"/><stop offset="1" stop-color="${mix(hair, -0.3)}"/></linearGradient>
    <linearGradient id="of${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${mix(outfit, 0.25)}"/><stop offset="1" stop-color="${mix(outfit, -0.28)}"/></linearGradient>
    <clipPath id="clip${id}"><rect width="240" height="240" rx="66"/></clipPath>
    <filter id="sh${id}" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="5" stdDeviation="5" flood-color="#1a1040" flood-opacity=".28"/></filter>
  </defs>
  <g clip-path="url(#clip${id})">
    <rect width="240" height="240" fill="url(#bg${id})"/>
    <circle cx="190" cy="40" r="64" fill="#fff" opacity=".22"/>
    <circle cx="30" cy="210" r="56" fill="#fff" opacity=".14"/>
    <g filter="url(#sh${id})">
      ${back}
      <path d="M34 246c0-52 40-74 86-74s86 22 86 74Z" fill="url(#of${id})"/>
      <path d="M96 172c4 18 14 28 24 28s20-10 24-28Z" fill="${mix(skin, -0.12)}"/>
      <path d="M98 172l22 30 22-30" fill="none" stroke="${mix(outfit, 0.45)}" stroke-width="5" stroke-linejoin="round" opacity=".7"/>
      <path d="M103 138h34v36c-10 9-24 9-34 0Z" fill="${mix(skin, -0.14)}"/>
      <path d="M103 150c10 8 24 8 34 0v-12h-34Z" fill="#000" opacity=".1"/>
      <ellipse cx="73" cy="120" rx="8.500" ry="13" fill="${mix(skin, -0.08)}"/>
      <ellipse cx="167" cy="120" rx="8.500" ry="13" fill="${mix(skin, -0.08)}"/>
      <ellipse cx="120" cy="112" rx="49" ry="56" fill="url(#face${id})"/>
      ${beard}
      <ellipse cx="94" cy="138" rx="11" ry="7" fill="#ff6f86" opacity=".2"/>
      <ellipse cx="146" cy="138" rx="11" ry="7" fill="#ff6f86" opacity=".2"/>
      <g fill="#2a1a24"><ellipse cx="100" cy="116" rx="5.800" ry="7.600"/><ellipse cx="140" cy="116" rx="5.800" ry="7.600"/></g>
      <g fill="#fff"><circle cx="102" cy="112.500" r="2.200"/><circle cx="142" cy="112.500" r="2.200"/></g>
      <g fill="none" stroke="${mix(hair, -0.1)}" stroke-width="4" stroke-linecap="round"><path d="M89 100q11-7 22-1"/><path d="M129 99q11-6 22 1"/></g>
      <path d="M117 124q-4 11 1 14 5 2 9-1" fill="none" stroke="${mix(skin, -0.28)}" stroke-width="2.800" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M104 144q16 15 32 0" fill="none" stroke="#8c3b46" stroke-width="3.800" stroke-linecap="round"/>
      ${front}
      <path d="M72 108c8-12 22-18 48-18s40 6 48 18" fill="none" stroke="#000" stroke-width="10" opacity=".05" stroke-linecap="round"/>
      ${glasses}
    </g>
  </g>
  <path d="M30 56a82 82 0 0 1 68-28" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".5" clip-path="url(#clip${id})"/>
</svg>`);
}

// ---------- Editor ----------

const swatch = (value, label, color, on) =>
  html`<button type="button" class="swatch" data-v="${value}" aria-pressed="${on}" aria-label="${label}" title="${label}" style="--c:${color}"></button>`;

// Mounts the editor. onChange(avatar, gender) fires on every edit.
export function mountAvatarEditor(el, { avatar, gender = 'neutre', onChange, big = true } = {}) {
  let cfg = { ...defaultAvatar(gender), ...(avatar || {}) };
  let g = gender;
  const GENDERS = [['masculin', 'Homme'], ['feminin', 'Femme'], ['neutre', 'Autre']];

  const preview = () => {
    const box = el.querySelector('.avb-preview-art');
    box.innerHTML = avatarSvg(cfg, big ? 260 : 190).toString();
    box.classList.remove('pop');
    void box.offsetWidth;
    box.classList.add('pop');
  };
  const emit = () => onChange?.(cfg, g);

  const draw = () => {
    el.innerHTML = html`<div class="avb ${big ? 'big' : ''}">
      <div class="avb-preview">
        <div class="avb-preview-art"></div>
        <button type="button" class="btn btn-secondary btn-sm" data-random>${raw('<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3.500" y="3.500" width="17" height="17" rx="4"/><circle cx="8.500" cy="8.500" r="1" fill="currentColor"/><circle cx="15.500" cy="15.500" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/></svg>')} Aléatoire</button>
      </div>
      <div class="avb-opts">
        <div class="avb-row"><span class="avb-label">Je suis</span>
          <div class="segmented" data-g>${GENDERS.map(([k, l]) => html`<button type="button" data-v="${k}" aria-pressed="${g === k}">${l}</button>`)}</div></div>
        <div class="avb-row"><span class="avb-label">Peau</span><div class="swatches" data-k="skin">${SKINS.map((c, i) => swatch(i, `Teint ${i + 1}`, c, cfg.skin === i))}</div></div>
        <div class="avb-row"><span class="avb-label">Cheveux</span><div class="chips" data-k="hair">${HAIRS.map(([k, l]) => html`<button type="button" class="chip ${cfg.hair === k ? 'on' : 'suggest'}" data-v="${k}">${l}</button>`)}</div></div>
        <div class="avb-row"><span class="avb-label">Couleur</span><div class="swatches" data-k="hairColor">${HAIR_COLORS.map((c, i) => swatch(i, `Couleur ${i + 1}`, c, cfg.hairColor === i))}</div></div>
        <div class="avb-row"><span class="avb-label">Barbe</span><div class="chips" data-k="beard">${BEARDS.map(([k, l]) => html`<button type="button" class="chip ${cfg.beard === k ? 'on' : 'suggest'}" data-v="${k}">${l}</button>`)}</div></div>
        <div class="avb-row"><span class="avb-label">Lunettes</span><div class="chips" data-k="glasses">${GLASSES.map(([k, l]) => html`<button type="button" class="chip ${cfg.glasses === k ? 'on' : 'suggest'}" data-v="${k}">${l}</button>`)}</div></div>
        <div class="avb-row"><span class="avb-label">Tenue</span><div class="swatches" data-k="outfit">${OUTFITS.map((c) => swatch(c, 'Tenue', c, cfg.outfit === c))}</div></div>
        <div class="avb-row"><span class="avb-label">Fond</span><div class="swatches" data-k="bg">${BACKS.map((h) => swatch(h, 'Fond', `hsl(${h} 85% 66%)`, cfg.bg === h))}</div></div>
      </div>
    </div>`.toString();
    preview();

    el.querySelectorAll('[data-k]').forEach((group) =>
      group.querySelectorAll('[data-v]').forEach((b) =>
        b.addEventListener('click', () => {
          const k = group.dataset.k;
          const val = b.dataset.v;
          cfg = { ...cfg, [k]: ['skin', 'hairColor', 'bg'].includes(k) ? Number(val) : val };
          group.querySelectorAll('[data-v]').forEach((x) => {
            const on = x === b;
            x.setAttribute('aria-pressed', on);
            if (x.classList.contains('chip')) {
              x.classList.toggle('on', on);
              x.classList.toggle('suggest', !on);
            }
          });
          preview();
          emit();
        }),
      ),
    );
    el.querySelectorAll('[data-g] [data-v]').forEach((b) =>
      b.addEventListener('click', () => {
        g = b.dataset.v;
        // A new gender restyles hair and outfit, but keeps the chosen skin tone and glasses.
        cfg = { ...defaultAvatar(g), skin: cfg.skin, glasses: cfg.glasses };
        draw();
        emit();
      }),
    );
    el.querySelector('[data-random]').addEventListener('click', () => {
      cfg = randomAvatar(g);
      draw();
      emit();
    });
  };
  draw();
  return { get: () => ({ avatar: cfg, gender: g }) };
}

// Small round avatar (navigation, greeting). Falls back to a plain monogram.
export function avatarBadge(profile, size = 36) {
  if (!profile?.avatar) {
    const letter = (profile?.name || '?').trim()[0]?.toUpperCase() || '?';
    return raw(`<span class="avatar-fallback" style="--s:${size}px">${letter}</span>`);
  }
  return avatarSvg(profile.avatar, size);
}
