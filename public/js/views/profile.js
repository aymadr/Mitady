import { S, refreshNav } from '../main.js';
import { siteLogo } from '../logos.js';
import { mountPetEditor } from '../pet.js';
import { refreshPerches } from '../decorate.js';
import { html, raw, mount, api, fail, toast, debounce, busy, chipInput, fileToBase64, longDate, norm, icons } from '../lib.js';

const CONTRACTS = ['Alternance', 'Stage', 'CDI', 'CDD', 'Freelance'];

let saveState = null;
let queued = {};
const flush = debounce(async () => {
  const patch = queued;
  queued = {};
  try {
    const res = await api('/profile', { method: 'PUT', body: patch });
    S.profile = { ...res.profile, ...queued }; // keep edits made while saving
    S.applications = res.applications;
    if (saveState) saveState.textContent = 'Enregistré';
    refreshStylePreview(); // text edits reach the preview once saved
  } catch (e) {
    fail(e);
  }
}, 500);

// Every edit goes through here: local state first, then a debounced save.
function update(patch) {
  Object.assign(S.profile, patch);
  queued = { ...queued, ...patch };
  if (saveState) saveState.textContent = 'Enregistrement…';
  flush();
  if (patch.cvStyle) {
    refreshStylePreview();
    refreshThumbs();
  }
}

// Merges parsed CV data into the profile without overwriting what the user typed.
// With overwrite (a CV replacing another one), the new CV wins; skills that were
// not in the previous CV text were added by hand and are kept.
function applyParsed(parsed, { overwrite = false, previousText = null } = {}) {
  const p = S.profile;
  const pick = (k) => (overwrite ? parsed[k] || p[k] : p[k] || parsed[k]);
  const fromCv = parsed.skills || [];
  const previous = previousText === null ? null : norm(previousText);
  const kept = previous === null ? p.skills : p.skills.filter((s) => !previous.includes(norm(s)));
  const known = new Set(fromCv.map(norm));
  const next = {
    name: pick('name'),
    headline: pick('headline'),
    email: pick('email'),
    phone: pick('phone'),
    location: pick('location'),
    summary: pick('summary'),
    links: overwrite ? (parsed.links?.length ? parsed.links : p.links) : p.links?.length ? p.links : parsed.links || [],
    skills: [...fromCv, ...kept.filter((s) => !known.has(norm(s)))],
    sections: overwrite || !p.sections.length ? parsed.sections || p.sections : p.sections,
  };
  // Pre-fills the Word template settings: the exact headline and profile paragraph
  // to swap, and where added skills go.
  const d = p.docx || {};
  next.docx = {
    titleText: overwrite || !d.titleText ? next.headline : d.titleText,
    summaryText: overwrite || !d.summaryText ? parsed.summary || d.summaryText || '' : d.summaryText,
    skillsAnchor: overwrite || !d.skillsAnchor ? parsed.skillsAnchor || d.skillsAnchor || '' : d.skillsAnchor,
  };
  update(next);
  return { fromCv: fromCv.length, kept: kept.filter((s) => !known.has(norm(s))).length };
}

