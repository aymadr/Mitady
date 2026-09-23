// Offer collection driven by the user's search preferences, plus recruiter lookup.
const { chromium } = require('playwright');
const { DOMAINS, norm, isExcluded } = require('./skills');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const MAX_NEW = 60;

function key(job) {
  const strip = (s) => norm(s).replace(/\b(alternance|alternant|apprenti|apprentissage|stage|stagiaire|h\s*f|f\s*h|cdi|cdd)\b/g, '').replace(/[^a-z0-9]/g, '');
  return `${strip(job.company)}|${strip(job.title)}`;
}

function isDuplicate(a, b) {
  if (a.link && b.link && a.link === b.link) return true;
  const [ca, ta] = key(a).split('|');
  const [cb, tb] = key(b).split('|');
  return ca === cb && ta && tb && (ta.includes(tb) || tb.includes(ta));
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

async function helloWork(context, keyword, search, log) {
  const params = new URLSearchParams({ k: keyword });
  if (search.contract) params.set('c', search.contract);
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

// Sites behind bot protection are reached through a search engine index.
async function viaSearchEngine(context, keyword, search, site, source) {
  const q = `site:${site} "${search.contract || ''}" "${keyword}" ${search.location || ''}`.replace(/""\s?/g, '');
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
      .filter((r) => r.link.includes(site.split('/')[0]))
      .map((r) => {
        let title = r.title.replace(/\s*[|-]\s*(Welcome to the Jungle|makesense|Jobs That Make Sense)\s*$/i, '').trim();
        let company = '';
        const parts = title.split(/\s+[-|–]\s+/);
        if (parts.length > 1) {
          company = parts.pop().trim();
          title = parts.join(' - ');
        }
        const m = r.link.match(/\/companies\/([^/]+)/);
        if (m) company = m[1].replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
        return { title, company: company || 'Entreprise non précisée', link: r.link, location: search.location || '', snippet: r.snippet, source };
      });
  } catch {
    return [];
  } finally {
    await page.close();
  }
}

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

async function run(profile, existing, log = () => {}) {
  const search = profile.search || {};
  const { keywords, hints } = searchPlan(search);
  if (!keywords.length) throw new Error('Choisis un domaine ou ajoute des mots-clés dans ton profil.');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: UA, locale: 'fr-FR' });
  try {
    let found = [];
    for (const kw of keywords) {
      log(`Recherche « ${kw} »`);
      // HelloWork runs alongside; search-engine queries go one at a time.
      const hw = helloWork(context, kw, search, log);
      const wttj = await viaSearchEngine(context, kw, search, 'welcometothejungle.com/fr/companies', 'Welcome to the Jungle');
      const jtms = await viaSearchEngine(context, kw, search, 'jobs.makesense.org/fr/jobs', 'Jobs That Make Sense');
      const batches = [await hw, wttj, jtms];
      log(`  HelloWork ${batches[0].length} · Welcome to the Jungle ${wttj.length} · Jobs That Make Sense ${jtms.length}`);
      found.push(...batches.flat());
    }

    const before = found.length;
    found = found.filter((j) => j.title.length > 4 && relevant(j.title, hints) && !isExcluded(j.company, search.excluded));
    log(`${before - found.length} offres écartées (hors sujet ou organismes de formation)`);

    const fresh = [];
    for (const job of found) {
      if (!fresh.some((f) => isDuplicate(f, job)) && !existing.some((e) => isDuplicate(e, job))) fresh.push(job);
    }
    const batch = fresh.slice(0, MAX_NEW);
    log(`${fresh.length} nouvelles offres${fresh.length > MAX_NEW ? `, ${MAX_NEW} analysées cette fois` : ''}`);

    for (let i = 0; i < batch.length; i += 4) {
      log(`Lecture des annonces ${i + 1}–${Math.min(i + 4, batch.length)} sur ${batch.length}`);
      await Promise.all(batch.slice(i, i + 4).map((job) => fetchDescription(context, job)));
    }
    return batch;
  } finally {
    await browser.close();
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

module.exports = { run, findContacts, isDuplicate };
