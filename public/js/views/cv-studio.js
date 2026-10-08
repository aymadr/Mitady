// "Modifier mon CV": a Flow CV style editor. Content (personal details, sections made of entries,
// skills, languages…) and design (template, font, spacing, colors, headings…) next to a live preview.
import { S } from '../main.js';
import { html, raw, mount, api, fail, debounce, chipInput, fileToBase64, norm, esc, icons } from '../lib.js';
import { openPhotoEditor } from './photo-editor.js';

const RANGE_UNITS = {
  fontSize: ' pt', margin: ' mm', gap: ' pt', nameSize: ' pt', lineHeight: '', paraGap: ' pt', headlineSize: ' pt', headerGap: ' mm', photoBorderWidth: ' mm',
  iconSize: ' px', headSize: ' pt', headBelow: ' pt', ruleWidth: ' pt', entryGap: ' pt', dateWidth: ' mm',
};
const RESET_STYLE = {
  layout: 'classique', font: 'calibri', nameFont: '', accent: 'bleu', textColor: '', bgColor: '', bgMode: 'header', colorMode: 'single', accentOn: null,
  photoShape: 'portrait', photoSize: 'm', photoBorder: false, photoGray: false, photoPos: '',
  fontSize: 0, lineHeight: 0, margin: 0, gap: 0, nameSize: 0, headStyle: '', headCaps: '', headIcons: '', skillStyle: 'text', langStyle: 'text',
  entryStruct: '', datePos: '', subPos: '', icons: false, linkIcons: false, linkIconType: 'link', linkUnderline: false, linkBlue: false,
  align: '', contactArr: 'line', columns: 'one', summary: true,
  textAlign: '', paraGap: 0, bullet: '', entryGap: 0, titleStyle: '', subStyle: '', dateStyle: '', dateWidth: 0, keepEntries: true, linkColor: '', linkText: '', iconSize: 0,
  nameWeight: '', nameCaps: '', nameSpacing: '', headlineSize: 0, headlineStyle: '', headerGap: 0, headSize: 0, headSpacing: '', headBelow: 0, ruleWidth: 0,
  photoBorderColor: '', photoBorderWidth: 0, photoShadow: false,
};
const uid = () => Math.random().toString(36).slice(2, 8);
const I = {
  up: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m6 15 6-6 6 6"/></svg>',
  down: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
  eye: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  eyeOff: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.9 17.9A10.6 10.6 0 0 1 12 19c-6.4 0-10-7-10-7a18 18 0 0 1 5-5.7M9.9 5.2A9.7 9.7 0 0 1 12 5c6.4 0 10 7 10 7a18 18 0 0 1-2.2 3.2M1 1l22 22"/></svg>',
  trash: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>',
  grip: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>',
};
const TYPE_ICON = { employment: '💼', education: '🎓', projects: '🧩', certificates: '📜', courses: '📚', awards: '🏆', organisations: '🤝', skills: '⚡', languages: '🌍', interests: '✨', publications: '📰', references: '👥', declaration: '✍️', custom: '🧱', text: '📝' };

let ctx = null; // { update, rerender } of the page currently showing the studio
let tab = 'content';
const openKeys = new Set();
let previewEl = null;

const types = () => S.cvStyles.sectionTypes;
const sections = () => S.profile.sections;
const style = () => S.profile.cvStyle;
const isSkillsText = (s) => !s.type && /^comp[ée]tences?$/i.test((s.title || '').trim());

// ---------- Preview ----------

const PROFILE_KEYS = ['name', 'headline', 'email', 'phone', 'location', 'links', 'summary', 'skills', 'sections', 'details', 'skillLevels', 'cvManaged'];
const payload = (cvStyle) => ({ cvStyle, profile: Object.fromEntries(PROFILE_KEYS.map((k) => [k, S.profile[k]])) });

function fitPreview() {
  const f = previewEl;
  if (!f?.isConnected) return;
  const page = f.parentElement;
  const [pw, ph] = style().pageFormat === 'Letter' ? [816, 1056] : [794, 1123];
  const k = page.clientWidth / pw;
  let h = ph;
  let pages = 1;
  try {
    const doc = f.contentDocument;
    const pad = parseFloat(getComputedStyle(doc.body).paddingTop) || 0;
    const total = doc.documentElement.scrollHeight;
    h = Math.max(ph, total);
    pages = Math.max(1, Math.ceil((total - 2 * pad - 4) / (ph - 2 * pad)));
  } catch {}
  f.style.width = pw + 'px';
  f.style.transform = `scale(${k})`;
  f.style.height = h + 'px';
  page.style.height = h * k + 'px';
  const label = document.querySelector('#pages');
  if (label) label.textContent = `≈ ${pages} page${pages > 1 ? 's' : ''}`;
}

const refreshPreview = debounce(async () => {
  if (!previewEl?.isConnected) return;
  try {
    previewEl.srcdoc = tab === 'letter'
      ? await api('/profile/letter-preview', { method: 'POST', body: { ...payload(style()), letter: S.profile.letter } })
      : await api('/profile/cv-preview', { method: 'POST', body: payload(style()) });
  } catch (e) {
    fail(e);
  }
}, 250);

const refreshThumbs = debounce(() => {
  document.querySelectorAll('#layouts iframe').forEach((f) =>
    (tab === 'letter'
      ? api('/profile/letter-preview', { method: 'POST', body: { ...payload(style()), letter: { ...S.profile.letter, layout: f.dataset.layout } } })
      : api('/profile/cv-preview', { method: 'POST', body: payload({ ...style(), layout: f.dataset.layout }) }))
      .then((doc) => (f.srcdoc = doc))
      .catch(() => {}),
  );
}, 600);

// Called by the profile page after every edit.
export function studioChanged(patch) {
  refreshPreview();
  if (patch.cvStyle) refreshThumbs();
}

// ---------- Data helpers ----------

// First time the editor opens: gives sections an id and makes sure skills have a place.
function ensureManaged() {
  const p = S.profile;
  if (p.cvManaged) return;
  const next = (p.sections || []).map((s) => ({ ...s, id: s.id || uid() }));
  const hasSkills = next.some((s) => s.type === 'skills' || isSkillsText(s));
  if (!hasSkills && (p.skills || []).length) next.push({ id: uid(), type: 'skills', title: 'Compétences' });
  ctx.raw({ sections: next, cvManaged: true }); // not an undo step
}

function edit(fn, rerender = false) {
  const next = structuredClone(sections());
  fn(next);
  ctx.update({ sections: next });
  if (rerender) renderContent();
}

