import { S, upsertApp, go, refreshPage } from '../main.js';
import { siteLogo } from '../logos.js';
import { working, cheerStatus, isSent } from '../mascot.js';
import { html, raw, mount, api, fail, toast, icons, avatar, debounce, busy, longDate, relDate, norm, STATUS } from '../lib.js';

const TABS = [
  { id: 'offre', label: 'Offre' },
  { id: 'cv', label: 'CV' },
  { id: 'lettre', label: 'Lettre' },
  { id: 'candidature', label: 'Candidature' },
  { id: 'notes', label: 'Notes' },
];

const state = { id: null, tab: 'offre' };
const emailDrafts = new Map(); // id -> { to, subject, body, attach }

const app = () => S.applications.find((a) => a.id === state.id);
const sheet = () => document.querySelector('.sheet');

async function save(patch) {
  const updated = await api(`/applications/${state.id}`, { method: 'PUT', body: patch });
  upsertApp(updated);
  return updated;
}

// ---------- Open / close ----------

export function openOffer(id, tab = 'offre') {
  if (!S.applications.some((a) => a.id === id)) return go('#/offres');
  const root = document.getElementById('sheet-root');
  const fresh = !sheet();
  if (fresh) {
    mount(root, html`<div class="scrim"></div><aside class="sheet" role="dialog" aria-modal="true" aria-label="Détail de l'offre"></aside>`);
    root.querySelector('.scrim').addEventListener('click', () => go('#/offres'));
    requestAnimationFrame(() => root.querySelectorAll('.scrim, .sheet').forEach((el) => el.classList.add('open')));
  }
  const changed = state.id !== id;
  state.id = id;
  state.tab = TABS.some((t) => t.id === tab) ? tab : 'offre';
  render();
  if (changed) sheet().querySelector('.sheet-body').scrollTop = 0;
}

export function closeOffer() {
  const root = document.getElementById('sheet-root');
  if (!sheet()) return;
  root.querySelectorAll('.scrim, .sheet').forEach((el) => el.classList.remove('open'));
  state.id = null;
  setTimeout(() => {
    if (!state.id) root.innerHTML = '';
  }, 420);
}