export function renderProfile(view) {
  const p = S.profile;
  const domain = S.domains.find((d) => d.id === p.search.domain);
  const suggestions = (domain?.skills || []).filter((s) => !p.skills.some((x) => norm(x) === norm(s)));

  mount(
    view,
    html`<div class="page-head">
        <div><h1 class="page-title">Profil</h1><p class="page-sub">Tout ce qui sert à lire les offres et à écrire tes CV.</p></div>
        <span class="saved" id="saved"></span>
      </div>

      <section>
        <div class="section-head"><h2 class="section-title">Ton CV</h2></div>
        ${p.cvFile
          ? html`<div class="card row wrap">
              <div class="grow">
                <div style="font-weight:600">${p.cvFile.name}</div>
                <div class="small muted">Importé le ${longDate(p.cvFile.uploadedAt)}</div>
              </div>
              <a class="btn btn-secondary btn-sm" href="/api/profile/cv" target="_blank">Ouvrir</a>
              <button class="btn btn-secondary btn-sm" id="replace">Remplacer</button>
              ${S.secrets.aiEnabled ? html`<button class="btn btn-primary btn-sm" id="ai-parse" data-busy="Lecture…">Remplir avec Claude</button>` : ''}
            </div>`
          : html`<div class="dropzone" id="drop" tabindex="0" role="button">
              <strong>Importe ton CV</strong>
              <span class="muted small">Glisse un PDF ou un fichier Word ici, ou clique pour choisir. Pas de CV ? Remplis simplement les rubriques ci-dessous.</span>
            </div>`}
        <input type="file" id="file" accept=".pdf,.docx" hidden>
      </section>

      <section class="section">
        <div class="section-head"><h2 class="section-title">Ton compagnon</h2><span class="section-note">Il se perche sur tes barres de recherche</span></div>
        <div class="card" id="avatar-editor"></div>
      </section>

      <section class="section">
        <div class="section-head"><h2 class="section-title">Identité</h2></div>
        <div class="card">
          <div class="grid-2">
            <label class="field"><span class="label">Nom complet</span><input class="input" data-k="name" value="${p.name}"></label>
            <label class="field"><span class="label">Titre actuel</span><input class="input" data-k="headline" value="${p.headline}" placeholder="Ex. Apprenti ingénieur cybersécurité"></label>
            <label class="field"><span class="label">E-mail</span><input class="input" data-k="email" type="email" value="${p.email}"></label>
            <label class="field"><span class="label">Téléphone</span><input class="input" data-k="phone" value="${p.phone}"></label>
            <label class="field"><span class="label">Ville</span><input class="input" data-k="location" value="${p.location}"></label>
            <label class="field"><span class="label">Liens</span><input class="input" id="links" value="${(p.links || []).join(', ')}" placeholder="LinkedIn, GitHub, portfolio"></label>
          </div>
          <div class="field" style="margin-top:20px"><span class="label">Accord des intitulés de poste sur ton CV</span>
            <div class="segmented" id="gender">
              ${[['masculin', 'Masculin'], ['feminin', 'Féminin'], ['neutre', 'Tel quel']].map(([v, l]) => html`<button data-v="${v}" aria-pressed="${p.titleGender === v}">${l}</button>`)}
            </div>
            <p class="hint">« Alternant(e) Ingénieur(e) H/F » devient « Alternant Ingénieur » ou « Alternante Ingénieure ».</p>
          </div>
        </div>
      </section>

      <section class="section">
        <div class="section-head"><h2 class="section-title">Résumé</h2></div>
        <div class="card">
          <textarea class="textarea" data-k="summary" rows="4" placeholder="Qui tu es, ce que tu sais faire, ce que tu cherches. Utilisé par défaut en tête de tes CV.">${p.summary}</textarea>
        </div>
      </section>

      <section class="section">
        <div class="section-head"><h2 class="section-title">Compétences</h2><span class="section-note">${p.skills.length} au total</span></div>
        <div class="card">
          <div id="skills"></div>
          <p class="hint">Entrée pour ajouter. Plus cette liste est juste, plus la correspondance avec les offres est fiable.</p>
          ${suggestions.length
            ? html`<div class="label" style="margin-top:20px">Souvent demandées en ${domain.label.toLowerCase()}</div>
              <div class="chips" id="suggest">${suggestions.slice(0, 40).map((s) => html`<button class="chip suggest" data-s="${s}">${icons.plus} ${s}</button>`)}</div>`
            : ''}
        </div>
      </section>

      <section class="section">
        <div class="section-head"><h2 class="section-title">Parcours</h2><button class="btn btn-plain small" id="add-section">Ajouter une rubrique</button></div>
        <div id="sections"></div>
        <p class="hint" style="padding:0 4px">Repris sur le CV généré par l'app. Une ligne par information ; « - » en début de ligne pour une puce ; une date en fin de ligne (« 09/2024 - 06/2025 ») s'aligne à droite. Dans une rubrique « Compétences », écris « Catégorie : a, b, c ».</p>
      </section>

      ${cvStyleSection(p)}

      <section class="section" id="recherche">
        <div class="section-head"><h2 class="section-title">Ce que tu cherches</h2></div>
        <div class="card">
          <div class="grid-2">
            <label class="field"><span class="label">Domaine</span>
              <select class="select" id="domain">
                <option value="">Choisir…</option>
                ${S.domains.map((d) => html`<option value="${d.id}" ${p.search.domain === d.id ? raw('selected') : ''}>${d.label}</option>`)}
                <option value="autre" ${p.search.domain === 'autre' ? raw('selected') : ''}>Autre</option>
              </select></label>
            <label class="field"><span class="label">Lieu</span><input class="input" id="where" value="${p.search.location}" placeholder="Ex. Île-de-France, Lyon"></label>
          </div>
          <div class="field" style="margin-top:16px"><span class="label">Contrat</span>
            <div class="chips" id="contracts">${CONTRACTS.map((c) => html`<button class="chip ${p.search.contracts.includes(c) ? 'on' : 'suggest'}" data-v="${c}" aria-pressed="${p.search.contracts.includes(c)}">${c}</button>`)}</div>
            <p class="hint">Coche plusieurs types pour chercher en même temps, par exemple alternance et stage.</p>
          </div>
          <div class="field"><span class="label">Sites de recherche</span>
            <div class="chips" id="sources">${S.sources.map((src) => html`<button class="chip ${activeSources(p).includes(src.id) ? 'on' : 'suggest'}" data-v="${src.id}" aria-pressed="${activeSources(p).includes(src.id)}">${siteLogo(src.label, 20)}${src.label}</button>`)}</div>
            <p class="hint">Plus tu actives de sites, plus la recherche est longue. Une même offre publiée sur plusieurs sites n'apparaît qu'une fois.</p>
          </div>
          <div class="field"><span class="label">Mots-clés de recherche</span><div id="keywords"></div>
            <p class="hint">${domain ? `Vide = mots-clés par défaut : ${domain.keywords.join(', ')}.` : 'Un intitulé ou un métier par mot-clé.'}</p></div>
          <div class="field"><span class="label">Entreprises à ignorer</span><div id="excluded"></div>
            <p class="hint">Les écoles et organismes de formation qui publient de fausses offres sont exclus par défaut.</p></div>
        </div>
      </section>

      ${p.cvFile?.type === 'docx'
        ? html`<section class="section">
            <div class="section-head"><h2 class="section-title">Ton fichier Word</h2></div>
            <div class="card">
              <p class="small muted" style="margin-bottom:16px">Pour générer tes CV directement depuis ton fichier Word, en gardant sa mise en page.</p>
              <div class="grid-2">
                <label class="field"><span class="label">Texte du titre à remplacer</span><input class="input" id="docx-title" value="${p.docx.titleText}" placeholder="Tel qu'écrit dans ton CV"></label>
                <label class="field"><span class="label">Rubrique où ajouter les compétences</span><input class="input" id="docx-anchor" value="${p.docx.skillsAnchor}" placeholder="Ex. Cybersécurité"></label>
              </div>
              <p class="hint">La conversion en PDF utilise Microsoft Word ou LibreOffice s'ils sont installés.</p>
            </div>
          </section>`
        : ''}`,
  );

  saveState = view.querySelector('#saved');
  mountPetEditor(view.querySelector('#avatar-editor'), {
    pet: p.pet,
    gender: p.titleGender || 'neutre',
    big: false,
    onChange: (pet, gender) => {
      update({ pet, titleGender: gender });
      refreshNav();
      refreshPerches();
      view.querySelectorAll('#gender [data-v]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.v === gender));
    },
  });
  bindUpload(view);
  bindCvStyle(view);

  view.querySelectorAll('[data-k]').forEach((el) => el.addEventListener('input', () => update({ [el.dataset.k]: el.value })));
  view.querySelector('#links').addEventListener('input', (e) => update({ links: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) }));
  segmented(view.querySelector('#gender'), (v) => update({ titleGender: v }));

  chipInput(view.querySelector('#skills'), [...p.skills], (skills) => update({ skills }), { placeholder: 'Ajouter une compétence' });
  view.querySelectorAll('#suggest [data-s]').forEach((b) =>
    b.addEventListener('click', () => {
      update({ skills: [...S.profile.skills, b.dataset.s] });
      renderProfile(view);
    }),
  );

  renderSections(view.querySelector('#sections'));
  view.querySelector('#add-section').addEventListener('click', () => {
    update({ sections: [...S.profile.sections, { title: 'Nouvelle rubrique', body: '' }] });
    renderSections(view.querySelector('#sections'));
  });

  const search = (patch) => update({ search: { ...S.profile.search, ...patch } });
  view.querySelector('#domain').addEventListener('change', (e) => {
    search({ domain: e.target.value });
    renderProfile(view);
  });
  view.querySelector('#where').addEventListener('input', (e) => search({ location: e.target.value }));
  toggleGroup(view.querySelector('#contracts'), () => search({ contracts: [...view.querySelectorAll('#contracts [aria-pressed="true"]')].map((b) => b.dataset.v) }), 1);
  toggleGroup(view.querySelector('#sources'), () => search({ sources: [...view.querySelectorAll('#sources [aria-pressed="true"]')].map((b) => b.dataset.v) }), 1);
  chipInput(view.querySelector('#keywords'), [...p.search.keywords], (keywords) => search({ keywords }), { placeholder: 'Ajouter un mot-clé' });
  chipInput(view.querySelector('#excluded'), [...p.search.excluded], (excluded) => search({ excluded }), { placeholder: 'Ajouter une entreprise' });

  view.querySelector('#docx-title')?.addEventListener('input', (e) => update({ docx: { ...S.profile.docx, titleText: e.target.value } }));
  view.querySelector('#docx-anchor')?.addEventListener('input', (e) => update({ docx: { ...S.profile.docx, skillsAnchor: e.target.value } }));

  if (location.hash.endsWith('/recherche')) view.querySelector('#recherche').scrollIntoView({ block: 'start' });
}

