// "Modifier mon CV": a Flow CV style editor. Content (personal details, sections made of entries,
// skills, languages…) and design (template, font, spacing, colors, headings…) next to a live preview.
import { S } from '../main.js';
import { html, raw, mount, api, fail, debounce, chipInput, fileToBase64, norm, esc, icons } from '../lib.js';
import { openPhotoEditor } from './photo-editor.js';

const uid = () => Math.random().toString(36).slice(2, 8);
const I = {
  up: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m6 15 6-6 6 6"/></svg>',
  down: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
  eye: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  eyeOff: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.9 17.9A10.6 10.6 0 0 1 12 19c-6.4 0-10-7-10-7a18 18 0 0 1 5-5.7M9.9 5.2A9.7 9.7 0 0 1 12 5c6.4 0 10 7 10 7a18 18 0 0 1-2.2 3.2M1 1l22 22"/></svg>',
  trash: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>',
  grip: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>',
};
const TYPE_ICON = { employment: '💼', education: '🎓', projects: '🧩', certificates: '📜', courses: '📚', awards: '🏆', organisations: '🤝', skills: '⚡', languages: '🌍', interests: '✨', text: '📝' };

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
  const k = page.clientWidth / 794;
  let h = 1123;
  let pages = 1;
  try {
    const doc = f.contentDocument;
    const pad = parseFloat(getComputedStyle(doc.body).paddingTop) || 0;
    const total = doc.documentElement.scrollHeight;
    h = Math.max(1123, total);
    pages = Math.max(1, Math.ceil((total - 2 * pad - 4) / (1123 - 2 * pad)));
  } catch {}
  f.style.transform = `scale(${k})`;
  f.style.height = h + 'px';
  page.style.height = h * k + 'px';
  const label = document.querySelector('#pages');
  if (label) label.textContent = `≈ ${pages} page${pages > 1 ? 's' : ''}`;
}

const refreshPreview = debounce(async () => {
  if (!previewEl?.isConnected) return;
  try {
    previewEl.srcdoc = await api('/profile/cv-preview', { method: 'POST', body: payload(style()) });
  } catch (e) {
    fail(e);
  }
}, 250);