const RANGE = /\s*[·|,]?\s*((?:\d{1,2}\/)?\d{4})\s*[-–]\s*((?:\d{1,2}\/)?\d{4}|aujourd'hui|en cours|présent|now)\s*$/i;
const BULLET = /^[-•●▪*–]\s*/;

// Free text ("Rôle, Société · 09/2024 - 06/2025" then "- puces") to entries.
function textToEntries(body) {
  const items = [];
  let cur = null;
  for (const raw0 of String(body || '').split('\n')) {
    const l = raw0.trim();
    if (!l) continue;
    if (BULLET.test(l)) {
      cur ||= { title: '', subtitle: '', location: '', start: '', end: '', current: false, description: '' };
      cur.description += (cur.description ? '\n' : '') + '- ' + l.replace(BULLET, '');
      if (!items.includes(cur)) items.push(cur);
      continue;
    }
    cur = { title: '', subtitle: '', location: '', start: '', end: '', current: false, description: '' };
    let rest = l;
    const m = l.match(RANGE);
    if (m) {
      rest = l.slice(0, m.index);
      cur.start = m[1];
      cur.current = /aujourd|cours|présent|now/i.test(m[2]);
      cur.end = cur.current ? '' : m[2];
    }
    const cut = rest.match(/\s[-–·]\s|,\s/);
    if (cut) [cur.title, cur.subtitle] = [rest.slice(0, cut.index), rest.slice(cut.index + cut[0].length)];
    else cur.title = rest;
    cur.title = cur.title.trim();
    cur.subtitle = cur.subtitle.trim();
    items.push(cur);
  }
  return items;
}

const guessType = (title) =>
  /exp[ée]rience|emploi|stage|professionnel/i.test(title) ? 'employment'
    : /formation|[ée]ducation|dipl[oô]me|[ée]tudes/i.test(title) ? 'education'
      : /projet/i.test(title) ? 'projects'
        : /certif/i.test(title) ? 'certificates'
          : /distinction|prix|award/i.test(title) ? 'awards'
            : /associat|b[ée]n[ée]vol/i.test(title) ? 'organisations'
              : 'employment';

// ---------- Rendering: content ----------

function sectionBody(s, i) {
  const t = types()[s.type || 'text'] || types().text;
  const k = t.kind;
  if (k === 'entries') {
    const items = s.items || [];
    return html`${items.map((it, j) => {
      const key = `${s.id}.${j}`;
      return html`<details class="ent ${it.hidden ? 'is-hidden' : ''}" data-key="${key}" data-e="${j}" ${openKeys.has(key) ? raw('open') : ''}>
        <summary><span class="ent-handle" title="Glisser pour réordonner">${raw(I.grip)}</span><span class="ent-t">${it.title || it.subtitle || 'Sans titre'}</span><span class="ent-d">${[it.start, it.current ? "Aujourd'hui" : it.end].filter(Boolean).join(' – ')}</span>
          <span class="ent-act"><button class="ib" data-act="e-up" data-s="${i}" data-e="${j}" title="Monter">${raw(I.up)}</button><button class="ib" data-act="e-down" data-s="${i}" data-e="${j}" title="Descendre">${raw(I.down)}</button><button class="ib" data-act="e-hide" data-s="${i}" data-e="${j}" title="${it.hidden ? 'Afficher sur le CV' : 'Masquer du CV'}">${raw(it.hidden ? I.eyeOff : I.eye)}</button><button class="ib danger" data-act="e-del" data-s="${i}" data-e="${j}" title="Supprimer">${raw(I.trash)}</button></span></summary>
        <div class="ent-body grid-2">
          <label class="field"><span class="label">${t.f.title}</span><input class="input" data-s="${i}" data-e="${j}" data-f="title" value="${it.title || ''}"></label>
          <label class="field"><span class="label">${t.f.subtitle}</span><input class="input" data-s="${i}" data-e="${j}" data-f="subtitle" value="${it.subtitle || ''}"></label>
          <label class="field"><span class="label">Début</span><input class="input" data-s="${i}" data-e="${j}" data-f="start" value="${it.start || ''}" placeholder="MM/AAAA"></label>
          <label class="field"><span class="label">Fin</span><input class="input" data-s="${i}" data-e="${j}" data-f="end" value="${it.end || ''}" placeholder="MM/AAAA" ${it.current ? raw('disabled') : ''}>
            <label class="row small"><input type="checkbox" data-s="${i}" data-e="${j}" data-f="current" ${it.current ? raw('checked') : ''}> En cours</label></label>
          <label class="field"><span class="label">${t.f.location}</span><input class="input" data-s="${i}" data-e="${j}" data-f="location" value="${it.location || ''}"></label>
          <label class="field"><span class="label">Lien</span><input class="input" data-s="${i}" data-e="${j}" data-f="link" value="${it.link || ''}" placeholder="Facultatif"></label>
          <label class="field" style="grid-column:1/-1"><span class="label">Description</span><textarea class="textarea" rows="4" data-s="${i}" data-e="${j}" data-f="description" placeholder="Une ligne par information, « - » en début de ligne pour une puce.">${it.description || ''}</textarea></label>
        </div></details>`;
    })}
    <button class="btn btn-secondary btn-sm" data-act="e-add" data-s="${i}">${icons.plus} Ajouter</button>`;
  }
  if (k === 'skills') {
    const lv = style().skillStyle === 'bars' || style().skillStyle === 'dots';
    return html`<div class="chips-host" data-skills></div>
      ${lv && S.profile.skills.length
        ? html`<div class="lvls">${S.profile.skills.map((n) => html`<label class="lvl"><span>${n}</span><input type="range" min="1" max="5" step="1" data-level="${n}" value="${S.profile.skillLevels?.[n] || 4}"></label>`)}</div>`
        : html`<p class="hint">Ces compétences servent aussi à comparer ton profil aux offres. Pour afficher des niveaux, choisis « Barres » ou « Points » dans Design.</p>`}`;
  }
  if (k === 'languages') {
    return html`${(s.items || []).map((it, j) => html`<div class="row lang-row">
        <input class="input grow" data-s="${i}" data-e="${j}" data-f="name" value="${it.name || ''}" placeholder="Langue">
        <select class="select" data-s="${i}" data-e="${j}" data-f="level">${S.cvStyles.levels.map((l, n) => html`<option value="${n + 1}" ${Number(it.level || 3) === n + 1 ? raw('selected') : ''}>${l}</option>`)}</select>
        <button class="ib danger" data-act="e-del" data-s="${i}" data-e="${j}" title="Supprimer">${raw(I.trash)}</button></div>`)}
      <button class="btn btn-secondary btn-sm" data-act="lang-add" data-s="${i}">${icons.plus} Ajouter une langue</button>`;
  }
  if (k === 'tags') return html`<div class="chips-host" data-tags="${i}"></div>`;
  const looksOld = /exp[ée]rience|formation|projet|certif|[ée]ducation|associat|distinction/i.test(s.title || '');
  return html`<textarea class="textarea" rows="${Math.min(14, Math.max(4, String(s.body || '').split('\n').length + 1))}" data-s="${i}" data-f="body">${s.body || ''}</textarea>
    ${looksOld || s.body ? html`<button class="btn btn-secondary btn-sm" data-act="convert" data-s="${i}" style="margin-top:10px">Convertir en fiches modifiables</button>` : ''}`;
}

function sectionCard(s, i) {
  const t = types()[s.type || 'text'] || types().text;
  const key = 'sec.' + s.id;
  return html`<details class="sx ${s.hidden ? 'is-hidden' : ''}" data-i="${i}" data-key="${key}" ${openKeys.has(key) ? raw('open') : ''}>
    <summary><span class="sx-handle" title="Glisser pour réordonner">${raw(I.grip)}</span><span class="sx-ico">${TYPE_ICON[s.type || 'text']}</span>
      <input class="sx-title" data-s="${i}" data-f="title" value="${s.title}" aria-label="Titre de la rubrique">
      <span class="sx-act"><button class="ib" data-act="s-up" data-s="${i}" title="Monter">${raw(I.up)}</button><button class="ib" data-act="s-down" data-s="${i}" title="Descendre">${raw(I.down)}</button>
        <button class="ib" data-act="s-hide" data-s="${i}" title="${s.hidden ? 'Afficher sur le CV' : 'Masquer du CV'}">${raw(s.hidden ? I.eyeOff : I.eye)}</button>
        <button class="ib danger" data-act="s-del" data-s="${i}" title="Supprimer la rubrique">${raw(I.trash)}</button></span></summary>
    <div class="sx-body">${sectionBody(s, i)}</div></details>`;
}

function personal(p) {
  return html`<details class="sx" data-key="personal" ${openKeys.has('personal') || !openKeys.size ? raw('open') : ''}>
    <summary><span class="sx-ico">👤</span><span class="sx-name">Infos personnelles</span></summary>
    <div class="sx-body">
      <div class="row wrap" style="margin-bottom:14px">
        ${p.photo ? html`<img class="photo-thumb" src="/api/profile/photo?v=${Date.now()}" alt="Ta photo">` : ''}
        ${p.photo
          ? html`<button class="btn btn-secondary btn-sm" id="photo-edit">Modifier la photo</button><button class="btn btn-plain small" id="photo-change">Changer</button><button class="btn btn-danger small" id="photo-remove">Retirer</button>
              <label class="row small"><input type="checkbox" id="photo-on" ${style().photo !== false ? raw('checked') : ''}> Afficher</label>`
          : html`<button class="btn btn-secondary btn-sm" id="photo-change">Ajouter une photo</button><span class="hint" style="margin:0">Tu pourras la recadrer, zoomer, changer sa forme…</span>`}
        <input type="file" id="photo-file" accept="image/png,image/jpeg" hidden>
      </div>
      <div class="grid-2">
        <label class="field"><span class="label">Nom complet</span><input class="input" data-k="name" value="${p.name}"></label>
        <label class="field"><span class="label">Titre du poste</span><input class="input" data-k="headline" value="${p.headline}" placeholder="Ex. Apprenti ingénieur cybersécurité"></label>
        <label class="field"><span class="label">E-mail</span><input class="input" data-k="email" type="email" value="${p.email}"></label>
        <label class="field"><span class="label">Téléphone</span><input class="input" data-k="phone" value="${p.phone}"></label>
        <label class="field"><span class="label">Ville</span><input class="input" data-k="location" value="${p.location}"></label>
        <label class="field"><span class="label">Liens</span><input class="input" id="links" value="${(p.links || []).join(', ')}" placeholder="linkedin.com/in/…, github.com/…"></label>
      </div>
      <p class="hint">Le titre du poste est ce qui s'adapte à chaque offre : le reste de ton CV ne bouge pas.</p>
      <div class="field"><span class="label">Autres informations</span>
        ${(p.details || []).map((d, j) => html`<div class="row lang-row"><input class="input" style="max-width:180px" data-d="${j}" data-df="label" value="${d.label}" placeholder="Permis, Nationalité…"><input class="input grow" data-d="${j}" data-df="value" value="${d.value}" placeholder="B, Française…"><button class="ib danger" data-act="d-del" data-d="${j}">${raw(I.trash)}</button></div>`)}
        <button class="btn btn-secondary btn-sm" data-act="d-add">${icons.plus} Ajouter une information</button></div>
      <div class="field" style="margin-top:14px"><span class="label">Accord des intitulés de poste</span>
        <div class="segmented" id="gender">${[['masculin', 'Masculin'], ['feminin', 'Féminin'], ['neutre', 'Tel quel']].map(([v, l]) => html`<button data-v="${v}" aria-pressed="${p.titleGender === v}">${l}</button>`)}</div>
        <p class="hint">« Alternant(e) Ingénieur(e) H/F » devient « Alternant Ingénieur » ou « Alternante Ingénieure ».</p></div>
    </div></details>
  <details class="sx ${style().summary === false ? 'is-hidden' : ''}" data-key="summary" ${openKeys.has('summary') ? raw('open') : ''}>
    <summary><span class="sx-ico">🙋</span><span class="sx-name">Profil</span>
      <span class="sx-act"><button class="ib" data-act="sum-hide" title="${style().summary === false ? 'Afficher sur le CV' : 'Masquer du CV'}">${raw(style().summary === false ? I.eyeOff : I.eye)}</button></span></summary>
    <div class="sx-body"><textarea class="textarea" data-k="summary" rows="4" placeholder="Qui tu es, ce que tu sais faire, ce que tu cherches.">${p.summary}</textarea></div></details>`;
}

function contentPanel() {
  const p = S.profile;
  const t = types();
  return html`${personal(p)}
    <div id="secs">${sections().map(sectionCard)}</div>
    <button type="button" class="btn btn-primary add-btn" data-act="open-add">${icons.plus} Ajouter du contenu</button>`;
}

// ---------- Rendering: design ----------

const HEAD_STYLES = [['', 'Modèle'], ['line', 'Trait'], ['accent', 'Trait couleur'], ['shade', 'Bandeau gris'], ['center', 'Centré'], ['bar', 'Barre'], ['plain', 'Simple'], ['short', 'Trait court'], ['wavy', 'Ondulé'], ['box', 'Bloc']];
const DEFAULT_ACCENT_ON = ['jobTitle', 'headerIcons', 'bars', 'linkIcons'];
const isHexColor = (v) => /^#[0-9a-f]{6}$/i.test(v || '');
const isLight = (h) => { const n = parseInt(h.slice(1), 16); return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) > 150; };

