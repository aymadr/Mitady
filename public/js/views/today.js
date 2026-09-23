import { S, startSearch, refreshPage, upsertApp } from '../main.js';
import { html, mount, api, fail, toast, icons, scoreClass, scoreText, relDate } from '../lib.js';

function offerRow(a, side) {
  return html`<a class="item" href="#/offres/${a.id}">
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
    html`<div class="page-head"><div>
        <h1 class="page-title">Trouve le bon poste,<br>plus vite.</h1>
        <p class="page-sub">Importe ton CV, dis ce que tu cherches. L'app collecte les offres, mesure ta correspondance et adapte ton CV à chacune.</p>
      </div></div>
      <div class="group steps">
        ${step(hasCv, 1, 'Importe ou écris ton CV', 'Un PDF ou un Word, analysé automatiquement. Ou saisis ton parcours à la main : l'app le met en forme au format ATS.', html`<a class="btn btn-primary btn-sm" href="#/profil">Commencer</a>`)}
        ${step(hasSearch, 2, 'Choisis ton domaine', 'Cybersécurité, finance, data, marketing… et le type de contrat recherché.', html`<a class="btn btn-secondary btn-sm" href="#/profil/recherche">Définir</a>`)}
        ${step(hasOffers, 3, 'Lance une première recherche', 'HelloWork, Welcome to the Jungle et Jobs That Make Sense.', html`<button class="btn btn-secondary btn-sm" data-search>Chercher</button>`)}
      </div>`,
  );
  view.querySelector('[data-search]')?.addEventListener('click', startSearch);
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

  mount(
    view,
    html`<div class="page-head"><div>
        <h1 class="page-title">Bonjour${firstName ? ` ${firstName}` : ''}.</h1>
        <p class="page-sub">${summary[0].toUpperCase() + summary.slice(1)}</p>
      </div></div>

      <div class="stats">
        <div class="stat"><div class="stat-value">${todo.length}</div><div class="stat-label">À traiter</div></div>
        <div class="stat"><div class="stat-value">${sentEver.length}</div><div class="stat-label">Candidatures envoyées</div></div>
        <div class="stat"><div class="stat-value">${interviews.length}</div><div class="stat-label">Entretiens en cours</div></div>
        <div class="stat"><div class="stat-value">${rate === null ? '—' : `${rate} %`}</div><div class="stat-label">Taux de réponse</div></div>
      </div>

      ${followUps.length
        ? html`<section class="section">
            <div class="section-head"><h2 class="section-title">À relancer</h2><span class="section-note">Sans réponse depuis ${S.settings.followUpDays} jours ou plus</span></div>
            <div class="group">
              ${followUps.map(
                (a) => html`<div class="item">
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
            ? best.map((a) => offerRow(a, html`<span class="score ${scoreClass(a.score)}">${scoreText(a.score)}</span>`))
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