const refreshThumbs = debounce(() => {
  document.querySelectorAll('#layouts iframe').forEach((f) =>
    api('/profile/cv-preview', { method: 'POST', body: payload({ ...style(), layout: f.dataset.layout }) })
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
  ctx.update({ sections: next, cvManaged: true });
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
      return html`<details class="ent" data-key="${key}" ${openKeys.has(key) ? raw('open') : ''}>
        <summary><span class="ent-t">${it.title || it.subtitle || 'Sans titre'}</span><span class="ent-d">${[it.start, it.current ? "Aujourd'hui" : it.end].filter(Boolean).join(' – ')}</span>
          <span class="ent-act"><button class="ib" data-act="e-up" data-s="${i}" data-e="${j}" title="Monter">${raw(I.up)}</button><button class="ib" data-act="e-down" data-s="${i}" data-e="${j}" title="Descendre">${raw(I.down)}</button><button class="ib danger" data-act="e-del" data-s="${i}" data-e="${j}" title="Supprimer">${raw(I.trash)}</button></span></summary>
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
    <div class="add-grid-head label">Ajouter une rubrique</div>
    <div class="add-grid">${Object.entries(t).map(([k, v]) => html`<button class="add-tile" data-act="s-add" data-type="${k}"><span>${TYPE_ICON[k]}</span>${v.label}</button>`)}</div>`;
}

// ---------- Rendering: design ----------

function designPanel() {
  const st = S.cvStyles;
  const cur = style();
  const seg = (key, entries, value) => html`<div class="segmented" data-style="${key}">${entries.map(([k, label]) => html`<button data-v="${k}" aria-pressed="${String(value) === String(k)}">${label}</button>`)}</div>`;
  const range = (key, min, max, step, unit, auto) => html`<div class="rng"><input type="range" min="${min}" max="${max}" step="${step}" data-range="${key}" value="${cur[key] || auto}"><span class="rng-v" data-rv="${key}">${cur[key] ? cur[key] + unit : 'Auto'}</span>${cur[key] ? html`<button class="btn btn-plain small" data-act="auto" data-key="${key}">Auto</button>` : ''}</div>`;
  const groups = ['Sans', 'Serif', 'Mono'];
  const atsOk = st.layouts[cur.layout]?.ats && cur.columns !== 'two';
  return html`
    <div class="field"><span class="label">Modèle</span>
      <div class="templates" id="layouts">${Object.entries(st.layouts).map(([k, l]) => html`<button class="tpl" data-v="${k}" aria-pressed="${cur.layout === k}">
        <span class="tpl-thumb"><iframe tabindex="-1" data-layout="${k}" title="${l.label}" sandbox="allow-same-origin"></iframe></span>
        <span class="tpl-name">${l.label}</span><span class="tpl-tag ${l.ats ? 'ats' : ''}">${l.ats ? 'ATS' : 'Design'}</span></button>`)}</div>
      <p class="hint ${atsOk ? '' : 'warn'}">${atsOk ? 'Compatible ATS : une colonne, texte réel, lu sans erreur par les logiciels de tri.' : 'Ce réglage est plus visuel : à privilégier pour un envoi direct à une personne. Pour un logiciel de tri (ATS), garde un modèle « ATS » en une colonne.'}</p></div>
    <div class="field"><span class="label">Police</span>
      ${groups.map((g) => html`<div class="font-group"><span class="hint" style="margin:0">${g === 'Sans' ? 'Sans empattement' : g === 'Serif' ? 'Avec empattement' : 'Monospace'}</span>
        <div class="fonts" data-style="font">${Object.entries(st.fonts).filter(([, f]) => f.group === g).map(([k, f]) => html`<button class="font-btn" data-v="${k}" aria-pressed="${cur.font === k}" style="font-family:${f.stack}">${f.label}</button>`)}</div></div>`)}</div>
    <div class="grid-2">
      <div class="field"><span class="label">Taille du texte</span>${range('fontSize', 8, 11, 0.1, ' pt', 9.2)}</div>
      <div class="field"><span class="label">Interligne</span>${range('lineHeight', 1.05, 1.7, 0.05, '', 1.25)}</div>
      <div class="field"><span class="label">Marges</span>${range('margin', 8, 22, 1, ' mm', 12)}</div>
      <div class="field"><span class="label">Espace entre rubriques</span>${range('gap', 2, 18, 1, ' pt', 6)}</div>
      <div class="field"><span class="label">Taille du nom</span>${range('nameSize', 16, 32, 1, ' pt', 20)}</div>
    </div>
    <div class="field"><span class="label">Couleur</span>
      <div class="swatches" data-style="accent">${Object.entries(st.accents).map(([k, v]) => html`<button class="swatch" data-v="${k}" aria-pressed="${cur.accent === k}" aria-label="${v.label}" title="${v.label}" style="--c:${v.color}"></button>`)}
        <label class="swatch custom" title="Couleur personnalisée" style="--c:${/^#/.test(cur.accent) ? cur.accent : '#ffffff'}" aria-pressed="${/^#/.test(cur.accent)}"><input type="color" id="accent-custom" value="${/^#/.test(cur.accent) ? cur.accent : '#1f3a93'}"></label></div></div>
    <div class="field"><span class="label">En-tête</span>
      ${seg('align', [['', 'À gauche'], ['center', 'Centré']], cur.align || '')}
      <div class="row wrap" style="margin-top:10px">
        <label class="row small"><input type="checkbox" data-toggle="icons" ${cur.icons ? raw('checked') : ''}> Icônes pour e-mail, téléphone, ville</label>
        <label class="row small"><input type="checkbox" data-toggle="linkIcons" ${cur.linkIcons ? raw('checked') : ''}> Logos LinkedIn, GitHub… sur les liens</label></div></div>
    <div class="field"><span class="label">Photo</span>
      <div class="row wrap"><label class="row small"><input type="checkbox" data-toggle="photo" ${cur.photo !== false ? raw('checked') : ''}> Afficher la photo</label></div>
      <div class="row wrap" style="margin-top:8px">${seg('photoShape', Object.entries(st.photoShapes), cur.photoShape)}${seg('photoSize', Object.entries(st.photoSizes), cur.photoSize)}
        <label class="row small"><input type="checkbox" data-toggle="photoBorder" ${cur.photoBorder ? raw('checked') : ''}> Cadre</label></div></div>
    <div class="field"><span class="label">Titres de rubrique</span>
      ${seg('headStyle', [['', 'Modèle'], ['line', 'Trait noir'], ['accent', 'Trait couleur'], ['plain', 'Sans trait'], ['bar', 'Barre'], ['box', 'Bloc']], cur.headStyle || '')}
      <div style="margin-top:10px">${seg('headCaps', [['', 'Modèle'], ['on', 'MAJUSCULES'], ['off', 'Minuscules']], cur.headCaps || '')}</div></div>
    <div class="field"><span class="label">Dates</span>${seg('dateFormat', [['mmyyyy', '09/2024'], ['mmm', 'sept. 2024'], ['yyyy', '2024']], cur.dateFormat || 'mmyyyy')}</div>
    <div class="field"><span class="label">Compétences</span>${seg('skillStyle', [['text', 'Texte'], ['chips', 'Pastilles'], ['bars', 'Barres'], ['dots', 'Points']], cur.skillStyle || 'text')}</div>
    <div class="field"><span class="label">Langues</span>${seg('langStyle', [['text', 'Texte'], ['bars', 'Barres'], ['dots', 'Points']], cur.langStyle || 'text')}</div>
    <div class="field"><span class="label">Colonnes</span>${seg('columns', [['one', 'Une colonne'], ['two', 'Deux colonnes']], cur.columns || 'one')}
      <p class="hint">Deux colonnes : compétences, langues et centres d'intérêt passent à droite.</p></div>
    <button class="btn btn-plain small" data-act="reset-design">Réinitialiser le design</button>`;
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
        <div class="segmented studio-tabs" id="studio-tabs"><button data-v="content" aria-pressed="true">Contenu</button><button data-v="design" aria-pressed="false">Design</button></div>
        <div id="studio-panel"></div>
      </div>
      <div class="studio-prev"><div class="row" style="justify-content:space-between;margin-bottom:8px"><span class="label" style="margin:0">Aperçu en direct</span><span class="small muted" id="pages"></span></div>
        <div class="preview"><div class="preview-page"><iframe id="studio-preview" title="Aperçu du CV" sandbox="allow-same-origin"></iframe></div></div></div>
    </div>
  </section>`;
}

function renderContent() {
  const panel = document.querySelector('#studio-panel');
  if (!panel) return;
  if (sections().some((s) => !s.id)) ctx.update({ sections: sections().map((s) => ({ ...s, id: s.id || uid() })) });
  mount(panel, contentPanel());
  bindContent(panel);
}

function renderDesign() {
  const panel = document.querySelector('#studio-panel');
  if (!panel) return;
  mount(panel, designPanel());
  bindDesign(panel);
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

export function bindCvStudio(view, c) {
  ctx = c;
  ensureManaged();
  loadFonts();
  previewEl = view.querySelector('#studio-preview');
  previewEl.addEventListener('load', fitPreview);
  new ResizeObserver(fitPreview).observe(previewEl.parentElement);
  refreshPreview();
  const render = () => (tab === 'design' ? renderDesign() : renderContent());
  const tabs = view.querySelector('#studio-tabs');
  tabs.querySelectorAll('[data-v]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.v === tab));
  tabs.querySelectorAll('[data-v]').forEach((b) =>
    b.addEventListener('click', () => {
      tab = b.dataset.v;
      tabs.querySelectorAll('[data-v]').forEach((x) => x.setAttribute('aria-pressed', x === b));
      render();
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
        case 's-add': {
          const type = b.dataset.type;
          const id = uid();
          const base = { id, type, title: types()[type].label, items: [] };
          if (types()[type].kind === 'entries') base.items = [{ title: '', subtitle: '', location: '', start: '', end: '', current: false, link: '', description: '' }];
          if (types()[type].kind === 'text') base.body = '';
          if (types()[type].kind === 'languages') base.items = [{ name: '', level: 3 }];
          ctx.update({ sections: [...sections(), base] });
          openKeys.add('sec.' + id);
          if (base.items.length) openKeys.add(`${id}.0`);
          renderContent();
          return document.querySelector(`[data-key="sec.${id}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
        case 'sum-hide':
          ctx.update({ cvStyle: { ...style(), summary: style().summary === false } });
          return renderContent();
        case 'd-add': return ctx.update({ details: [...(S.profile.details || []), { label: '', value: '' }] }), renderContent();
        case 'd-del': return ctx.update({ details: S.profile.details.filter((_, k) => k !== Number(b.dataset.d)) }), renderContent();
        default:
      }
    }),
  );

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