const seg = (key, entries, value) =>
  html`<div class="segmented" data-style="${key}">${entries.map(([k, label]) => html`<button type="button" data-v="${k}" aria-pressed="${String(value) === String(k)}">${label}</button>`)}</div>`;
const check = (key, label, on) => html`<label class="chk"><input type="checkbox" data-toggle="${key}" ${on ? raw('checked') : ''}><span>${label}</span></label>`;
const dcard = (title, body, id = '') => html`<section class="dcard" ${id ? raw(`id="${id}"`) : ''}><h4>${title}</h4>${body}</section>`;
const range = (cur, key, min, max, step, unit, auto) =>
  html`<div class="rng"><input type="range" min="${min}" max="${max}" step="${step}" data-range="${key}" value="${cur[key] || auto}"><span class="rng-v" data-rv="${key}">${cur[key] ? cur[key] + unit : 'Auto'}</span>${cur[key] ? html`<button type="button" class="btn btn-plain small" data-act="auto" data-key="${key}">Auto</button>` : ''}</div>`;
const adv = (key, body) => html`<details class="adv" data-key="adv-${key}" ${openKeys.has('adv-' + key) ? raw('open') : ''}><summary>Réglages avancés</summary><div class="adv-body">${body}</div></details>`;
const field = (label, body) => html`<div class="field"><span class="label">${label}</span>${body}</div>`;
const colorField = (cur, key, label, fallback) =>
  html`<div class="field"><span class="label">${label}</span><div class="row"><input type="color" class="clr" data-color="${key}" value="${isHexColor(cur[key]) ? cur[key] : fallback}">${cur[key] ? html`<button type="button" class="btn btn-plain small" data-act="clear-key" data-key="${key}">Auto</button>` : html`<span class="small muted">Auto</span>`}</div></div>`;
const fontSelect = (st, key, value, withSame) => {
  const groups = ['Sans', 'Serif', 'Slab', 'Mono'];
  return html`<select class="select" data-font="${key}">${withSame ? html`<option value="" ${!value ? raw('selected') : ''}>Comme le corps du texte</option>` : ''}${groups.map((g) => html`<optgroup label="${g === 'Sans' ? 'Sans empattement' : g === 'Serif' ? 'Avec empattement' : g === 'Slab' ? 'Slab' : 'Monospace'}">${Object.entries(st.fonts).filter(([, f]) => f.group === g).map(([k, f]) => html`<option value="${k}" ${value === k ? raw('selected') : ''}>${f.label}</option>`)}</optgroup>`)}</select>`;
};

