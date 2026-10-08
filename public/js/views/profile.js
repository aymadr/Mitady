import { S, refreshNav } from '../main.js';
import { siteLogo } from '../logos.js';
import { mountPetEditor } from '../pet.js';
import { cvStudioSection, bindCvStudio, studioChanged } from './cv-studio.js';
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
  studioChanged(patch);
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
  if (next.sections !== p.sections) next.cvManaged = false; // the editor re-adds ids and the skills section
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
        <div class="section-head"><h2 class="section-title">Ton animal</h2><span class="section-note">Il se perche sur tes barres de recherche</span></div>
        <div class="card" id="avatar-editor"></div>
      </section>

      ${cvStudioSection(p)}

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
    big: false,
    onChange: (pet) => {
      update({ pet });
      refreshNav();
      refreshPerches();
    },
  });
  bindUpload(view);
  bindCvStudio(view, { update });


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