const DESIGN_KEYS = ['layout', 'font', 'accent', 'fontSize', 'lineHeight', 'margin', 'gap', 'nameSize', 'headStyle', 'headCaps', 'dateFormat', 'skillStyle', 'langStyle', 'icons', 'linkIcons', 'align', 'columns', 'photo', 'photoShape', 'photoSize', 'photoBorder', 'summary'];

function bindDesign(panel) {
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
  panel.querySelectorAll('[data-style]').forEach((group) =>
    group.querySelectorAll('[data-v]').forEach((b) =>
      b.addEventListener('click', () => {
        group.querySelectorAll('[data-v]').forEach((x) => x.setAttribute('aria-pressed', x === b));
        group.querySelector('.custom')?.setAttribute('aria-pressed', false);
        set({ [group.dataset.style]: b.dataset.v });
        if (['skillStyle', 'columns'].includes(group.dataset.style)) renderDesign();
      }),
    ),
  );
  panel.querySelector('#accent-custom').addEventListener('input', (e) => {
    panel.querySelectorAll('[data-style="accent"] .swatch').forEach((x) => x.setAttribute('aria-pressed', x.contains(e.target)));
    e.target.parentElement.style.setProperty('--c', e.target.value);
    set({ accent: e.target.value });
  });
  panel.querySelectorAll('[data-toggle]').forEach((c) => c.addEventListener('change', () => set({ [c.dataset.toggle]: c.checked })));
  panel.querySelectorAll('[data-range]').forEach((r) =>
    r.addEventListener('input', () => {
      const k = r.dataset.range;
      const unit = { fontSize: ' pt', margin: ' mm', gap: ' pt', nameSize: ' pt', lineHeight: '' }[k];
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
  panel.querySelector('[data-act="reset-design"]').addEventListener('click', () => {
    if (!confirm('Revenir aux réglages d\'origine du modèle ?')) return;
    const keep = { photo: style().photo, photoShape: style().photoShape, photoSize: style().photoSize, photoBorder: style().photoBorder };
    ctx.update({ cvStyle: { layout: 'classique', font: 'calibri', accent: 'bleu', fontSize: 0, lineHeight: 0, margin: 0, gap: 0, nameSize: 0, headStyle: '', headCaps: '', dateFormat: 'mmyyyy', skillStyle: 'text', langStyle: 'text', icons: false, linkIcons: false, align: '', columns: 'one', summary: true, ...keep } });
    renderDesign();
  });
}