function designPanel() {
  const st = S.cvStyles;
  const cur = style();
  const atsOk = st.layouts[cur.layout]?.ats && cur.columns !== 'two' && !cur.bgColor;
  const mode = cur.colorMode || (isHexColor(cur.bgColor) ? 'multi' : 'single');
  const accentOn = new Set(cur.accentOn || DEFAULT_ACCENT_ON);
  const customAccent = isHexColor(cur.accent);

  const templates = dcard('Modèle', html`
    <div class="templates" id="layouts">${Object.entries(st.layouts).map(([k, l]) => html`<button type="button" class="tpl" data-v="${k}" aria-pressed="${cur.layout === k}">
      <span class="tpl-thumb"><iframe tabindex="-1" data-layout="${k}" title="${l.label}" sandbox="allow-same-origin"></iframe></span>
      <span class="tpl-name">${l.label}</span><span class="tpl-tag ${l.ats ? 'ats' : ''}">${l.ats ? 'ATS' : 'Design'}</span></button>`)}</div>
    <p class="hint ${atsOk ? '' : 'warn'}">${atsOk ? 'Compatible ATS : une colonne, texte réel, lu sans erreur par les logiciels de tri.' : 'Ce réglage est plus visuel : à privilégier pour un envoi direct à une personne. Pour un logiciel de tri (ATS), garde un modèle « ATS » en une colonne, sans fond coloré.'}</p>`);

  const layout = dcard('Mise en page', html`
    <div class="grid-2">
      <div class="field"><span class="label">Marges</span>${range(cur, 'margin', 8, 22, 1, ' mm', 12)}</div>
      <div class="field"><span class="label">Taille du texte</span>${range(cur, 'fontSize', 8, 11, 0.1, ' pt', 9.2)}</div>
      <div class="field"><span class="label">Interligne</span>${range(cur, 'lineHeight', 1.05, 1.7, 0.05, '', 1.25)}</div>
      <div class="field"><span class="label">Espace entre rubriques</span>${range(cur, 'gap', 2, 18, 1, ' pt', 6)}</div>
    </div>
    <div class="field"><span class="label">Colonnes</span>${seg('columns', [['one', 'Une colonne'], ['two', 'Deux colonnes']], cur.columns || 'one')}
      <p class="hint">Deux colonnes : compétences, langues et centres d'intérêt passent à droite.</p></div>
    ${adv('layout', html`
      ${field('Alignement du texte', seg('textAlign', [['', 'Selon le modèle'], ['left', 'Gauche'], ['justify', 'Justifié']], cur.textAlign || ''))}
      ${field('Espace entre paragraphes', range(cur, 'paraGap', 1, 8, 0.5, ' pt', 1.5))}
      ${field('Puces', seg('bullet', [['', 'Selon le modèle'], ['dash', 'Tiret'], ['dot', 'Point'], ['arrow', 'Flèche'], ['square', 'Carré'], ['none', 'Aucune']], cur.bullet || ''))}`)}`);

  const fonts = dcard('Police', html`
    <div class="field"><span class="label">Texte</span>${fontSelect(st, 'font', cur.font, false)}</div>
    <div class="field"><span class="label">Nom et titre</span>${fontSelect(st, 'nameFont', cur.nameFont, true)}</div>
    <div class="field"><span class="label">Taille du nom</span>${range(cur, 'nameSize', 16, 32, 1, ' pt', 20)}</div>
    <p class="font-sample" style="font-family:${st.fonts[cur.font]?.stack || 'inherit'}">Analyste cybersécurité · Aa Bb Cc 0123</p>`);

  const colors = dcard('Couleurs', html`
    <div class="field"><span class="label">Appliquer le fond sur</span>
      <div class="zones" data-style="bgMode">${[['page', 'Page entière'], ['header', 'En-tête'], ['border', 'Bordure']].map(([k, l]) => html`<button type="button" class="zone zone-${k}" data-v="${k}" aria-pressed="${(cur.bgMode || 'header') === k}"><i></i><span>${l}</span></button>`)}</div></div>
    <div class="field"><span class="label">Palette</span>${seg('colorMode', [['single', 'Simple'], ['multi', 'Multi']], mode)}</div>
    ${mode === 'single'
      ? html`<div class="swatches" data-style="accent">${Object.entries(st.accents).map(([k, v]) => html`<button type="button" class="swatch" data-v="${k}" aria-pressed="${cur.accent === k}" aria-label="${v.label}" title="${v.label}" style="--c:${v.color}"></button>`)}
          <label class="swatch custom" title="Couleur personnalisée" style="--c:${customAccent ? cur.accent : '#ffffff'}" aria-pressed="${customAccent}"><input type="color" id="accent-custom" value="${customAccent ? cur.accent : '#1f3a93'}"></label></div>`
      : html`<div class="palettes">${st.palettes.map((p, i) => html`<button type="button" class="pal" data-pal="${i}" title="${p.label}" aria-pressed="${cur.bgColor === p.bg && cur.accent === p.accent}" style="--pb:${p.bg};--pa:${p.accent};--pi:${isLight(p.bg) ? '#222' : '#fff'}"><span class="pal-l"><b>T</b><i></i></span><span class="pal-r"><b>T</b><i></i></span></button>`)}</div>
        <div class="custom-colors">
          <label><span>Texte</span><input type="color" data-color="textColor" value="${isHexColor(cur.textColor) ? cur.textColor : '#222222'}"></label>
          <label><span>Fond</span><input type="color" data-color="bgColor" value="${isHexColor(cur.bgColor) ? cur.bgColor : '#f4f1e8'}"></label>
          <label><span>Accent</span><input type="color" data-color="accent" value="${customAccent ? cur.accent : (st.accents[cur.accent]?.color || '#1f3a93')}"></label>
          ${cur.bgColor ? html`<button type="button" class="btn btn-plain small" data-act="no-bg">Sans fond</button>` : ''}
        </div>`}
    <div class="field" style="margin-top:16px"><span class="label">Appliquer la couleur d'accent à</span>
      <div class="chk-grid">${Object.entries(st.accentKeys).map(([k, l]) => html`<label class="chk"><input type="checkbox" data-acc="${k}" ${accentOn.has(k) ? raw('checked') : ''}><span>${l}</span></label>`)}</div></div>`);

  const header = dcard('En-tête', html`
    <div class="field"><span class="label">Alignement du texte</span>${seg('align', [['', 'À gauche'], ['center', 'Centré']], cur.align || '')}</div>
    <div class="field"><span class="label">Arrangement des coordonnées</span>${seg('contactArr', [['line', 'Sur une ligne'], ['cols', 'Deux colonnes'], ['stack', 'En liste']], cur.contactArr || 'line')}</div>
    <div class="row wrap" style="margin-top:12px">${check('icons', 'Icônes pour e-mail, téléphone, ville', cur.icons)}</div>
    ${adv('header', html`
      ${field('Graisse du nom', seg('nameWeight', [['', 'Selon le modèle'], ['light', 'Fine'], ['normal', 'Normale'], ['bold', 'Grasse']], cur.nameWeight || ''))}
      ${field('Majuscules du nom', seg('nameCaps', [['', 'Selon le modèle'], ['off', 'Telles quelles'], ['on', 'MAJUSCULES']], cur.nameCaps || ''))}
      ${field('Espacement des lettres du nom', seg('nameSpacing', [['', 'Selon le modèle'], ['tight', 'Serré'], ['normal', 'Normal'], ['wide', 'Large']], cur.nameSpacing || ''))}
      ${field('Taille du titre du poste', range(cur, 'headlineSize', 9, 18, 0.5, ' pt', 12))}
      ${field('Style du titre du poste', seg('headlineStyle', [['', 'Selon le modèle'], ['normal', 'Normal'], ['italic', 'Italique'], ['bold', 'Gras']], cur.headlineStyle || ''))}
      ${field("Espace sous l'en-tête", range(cur, 'headerGap', 1, 16, 1, ' mm', 4))}`)}`);

  const photo = dcard('Photo', html`
    <div class="row wrap">${check('photo', 'Afficher', cur.photo !== false)}${check('photoGray', 'Noir et blanc', cur.photoGray)}${check('photoBorder', 'Cadre', cur.photoBorder)}</div>
    <div class="field" style="margin-top:14px"><span class="label">Position</span>${seg('photoPos', [['', 'Selon le modèle'], ['left', 'Gauche'], ['top', 'Haut'], ['right', 'Droite']], cur.photoPos || '')}</div>
    <div class="field"><span class="label">Taille</span>${seg('photoSize', Object.entries(st.photoSizes), cur.photoSize || 'm')}</div>
    <div class="field"><span class="label">Forme</span><div class="shapes" data-style="photoShape">${Object.entries(st.photoShapes).map(([k, l]) => html`<button type="button" class="shp shp-${k}" data-v="${k}" aria-pressed="${(cur.photoShape || 'portrait') === k}" title="${l}"><i></i></button>`)}</div></div>
    ${adv('photo', html`
      ${colorField(cur, 'photoBorderColor', 'Couleur du cadre', '#1f3a93')}
      ${field('Épaisseur du cadre', range(cur, 'photoBorderWidth', 0.2, 2, 0.1, ' mm', 0.55))}
      <div class="row wrap">${check('photoShadow', 'Ombre portée', cur.photoShadow)}</div>`)}`);

  const links = dcard('Liens', html`
    <div class="row wrap">${check('linkUnderline', 'Souligné', cur.linkUnderline)}${check('linkBlue', 'En bleu', cur.linkBlue)}${check('linkIcons', 'Logo devant les liens (LinkedIn, GitHub…)', cur.linkIcons)}</div>
    ${cur.linkIcons ? html`<div class="field" style="margin-top:12px"><span class="label">Icône des autres liens</span>${seg('linkIconType', [['link', 'Chaîne'], ['external', 'Flèche']], cur.linkIconType || 'link')}</div>` : ''}
    ${adv('links', html`
      ${field('Texte des liens', seg('linkText', [['', 'Tel quel'], ['short', 'Sans https://'], ['name', 'Nom du site']], cur.linkText || ''))}
      ${colorField(cur, 'linkColor', 'Couleur des liens', '#1a56c8')}
      ${field('Taille des icônes', range(cur, 'iconSize', 7, 16, 1, ' px', 9))}`)}`);

  const heads = dcard('Titres de rubrique', html`
    <div class="hstyles" data-style="headStyle">${HEAD_STYLES.map(([k, l]) => html`<button type="button" class="hs hs-${k || 'tpl'}" data-v="${k}" aria-pressed="${(cur.headStyle || '') === k}"><span class="hs-prev"><b>Titre</b><i></i></span><small>${l}</small></button>`)}</div>
    <div class="field" style="margin-top:14px"><span class="label">Majuscules</span>${seg('headCaps', [['', 'Selon le modèle'], ['off', 'Telles quelles'], ['on', 'MAJUSCULES']], cur.headCaps || '')}</div>
    <div class="field"><span class="label">Icônes</span>${seg('headIcons', [['', 'Selon le modèle'], ['none', 'Aucune'], ['outline', 'Contour'], ['filled', 'Rempli']], cur.headIcons || '')}</div>
    ${adv('heads', html`
      ${field('Taille des titres', range(cur, 'headSize', 8, 15, 0.5, ' pt', 10.5))}
      ${field('Espacement des lettres', seg('headSpacing', [['', 'Selon le modèle'], ['normal', 'Normal'], ['wide', 'Large']], cur.headSpacing || ''))}
      ${field('Espace sous le titre', range(cur, 'headBelow', 1, 12, 0.5, ' pt', 4))}
      ${field('Épaisseur du trait', range(cur, 'ruleWidth', 0.3, 3, 0.1, ' pt', 0.8))}`)}`);

  const entries = dcard('Fiches (expériences, formations…)', html`
    <div class="field"><span class="label">Structure</span>
      <div class="structs" data-style="entryStruct">${[['', 'Selon le modèle', 'full'], ['full', 'Pleine largeur', 'full'], ['cols', 'Colonnes', 'cols']].map(([k, l, ic]) => html`<button type="button" class="struct struct-${ic}" data-v="${k}" aria-pressed="${(cur.entryStruct || '') === k}"><i></i><i></i><i></i><small>${l}</small></button>`)}</div></div>
    <div class="field"><span class="label">Position des dates et du lieu</span>${seg('datePos', [['', 'Selon le modèle'], ['right', 'Droite'], ['left', 'Gauche'], ['split', 'Séparés']], cur.datePos || '')}</div>
    <div class="field"><span class="label">Sous-titre</span>${seg('subPos', [['', 'Selon le modèle'], ['same', 'Sur la même ligne'], ['below', 'Sous le titre']], cur.subPos || '')}</div>
    ${adv('entries', html`
      ${field('Espace entre les fiches', range(cur, 'entryGap', 1, 16, 0.5, ' pt', 4))}
      ${field('Titre des fiches', seg('titleStyle', [['', 'Selon le modèle'], ['normal', 'Normal'], ['bold', 'Gras']], cur.titleStyle || ''))}
      ${field('Sous-titre', seg('subStyle', [['', 'Selon le modèle'], ['normal', 'Normal'], ['italic', 'Italique'], ['bold', 'Gras']], cur.subStyle || ''))}
      ${field('Dates et lieu', seg('dateStyle', [['', 'Selon le modèle'], ['normal', 'Normal'], ['italic', 'Italique'], ['bold', 'Gras']], cur.dateStyle || ''))}
      ${field('Largeur de la colonne des dates', range(cur, 'dateWidth', 16, 44, 1, ' mm', 27))}
      <div class="row wrap">${check('keepEntries', "Ne pas couper une fiche entre deux pages", cur.keepEntries !== false)}</div>`)}`);

  const skills = dcard('Compétences et langues', html`
    <div class="field"><span class="label">Compétences</span>${seg('skillStyle', [['text', 'Texte'], ['chips', 'Pastilles'], ['bars', 'Barres'], ['dots', 'Points']], cur.skillStyle || 'text')}</div>
    <div class="field"><span class="label">Langues</span>${seg('langStyle', [['text', 'Texte'], ['bars', 'Barres'], ['dots', 'Points']], cur.langStyle || 'text')}</div>`);

  return html`${templates}${layout}${fonts}${colors}${header}${photo}${links}${heads}${entries}${skills}
    <button type="button" class="btn btn-plain small" data-act="reset-design">Réinitialiser le design</button>`;
}

