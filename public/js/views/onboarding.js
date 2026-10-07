// First-run experience: a full-screen, five-step guided setup.
// Welcome → CV → contract types → field and place → ready. Everything it collects
// goes through the same API as the Profile page, so it can be redone at any time.
import { S, startSearch } from '../main.js';
import { html, raw, mount, api, fail, toast, fileToBase64, chipInput, icons } from '../lib.js';
import { logo, tile } from '../brand.js';

const KEY = 'candidatures.onboarded';
const seen = () => {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
};
const markSeen = () => {
  try {
    localStorage.setItem(KEY, '1');
  } catch {}
};

// A brand-new profile on its first visit.
export function needsOnboarding() {
  const p = S.profile;
  return !seen() && !p.name && !p.cvFile && !p.search.domain && !S.applications.length;
}

const CONTRACTS = [
  ['Alternance', "Un rythme école et entreprise, un vrai salaire."],
  ['Stage', "Une première expérience, de quelques semaines à six mois."],
  ['CDI', 'Un poste stable, sans date de fin.'],
  ['CDD', 'Une mission à durée déterminée.'],
  ['Freelance', 'Tes missions, tes tarifs, ton agenda.'],
];

const STEPS = ['welcome', 'cv', 'contract', 'field', 'ready'];

let root = null;
let step = 0;
let leaving = false;
const draft = { parsed: null };
let parallax = null;

function patch(body) {
  return api('/profile', { method: 'PUT', body }).then((res) => {
    S.profile = res.profile;
    S.applications = res.applications;
  });
}

export function startOnboarding() {
  if (root) return;
  step = 0;
  root = document.createElement('div');
  root.className = 'ob';
  root.innerHTML = `
    <div class="ob-bg"><i class="ob-blob b1"></i><i class="ob-blob b2"></i><i class="ob-blob b3"></i></div>
    <header class="ob-top">
      <div class="ob-brand"><span class="brand-mark">${logo(32)}</span>Mitady</div>
      <div class="ob-progress" aria-hidden="true">${STEPS.map(() => '<i><b></b></i>').join('')}</div>
      <button class="ob-skip" id="ob-skip">Passer</button>
    </header>
    <div class="ob-stage" id="ob-stage"></div>`;
  document.body.append(root);
  document.body.classList.add('ob-open');
  root.querySelector('#ob-skip').addEventListener('click', finish);
  document.addEventListener('keydown', onKey);
  render();
}