const activeSources = (p) => (Array.isArray(p.search.sources) ? p.search.sources : S.sources.filter((x) => x.on).map((x) => x.id));

// Multi-select chips; `min` keeps at least that many selected.
function toggleGroup(group, onChange, min = 0) {
  group.querySelectorAll('[data-v]').forEach((b) =>
    b.addEventListener('click', () => {
      const on = b.getAttribute('aria-pressed') !== 'true';
      if (!on && group.querySelectorAll('[aria-pressed="true"]').length <= min) return;
      b.setAttribute('aria-pressed', on);
      b.classList.toggle('on', on);
      b.classList.toggle('suggest', !on);
      onChange();
    }),
  );
}

function segmented(group, onPick) {
  group.querySelectorAll('[data-v]').forEach((b) =>
    b.addEventListener('click', () => {
      group.querySelectorAll('[data-v]').forEach((x) => x.setAttribute('aria-pressed', x === b));
      onPick(b.dataset.v);
    }),
  );
}

function renderSections(root) {
  const sections = S.profile.sections;
  mount(
    root,
    sections.length
      ? html`${sections.map(
          (s, i) => html`<div class="card" data-i="${i}">
            <div class="row" style="margin-bottom:10px">
              <input class="input grow" data-f="title" value="${s.title}" style="font-weight:600">
              <button class="btn btn-danger small" data-remove>Retirer</button>
            </div>
            <textarea class="textarea" data-f="body" rows="${Math.min(14, Math.max(4, s.body.split('\n').length + 1))}">${s.body}</textarea>
          </div>`,
        )}`
      : html`<div class="card empty"><strong>Aucune rubrique</strong>Importe ton CV pour les remplir, ou ajoute Expérience, Formation, Projets…</div>`,
  );
  root.querySelectorAll('[data-i]').forEach((card) => {
    const i = Number(card.dataset.i);
    card.querySelectorAll('[data-f]').forEach((el) =>
      el.addEventListener('input', () => {
        const next = S.profile.sections.map((s, j) => (j === i ? { ...s, [el.dataset.f]: el.value } : s));
        update({ sections: next });
      }),
    );
    card.querySelector('[data-remove]').addEventListener('click', () => {
      update({ sections: S.profile.sections.filter((_, j) => j !== i) });
      renderSections(root);
    });
  });
}