// ---------- Rendering: document ----------

function documentPanel() {
  const st = S.cvStyles;
  const cur = style();
  return html`${dcard('Paramètres du document', html`
    <div class="field"><span class="label">Langue du CV</span>${seg('docLang', Object.entries(st.langs), cur.docLang || 'fr')}
      <p class="hint">Traduit ce que l'app écrit elle-même (Profil, Contact, « Aujourd'hui », les mois, les niveaux de langue et les titres de rubrique par défaut). Tes propres textes ne sont pas traduits.</p></div>
    <div class="field"><span class="label">Format des dates</span>${seg('dateFormat', Object.entries(st.dateFormats), cur.dateFormat || 'mmyyyy')}</div>
    <div class="field"><span class="label">Format de page</span>${seg('pageFormat', Object.entries(st.pageFormats), cur.pageFormat || 'A4')}
      <p class="hint">A4 en France et en Europe, Letter aux États-Unis et au Canada.</p></div>
    ${adv('doc', html`${field('Numéros de page', seg('pageNumbers', [['', 'Aucun'], ['center', 'Centrés'], ['right', 'À droite']], cur.pageNumbers || ''))}
      <p class="hint">Affichés en bas des pages du PDF (« 1 / 2 »), pas dans l'aperçu.</p>`)}`)}`;
}

// ---------- Section ----------

export function cvStudioSection(p) {
  const hasFile = Boolean(p.cvFile);
  const own = p.cvFile?.type === 'docx' ? 'ton fichier Word, adapté à chaque offre' : 'ton PDF tel quel';
  return html`<section class="section" id="studio">
    <div class="section-head"><h2 class="section-title">Modifier mon CV</h2><span class="section-note">Toujours envoyé en PDF</span></div>
    <div class="card" style="margin-bottom:16px">
      <div class="field"><span class="label">Quel CV utiliser ?</span>
        <div class="segmented" id="cv-mode">
          <button data-v="own" aria-pressed="${p.cvMode !== 'app' && hasFile}" ${hasFile ? '' : raw('disabled')}>Garder mon CV</button>
          <button data-v="app" aria-pressed="${p.cvMode === 'app' || !hasFile}">Modèle de l'app (ATS)</button>
        </div>
        <p class="hint">${hasFile
          ? html`${p.cvMode === 'app' ? 'Ton CV est mis en page par l\'app : seul le titre du poste change selon l\'offre.' : `Tes candidatures partent avec ${own}.`} Tu peux changer pour chaque offre.`
          : "Importe ton CV plus haut pour pouvoir le garder tel quel. Sans fichier, l'app construit ton CV à partir de ce que tu remplis ici."}</p>
      </div>
    </div>
    <div class="studio">
      <div class="studio-edit">
        <div class="segmented studio-tabs" id="studio-tabs"><button data-v="content" aria-pressed="true">Contenu</button><button data-v="design" aria-pressed="false">Design</button><button data-v="doc" aria-pressed="false">Document</button><button data-v="letter" aria-pressed="false">Lettre</button></div>
        <div id="studio-panel"></div>
      </div>
      <div class="studio-hist on"><button type="button" data-undo title="Annuler (Ctrl+Z)" aria-label="Annuler"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3"/></svg></button><button type="button" data-redo title="Rétablir (Ctrl+Y)" aria-label="Rétablir"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 14 5-5-5-5M20 9H10a6 6 0 0 0 0 12h3"/></svg></button></div>
      <div class="studio-prev"><div class="row" style="justify-content:space-between;margin-bottom:8px"><span class="label" style="margin:0">Aperçu en direct</span><span class="small muted" id="pages"></span></div>
        <div class="preview"><div class="preview-page"><iframe id="studio-preview" title="Aperçu du CV" sandbox="allow-same-origin"></iframe></div></div></div>
    </div>
  </section>`;
}

function renderContent() {
  const panel = document.querySelector('#studio-panel');
  if (!panel) return;
  if (sections().some((s) => !s.id)) ctx.raw({ sections: sections().map((s) => ({ ...s, id: s.id || uid() })) });
  mount(panel, contentPanel());
  bindContent(panel);
}

function renderDesign() {
  const panel = document.querySelector('#studio-panel');
  if (!panel) return;
  const y = panel.scrollTop;
  mount(panel, designPanel());
  bindDesign(panel);
  panel.scrollTop = y;
}

function renderTab() {
  if (tab === 'design') renderDesign();
  else if (tab === 'doc') renderDocument();
  else if (tab === 'letter') renderLetter();
  else renderContent();
}

function renderLetter() {
  const panel = document.querySelector('#studio-panel');
  if (!panel) return;
  mount(panel, letterPanel());
  bindLetter(panel);
}

function renderDocument() {
  const panel = document.querySelector('#studio-panel');
  if (!panel) return;
  mount(panel, documentPanel());
  bindDocument(panel);
}

let fontsLoaded = false;
function loadFonts() {
  if (fontsLoaded) return;
  fontsLoaded = true;
  const fam = Object.values(S.cvStyles.fonts).filter((f) => f.g).map((f) => 'family=' + f.g).join('&');
  const l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = `https://fonts.googleapis.com/css2?${fam}&display=swap`;
  document.head.appendChild(l);
}

// ---------- Undo / redo ----------

const HIST_KEYS = ['letter', 'name', 'headline', 'email', 'phone', 'location', 'links', 'summary', 'skills', 'sections', 'details', 'skillLevels', 'cvStyle', 'photoCrop'];
let past = [];
let future = [];
let lastPush = 0;

function pick(keys) {
  return Object.fromEntries(keys.map((k) => [k, structuredClone(S.profile[k] ?? null)]));
}

function refreshHistBar() {
  const bar = document.querySelector('.studio-hist');
  if (!bar) return;
  bar.querySelector('[data-undo]').disabled = !past.length;
  bar.querySelector('[data-redo]').disabled = !future.length;
}

