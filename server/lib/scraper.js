// Offer collection driven by the user's search preferences, plus recruiter lookup.
const { chromium } = require('playwright');
const { DOMAINS, norm, isExcluded } = require('./skills');
const { isDuplicate } = require('./dedupe');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const MAX_NEW = 60;

// Contract types the user can search for, with what each board calls them.
const CONTRACTS = {
  Alternance: { word: 'alternance', hellowork: 'Alternance', linkedin: null, indeed: null },
  Stage: { word: 'stage', hellowork: 'Stage', linkedin: 'I', indeed: 'internship' },
  CDI: { word: 'CDI', hellowork: 'CDI', linkedin: 'F', indeed: 'permanent' },
  CDD: { word: 'CDD', hellowork: 'CDD', linkedin: 'C', indeed: 'contract' },
  Freelance: { word: 'freelance', hellowork: 'Freelance', linkedin: 'C', indeed: 'subcontract' },
};

function detectContract(job) {
  const t = norm(`${job.title} ${job.snippet || ''} ${job.link}`);
  if (/alternan|apprenti|apprentissage|contrat[- ]pro/.test(t)) return 'Alternance';
  if (/\bstage|stagiaire|\bintern(ship)?\b/.test(t)) return 'Stage';
  if (/\bcdi\b/.test(t)) return 'CDI';
  if (/\bcdd\b/.test(t)) return 'CDD';
  return '';
}

// Job boards. `direct` ones are read on their own site; the others sit behind bot
// protection and are reached through a search engine's index (`site`).
const SOURCES = [
  { id: 'hellowork', label: 'HelloWork', on: true, direct: true },
  { id: 'linkedin', label: 'LinkedIn', on: true, direct: true },
  { id: 'indeed', label: 'Indeed', on: true, direct: true, fallbackSite: 'fr.indeed.com/viewjob' },
  { id: 'wttj', label: 'Welcome to the Jungle', on: true, site: 'welcometothejungle.com/fr/companies' },
  { id: 'jtms', label: 'Jobs That Make Sense', on: true, site: 'jobs.makesense.org/fr/jobs' },
  { id: 'francetravail', label: 'France Travail', on: true, site: 'candidat.francetravail.fr/offres/recherche/detail' },
  { id: 'jobijoba', label: 'Jobijoba', on: false, site: 'jobijoba.com' },
  { id: 'jobteaser', label: 'JobTeaser', on: false, site: 'jobteaser.com/fr/job-offers' },
  { id: 'letudiant', label: "L'Étudiant", on: false, site: 'letudiant.fr/jobs-stages-alternance' },
];

function enabledSources(search) {
  const ids = Array.isArray(search.sources) ? search.sources : SOURCES.filter((s) => s.on).map((s) => s.id);
  return SOURCES.filter((s) => ids.includes(s.id));
}

function selectedContracts(search) {
  const list = (search.contracts?.length ? search.contracts : ['Alternance']).filter((c) => CONTRACTS[c]);
  return list.length ? list : ['Alternance'];
}

function searchPlan(search) {
  const domain = DOMAINS[search.domain];
  const keywords = (search.keywords?.length ? search.keywords : domain?.keywords || []).slice(0, 6);
  const hints = [...(domain?.titleHints || []), ...keywords.flatMap((k) => norm(k).split(/\s+/)).filter((w) => w.length >= 4)];
  return { keywords, hints };
}

function relevant(title, hints) {
  if (!hints.length) return true;
  const t = norm(title);
  return hints.some((h) => t.includes(norm(h)));
}

async function helloWork(context, keyword, contract, search, log) {
  const params = new URLSearchParams({ k: keyword });
  params.set('c', CONTRACTS[contract].hellowork);
  if (search.location) params.set('l', search.location);
  const url = `https://www.hellowork.com/fr-fr/emploi/recherche.html?${params}`;
  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(2500);
    return await page.evaluate(() => {
      const out = [];
      document.querySelectorAll('li').forEach((li) => {
        const titleEl = li.querySelector('p.typo-l, p.typo-xl, h3');
        const companyEl = li.querySelector('p.typo-s.inline, p.typo-s');
        const linkEl = li.querySelector('a[href*="/emplois/"]');
        if (!titleEl || !companyEl || !linkEl) return;
        const tags = [...li.querySelectorAll('.tag-secondary-s')].map((e) => e.innerText.trim());
        out.push({
          title: titleEl.innerText.trim(),
          company: companyEl.innerText.trim(),
          link: new URL(linkEl.getAttribute('href'), location.origin).href,
          location: tags[0] || '',
          source: 'HelloWork',
        });
      });
      return out;
    });
  } catch (e) {
    log(`HelloWork « ${keyword} » : ${e.message.split('\n')[0]}`);
    return [];
  } finally {
    await page.close();
  }
}