function finish({ search = false } = {}) {
  markSeen();
  document.removeEventListener('keydown', onKey);
  document.removeEventListener('pointermove', parallax);
  root.classList.add('out');
  document.body.classList.remove('ob-open');
  const el = root;
  root = null;
  setTimeout(() => el.remove(), 600);
  if (search === true) setTimeout(startSearch, 450);
  else location.hash = '#/';
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

function onKey(e) {
  if (!root || e.target.closest?.('textarea')) return;
  if (e.key === 'Enter' && !e.target.closest?.('.chip-input')) root.querySelector('[data-next]:not(:disabled)')?.click();
}

function go(to) {
  if (leaving || to < 0 || to >= STEPS.length) return;
  leaving = true;
  const stage = root.querySelector('#ob-stage');
  stage.classList.add('leave');
  setTimeout(() => {
    step = to;
    stage.classList.remove('leave');
    leaving = false;
    render();
  }, 320);
}

function progress() {
  root.querySelectorAll('.ob-progress i').forEach((el, i) => el.classList.toggle('on', i < step + 1));
  root.querySelector('#ob-skip').hidden = step === STEPS.length - 1;
}

const nav = (back, next, nextLabel = 'Continuer', disabled = false) => html`<div class="ob-nav">
  ${back ? html`<button class="ob-back" data-back>${raw('<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10 3 5 8l5 5"/></svg>')} Retour</button>` : '<span></span>'}
  <button class="ob-cta" data-next ${disabled ? raw('disabled') : ''}>${nextLabel}${raw('<svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8h10M9 4l4 4-4 4"/></svg>')}</button>
</div>`;

function render() {
  progress();
  const stage = root.querySelector('#ob-stage');
  document.removeEventListener('pointermove', parallax);
  ({ welcome, cv, contract, field, ready })[STEPS[step]](stage);
  stage.querySelector('[data-back]')?.addEventListener('click', () => go(step - 1));
  stage.scrollTo?.(0, 0);
}

// ---------- 1. Welcome ----------

function welcome(stage) {
  mount(
    stage,
    html`<section class="ob-step ob-welcome">
      <div class="ob-copy">
        <div class="ob-kicker"><span></span>Bienvenue</div>
        <h1 class="ob-mega">Décroche ton<br><span class="ob-words"><b>alternance</b><b>stage</b><b>premier poste</b><b>alternance</b></span><br>sans t'épuiser.</h1>
        <p class="ob-lead">Une appli qui lit des centaines d'offres à ta place, mesure ta correspondance avec chacune et prépare un CV sur mesure, en PDF.</p>
        <div class="ob-actions">
          <button class="ob-cta big" data-next>Commencer ${raw('<svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8h10M9 4l4 4-4 4"/></svg>')}</button>
          <span class="ob-hint">2 minutes · tes données restent sur ton ordinateur</span>
        </div>
        <ul class="ob-points">
          <li><b>7</b><span>sites d'offres,<br>une seule recherche</span></li>
          <li><b>0</b><span>doublon,<br>même offre sur 3 sites</span></li>
          <li><b>PDF</b><span>un CV adapté<br>à chaque offre</span></li>
        </ul>
      </div>
      <div class="ob-visual" aria-hidden="true">
        <div class="ob-orb" data-depth="14"></div>
        ${[
          ['Analyste SOC en alternance', 'Orange Cyberdefense', 91, 'c1', 22, 262],
          ['Stage Data Analyst', 'Alan', 84, 'c2', 40, 160],
          ['Alternant Développeur', 'Doctolib', 76, 'c3', 8, 40],
        ].map(
          ([t, c, s, cls, d, h]) => html`<div class="ob-card ${cls}" data-depth="${d}">
            <span class="avatar" style="--h:${h}">${c[0]}</span>
            <div><b>${t}</b><small>${c}</small></div>
            <span class="mini-ring high" style="--p:${s}"><b>${s}</b></span>
          </div>`,
        )}
        <span class="t3 a" data-depth="40">${tile('search', { size: 76, cls: 'float' })}</span>
        <span class="t3 b" data-depth="26">${tile('target', { size: 64, cls: 'float' })}</span>
        <span class="t3 c" data-depth="34">${tile('send', { size: 56, cls: 'float' })}</span>
        <div class="ob-pdf" data-depth="30"><i></i><i></i><i class="s"></i><i></i><i class="s"></i></div>
      </div>
    </section>`,
  );
  stage.querySelector('[data-next]').addEventListener('click', () => go(1));
  parallax = (e) => {
    const x = e.clientX / innerWidth - 0.5;
    const y = e.clientY / innerHeight - 0.5;
    stage.querySelectorAll('[data-depth]').forEach((el) => {
      const d = Number(el.dataset.depth);
      el.style.setProperty('--px', `${-x * d}px`);
      el.style.setProperty('--py', `${-y * d}px`);
    });
  };
  document.addEventListener('pointermove', parallax);
}

// ---------- 2. CV ----------

function cv(stage) {
  const done = Boolean(draft.parsed || S.profile.name);
  mount(
    stage,
    html`<section class="ob-step ob-narrow">
      <div class="ob-kicker"><span></span>01 · Ton CV</div>
      <h2 class="ob-title">On part de <em>ton</em> CV.</h2>
      <p class="ob-lead">Dépose-le, l'appli lit ton identité, ton parcours et tes compétences. Tu pourras tout corriger ensuite.</p>
      ${done ? '' : html`<label class="ob-drop" id="ob-drop" tabindex="0">
        <span class="ob-drop-ring"></span>
        <span class="ob-drop-icon">${raw('<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V4M7.500 8.500 12 4l4.500 4.500M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/></svg>')}</span>
        <strong>Glisse ton CV ici</strong>
        <small>PDF ou Word · ou clique pour choisir un fichier</small>
        <input type="file" id="ob-file" accept=".pdf,.docx" hidden>
      </label>
      <button class="ob-link" id="ob-manual">Je n'ai pas de CV, je remplis moi-même</button>`}
      <div id="ob-result">${done ? resultCard() : ''}</div>
      ${done ? nav(true, true) : nav(true, false, 'Continuer', true)}
    </section>`,
  );
  bindCv(stage);
}

function resultCard() {
  const p = S.profile;
  const skills = p.skills.slice(0, 14);
  return html`<div class="ob-result">
    <div class="ob-result-head">
      <span class="avatar lg" style="--h:${hue(p.name || 'x')}">${(p.name || '?').split(' ').map((w) => w[0]).slice(0, 2).join('')}</span>
      <div class="grow"><b>${p.name || 'Ton nom'}</b><small>${p.headline || 'Ajoute un titre depuis ton profil'}</small></div>
      <span class="ob-check">${icons.check}</span>
    </div>
    ${p.skills.length
      ? html`<div class="ob-skills">${skills.map((s, i) => html`<span class="chip have" style="animation-delay:${0.15 + i * 0.07}s">${s}</span>`)}
        ${p.skills.length > skills.length ? html`<span class="chip" style="animation-delay:${0.15 + skills.length * 0.07}s">+${p.skills.length - skills.length}</span>` : ''}</div>
        <p class="ob-meta">${p.skills.length} compétence${p.skills.length > 1 ? 's' : ''} détectée${p.skills.length > 1 ? 's' : ''}${p.sections.length ? ` · ${p.sections.length} rubrique${p.sections.length > 1 ? 's' : ''} de parcours` : ''}</p>`
      : ''}
  </div>`;
}

const hue = (s) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);

function bindCv(stage) {
  const next = stage.querySelector('[data-next]');
  const result = stage.querySelector('#ob-result');
  const upload = async (file) => {
    if (!file) return;
    if (!/\.(pdf|docx)$/i.test(file.name)) return toast('Choisis un PDF ou un fichier .docx.', { error: true });
    const drop = stage.querySelector('#ob-drop');
    drop.classList.add('busy');
    drop.querySelector('strong').textContent = 'Lecture de ton CV…';
    try {
      const res = await api('/profile/cv', { method: 'POST', body: { name: file.name, data: await fileToBase64(file) } });
      const x = res.parsed;
      await patch({
        name: x.name, headline: x.headline, email: x.email, phone: x.phone, location: x.location, summary: x.summary,
        links: x.links, skills: x.skills, sections: x.sections,
        docx: { titleText: x.headline, summaryText: x.summary || '', skillsAnchor: x.skillsAnchor || '' },
        search: { location: S.profile.search.location || x.location || '' },
      });
      draft.parsed = x;
      cv(stage);
    } catch (e) {
      fail(e);
      drop.classList.remove('busy');
      drop.querySelector('strong').textContent = 'Glisse ton CV ici';
    }
  };
  const input = stage.querySelector('#ob-file');
  const drop = stage.querySelector('#ob-drop');
  if (drop) {
    input.addEventListener('change', () => upload(input.files[0]));
    ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => (e.preventDefault(), drop.classList.add('over'))));
    ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => (e.preventDefault(), drop.classList.remove('over'))));
    drop.addEventListener('drop', (e) => upload(e.dataTransfer.files[0]));
    drop.addEventListener('keydown', (e) => (e.key === ' ' || e.key === 'Enter') && (e.preventDefault(), input.click()));
  }
  stage.querySelector('#ob-manual')?.addEventListener('click', () => {
    mount(
      result,
      html`<div class="ob-manual">
        <label class="ob-field"><span>Ton nom</span><input id="ob-name" placeholder="Camille Martin" autocomplete="name"></label>
        <label class="ob-field"><span>Ton titre ou ta formation</span><input id="ob-headline" placeholder="Étudiante en Master Cybersécurité"></label>
      </div>`,
    );
    stage.querySelector('#ob-drop').hidden = true;
    stage.querySelector('#ob-manual').hidden = true;
    const name = result.querySelector('#ob-name');
    const headline = result.querySelector('#ob-headline');
    const sync = () => (next.disabled = !name.value.trim());
    name.addEventListener('input', sync);
    name.focus();
  });
  next?.addEventListener('click', async () => {
    const name = stage.querySelector('#ob-name');
    if (name && name.value.trim()) {
      await patch({ name: name.value.trim(), headline: stage.querySelector('#ob-headline').value.trim() }).catch(fail);
    }
    go(2);
  });
}

// ---------- 3. Contract ----------

function contract(stage) {
  const chosen = new Set(S.profile.search.contracts?.length ? S.profile.search.contracts : ['Alternance']);
  mount(
    stage,
    html`<section class="ob-step">
      <div class="ob-kicker"><span></span>02 · Le contrat</div>
      <h2 class="ob-title">Tu cherches <em>quoi</em> ?</h2>
      <p class="ob-lead">Choisis-en plusieurs : alternance et stage, par exemple. L'appli cherche tout en même temps.</p>
      <div class="ob-cards" id="ob-contracts">
        ${CONTRACTS.map(([k, d], i) => html`<button class="ob-choice" data-v="${k}" aria-pressed="${chosen.has(k)}" style="--i:${i}">
          ${tile(k, { size: 54, cls: 'choice' })}
          <b>${k}</b><small>${d}</small>
          <span class="ob-tick">${icons.check}</span>
        </button>`)}
      </div>
      ${nav(true, true)}
    </section>`,
  );
  const group = stage.querySelector('#ob-contracts');
  const next = stage.querySelector('[data-next]');
  group.querySelectorAll('[data-v]').forEach((b) =>
    b.addEventListener('click', () => {
      b.setAttribute('aria-pressed', b.getAttribute('aria-pressed') !== 'true');
      next.disabled = !group.querySelector('[aria-pressed="true"]');
    }),
  );
  next.addEventListener('click', async () => {
    const contracts = [...group.querySelectorAll('[aria-pressed="true"]')].map((b) => b.dataset.v);
    await patch({ search: { contracts } }).catch(fail);
    go(3);
  });
}

// ---------- 4. Field & place ----------

function field(stage) {
  const cur = S.profile.search;
  let domain = cur.domain || '';
  let keywords = [...(cur.keywords || [])];
  const domains = [...S.domains.map((d) => ({ id: d.id, label: d.label, sample: d.keywords.slice(0, 3).join(' · ') })), { id: 'autre', label: 'Autre', sample: 'Tes propres mots-clés' }];
  mount(
    stage,
    html`<section class="ob-step">
      <div class="ob-kicker"><span></span>03 · Le domaine</div>
      <h2 class="ob-title sm">Dans quel <em>domaine</em> ?</h2>
      <div class="ob-cards dense" id="ob-domains">
        ${domains.map((d, i) => html`<button class="ob-choice" data-v="${d.id}" aria-pressed="${domain === d.id}" style="--i:${i}">
          ${tile(d.id, { size: 46, cls: 'choice' })}
          <b>${d.label}</b><small>${d.sample}</small>
          <span class="ob-tick">${icons.check}</span>
        </button>`)}
      </div>
      <div class="ob-extra" id="ob-kw" ${domain === 'autre' ? '' : raw('hidden')}>
        <span class="ob-label">Tes mots-clés (un intitulé ou un métier par mot-clé)</span>
        <div id="ob-kw-input"></div>
      </div>
      <label class="ob-field wide"><span>Où cherches-tu ?</span><input id="ob-where" value="${cur.location || S.profile.location || ''}" placeholder="Paris, Lyon, Île-de-France…" autocomplete="off"></label>
      ${nav(true, true, 'Continuer', !domain)}
    </section>`,
  );
  const group = stage.querySelector('#ob-domains');
  const next = stage.querySelector('[data-next]');
  const kw = stage.querySelector('#ob-kw');
  const sync = () => (next.disabled = !domain || (domain === 'autre' && !keywords.length));
  chipInput(stage.querySelector('#ob-kw-input'), keywords, (v) => ((keywords = v), sync()), { placeholder: 'Ex. chargé de projet, UX designer…' });
  group.querySelectorAll('[data-v]').forEach((b) =>
    b.addEventListener('click', () => {
      domain = b.dataset.v;
      group.querySelectorAll('[data-v]').forEach((x) => x.setAttribute('aria-pressed', x === b));
      kw.hidden = domain !== 'autre';
      sync();
    }),
  );
  next.addEventListener('click', async () => {
    await patch({ search: { domain, keywords, location: stage.querySelector('#ob-where').value.trim() } }).catch(fail);
    go(4);
  });
}

// ---------- 5. Ready ----------

function ready(stage) {
  const p = S.profile;
  const first = (p.name || '').split(' ')[0];
  const label = S.domains.find((d) => d.id === p.search.domain)?.label || 'Domaine personnalisé';
  const items = [
    [p.name ? `Profil de ${p.name}` : 'Profil créé', true],
    [p.skills.length ? `${p.skills.length} compétences prêtes à être comparées` : 'Compétences à compléter dans ton profil', p.skills.length > 0],
    [`${(p.search.contracts || []).join(' + ') || 'Alternance'}${p.search.location ? ` · ${p.search.location}` : ''}`, true],
    [label, true],
  ];
  mount(
    stage,
    html`<section class="ob-step ob-ready">
      <div class="ob-burst" aria-hidden="true">${Array.from({ length: 18 }, (_, i) => html`<i style="--a:${i * 20}deg;--d:${0.05 * i}s;--h:${(i * 47) % 360}"></i>`)}</div>
      <div class="ob-kicker"><span></span>C'est prêt</div>
      <h2 class="ob-title big">Tout est en place${first ? html`, <em>${first}</em>` : ''}.</h2>
      <ul class="ob-checks">
        ${items.map(([t, ok], i) => html`<li style="--i:${i}"><span class="ob-check ${ok ? '' : 'warn'}">${ok ? icons.check : '!'}</span>${t}</li>`)}
      </ul>
      <div class="ob-actions">
        <button class="ob-cta big" id="ob-go">Lancer ma première recherche ${raw('<svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="7" cy="7" r="4.500"/><path d="m10.500 10.500 3 3"/></svg>')}</button>
        <button class="ob-link" id="ob-explore">Explorer l'appli d'abord</button>
      </div>
      <p class="ob-hint">La recherche dure quelques minutes. Tu peux continuer à naviguer pendant ce temps.</p>
    </section>`,
  );
  stage.querySelector('#ob-go').addEventListener('click', () => finish({ search: true }));
  stage.querySelector('#ob-explore').addEventListener('click', () => finish());
}