function record(patch) {
  const keys = Object.keys(patch).filter((k) => HIST_KEYS.includes(k));
  if (!keys.length) return;
  const now = Date.now();
  const last = past[past.length - 1];
  // What changes: for the style, the options touched, so two different choices are two steps.
  const sig = keys.map((k) => (k === 'cvStyle' ? 'cvStyle:' + Object.keys(patch.cvStyle || {}).filter((o) => JSON.stringify(patch.cvStyle[o]) !== JSON.stringify(S.profile.cvStyle?.[o])).join(',') : k)).join('|');
  // Typing in the same field is one step.
  if (last && now - lastPush < 700 && sig === last.sig) {
    lastPush = now;
    return;
  }
  past.push({ keys, sig, before: pick(keys) });
  if (past.length > 80) past.shift();
  future = [];
  lastPush = now;
  refreshHistBar();
}

function stepHistory(from, to) {
  const e = from.pop();
  if (!e) return;
  to.push({ keys: e.keys, sig: e.sig, before: pick(e.keys) });
  // The server merges style objects: options that did not exist before the step are blanked, not left behind.
  const restore = { ...e.before };
  for (const k of ['cvStyle', 'letter']) {
    if (restore[k] && S.profile[k]) restore[k] = { ...Object.fromEntries(Object.keys(S.profile[k]).filter((x) => x !== 'photoShapeV2').map((x) => [x, ''])), ...restore[k] };
  }
  ctx.raw(restore);
  lastPush = 0;
  renderTab();
  refreshHistBar();
}