// Parsed in the page (DOMParser) so the markup is read like a browser would.
function parseLinkedInCards(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return [...doc.querySelectorAll('li')]
    .map((li) => {
      const a = li.querySelector('a.base-card__full-link, a[href*="/jobs/view/"]');
      const title = li.querySelector('.base-search-card__title, h3')?.textContent.trim();
      if (!a || !title) return null;
      return {
        title,
        company: li.querySelector('.base-search-card__subtitle, h4')?.textContent.trim() || '',
        link: a.getAttribute('href'),
        location: li.querySelector('.job-search-card__location')?.textContent.trim() || '',
        source: 'LinkedIn',
      };
    })
    .filter(Boolean);
}

// LinkedIn's public (logged-out) job search, the same one that feeds its job pages.
async function linkedIn(context, keyword, contract, search, log) {
  const c = CONTRACTS[contract];
  const params = new URLSearchParams({ keywords: contract === 'Alternance' ? `${keyword} alternance` : keyword, location: search.location || 'France', start: '0' });
  if (c.linkedin) params.set('f_JT', c.linkedin);
  const page = await context.newPage();
  try {
    const res = await context.request.get(`https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?${params}`, { timeout: 20000 });
    if (!res.ok()) throw new Error(`HTTP ${res.status()}`);
    const cards = await page.evaluate(`(${parseLinkedInCards.toString()})(${JSON.stringify(await res.text())})`);
    return cards.map((j) => ({ ...j, link: canonicalLinkedIn(j.link) }));
  } catch (e) {
    log(`LinkedIn « ${keyword} » : ${e.message.split('\n')[0]}`);
    return [];
  } finally {
    await page.close();
  }
}

function canonicalLinkedIn(link) {
  const id = link.match(/(\d{6,})(?:\?|$)/)?.[1];
  return id ? `https://www.linkedin.com/jobs/view/${id}` : link.split('?')[0];
}

async function indeed(context, keyword, contract, search, log) {
  const c = CONTRACTS[contract];
  const q = contract === 'Alternance' ? `${keyword} alternance` : keyword;
  const params = new URLSearchParams({ q, l: search.location || 'France' });
  if (c.indeed) params.set('sc', `0kf:jt(${c.indeed});`);
  const page = await context.newPage();
  try {
    await page.goto(`https://fr.indeed.com/jobs?${params}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(2500);
    const jobs = await page.evaluate(() =>
      [...document.querySelectorAll('div.job_seen_beacon, li div[data-jk], .jobsearch-SerpJobCard')].map((card) => {
        const a = card.querySelector('h2 a, a.jcs-JobTitle');
        const jk = a?.getAttribute('data-jk') || card.getAttribute('data-jk') || new URL(a?.href || location.href, location.origin).searchParams.get('jk');
        return {
          title: (card.querySelector('h2 span[title], h2 a span, h2')?.innerText || '').trim(),
          company: (card.querySelector('[data-testid="company-name"], .companyName')?.innerText || '').trim(),
          location: (card.querySelector('[data-testid="text-location"], .companyLocation')?.innerText || '').trim(),
          link: jk ? `https://fr.indeed.com/viewjob?jk=${jk}` : '',
          source: 'Indeed',
        };
      }),
    );
    return jobs.filter((j) => j.title && j.link);
  } catch (e) {
    log(`Indeed « ${keyword} » : ${e.message.split('\n')[0]}`);
    return [];
  } finally {
    await page.close();
  }
}