function render() {
  const a = app();
  const el = sheet();
  mount(
    el,
    html`<header class="sheet-head">
        <div class="sheet-top">
          ${avatar(a.company, 'lg')}
          <div class="grow">
            <div class="sheet-company">${a.company}</div>
            <h2 class="sheet-title">${a.title}</h2>
          </div>
          <a class="icon-btn" href="#/offres" aria-label="Fermer">${icons.close}</a>
        </div>
        <div class="sheet-meta">
          ${a.location ? html`<span>${a.location}</span>` : ''}
          <span class="src">${siteLogo(a.source, 18)}${a.source}${a.contract ? ` · ${a.contract}` : ''}</span>
          <span>Ajoutée ${relDate(a.addedAt)}</span>
          ${a.link ? html`<a href="${a.link}" target="_blank" rel="noopener">Voir l'annonce ${icons.external}</a>` : ''}
        </div>
        <div class="sheet-actions">
          <select class="select" id="status" aria-label="Statut">
            ${Object.entries(STATUS).map(([k, v]) => html`<option value="${k}" ${a.status === k ? raw('selected') : ''}>${v}</option>`)}
          </select>
          ${a.followUpDue ? html`<span class="badge orange">À relancer</span>` : ''}
        </div>
        <div class="segmented sheet-tabs" role="tablist">
          ${TABS.map((t) => html`<button role="tab" aria-pressed="${state.tab === t.id}" data-tab="${t.id}">${t.label}</button>`)}
        </div>
      </header>
      <div class="sheet-body"></div>`,
  );

  el.querySelector('#status').addEventListener('change', async (e) => {
    try {
      const was = isSent(a.status);
      await save({ status: e.target.value });
      toast(`Statut : ${STATUS[e.target.value]}`);
      cheerStatus(e.target.value, { wasSent: was, sent: S.applications.filter((x) => isSent(x.status)).length, at: { x: innerWidth * 0.3, y: innerHeight * 0.5 } });
      refreshPage();
      render();
    } catch (err) {
      fail(err);
    }
  });
  el.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => go(`#/offres/${state.id}/${b.dataset.tab}`)));

  const body = el.querySelector('.sheet-body');
  ({ offre: renderOffer, cv: renderCv, lettre: renderLetter, candidature: renderApply, notes: renderNotes })[state.tab](body, a);
}

// ---------- Offre ----------

async function addSkillToProfile(skill) {
  const res = await api('/profile', { method: 'PUT', body: { skills: [...S.profile.skills, skill] } });
  S.profile = res.profile;
  S.applications = res.applications;
  toast(`« ${skill} » ajouté à ton profil`);
  refreshPage();
  render();
}

function renderOffer(body, a) {
  const pct = a.score ?? 0;
  const ringColor = a.score >= 70 ? 'var(--green)' : a.score >= 45 ? 'var(--accent)' : 'var(--text-3)';
  const [ga, gb] = a.score >= 70 ? ['#14b87d', '#5ee6b0'] : a.score >= 45 ? ['#2f7d5b', '#ffcd00'] : ['#8b8aa3', '#8b8aa3'];
  mount(
    body,
    html`<div class="stack">
      <section class="card">
        ${a.skills.length >= 2
          ? html`<div class="match">
              <div class="ring" style="--p:${pct};--ring-color:${ringColor};--grad-a:${ga};--grad-b:${gb}"><span>${pct} %</span></div>
              <div>
                <div style="font-weight:600">${a.matched.length} compétence${a.matched.length > 1 ? 's' : ''} sur ${a.skills.length} demandées</div>
                <div class="small muted">${a.missing.length
                  ? 'Tu maîtrises une compétence manquante ? Clique dessus : elle rejoint ton profil et le score se met à jour partout.'
                  : 'Ton profil couvre tout ce que l\'annonce mentionne.'}</div>
              </div>
            </div>
            <div class="chips" style="margin-top:18px">
              ${a.matched.map((s) => html`<span class="chip have">${icons.check} ${s}</span>`)}
              ${a.missing.map((s) => html`<button class="chip gap" data-skill="${s}" title="J'ai cette compétence">${icons.plus} ${s}</button>`)}
            </div>`
          : html`<div style="font-weight:600">Correspondance indisponible</div>
            <p class="small muted" style="margin-top:4px">${a.description
              ? 'L\'annonce cite trop peu de compétences reconnues. Ajoute les tiennes dans ton profil pour affiner la lecture.'
              : 'La description de l\'annonce est vide. Colle-la pour calculer ta correspondance.'}</p>
            ${a.description ? '' : html`<button class="btn btn-secondary btn-sm" style="margin-top:12px" id="edit-desc">Coller la description</button>`}`}
      </section>

      ${aiCard(a)}

      ${a.description
        ? html`<section class="card">
            <div class="row" style="margin-bottom:10px"><strong class="grow">Annonce</strong><button class="btn btn-plain small" id="edit-desc">Modifier</button></div>
            <div class="description" id="desc">${a.description}</div>
            <button class="btn btn-plain small" id="expand" style="margin-top:8px">Afficher tout</button>
          </section>`
        : ''}
    </div>`,
  );

  body.querySelectorAll('[data-skill]').forEach((b) => b.addEventListener('click', () => addSkillToProfile(b.dataset.skill).catch(fail)));
  body.querySelector('#expand')?.addEventListener('click', (e) => {
    const d = body.querySelector('#desc');
    d.classList.toggle('expanded');
    e.target.textContent = d.classList.contains('expanded') ? 'Réduire' : 'Afficher tout';
  });
  const desc = body.querySelector('#desc');
  if (desc && desc.scrollHeight <= 290) {
    desc.classList.add('expanded');
    body.querySelector('#expand').hidden = true;
  }
  body.querySelectorAll('#edit-desc').forEach((b) => b.addEventListener('click', () => editDescription(body, a)));
  bindAi(body, a);
}

function editDescription(body, a) {
  mount(
    body,
    html`<section class="card">
      <label class="field"><span class="label">Texte de l'annonce</span><textarea class="textarea" id="desc-input" rows="16">${a.description}</textarea></label>
      <div class="form-foot"><button class="btn btn-secondary" id="cancel">Annuler</button><button class="btn btn-primary" id="save">Enregistrer</button></div>
    </section>`,
  );
  body.querySelector('#cancel').addEventListener('click', render);
  body.querySelector('#save').addEventListener('click', async () => {
    try {
      await save({ description: body.querySelector('#desc-input').value });
      refreshPage();
      render();
    } catch (e) {
      fail(e);
    }
  });
}

function aiCard(a) {
  if (!S.secrets.aiEnabled) {
    return html`<div class="callout">Avec une clé Claude (dans <a href="#/reglages">Réglages</a>), tu obtiens pour chaque offre ses attentes clés, un titre et un résumé de CV ciblés, et un e-mail rédigé.</div>`;
  }
  if (!a.ai) {
    return html`<section class="card row">
      <div class="grow"><strong>Lecture par Claude</strong><div class="small muted">Attentes clés, points à préparer, CV et e-mail adaptés à cette offre.</div></div>
      <button class="btn btn-secondary btn-sm" id="ai-run" data-busy="Analyse…">Analyser</button>
    </section>`;
  }
  return html`<section class="card">
    <div class="row" style="margin-bottom:12px"><strong class="grow">Lecture par Claude</strong><button class="btn btn-plain small" id="ai-run" data-busy="Analyse…">Relancer</button></div>
    <div class="label">Ce que l'offre attend</div>
    <ul class="list-plain">${a.ai.requirements.map((r) => html`<li>${r}</li>`)}</ul>
    ${a.ai.gaps.length
      ? html`<div class="label" style="margin-top:14px">À préparer</div><ul class="list-plain">${a.ai.gaps.map((r) => html`<li>${r}</li>`)}</ul>`
      : ''}
    <div class="form-foot"><a class="btn btn-primary btn-sm" href="#/offres/${a.id}/cv">Utiliser pour mon CV</a></div>
  </section>`;
}

function bindAi(body, a) {
  const btn = body.querySelector('#ai-run');
  if (!btn) return;
  btn.addEventListener('click', () =>
    busy(btn, async () => {
      const w = working({ text: 'Claude lit l’offre…', mood: 'think', i: 5 });
      try {
        upsertApp(await api(`/applications/${a.id}/ai`, { method: 'POST' }));
        emailDrafts.delete(a.id);
        w.done('Analyse terminée !');
        render();
      } catch (e) {
        w.fail('Claude n’a pas répondu');
        fail(e);
      }
    }),
  );
}

// ---------- CV ----------

// Same rule as the server: the user's own CV unless they chose the app's templates.
function defaultTemplate() {
  const f = S.profile.cvFile;
  if (S.profile.cvMode === 'app' || !f) return 'builtin';
  return f.type === 'docx' ? 'docx' : 'original';
}

function cvDraft(a) {
  return {
    headline: a.cv?.headline ?? a.ai?.headline ?? a.suggestedHeadline,
    summary: a.cv?.summary ?? a.ai?.summary ?? S.profile.summary,
    skillsAdded: a.cv?.skillsAdded ?? [],
    // The template sticks to an offer only when picked by hand; otherwise the Word file wins.
    template: a.cv?.templateChosen ? a.cv.template : defaultTemplate(),
    templateChosen: Boolean(a.cv?.templateChosen),
  };
}

function renderCv(body, a) {
  const d = cvDraft(a);
  const hasFile = Boolean(S.profile.cvFile);
  const hasDocx = S.profile.cvFile?.type === 'docx';
  const candidates = [...new Set([...a.missing, ...(a.ai?.skillsToAdd || [])])].filter(
    (s) => !S.profile.skills.some((p) => norm(p) === norm(s)),
  );
  const generated = a.cv?.file && a.cv?.generatedAt;

  mount(
    body,
    html`<div class="stack">
      ${!S.profile.name
        ? html`<div class="callout blue">Complète d'abord ton <a href="#/profil">profil</a> (nom, parcours, compétences) : c'est la base de chaque CV.</div>`
        : ''}
      <section class="card">
        ${hasFile
          ? html`<div class="field"><span class="label">CV à envoyer</span>
              <div class="segmented" id="template">
                <button aria-pressed="${d.template === 'original'}" data-v="original">Mon CV tel quel</button>
                ${hasDocx ? html`<button aria-pressed="${d.template === 'docx'}" data-v="docx">Mon Word adapté</button>` : ''}
                <button aria-pressed="${d.template === 'builtin'}" data-v="builtin">Modèle de l'app</button>
              </div>
              <p class="hint">${{
                original: "Ton fichier, sans aucun changement (converti en PDF si c'est un Word). Rien à générer : il est joint tel quel.",
                docx: "Ton fichier Word, mise en page conservée : seuls le titre, le paragraphe de profil et les compétences ajoutées changent. Livré en PDF.",
                builtin: "Le CV est reconstruit avec le modèle et la photo choisis dans ton profil. Livré en PDF.",
              }[d.template]}</p>
            </div>`
          : html`<p class="hint" style="margin-bottom:12px">CV généré par l'app (PDF). Importe ton propre CV dans ton profil pour pouvoir aussi l'envoyer tel quel.</p>`}
        ${d.template === 'original'
          ? html`<div class="file-row"><div class="grow"><strong>${S.profile.cvFile.name}</strong>Ce CV est joint tel quel à ta candidature, rien à générer.</div>
              <a class="btn btn-secondary btn-sm" href="/api/profile/cv/pdf" target="_blank">Ouvrir</a>
              <a class="btn btn-secondary btn-sm" href="/api/profile/cv/pdf?download=1">Télécharger</a></div>`
          : html`<label class="field"><span class="label">Titre du CV</span><input class="input" id="headline" value="${d.headline}"></label>
        <label class="field"><span class="label">Résumé de profil</span><textarea class="textarea" id="summary" rows="4" placeholder="2 à 3 phrases qui répondent à l'offre.">${d.summary}</textarea></label>
        <div class="field">
          <span class="label">Compétences à ajouter pour cette offre</span>
          ${candidates.length
            ? html`<div class="chips" id="add-skills">${candidates.map((s) => html`<button class="chip ${d.skillsAdded.includes(s) ? 'on' : 'suggest'}" data-s="${s}">${s}</button>`)}</div>
              <p class="hint">N'ajoute que ce que tu sais réellement faire. Tes compétences demandées par l'offre passent en tête automatiquement.</p>`
            : html`<p class="small muted">Aucune compétence manquante : ton profil couvre l'annonce.</p>`}
        </div>
        <div class="form-foot">
          <button class="btn btn-primary" id="generate" data-busy="Génération…">${generated ? 'Régénérer le PDF' : 'Générer le PDF'}</button>
        </div>`}
      </section>

      ${generated && d.template !== 'original'
        ? html`<div class="file-row">
            <div class="grow"><strong>CV prêt</strong>Généré ${relDate(a.cv.generatedAt)} · joint automatiquement à ta candidature</div>
            <a class="btn btn-secondary btn-sm" href="/api/applications/${a.id}/cv" target="_blank">Ouvrir</a>
            <a class="btn btn-secondary btn-sm" href="/api/applications/${a.id}/cv?download=1">Télécharger</a>
          </div>`
        : ''}

      ${d.template === 'original'
        ? html`<section class="preview"><iframe class="pdf-frame" title="Ton CV" src="/api/profile/cv/pdf#toolbar=0&view=FitH"></iframe></section>`
        : d.template === 'builtin'
        ? html`<section class="preview"><div class="preview-page"><iframe id="preview" title="Aperçu du CV" sandbox="allow-same-origin"></iframe></div></section>`
        : generated
          ? html`<section class="preview"><iframe class="pdf-frame" title="CV généré" src="/api/applications/${a.id}/cv?v=${a.cv.generatedAt}#toolbar=0&view=FitH"></iframe></section>`
          : html`<p class="small muted" style="padding:0 4px">L'aperçu du PDF s'affiche ici après la génération.</p>`}
    </div>`,
  );

  const draft = { ...d };
  const persist = debounce(() => save({ cvDraft: draft }).catch(fail), 600);
  const iframe = body.querySelector('#preview');
  const refreshPreview = debounce(async () => {
    if (!iframe) return;
    try {
      iframe.srcdoc = await api(`/applications/${a.id}/cv/preview`, { method: 'POST', body: draft });
    } catch (e) {
      fail(e);
    }
  }, 300);
  if (iframe) {
    const page = iframe.parentElement;
    new ResizeObserver(() => (iframe.style.transform = `scale(${page.clientWidth / 794})`)).observe(page);
    refreshPreview();
  }

  const onEdit = () => {
    persist();
    refreshPreview();
  };
  body.querySelector('#headline')?.addEventListener('input', (e) => {
    draft.headline = e.target.value;
    onEdit();
  });
  body.querySelector('#summary')?.addEventListener('input', (e) => {
    draft.summary = e.target.value;
    onEdit();
  });
  body.querySelectorAll('#add-skills [data-s]').forEach((b) =>
    b.addEventListener('click', () => {
      const s = b.dataset.s;
      draft.skillsAdded = draft.skillsAdded.includes(s) ? draft.skillsAdded.filter((x) => x !== s) : [...draft.skillsAdded, s];
      b.classList.toggle('on');
      b.classList.toggle('suggest');
      onEdit();
    }),
  );
  body.querySelectorAll('#template [data-v]').forEach((b) =>
    b.addEventListener('click', async () => {
      draft.template = b.dataset.v;
      draft.templateChosen = true;
      await save({ cvDraft: draft }).catch(fail);
      render();
    }),
  );
  body.querySelector('#generate')?.addEventListener('click', (e) =>
    busy(e.currentTarget, async () => {
      const w = working({ text: 'Je prépare ton CV…', mood: 'write', i: 3 });
      try {
        const res = await api(`/applications/${a.id}/cv`, { method: 'POST', body: draft });
        upsertApp(res.application);
        res.warning ? w.fail('CV généré, avec une remarque') : w.done('CV prêt en PDF !');
        toast(res.warning || 'CV généré', { error: Boolean(res.warning) });
        render();
      } catch (err) {
        w.fail('Oups, ça n’a pas marché');
        fail(err);
      }
    }),
  );
}

// ---------- Lettre ----------

async function renderLetter(body, a) {
  mount(body, html`<div class="stack"><p class="small muted" style="padding:0 4px">Je prépare ta lettre…</p></div>`);
  let draft;
  try {
    draft = await api(`/applications/${a.id}/letter/draft`);
  } catch (e) {
    return fail(e);
  }
  if (state.id !== a.id || state.tab !== 'lettre') return;
  const generated = a.letter?.file && a.letter?.generatedAt;
  const aiOn = S.secrets.aiEnabled;

  mount(
    body,
    html`<div class="stack">
      ${!S.profile.name ? html`<div class="callout blue">Complète d'abord ton <a href="#/profil">profil</a> : ton nom et tes coordonnées figurent sur la lettre.</div>` : ''}
      <section class="card">
        <div class="row" style="margin-bottom:12px"><strong class="grow">Lettre de motivation</strong>
          ${aiOn ? html`<button class="btn btn-secondary btn-sm" id="l-ai" data-busy="Claude écrit…">Rédiger avec Claude</button>` : ''}
          <button class="btn btn-plain small" id="l-reset">Reprendre mon modèle</button></div>
        <div class="grid-2">
          <label class="field"><span class="label">Destinataire</span><input class="input" id="l-name" value="${draft.recipient.name}" placeholder="Prénom Nom (facultatif)"></label>
          <label class="field"><span class="label">Fonction</span><input class="input" id="l-role" value="${draft.recipient.role}" placeholder="Responsable recrutement"></label>
        </div>
        <label class="field" style="margin-top:12px"><span class="label">Objet</span><input class="input" id="l-subject" value="${draft.subject}"></label>
        <label class="field"><span class="label">Formule d'appel</span><input class="input" id="l-opening" value="${draft.opening}"></label>
        <label class="field"><span class="label">Lettre</span><textarea class="textarea" id="l-body" rows="12">${draft.body}</textarea>
          <span class="hint">Une ligne vide sépare deux paragraphes. Le modèle se règle dans Profil › Modifier mon CV › Lettre.</span></label>
        <label class="field"><span class="label">Formule de politesse</span><textarea class="textarea" id="l-closing" rows="2">${draft.closing}</textarea></label>
        <div class="form-foot"><button class="btn btn-primary" id="l-generate" data-busy="Génération…">${generated ? 'Régénérer le PDF' : 'Générer le PDF'}</button></div>
      </section>
      ${generated
        ? html`<div class="file-row"><div class="grow"><strong>Lettre prête</strong>Générée ${relDate(a.letter.generatedAt)} · à joindre dans l'onglet Candidature</div>
            <a class="btn btn-secondary btn-sm" href="/api/applications/${a.id}/letter" target="_blank">Ouvrir</a>
            <a class="btn btn-secondary btn-sm" href="/api/applications/${a.id}/letter?download=1">Télécharger</a></div>`
        : ''}
      <section class="preview"><div class="preview-page"><iframe id="l-preview" title="Aperçu de la lettre" sandbox="allow-same-origin"></iframe></div></section>
    </div>`,
  );

  const $ = (sel) => body.querySelector(sel);
  const iframe = $('#l-preview');
  const page = iframe.parentElement;
  const fit = () => (iframe.style.transform = `scale(${page.clientWidth / 794})`);
  new ResizeObserver(fit).observe(page);
  const collect = () => ({
    subject: $('#l-subject').value, opening: $('#l-opening').value, body: $('#l-body').value, closing: $('#l-closing').value,
    recipient: { name: $('#l-name').value, role: $('#l-role').value },
  });
  const preview = debounce(async () => {
    try {
      iframe.srcdoc = await api(`/applications/${a.id}/letter/preview`, { method: 'POST', body: collect() });
    } catch (e) {
      fail(e);
    }
  }, 300);
  const persist = debounce(() => save({ letterDraft: collect() }).catch(fail), 600);
  const onEdit = () => { persist(); preview(); };
  ['#l-name', '#l-role', '#l-subject', '#l-opening', '#l-body', '#l-closing'].forEach((sel) => $(sel).addEventListener('input', onEdit));
  preview();

  const fill = (d) => {
    $('#l-subject').value = d.subject;
    $('#l-opening').value = d.opening;
    $('#l-body').value = d.body;
    $('#l-closing').value = d.closing;
    onEdit();
  };
  $('#l-reset').addEventListener('click', async () => {
    if (!confirm('Remplacer le texte par ton modèle de lettre ?')) return;
    try { fill(await api(`/applications/${a.id}/letter/draft?fresh=1`)); } catch (e) { fail(e); }
  });
  $('#l-ai')?.addEventListener('click', (e) =>
    busy(e.currentTarget, async () => {
      const w = working({ text: 'J’écris ta lettre…', mood: 'write', i: 3 });
      try {
        const updated = await api(`/applications/${a.id}/ai`, { method: 'POST' });
        upsertApp(updated);
        if (updated.ai?.letterBody) $('#l-body').value = updated.ai.letterBody;
        onEdit();
        w.done('Lettre rédigée !');
      } catch (err) {
        w.fail('Oups, ça n’a pas marché');
        fail(err);
      }
    }),
  );
  $('#l-generate').addEventListener('click', (e) =>
    busy(e.currentTarget, async () => {
      const w = working({ text: 'Je prépare ta lettre…', mood: 'write', i: 3 });
      try {
        const res = await api(`/applications/${a.id}/letter`, { method: 'POST', body: collect() });
        upsertApp(res.application);
        w.done('Lettre prête en PDF !');
        toast('Lettre générée');
        render();
      } catch (err) {
        w.fail('Oups, ça n’a pas marché');
        fail(err);
      }
    }),
  );
}

// ---------- Candidature ----------

const PATTERNS = {
  'prenom.nom': (p, n) => `${p}.${n}`,
  'p.nom': (p, n) => `${p[0]}.${n}`,
  prenomnom: (p, n) => `${p}${n}`,
  'prenom-nom': (p, n) => `${p}-${n}`,
  'nom.prenom': (p, n) => `${n}.${p}`,
  pnom: (p, n) => `${p[0]}${n}`,
  prenom: (p) => p,
};

const clean = (s) => norm(s).replace(/[^a-z0-9-]/g, '');
const guessDomain = (company) => `${clean(company.replace(/\b(sa|sas|group|groupe|france)\b/gi, ''))}.com`;

function guessEmail(name, pattern, domain) {
  const [first = '', ...rest] = name.trim().split(/\s+/);
  const p = clean(first);
  const n = clean(rest.join(''));
  if (!p || !domain || (!n && pattern !== 'prenom')) return '';
  return `${PATTERNS[pattern](p, n)}@${domain}`;
}

async function renderApply(body, a) {
  const smtpReady = S.secrets.smtp.user && S.secrets.smtp.hasPass;
  if (!emailDrafts.has(a.id)) {
    try {
      const d = await api(`/applications/${a.id}/email-draft`);
      const tpl = a.cv?.templateChosen ? a.cv.template : defaultTemplate();
      emailDrafts.set(a.id, { ...d, attachLetter: Boolean(a.letter?.file), attach: tpl !== 'original' && a.cv?.file ? 'tailored' : S.profile.cvFile ? 'original' : a.cv?.file ? 'tailored' : 'none' });
    } catch (e) {
      return fail(e);
    }
  }
  if (state.id !== a.id || state.tab !== 'candidature') return;
  const draft = emailDrafts.get(a.id);
  const attachOptions = [
    { v: 'tailored', label: 'CV adapté', ok: Boolean(a.cv?.file) },
    { v: 'original', label: 'CV d\'origine', ok: Boolean(S.profile.cvFile) },
    { v: 'none', label: 'Aucune', ok: true },
  ];

  mount(
    body,
    html`<div class="stack">
      <section class="card">
        <div class="row" style="margin-bottom:14px"><strong class="grow">Contact</strong>
          <button class="btn btn-plain small" id="find" data-busy="Recherche…">Trouver des contacts</button></div>
        <div class="grid-2">
          <label class="field"><span class="label">Nom</span><input class="input" id="c-name" value="${a.contact?.name || ''}" placeholder="Prénom Nom"></label>
          <label class="field"><span class="label">E-mail</span><input class="input" id="c-email" type="email" value="${a.contact?.email || ''}" placeholder="nom@entreprise.com"></label>
        </div>
        <div class="row wrap" style="margin-top:12px">
          <span class="small muted">Deviner l'adresse</span>
          <select class="select select-sm" id="pattern">${Object.keys(PATTERNS).map((p) => html`<option>${p}</option>`)}</select>
          <span class="small muted">@</span>
          <input class="input input-sm" id="domain" value="${guessDomain(a.company)}" style="width:180px">
          <button class="btn btn-secondary btn-sm" id="apply-guess">Utiliser</button>
        </div>
        <div id="people" class="people" style="margin-top:14px"></div>
      </section>

      <section class="card">
        <strong>Message</strong>
        ${smtpReady ? '' : html`<div class="callout" style="margin-top:12px">Pour envoyer depuis l'app, configure ton adresse dans <a href="#/reglages">Réglages</a>. Tu peux aussi copier ce message.</div>`}
        <label class="field" style="margin-top:14px"><span class="label">À</span><input class="input" id="to" type="email" value="${draft.to || a.contact?.email || ''}"></label>
        <label class="field"><span class="label">Objet</span><input class="input" id="subject" value="${draft.subject}"></label>
        <label class="field"><span class="label">Message</span><textarea class="textarea" id="body" rows="12">${draft.body}</textarea></label>
        <div class="field"><span class="label">Pièce jointe</span>
          <div class="segmented" id="attach">
            ${attachOptions.map((o) => html`<button data-v="${o.v}" aria-pressed="${draft.attach === o.v}" ${o.ok ? '' : raw('disabled')}>${o.label}</button>`)}
          </div>
          ${a.cv?.file ? '' : html`<p class="hint">Génère un CV adapté dans l'onglet CV pour le joindre.</p>`}
          <label class="chk" style="margin-top:12px"><input type="checkbox" id="attach-letter" ${a.letter?.file ? '' : raw('disabled')} ${draft.attachLetter && a.letter?.file ? raw('checked') : ''}><span>Joindre la lettre de motivation</span></label>
          ${a.letter?.file ? '' : html`<p class="hint">Génère ta lettre dans l'onglet Lettre pour la joindre.</p>`}
        </div>
        <div class="form-foot">
          <button class="btn btn-plain small" id="copy">Copier</button>
          ${a.status === 'todo' ? html`<button class="btn btn-secondary" id="applied-elsewhere">J'ai postulé autrement</button>` : ''}
          <button class="btn btn-primary" id="send" data-busy="Envoi…" ${smtpReady ? '' : raw('disabled')}>${a.status === 'todo' ? 'Envoyer' : 'Envoyer la relance'}</button>
        </div>
      </section>

      ${(a.emails || []).length
        ? html`<section><div class="section-head"><span class="section-note">Envoyés</span></div>
            <div class="group">${a.emails.map((m) => html`<div class="item"><div class="item-main"><div class="item-title">${m.subject}</div><div class="item-sub">À ${m.to} · ${longDate(m.at)}</div></div></div>`)}</div></section>`
        : ''}
    </div>`,
  );

  const $ = (sel) => body.querySelector(sel);
  const saveContact = debounce(() => save({ contact: { name: $('#c-name').value, email: $('#c-email').value } }).catch(fail), 500);
  $('#c-name').addEventListener('input', saveContact);
  $('#c-email').addEventListener('input', (e) => {
    saveContact();
    $('#to').value = e.target.value;
    draft.to = e.target.value;
  });
  for (const k of ['to', 'subject', 'body']) $(`#${k}`).addEventListener('input', (e) => (draft[k] = e.target.value));

  $('#apply-guess').addEventListener('click', () => {
    const email = guessEmail($('#c-name').value, $('#pattern').value, $('#domain').value.trim());
    if (!email) return toast('Renseigne le nom complet du contact et le domaine.');
    $('#c-email').value = email;
    $('#c-email').dispatchEvent(new Event('input'));
  });

  $('#find').addEventListener('click', (e) =>
    busy(e.currentTarget, async () => {
      try {
        const people = await api(`/applications/${a.id}/contacts`);
        mount(
          $('#people'),
          people.length
            ? html`<div class="group" style="background:var(--bg)">${people.map(
                (p, i) => html`<div class="item">
                  <div class="item-main"><div class="item-title">${p.name}</div><div class="item-sub">${p.role}</div></div>
                  <a class="btn btn-plain small" href="${p.url}" target="_blank" rel="noopener">Profil ${icons.external}</a>
                  <button class="btn btn-secondary btn-sm" data-pick="${i}">Choisir</button>
                </div>`,
              )}</div>`
            : html`<p class="small muted">Aucun profil public trouvé pour ${a.company}.</p>`,
        );
        $('#people').querySelectorAll('[data-pick]').forEach((b) =>
          b.addEventListener('click', () => {
            const p = people[Number(b.dataset.pick)];
            $('#c-name').value = p.name;
            $('#apply-guess').click();
            draft.body = draft.body.replace(/^Bonjour\s*,/, `Bonjour ${p.name.split(' ')[0]},`);
            $('#body').value = draft.body;
          }),
        );
      } catch (err) {
        fail(err);
      }
    }),
  );

  $('#attach').querySelectorAll('[data-v]').forEach((b) =>
    b.addEventListener('click', () => {
      draft.attach = b.dataset.v;
      $('#attach').querySelectorAll('[data-v]').forEach((x) => x.setAttribute('aria-pressed', x === b));
    }),
  );

  $('#attach-letter').addEventListener('change', (e) => (draft.attachLetter = e.target.checked));

  $('#copy').addEventListener('click', async () => {
    await navigator.clipboard.writeText(`${draft.subject}\n\n${draft.body}`);
    toast('Message copié');
  });

  $('#applied-elsewhere')?.addEventListener('click', async () => {
    try {
      const was = isSent(a.status);
      await save({ status: 'applied' });
      toast('Marquée comme envoyée');
      cheerStatus('applied', { wasSent: was, sent: S.applications.filter((x) => isSent(x.status)).length, at: { x: innerWidth * 0.3, y: innerHeight * 0.5 } });
      refreshPage();
      render();
    } catch (e) {
      fail(e);
    }
  });

  $('#send').addEventListener('click', (e) => {
    if (!draft.to) return toast('Indique le destinataire.');
    busy(e.currentTarget, async () => {
      const w = working({ text: 'J’envoie ta candidature…', mood: 'send', i: 0 });
      const was = isSent(a.status);
      try {
        upsertApp(await api(`/applications/${a.id}/send`, { method: 'POST', body: draft }));
        emailDrafts.delete(a.id);
        w.done('Candidature envoyée !');
        cheerStatus('applied', { wasSent: was, sent: S.applications.filter((x) => isSent(x.status)).length, at: { x: innerWidth * 0.3, y: innerHeight * 0.45 } });
        toast('Candidature envoyée');
        refreshPage();
        render();
      } catch (err) {
        w.fail('L’envoi a échoué');
        fail(err);
      }
    });
  });
}

// ---------- Notes ----------

function renderNotes(body, a) {
  const events = [
    ['Ajoutée', a.addedAt],
    ['Candidature envoyée', a.appliedAt],
    ...(a.followUps ? [[`Dernière relance (${a.followUps})`, a.lastFollowUpAt]] : []),
  ].filter(([, d]) => d);

  mount(
    body,
    html`<div class="stack">
      <section class="card">
        <label class="field"><span class="label">Notes</span>
          <textarea class="textarea" id="notes" rows="8" placeholder="Nom du manager, questions d'entretien, date de rappel…">${a.notes || ''}</textarea></label>
        <p class="hint" id="notes-state">Enregistrement automatique</p>
      </section>
      <section class="group">
        ${events.map(([label, d]) => html`<div class="item"><div class="item-main">${label}</div><span class="muted small">${longDate(d)}</span></div>`)}
      </section>
      <div><button class="btn btn-danger small" id="delete">Supprimer cette offre</button></div>
    </div>`,
  );

  const notesState = body.querySelector('#notes-state');
  const persist = debounce(async (value) => {
    try {
      await save({ notes: value });
      notesState.textContent = 'Enregistré';
    } catch (e) {
      fail(e);
    }
  }, 600);
  body.querySelector('#notes').addEventListener('input', (e) => {
    notesState.textContent = 'Enregistrement…';
    persist(e.target.value);
  });
  body.querySelector('#delete').addEventListener('click', async () => {
    if (!confirm('Supprimer définitivement cette offre ? Pour la garder hors de ta liste, choisis plutôt le statut « Écartée ».')) return;
    try {
      await api(`/applications/${a.id}`, { method: 'DELETE' });
      S.applications = S.applications.filter((x) => x.id !== a.id);
      toast('Offre supprimée');
      go('#/offres');
      refreshPage();
    } catch (e) {
      fail(e);
    }
  });
}