export function bindCvStudio(view, c) {
  past = [];
  future = [];
  ctx = { ...c, raw: c.update, update: (patch) => { record(patch); c.update(patch); } };
  view.querySelector('[data-undo]')?.addEventListener('click', () => stepHistory(past, future));
  view.querySelector('[data-redo]')?.addEventListener('click', () => stepHistory(future, past));
  if (!window.__studioKeys) {
    window.__studioKeys = true;
    document.addEventListener('keydown', (e) => {
      if (!document.querySelector('#studio') || !(e.ctrlKey || e.metaKey) || e.target.closest?.('input, textarea, select')) return;
      if (e.key === 'z' || e.key === 'Z') { e.preventDefault(); e.shiftKey ? stepHistory(future, past) : stepHistory(past, future); }
      if (e.key === 'y' || e.key === 'Y') { e.preventDefault(); stepHistory(future, past); }
    });
  }
  refreshHistBar();
  ensureManaged();
  loadFonts();
  previewEl = view.querySelector('#studio-preview');
  previewEl.addEventListener('load', fitPreview);
  new ResizeObserver(fitPreview).observe(previewEl.parentElement);
  refreshPreview();
  const render = () => renderTab();
  const tabs = view.querySelector('#studio-tabs');
  tabs.querySelectorAll('[data-v]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.v === tab));
  tabs.querySelectorAll('[data-v]').forEach((b) =>
    b.addEventListener('click', () => {
      tab = b.dataset.v;
      tabs.querySelectorAll('[data-v]').forEach((x) => x.setAttribute('aria-pressed', x === b));
      render();
      refreshPreview();
    }),
  );
  const modes = view.querySelector('#cv-mode');
  modes.querySelectorAll('[data-v]').forEach((b) =>
    b.addEventListener('click', () => {
      modes.querySelectorAll('[data-v]').forEach((x) => x.setAttribute('aria-pressed', x === b));
      c.update({ cvMode: b.dataset.v });
    }),
  );
  render();
}

// ---------- Add content ----------

function addSection(type) {
  const id = uid();
  const t = types()[type];
  const base = { id, type, title: t.label, items: [] };
  if (t.kind === 'entries') base.items = [{ title: '', subtitle: '', location: '', start: '', end: '', current: false, link: '', description: '' }];
  if (t.kind === 'text') base.body = '';
  if (t.kind === 'languages') base.items = [{ name: '', level: 3 }];
  ctx.update({ sections: [...sections(), base] });
  openKeys.add('sec.' + id);
  if (base.items.length) openKeys.add(`${id}.0`);
  renderContent();
  document.querySelector(`[data-key="sec.${id}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

function openAddModal() {
  const wrap = document.createElement('div');
  wrap.className = 'modal-wrap';
  const t = types();
  wrap.innerHTML = html`<div class="add-modal" role="dialog" aria-modal="true" aria-label="Ajouter du contenu">
    <button type="button" class="x" aria-label="Fermer">${icons.x}</button>
    <h3>Ajouter du contenu</h3>
    <div class="add-cards">${Object.entries(t).map(([k, v]) => html`<button type="button" class="add-card ${k === 'custom' ? 'dashed' : ''}" data-type="${k}"><b><span>${TYPE_ICON[k]}</span>${v.label}</b><small>${v.desc || ''}</small></button>`)}</div>
  </div>`.toString();
  document.body.appendChild(wrap);
  const close = () => {
    document.removeEventListener('keydown', onKey);
    wrap.remove();
  };
  const onKey = (e) => e.key === 'Escape' && close();
  document.addEventListener('keydown', onKey);
  wrap.addEventListener('pointerdown', (e) => e.target === wrap && close());
  wrap.querySelector('.x').addEventListener('click', close);
  wrap.querySelectorAll('[data-type]').forEach((b) => b.addEventListener('click', () => { close(); addSection(b.dataset.type); }));
}

// ---------- Content bindings ----------

function bindContent(panel) {
  const p = S.profile;
  panel.querySelectorAll('details[data-key]').forEach((d) => d.addEventListener('toggle', () => (d.open ? openKeys.add(d.dataset.key) : openKeys.delete(d.dataset.key))));
  // Buttons inside <summary> must not toggle the section.
  panel.querySelectorAll('summary button, summary input').forEach((el) => el.addEventListener('click', (e) => e.preventDefault()));
  panel.querySelectorAll('summary input').forEach((el) => el.addEventListener('keydown', (e) => e.stopPropagation()));
  panel.querySelectorAll('summary input').forEach((el) => el.addEventListener('click', (e) => { e.stopPropagation(); el.focus(); }));

  panel.querySelectorAll('[data-k]').forEach((el) => el.addEventListener('input', () => ctx.update({ [el.dataset.k]: el.value })));
  panel.querySelector('#links')?.addEventListener('input', (e) => ctx.update({ links: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) }));
  const gender = panel.querySelector('#gender');
  gender?.querySelectorAll('[data-v]').forEach((b) =>
    b.addEventListener('click', () => {
      gender.querySelectorAll('[data-v]').forEach((x) => x.setAttribute('aria-pressed', x === b));
      ctx.update({ titleGender: b.dataset.v });
    }),
  );
  panel.querySelectorAll('[data-d]').forEach((el) =>
    el.addEventListener('input', () => ctx.update({ details: S.profile.details.map((d, j) => (j === Number(el.dataset.d) ? { ...d, [el.dataset.df]: el.value } : d)) })),
  );

  // Photo
  const file = panel.querySelector('#photo-file');
  const editPhoto = async (f) => {
    const out = await openPhotoEditor({ file: f, style: style(), crop: S.profile.photoCrop });
    if (!out) return;
    try {
      const body = { name: 'photo.jpg', data: await fileToBase64(out.blob) };
      if (out.original) body.original = { name: out.original.name, data: await fileToBase64(out.original) };
      const res = await api('/profile/photo', { method: 'POST', body });
      const cvStyle = { ...style(), ...out.style, photo: true };
      S.profile = { ...S.profile, photo: res.profile.photo, photoOriginal: res.profile.photoOriginal, photoCrop: out.crop, cvStyle };
      ctx.update({ cvStyle, photoCrop: out.crop });
      renderContent();
    } catch (e) {
      fail(e);
    }
  };
  panel.querySelector('#photo-change')?.addEventListener('click', () => file.click());
  panel.querySelector('#photo-edit')?.addEventListener('click', () => editPhoto(null));
  file?.addEventListener('change', () => {
    const f = file.files[0];
    file.value = '';
    if (f) editPhoto(f);
  });
  panel.querySelector('#photo-on')?.addEventListener('change', (e) => ctx.update({ cvStyle: { ...style(), photo: e.target.checked } }));
  panel.querySelector('#photo-remove')?.addEventListener('click', async () => {
    try {
      await api('/profile/photo', { method: 'DELETE' });
      S.profile.photo = null;
      studioChanged({});
      renderContent();
    } catch (e) {
      fail(e);
    }
  });

  // Sections: fields
  panel.querySelectorAll('[data-s][data-f]').forEach((el) => {
    const evt = el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : 'input';
    el.addEventListener(evt, () => {
      const i = Number(el.dataset.s);
      const j = el.dataset.e === undefined ? null : Number(el.dataset.e);
      const f = el.dataset.f;
      const v = el.type === 'checkbox' ? el.checked : f === 'level' ? Number(el.value) : el.value;
      edit((next) => {
        if (j === null) next[i][f] = v;
        else next[i].items[j][f] = v;
      });
      if (f === 'current') renderContent();
      if (f === 'title' && j !== null) {
        const t = el.closest('details')?.querySelector('.ent-t');
        if (t) t.textContent = v || 'Sans titre';
      }
    });
  });

  // Skills / interests chips
  const sk = panel.querySelector('[data-skills]');
  if (sk) {
    chipInput(sk, [...p.skills], (skills) => ctx.update({ skills }), { placeholder: 'Ajouter une compétence' });
    const domain = S.domains.find((d) => d.id === p.search.domain);
    const sug = (domain?.skills || []).filter((s) => !p.skills.some((x) => norm(x) === norm(s))).slice(0, 24);
    if (sug.length) {
      const box = document.createElement('div');
      box.className = 'chips';
      box.style.marginTop = '12px';
      box.innerHTML = sug.map((s) => `<button class="chip suggest" data-s="${esc(s)}">+ ${esc(s)}</button>`).join('');
      sk.after(box);
      box.querySelectorAll('[data-s]').forEach((b) => b.addEventListener('click', () => { ctx.update({ skills: [...S.profile.skills, b.dataset.s] }); renderContent(); }));
    }
    panel.querySelectorAll('[data-level]').forEach((r) =>
      r.addEventListener('input', () => ctx.update({ skillLevels: { ...(S.profile.skillLevels || {}), [r.dataset.level]: Number(r.value) } })),
    );
  }
  panel.querySelectorAll('[data-tags]').forEach((host) => {
    const i = Number(host.dataset.tags);
    chipInput(host, (sections()[i].items || []).map((x) => x.name), (names) => edit((next) => (next[i].items = names.map((name) => ({ name })))), { placeholder: 'Ajouter un centre d\'intérêt' });
  });

  // Sections: actions
  panel.querySelectorAll('[data-act]').forEach((b) =>
    b.addEventListener('click', () => {
      const i = Number(b.dataset.s);
      const j = Number(b.dataset.e);
      const move = (arr, a, to) => {
        if (to < 0 || to >= arr.length) return;
        arr.splice(to, 0, arr.splice(a, 1)[0]);
      };
      switch (b.dataset.act) {
        case 's-up': return edit((n) => move(n, i, i - 1), true);
        case 's-down': return edit((n) => move(n, i, i + 1), true);
        case 's-hide': return edit((n) => (n[i].hidden = !n[i].hidden), true);
        case 's-del':
          if (!confirm(`Supprimer la rubrique « ${sections()[i].title} » ?`)) return;
          return edit((n) => n.splice(i, 1), true);
        case 'e-up': return edit((n) => move(n[i].items, j, j - 1), true);
        case 'e-down': return edit((n) => move(n[i].items, j, j + 1), true);
        case 'e-del': return edit((n) => n[i].items.splice(j, 1), true);
        case 'e-add':
          edit((n) => (n[i].items = [...(n[i].items || []), { title: '', subtitle: '', location: '', start: '', end: '', current: false, link: '', description: '' }]), true);
          openKeys.add(`${sections()[i].id}.${(sections()[i].items || []).length - 1}`);
          return renderContent();
        case 'lang-add': return edit((n) => (n[i].items = [...(n[i].items || []), { name: '', level: 3 }]), true);
        case 'convert':
          return edit((n) => {
            const s = n[i];
            n[i] = { id: s.id, title: s.title, hidden: s.hidden, type: guessType(s.title), items: textToEntries(s.body) };
          }, true);
        case 'open-add': return openAddModal();
        case 'e-hide': return edit((n) => (n[i].items[j].hidden = !n[i].items[j].hidden), true);
        case 'sum-hide':
          ctx.update({ cvStyle: { ...style(), summary: style().summary === false } });
          return renderContent();
        case 'd-add': return ctx.update({ details: [...(S.profile.details || []), { label: '', value: '' }] }), renderContent();
        case 'd-del': return ctx.update({ details: S.profile.details.filter((_, k) => k !== Number(b.dataset.d)) }), renderContent();
        default:
      }
    }),
  );

  // Drag to reorder entries inside a section.
  panel.querySelectorAll('.sx-body').forEach((body) => {
    const sx = body.closest('.sx');
    const i = Number(sx?.dataset.i);
    let from = null;
    body.querySelectorAll(':scope > details.ent').forEach((ent) => {
      ent.querySelector('.ent-handle')?.addEventListener('mousedown', () => (ent.draggable = true));
      ent.addEventListener('dragstart', (e) => {
        e.stopPropagation();
        from = Number(ent.dataset.e);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', 'e' + from);
      });
      ent.addEventListener('dragover', (e) => {
        if (from === null) return;
        e.preventDefault();
        e.stopPropagation();
        ent.classList.add('over');
      });
      ent.addEventListener('dragleave', () => ent.classList.remove('over'));
      ent.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const to = Number(ent.dataset.e);
        if (from === null || from === to) return;
        edit((n) => n[i].items.splice(to, 0, n[i].items.splice(from, 1)[0]), true);
      });
      ent.addEventListener('dragend', () => {
        from = null;
        ent.draggable = false;
        body.querySelectorAll('.ent').forEach((x) => x.classList.remove('over'));
      });
    });
  });

  // Drag to reorder sections (the handle arms the drag, so text fields keep selecting normally).
  const list = panel.querySelector('#secs');
  let from = null;
  list.querySelectorAll('.sx').forEach((sx) => {
    sx.querySelector('.sx-handle').addEventListener('mousedown', () => (sx.draggable = true));
    sx.addEventListener('dragstart', (e) => {
      from = Number(sx.dataset.i);
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(from));
      sx.classList.add('dragging');
    });
    sx.addEventListener('dragover', (e) => {
      if (from === null) return;
      e.preventDefault();
      sx.classList.add('over');
    });
    sx.addEventListener('dragleave', () => sx.classList.remove('over'));
    sx.addEventListener('drop', (e) => {
      e.preventDefault();
      const to = Number(sx.dataset.i);
      if (from === null || from === to) return;
      edit((n) => n.splice(to, 0, n.splice(from, 1)[0]), true);
    });
    sx.addEventListener('dragend', () => {
      from = null;
      sx.draggable = false;
      list.querySelectorAll('.sx').forEach((x) => x.classList.remove('dragging', 'over'));
    });
  });
}

// ---------- Design bindings ----------

function trackAdv(panel) {
  panel.querySelectorAll('details.adv').forEach((d) => d.addEventListener('toggle', () => (d.open ? openKeys.add(d.dataset.key) : openKeys.delete(d.dataset.key))));
}


function bindDesign(panel) {
  trackAdv(panel);
  const set = (patch) => ctx.update({ cvStyle: { ...style(), ...patch } });
  const layouts = panel.querySelector('#layouts');
  layouts.querySelectorAll('iframe').forEach((f) => new ResizeObserver(() => (f.style.transform = `scale(${f.parentElement.clientWidth / 794})`)).observe(f.parentElement));
  refreshThumbs();
  layouts.querySelectorAll('[data-v]').forEach((b) =>
    b.addEventListener('click', () => {
      layouts.querySelectorAll('[data-v]').forEach((x) => x.setAttribute('aria-pressed', x === b));
      set({ layout: b.dataset.v });
    }),
  );
  // Choices: one value among several. The ones that change which controls are shown redraw the panel.
  const REDRAW = ['skillStyle', 'columns', 'colorMode', 'linkIconType'];
  panel.querySelectorAll('[data-style]').forEach((group) =>
    group.querySelectorAll('[data-v]').forEach((b) =>
      b.addEventListener('click', () => {
        group.querySelectorAll('[data-v]').forEach((x) => x.setAttribute('aria-pressed', x === b));
        group.querySelector('.custom')?.setAttribute('aria-pressed', false);
        const key = group.dataset.style;
        const patch = { [key]: b.dataset.v };
        if (key === 'accent') patch.colorMode = 'single';
        if (key === 'colorMode' && b.dataset.v === 'single') Object.assign(patch, { bgColor: '', textColor: '' });
        set(patch);
        if (REDRAW.includes(key) || key === 'accent') renderDesign();
        if (key === 'docLang') document.querySelector('#studio-panel')?.scrollTo?.(0, 0);
      }),
    ),
  );
  panel.querySelector('#accent-custom')?.addEventListener('input', (e) => {
    panel.querySelectorAll('[data-style="accent"] .swatch').forEach((x) => x.setAttribute('aria-pressed', x.contains(e.target)));
    e.target.parentElement.style.setProperty('--c', e.target.value);
    set({ accent: e.target.value });
  });
  panel.querySelectorAll('[data-toggle]').forEach((c) => c.addEventListener('change', () => { set({ [c.dataset.toggle]: c.checked }); if (c.dataset.toggle === 'linkIcons') renderDesign(); }));
  panel.querySelectorAll('[data-range]').forEach((r) =>
    r.addEventListener('input', () => {
      const k = r.dataset.range;
      const unit = RANGE_UNITS[k] ?? '';
      panel.querySelector(`[data-rv="${k}"]`).textContent = r.value + unit;
      set({ [k]: Number(r.value) });
    }),
  );
  panel.querySelectorAll('[data-act="auto"]').forEach((b) =>
    b.addEventListener('click', () => {
      set({ [b.dataset.key]: 0 });
      renderDesign();
    }),
  );
  panel.querySelectorAll('[data-font]').forEach((s) =>
    s.addEventListener('change', () => {
      set({ [s.dataset.font]: s.value });
      renderDesign();
    }),
  );
  panel.querySelectorAll('[data-pal]').forEach((b) =>
    b.addEventListener('click', () => {
      const p = S.cvStyles.palettes[Number(b.dataset.pal)];
      set({ bgColor: p.bg, accent: p.accent, textColor: p.text, colorMode: 'multi' });
      renderDesign();
    }),
  );
  panel.querySelectorAll('[data-color]').forEach((i) =>
    i.addEventListener('input', () => {
      set(['textColor', 'bgColor', 'accent'].includes(i.dataset.color) ? { [i.dataset.color]: i.value, colorMode: 'multi' } : { [i.dataset.color]: i.value });
      i.parentElement.querySelector('.small.muted')?.remove();
    }),
  );
  panel.querySelectorAll('[data-act="clear-key"]').forEach((b) =>
    b.addEventListener('click', () => {
      set({ [b.dataset.key]: '' });
      renderDesign();
    }),
  );
  panel.querySelector('[data-act="no-bg"]')?.addEventListener('click', () => {
    set({ bgColor: '', colorMode: 'multi' });
    renderDesign();
  });
  panel.querySelectorAll('[data-acc]').forEach((c) =>
    c.addEventListener('change', () => {
      const on = new Set(style().accentOn || DEFAULT_ACCENT_ON);
      if (c.checked) on.add(c.dataset.acc);
      else on.delete(c.dataset.acc);
      set({ accentOn: [...on] });
    }),
  );
  panel.querySelector('[data-act="reset-design"]')?.addEventListener('click', () => {
    if (!confirm("Revenir aux réglages d'origine du modèle ?")) return;
    const keep = { docLang: style().docLang, pageFormat: style().pageFormat, dateFormat: style().dateFormat, photo: style().photo };
    ctx.update({ cvStyle: { ...RESET_STYLE, ...keep } });
    renderDesign();
  });
}

function bindDocument(panel) {
  trackAdv(panel);
  panel.querySelectorAll('[data-style]').forEach((group) =>
    group.querySelectorAll('[data-v]').forEach((b) =>
      b.addEventListener('click', () => {
        group.querySelectorAll('[data-v]').forEach((x) => x.setAttribute('aria-pressed', x === b));
        ctx.update({ cvStyle: { ...style(), [group.dataset.style]: b.dataset.v } });
      }),
    ),
  );
}

// ---------- Letter ----------

const LETTER_VARS = [['entreprise', 'Entreprise'], ['poste', 'Poste'], ['contact', 'Contact'], ['competences', 'Compétences'], ['ravi', 'ravi(e)'], ['nom', 'Nom'], ['ville', 'Ville']];

function letterPanel() {
  const st = S.cvStyles;
  const L = S.profile.letter || {};
  const same = !L.layout;
  const templates = dcard('Modèle de la lettre', html`
    <div class="field"><label class="chk"><input type="checkbox" id="l-same" ${same ? raw('checked') : ''}><span>Même modèle que mon CV (recommandé : les deux documents sont assortis)</span></label></div>
    <div class="templates ${same ? 'is-off' : ''}" id="layouts">${Object.entries(st.layouts).map(([k, l]) => html`<button type="button" class="tpl" data-v="${k}" aria-pressed="${(L.layout || style().layout) === k}">
      <span class="tpl-thumb"><iframe tabindex="-1" data-layout="${k}" title="${l.label}" sandbox="allow-same-origin"></iframe></span>
      <span class="tpl-name">${l.label}</span></button>`)}</div>
    <p class="hint">Polices, couleurs, photo et en-tête viennent de l'onglet Design.</p>`);
  const text = dcard('Texte de ta lettre type', html`
    <p class="hint" style="margin-top:0">C'est le modèle de départ de chaque candidature : tu pourras le retoucher pour chaque offre, ou le faire rédiger par Claude.</p>
    <label class="field"><span class="label">Objet</span><input class="input" data-l="subject" value="${L.subject || ''}"></label>
    <label class="field"><span class="label">Formule d'appel</span><input class="input" data-l="opening" value="${L.opening || ''}"></label>
    <label class="field"><span class="label">Corps de la lettre</span><textarea class="textarea" id="l-text" data-l="body" rows="11">${L.body || ''}</textarea></label>
    <div class="chips" id="l-vars">${LETTER_VARS.map(([k, l]) => html`<button type="button" class="chip suggest" data-var="${k}" title="Insère {{${k}}}">${icons.plus} ${l}</button>`)}</div>
    <p class="hint">Les mots entre doubles accolades sont remplacés pour chaque offre : <code>{{entreprise}}</code>, <code>{{poste}}</code>, <code>{{competences}}</code>…</p>
    <label class="field"><span class="label">Formule de politesse</span><textarea class="textarea" data-l="closing" rows="2">${L.closing || ''}</textarea></label>`);
  const place = dcard('Présentation', html`
    <label class="field"><span class="label">Lieu</span><input class="input" data-l="place" value="${L.place || ''}" placeholder="${S.profile.location || 'Ville'}"></label>
    <div class="row wrap" style="margin-top:12px">${check('showDate', 'Afficher la date', L.showDate !== false)}</div>
    <div class="field" style="margin-top:14px"><span class="label">Bloc destinataire</span>${seg('l-align', [['right', 'À droite (usage français)'], ['left', 'À gauche']], L.align || 'right')}</div>`);
  return html`${templates}${text}${place}`;
}

function bindLetter(panel) {
  const set = (patch) => ctx.update({ letter: { ...(S.profile.letter || {}), ...patch } });
  panel.querySelectorAll('[data-l]').forEach((el) => el.addEventListener('input', () => set({ [el.dataset.l]: el.value })));
  panel.querySelector('[data-toggle=showDate]').addEventListener('change', (e) => set({ showDate: e.target.checked }));
  panel.querySelectorAll('[data-style="l-align"] [data-v]').forEach((b) =>
    b.addEventListener('click', () => {
      panel.querySelectorAll('[data-style="l-align"] [data-v]').forEach((x) => x.setAttribute('aria-pressed', x === b));
      set({ align: b.dataset.v });
    }),
  );
  const layouts = panel.querySelector('#layouts');
  layouts.querySelectorAll('iframe').forEach((f) => new ResizeObserver(() => (f.style.transform = `scale(${f.parentElement.clientWidth / 794})`)).observe(f.parentElement));
  refreshThumbs();
  panel.querySelector('#l-same').addEventListener('change', (e) => {
    layouts.classList.toggle('is-off', e.target.checked);
    set({ layout: e.target.checked ? '' : style().layout });
  });
  layouts.querySelectorAll('[data-v]').forEach((b) =>
    b.addEventListener('click', () => {
      panel.querySelector('#l-same').checked = false;
      layouts.classList.remove('is-off');
      layouts.querySelectorAll('[data-v]').forEach((x) => x.setAttribute('aria-pressed', x === b));
      set({ layout: b.dataset.v });
    }),
  );
  panel.querySelectorAll('#l-vars [data-var]').forEach((b) =>
    b.addEventListener('click', () => {
      const t = panel.querySelector('#l-text');
      const at = t.selectionStart ?? t.value.length;
      t.value = `${t.value.slice(0, at)}{{${b.dataset.var}}}${t.value.slice(t.selectionEnd ?? at)}`;
      t.focus();
      t.selectionStart = t.selectionEnd = at + b.dataset.var.length + 4;
      set({ body: t.value });
    }),
  );
}