// Sites behind bot protection are reached through a search engine index.
async function viaSearchEngine(context, keyword, contract, search, src) {
  const word = CONTRACTS[contract].word;
  const q = `site:${src.site || src.fallbackSite} "${word}" "${keyword}" ${search.location || ''}`.trim();
  const page = await context.newPage();
  try {
    // The engine returns an empty page when hit too fast: wait and retry once.
    for (let attempt = 0; attempt < 2; attempt++) {
      await page.goto(`https://fr.search.yahoo.com/search?p=${encodeURIComponent(q)}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(2000 + attempt * 4000);
      if (await page.$('.algo')) break;
    }
    const results = await page.evaluate(() =>
      [...document.querySelectorAll('.algo')].map((r) => ({
        // The link also contains a breadcrumb of the URL on its first line.
        title: (r.querySelector('h3 a')?.innerText || '').trim().split('\n').pop().trim(),
        link: r.querySelector('h3 a')?.getAttribute('href') || '',
        snippet: r.querySelector('.compText')?.innerText.trim() || '',
      })),
    );
    return results
      .filter((r) => r.link.includes((src.site || src.fallbackSite).split('/')[0]))
      .map((r) => {
        let title = r.title
          .replace(/\s*[|-]\s*(Welcome to the Jungle|makesense|Jobs That Make Sense|Indeed(\.com)?|France Travail|Jobijoba|JobTeaser|L'Étudiant)\s*$/i, '')
          .replace(/^Offre d'emploi\s+/i, '')
          .trim();
        let company = '';
        const parts = title.split(/\s+[-|–]\s+/);
        if (parts.length > 1) {
          company = parts.pop().trim();
          title = parts.join(' - ');
        }
        const m = r.link.match(/\/companies\/([^/]+)/);
        if (m) company = m[1].replace(/-/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase());
        return { title, company: company || 'Entreprise non précisée', link: r.link, location: search.location || '', snippet: r.snippet, source: src.label };
      });
  } catch {
    return [];
  } finally {
    await page.close();
  }
}

const DIRECT = { hellowork: helloWork, linkedin: linkedIn, indeed };

async function fetchDescription(context, job) {
  const page = await context.newPage();
  try {
    await page.goto(job.link, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(1500);
    const text = await page.evaluate(() => {
      const blocks = [...document.querySelectorAll('main section, article, section, main')];
      const wanted = /missions?|profil recherché|description du poste|détail du poste|vos responsabilités|compétences/i;
      const hit = blocks.find((b) => wanted.test(b.innerText || '') && b.innerText.length > 300 && b.innerText.length < 15000);
      const best = hit || blocks.sort((a, b) => (b.innerText || '').length - (a.innerText || '').length)[0];
      return (best?.innerText || '').trim();
    });
    job.description = text.length > 120 ? text.slice(0, 12000) : job.snippet || '';
  } catch {
    job.description = job.snippet || '';
  } finally {
    await page.close();
  }
}

async function fetchLinkedInDescription(context, job) {
  const id = job.link.match(/(\d{6,})$/)?.[1];
  if (!id) return false;
  try {
    const res = await context.request.get(`https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${id}`, { timeout: 20000 });
    if (!res.ok()) return false;
    const html = await res.text();
    const m = html.match(/show-more-less-html__markup[^>]*>([\s\S]*?)<\/div>/);
    if (!m) return false;
    const text = m[1].replace(/<br\s*\/?>|<\/(p|li|ul)>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
    if (text.length < 120) return false;
    job.description = text.slice(0, 12000);
    return true;
  } catch {
    return false;
  }
}

// One search at a time; stop() ends it early and keeps what was found so far.
let current = null;
function stop() {
  if (!current) return false;
  current.stopped = true;
  current.browser.close().catch(() => {});
  return true;
}

// `progress` receives structured events for the search screen:
// start, search (one per keyword and contract), filter, dedupe, read.
async function run(profile, existing, log = () => {}, progress = () => {}) {
  const search = profile.search || {};
  const { keywords, hints } = searchPlan(search);
  if (!keywords.length) throw new Error('Choisis un domaine ou ajoute des mots-clés dans ton profil.');
  const contracts = selectedContracts(search);
  const sources = enabledSources(search);
  if (!sources.length) throw new Error('Active au moins un site dans « Sites de recherche » (profil).');
  // Each extra contract type or site multiplies the number of pages read.
  const kws = keywords.slice(0, contracts.length > 1 ? 4 : 6);

  const browser = await chromium.launch({ headless: true });
  const ctl = { stopped: false, browser };
  current = ctl;
  const context = await browser.newContext({ userAgent: UA, locale: 'fr-FR' });
  try {
    let found = [];
    const total = contracts.length * kws.length;
    const perSource = Object.fromEntries(sources.map((s) => [s.label, 0]));
    let batchNo = 0;
    progress({ stage: 'start', sources: sources.map((s) => ({ id: s.id, label: s.label })), batches: total });
    try {
    for (const contract of contracts) {
      if (ctl.stopped) break;
      for (const kw of kws) {
        if (ctl.stopped) break;
        log(`Recherche « ${kw} » · ${contract}`);
        // Direct sites run side by side; search-engine queries go one at a time.
        const direct = sources.filter((s) => s.direct).map(async (s) => {
          let jobs = await DIRECT[s.id](context, kw, contract, search, log);
          if (!jobs.length && s.fallbackSite) jobs = await viaSearchEngine(context, kw, contract, search, s);
          return [s, jobs];
        });
        const viaEngine = [];
        for (const s of sources.filter((x) => x.site)) viaEngine.push([s, await viaSearchEngine(context, kw, contract, search, s)]);
        const batches = [...(await Promise.all(direct)), ...viaEngine];
        log('  ' + batches.map(([s, jobs]) => `${s.label} ${jobs.length}`).join(' · '));
        for (const [src, jobs] of batches) {
          found.push(...jobs.map((j) => ({ ...j, contract: detectContract(j) || contract })));
          perSource[src.label] += jobs.length;
        }
        batchNo += 1;
        progress({ stage: 'search', batch: batchNo, batches: total, keyword: kw, contract, perSource: { ...perSource }, seen: found.length });
      }
    }

    } catch (e) {
      // Closing the browser to stop makes the pending page calls fail: that is expected.
      if (!ctl.stopped) throw e;
    }

    const before = found.length;
    found = found.filter((j) => j.title.length > 4 && relevant(j.title, hints) && !isExcluded(j.company, search.excluded));
    log(`${before - found.length} offres écartées (hors sujet ou organismes de formation)`);
    progress({ stage: 'filter', before, kept: found.length });

    const fresh = [];
    let dupes = 0;
    for (const job of found) {
      if (fresh.some((f) => isDuplicate(f, job)) || existing.some((e) => isDuplicate(e, job))) dupes++;
      else fresh.push(job);
    }
    log(`${dupes} doublons ignorés (même offre sur plusieurs sites ou déjà dans ta liste)`);
    progress({ stage: 'dedupe', dupes, fresh: Math.min(fresh.length, MAX_NEW) });
    const batch = fresh.slice(0, MAX_NEW);
    log(`${fresh.length} nouvelles offres${fresh.length > MAX_NEW ? `, ${MAX_NEW} analysées cette fois` : ''}`);

    try {
    for (let i = 0; i < batch.length && !ctl.stopped; i += 4) {
      log(`Lecture des annonces ${i + 1}–${Math.min(i + 4, batch.length)} sur ${batch.length}`);
      progress({ stage: 'read', done: i, total: batch.length });
      await Promise.all(batch.slice(i, i + 4).map(async (job) => ((job.source === 'LinkedIn' && (await fetchLinkedInDescription(context, job))) ? null : fetchDescription(context, job))));
    }
    } catch (e) {
      if (!ctl.stopped) throw e;
    }
    for (const job of batch) job.description ||= job.snippet || '';
    ctl.result = batch;
    progress({ stage: 'read', done: batch.length, total: batch.length });
    return Object.assign(batch, { stopped: ctl.stopped });
  } finally {
    current = null;
    await browser.close().catch(() => {});
  }
}

// Public profiles of recruiters / managers at a company, found through a search engine.
async function findContacts(company, title = '') {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: UA, locale: 'fr-FR' });
  const page = await context.newPage();
  const queries = [
    `site:linkedin.com/in ("talent acquisition" OR "recrutement" OR "recruiter" OR "chargé de recrutement") "${company}"`,
    `site:linkedin.com/in "${company}" ("responsable" OR "manager" OR "head of" OR "RH") ${title.split(/\s+/).find((w) => w.length > 5) || ''}`,
  ];
  const people = [];
  try {
    for (const q of queries) {
      await page.goto(`https://fr.search.yahoo.com/search?p=${encodeURIComponent(q)}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(1500);
      const rows = await page.evaluate(() =>
        [...document.querySelectorAll('.algo')].map((r) => {
          const a = r.querySelector('h3 a');
          const span = a?.querySelector('span');
          let text = a?.innerText || '';
          if (span) text = text.replace(span.innerText, '');
          return { text: text.trim(), url: a?.getAttribute('href') || '', snippet: r.querySelector('.compText')?.innerText.trim() || '' };
        }),
      );
      for (const r of rows) {
        if (!r.url.includes('linkedin.com/in/') || people.some((p) => p.url === r.url)) continue;
        const [name, ...rest] = r.text.replace(/\s*[|-]\s*LinkedIn.*$/i, '').split(/\s+[-|–]\s+/);
        people.push({ name: name.trim(), role: rest.join(' · ') || r.snippet.slice(0, 90), url: r.url });
      }
      if (people.length >= 6) break;
    }
    return people.slice(0, 8);
  } finally {
    await browser.close();
  }
}

module.exports = { run, stop, findContacts, isDuplicate, SOURCES, CONTRACTS, detectContract };
