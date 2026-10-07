import { S, startSearch, refreshPage, upsertApp } from '../main.js';
import { html, raw, mount, api, fail, toast, icons, avatar, miniRing, relDate } from '../lib.js';
import { startOnboarding } from './onboarding.js';
import { tile, marquee } from '../brand.js';
import { petSvg, petOf } from '../pet.js';

// Numbers count up from zero when the page opens.
function countUp(root) {
  root.querySelectorAll('[data-count]').forEach((el) => {
    const end = Number(el.dataset.count);
    const suffix = el.dataset.suffix || '';
    const t0 = performance.now();
    const tick = (t) => {
      const k = Math.min(1, (t - t0) / 900);
      el.textContent = Math.round(end * (1 - Math.pow(1 - k, 3))) + suffix;
      if (k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

function offerRow(a, side) {
  return html`<a class="item" href="#/offres/${a.id}">
    ${avatar(a.company)}
    <div class="item-main">
      <div class="item-title">${a.title}</div>
      <div class="item-sub">${a.company}${a.location ? ` · ${a.location}` : ''}</div>
    </div>
    <div class="item-side">${side}${icons.chevron}</div>
  </a>`;
}

function onboarding(view) {
  const hasCv = Boolean(S.profile.cvFile || (S.profile.name && S.profile.sections.length));
  const hasSearch = Boolean(S.profile.search.domain || S.profile.search.keywords.length);
  const hasOffers = S.applications.length > 0;
  const step = (done, n, title, text, action) => html`
    <div class="step ${done ? 'done' : ''}">
      <span class="step-num">${done ? icons.check : n}</span>
      <div class="grow"><div class="step-title">${title}</div><div class="step-text">${text}</div></div>
      ${done ? '' : action}
    </div>`;

  mount(
    view,
    html`<div class="page-head hero-orb"><div>
        <div class="eyebrow">Pour démarrer</div>
        <h1 class="page-title">Trouve le bon poste,<br><span class="grad">plus vite.</span></h1>
        <p class="page-sub">Importe ton CV, dis ce que tu cherches. L'app collecte les offres, mesure ta correspondance et adapte ton CV à chacune.</p>
        <p style="margin-top:20px"><button class="btn btn-secondary btn-sm" id="guide">Découvrir ce que Mitady sait faire</button> <button class="btn btn-plain" id="setup">Refaire la configuration</button></p>
      </div></div>
      <div class="group steps">
        ${step(hasCv, 1, 'Importe ou écris ton CV', "Un PDF ou un Word, analysé automatiquement. Ou saisis ton parcours à la main : l'app le met en forme au format ATS.", html`<a class="btn btn-primary btn-sm" href="#/profil">Commencer</a>`)}
        ${step(hasSearch, 2, 'Choisis ton domaine', 'Cybersécurité, finance, data, marketing… et le type de contrat recherché.', html`<a class="btn btn-secondary btn-sm" href="#/profil/recherche">Définir</a>`)}
        ${step(hasOffers, 3, 'Lance une première recherche', 'HelloWork, LinkedIn, Indeed, Welcome to the Jungle et plus encore.', html`<button class="btn btn-secondary btn-sm" data-search>Chercher</button>`)}
      </div>`,
  );
  view.querySelector('#guide').addEventListener('click', () => startOnboarding({ tour: true }));
  view.querySelector('#setup').addEventListener('click', () => startOnboarding());
  view.querySelector('[data-search]')?.addEventListener('click', startSearch);
}

// "3 candidatures cette semaine · série de 2 jours"
function streakChip(apps) {
  const days = new Set(apps.map((a) => a.appliedAt).filter(Boolean));
  const iso = (d) => d.toISOString().slice(0, 10);
  const week = apps.filter((a) => a.appliedAt && (Date.now() - new Date(a.appliedAt)) / 86400000 < 7).length;
  let streak = 0;
  const d = new Date();
  if (!days.has(iso(d))) d.setDate(d.getDate() - 1);
  while (days.has(iso(d))) {
    streak += 1;
    d.setDate(d.getDate() - 1);
  }
  if (!week) return '';
  return html`<div class="streak">${tile('rocket', { size: 30, cls: 'inline' })}<span><b>${week} candidature${week > 1 ? 's' : ''}</b> cette semaine${streak > 1 ? html` · <b>série de ${streak} jours</b>` : ''}</span></div>`;
}

export function renderToday(view) {
  const apps = S.applications;
  const ready = S.profile.skills.length && (S.profile.search.domain || S.profile.search.keywords.length);
  if (!ready || !apps.length) return onboarding(view);

  const todo = apps.filter((a) => a.status === 'todo');
  const sentEver = apps.filter((a) => ['applied', 'interview', 'offer', 'rejected'].includes(a.status));
  const interviews = apps.filter((a) => a.status === 'interview');
  const answered = apps.filter((a) => ['interview', 'offer', 'rejected'].includes(a.status));
  const followUps = apps.filter((a) => a.followUpDue);
  const best = todo
    .filter((a) => a.score !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);
  const fresh = todo.filter((a) => a.addedAt === new Date().toISOString().slice(0, 10)).length;
  const firstName = (S.profile.name || '').split(' ')[0];

  const parts = [];
  if (followUps.length) parts.push(`${followUps.length} relance${followUps.length > 1 ? 's' : ''} à faire`);
  if (fresh) parts.push(`${fresh} nouvelle${fresh > 1 ? 's' : ''} offre${fresh > 1 ? 's' : ''} aujourd'hui`);
  if (interviews.length) parts.push(`${interviews.length} entretien${interviews.length > 1 ? 's' : ''} en cours`);
  const summary = parts.length ? parts.join(', ') + '.' : `${todo.length} offres t'attendent.`;
  const rate = sentEver.length ? Math.round((answered.length / sentEver.length) * 100) : null;

  const counts = {
    todo: todo.length,
    applied: apps.filter((a) => a.status === 'applied').length,
    interview: interviews.length,
    offer: apps.filter((a) => a.status === 'offer').length,
    rejected: apps.filter((a) => a.status === 'rejected').length,
  };
  const total = Object.values(counts).reduce((x, y) => x + y, 0) || 1;
  const stages = [
    ['todo', 'À traiter', '#8b8aa3'],
    ['applied', 'Envoyées', '#5b5bf0'],
    ['interview', 'Entretiens', '#a259f7'],
    ['offer', 'Offres reçues', '#14b87d'],
    ['rejected', 'Refus', '#ee5fa7'],
  ].filter(([k]) => counts[k]);

  mount(
    view,
    html`<div class="page-head"><div class="greet"><span class="greet-pet">${petSvg(petOf(S.profile), { size: 104, mood: 'idle', label: petOf(S.profile).name })}</span><div>
        <div class="eyebrow">${new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
        <h1 class="page-title">Bonjour${firstName ? html` <span class="grad">${firstName}</span>` : ''}.</h1>
        <p class="page-sub">${summary[0].toUpperCase() + summary.slice(1)}</p>
        ${streakChip(apps)}
        <div class="cta-row"><button class="btn btn-primary btn-lg" data-search>${icons.search} Chercher des offres</button></div>
      </div></div></div>

      ${marquee()}

      <div class="stats" style="margin-top:34px">
        <div class="stat hero">${tile('inbox', { size: 44 })}<div class="stat-value" data-count="${todo.length}">0</div><div class="stat-label">À traiter</div></div>
        <div class="stat">${tile('send', { size: 44 })}<div class="stat-value" data-count="${sentEver.length}">0</div><div class="stat-label">Candidatures envoyées</div></div>
        <div class="stat">${tile('chat', { size: 44 })}<div class="stat-value" data-count="${interviews.length}">0</div><div class="stat-label">Entretiens en cours</div></div>
        <div class="stat">${tile('pulse', { size: 44 })}<div class="stat-value" ${rate === null ? '' : raw(`data-count="${rate}" data-suffix=" %"`)}>${rate === null ? '—' : '0'}</div><div class="stat-label">Taux de réponse</div></div>
      </div>

      <div class="pipeline">
        <div class="pipeline-bar">${stages.map(([k, , c], i) => html`<span style="flex:${counts[k]};background:${c};animation-delay:${i * 0.12}s"></span>`)}</div>
        <div class="pipeline-legend">${stages.map(([k, l, c]) => html`<span><i style="background:${c}"></i><b>${counts[k]}</b>${l}</span>`)}</div>
      </div>

      ${followUps.length
        ? html`<section class="section">
            <div class="section-head"><h2 class="section-title">À relancer</h2><span class="section-note">Sans réponse depuis ${S.settings.followUpDays} jours ou plus</span></div>
            <div class="group">
              ${followUps.map(
                (a) => html`<div class="item">
                  ${avatar(a.company)}
                  <div class="item-main">
                    <div class="item-title">${a.title}</div>
                    <div class="item-sub">${a.company} · envoyée ${relDate(a.lastFollowUpAt || a.appliedAt)}</div>
                  </div>
                  <div class="item-side">
                    <button class="btn btn-plain small" data-done="${a.id}">Déjà fait</button>
                    <a class="btn btn-secondary btn-sm" href="#/offres/${a.id}/candidature">Relancer</a>
                  </div>
                </div>`,
              )}
            </div>
          </section>`
        : ''}

      <section class="section">
        <div class="section-head"><h2 class="section-title">Meilleures correspondances</h2><a class="small" href="#/offres">Tout voir</a></div>
        <div class="group">
          ${best.length
            ? best.map((a) => offerRow(a, miniRing(a.score)))
            : html`<div class="empty"><strong>Rien à traiter</strong>Lance une recherche pour trouver de nouvelles offres.</div>`}
        </div>
      </section>

      ${interviews.length
        ? html`<section class="section">
            <div class="section-head"><h2 class="section-title">Entretiens</h2></div>
            <div class="group">${interviews.map((a) => offerRow(a, html`<span class="badge blue">Entretien</span>`))}</div>
          </section>`
        : ''}`,
  );

  view.querySelector('[data-search]')?.addEventListener('click', startSearch);
  countUp(view);

  view.querySelectorAll('[data-done]').forEach((b) =>
    b.addEventListener('click', async () => {
      try {
        upsertApp(await api(`/applications/${b.dataset.done}/followed-up`, { method: 'POST' }));
        toast('Relance notée');
        refreshPage();
      } catch (e) {
        fail(e);
      }
    }),
  );
}