function bindUpload(view) {
  const input = view.querySelector('#file');
  const drop = view.querySelector('#drop');
  const upload = async (file) => {
    if (!file) return;
    if (!/\.(pdf|docx)$/i.test(file.name)) return toast('Choisis un PDF ou un fichier .docx.', { error: true });
    toast('Lecture du CV…');
    try {
      const replacing = Boolean(S.profile.cvFile);
      const res = await api('/profile/cv', { method: 'POST', body: { name: file.name, data: await fileToBase64(file) } });
      S.profile = res.profile;
      const { fromCv, kept } = applyParsed(res.parsed, replacing ? { overwrite: true, previousText: res.previousText } : {});
      toast(`CV importé · ${fromCv} compétences lues${kept ? `, ${kept} ajoutée${kept > 1 ? 's' : ''} à la main conservée${kept > 1 ? 's' : ''}` : ''}. Vérifie ton profil.`);
      setTimeout(() => renderProfile(view), 600);
    } catch (e) {
      fail(e);
    }
  };
  input.addEventListener('change', () => upload(input.files[0]));
  view.querySelector('#replace')?.addEventListener('click', () => input.click());
  if (drop) {
    drop.addEventListener('click', () => input.click());
    drop.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && input.click());
    drop.addEventListener('dragover', (e) => {
      e.preventDefault();
      drop.classList.add('over');
    });
    drop.addEventListener('dragleave', () => drop.classList.remove('over'));
    drop.addEventListener('drop', (e) => {
      e.preventDefault();
      drop.classList.remove('over');
      upload(e.dataTransfer.files[0]);
    });
  }
  view.querySelector('#ai-parse')?.addEventListener('click', (e) =>
    busy(e.currentTarget, async () => {
      if (!confirm('Claude va relire ton CV et remplacer ton identité, ton résumé et ton parcours. Tes compétences sont conservées et complétées. Continuer ?')) return;
      try {
        const { parsed } = await api('/profile/cv/ai', { method: 'POST' });
        applyParsed(parsed, { overwrite: true });
        toast('Profil mis à jour depuis ton CV');
        setTimeout(() => renderProfile(view), 600);
      } catch (err) {
        fail(err);
      }
    }),
  );
}

// ---------- CV layout (app template) ----------

function cvStyleSection(p) {
  const st = S.cvStyles;
  const cur = p.cvStyle;
  const seg = (group, entries, value) =>
    html`<div class="segmented" data-style="${group}">${entries.map(([k, label]) => html`<button data-v="${k}" aria-pressed="${value === k}">${label}</button>`)}</div>`;
  const hasFile = Boolean(p.cvFile);
  const own = p.cvFile?.type === 'docx' ? 'ton fichier Word, adapté à chaque offre' : 'ton PDF tel quel';
  return html`<section class="section">
    <div class="section-head"><h2 class="section-title">Ton CV</h2><span class="section-note">Toujours envoyé en PDF</span></div>
    <div class="card cv-style">
      <div class="stack">
        <div class="field"><span class="label">Quel CV utiliser ?</span>
          <div class="segmented" id="cv-mode">
            <button data-v="own" aria-pressed="${p.cvMode !== 'app' && hasFile}" ${hasFile ? '' : raw('disabled')}>Garder mon CV</button>
            <button data-v="app" aria-pressed="${p.cvMode === 'app' || !hasFile}">Modèle de l'app (ATS)</button>
          </div>
          <p class="hint">${hasFile
            ? html`${p.cvMode === 'app' ? 'Ton parcours est mis en page avec le modèle choisi ci-dessous.' : `Tes candidatures partent avec ${own}.`} Tu peux changer pour chaque offre.`
            : "Importe ton CV plus haut pour pouvoir le garder tel quel. Sans fichier, l'app construit ton CV à partir de ton parcours."}</p>
        </div>
        <div class="field"><span class="label">Modèle</span>
          <div class="templates" id="layouts">${Object.entries(st.layouts).map(([k, l]) => html`<button class="tpl" data-v="${k}" aria-pressed="${cur.layout === k}">
            <span class="tpl-thumb"><iframe tabindex="-1" data-layout="${k}" title="${l.label}" sandbox="allow-same-origin"></iframe></span>
            <span class="tpl-name">${l.label}</span><span class="tpl-tag ${l.ats ? 'ats' : ''}">${l.ats ? 'ATS' : 'Design'}</span></button>`)}</div>
          <p class="hint">ATS : une colonne, texte simple, lu sans erreur par les logiciels de tri des candidatures. Design : plus visuel, à privilégier pour un envoi direct à une personne.</p>
        </div>
        <div class="field"><span class="label">Police</span>${seg('font', Object.entries(st.fonts).map(([k, v]) => [k, v.label]), cur.font)}</div>
        <div class="field"><span class="label">Couleur</span>
          <div class="swatches" data-style="accent">${Object.entries(st.accents).map(([k, v]) => html`<button class="swatch" data-v="${k}" aria-pressed="${cur.accent === k}" aria-label="${v.label}" title="${v.label}" style="--c:${v.color}"></button>`)}
            <label class="swatch custom" title="Couleur personnalisée" style="--c:${/^#/.test(cur.accent) ? cur.accent : '#ffffff'}" aria-pressed="${/^#/.test(cur.accent)}"><input type="color" id="accent-custom" value="${/^#/.test(cur.accent) ? cur.accent : '#1f3a93'}"></label></div>
        </div>
        <div class="field"><span class="label">Photo</span>
          <div class="row wrap">
            ${p.photo ? html`<img class="photo-thumb" src="/api/profile/photo?v=${Date.now()}" alt="Ta photo">` : ''}
            ${p.photo
              ? html`<label class="row small"><input type="checkbox" id="photo-on" ${cur.photo ? raw('checked') : ''}> Afficher sur le CV</label>
                <button class="btn btn-plain small" id="photo-change">Changer</button><button class="btn btn-danger small" id="photo-remove">Retirer</button>`
              : html`<button class="btn btn-secondary btn-sm" id="photo-change">Ajouter une photo</button>`}
            <input type="file" id="photo-file" accept="image/png,image/jpeg" hidden>
          </div>
          ${p.photo ? html`<div style="margin-top:10px">${seg('photoShape', Object.entries(st.photoShapes), cur.photoShape)}</div>` : html`<p class="hint">JPG ou PNG. Elle apparaît sur le CV généré par l'app.</p>`}
        </div>
      </div>
      <div class="preview"><div class="preview-page"><iframe id="style-preview" title="Aperçu du CV" sandbox="allow-same-origin"></iframe></div></div>
    </div>
  </section>`;
}

// Mini preview of one template, with the current font, color and photo.
function refreshThumb(frame) {
  api('/profile/cv-preview', { method: 'POST', body: { cvStyle: { ...S.profile.cvStyle, layout: frame.dataset.layout } } })
    .then((doc) => (frame.srcdoc = doc))
    .catch(() => {});
}

const refreshThumbs = debounce(() => document.querySelectorAll('#layouts iframe').forEach(refreshThumb), 500);

let stylePreview = null;
const refreshStylePreview = debounce(async () => {
  if (!stylePreview?.isConnected) return;
  try {
    stylePreview.srcdoc = await api('/profile/cv-preview', { method: 'POST', body: { cvStyle: S.profile.cvStyle } });
  } catch (e) {
    fail(e);
  }
}, 700);

function bindCvStyle(view) {
  stylePreview = view.querySelector('#style-preview');
  const page = stylePreview.parentElement;
  new ResizeObserver(() => (stylePreview.style.transform = `scale(${page.clientWidth / 794})`)).observe(page);
  refreshStylePreview();

  view.querySelector('#accent-custom').addEventListener('input', (e) => {
    view.querySelectorAll('[data-style="accent"] .swatch').forEach((x) => x.setAttribute('aria-pressed', x.contains(e.target)));
    e.target.parentElement.style.setProperty('--c', e.target.value);
    update({ cvStyle: { ...S.profile.cvStyle, accent: e.target.value } });
  });
  segmented(view.querySelector('#cv-mode'), (v) => update({ cvMode: v }));
  const layouts = view.querySelector('#layouts');
  segmented(layouts, (v) => update({ cvStyle: { ...S.profile.cvStyle, layout: v } }));
  layouts.querySelectorAll('iframe').forEach((f) => {
    f.style.transform = 'scale(0.17)';
    refreshThumb(f);
  });

  view.querySelectorAll('[data-style]').forEach((group) =>
    group.querySelectorAll('[data-v]').forEach((b) =>
      b.addEventListener('click', () => {
        group.querySelectorAll('[data-v]').forEach((x) => x.setAttribute('aria-pressed', x === b));
        group.querySelector('.custom')?.setAttribute('aria-pressed', false);
        update({ cvStyle: { ...S.profile.cvStyle, [group.dataset.style]: b.dataset.v } });
      }),
    ),
  );
  view.querySelector('#photo-on')?.addEventListener('change', (e) => update({ cvStyle: { ...S.profile.cvStyle, photo: e.target.checked } }));

  const file = view.querySelector('#photo-file');
  view.querySelector('#photo-change').addEventListener('click', () => file.click());
  file.addEventListener('change', async () => {
    const f = file.files[0];
    if (!f) return;
    try {
      const res = await api('/profile/photo', { method: 'POST', body: { name: f.name, data: await fileToBase64(f) } });
      S.profile = { ...S.profile, photo: res.profile.photo, cvStyle: { ...S.profile.cvStyle, photo: true } };
      update({ cvStyle: S.profile.cvStyle });
      renderProfile(view);
    } catch (e) {
      fail(e);
    }
  });
  view.querySelector('#photo-remove')?.addEventListener('click', async () => {
    try {
      await api('/profile/photo', { method: 'DELETE' });
      S.profile.photo = null;
      renderProfile(view);
    } catch (e) {
      fail(e);
    }
  });
}
