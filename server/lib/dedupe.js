// Duplicate detection across sources: the same offer is often posted on several
// job boards, or twice on the same one, with slightly different titles and links.
const { norm } = require('./skills');

const CONTRACT_WORDS = /\b(alternance|alternant|alternante|apprenti|apprentie|apprentissage|stage|stagiaire|intern|internship|cdi|cdd|freelance|contrat|pro|professionnalisation)\b/g;
const GENDER = /\b(h\s*f|f\s*h|h\s*\/\s*f|f\s*\/\s*h|m\s*\/\s*f|f\s*\/\s*m)\b/g;
const COMPANY_NOISE = /\b(sas|sasu|sarl|sa|se|eurl|group|groupe|france|international|holding|services|consulting|conseil)\b/g;
const TITLE_STOP = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'et', 'en', 'au', 'aux', 'pour', 'un', 'une', 'd', 'l', 'a', 'the', 'and', 'of', 'to', 'for', 'in', 'junior', 'senior']);
const UNKNOWN_COMPANY = 'entreprisenonprecisee';

function companyKey(company = '') {
  return norm(company).replace(COMPANY_NOISE, '').replace(/[^a-z0-9]/g, '');
}

function titleTokens(title = '') {
  return new Set(
    norm(title)
      .replace(GENDER, ' ')
      .replace(CONTRACT_WORDS, ' ')
      .split(/[^a-z0-9+#]+/)
      .filter((w) => w && !TITLE_STOP.has(w)),
  );
}

// A link reduced to what identifies the offer: no tracking parameters, and the
// board's own offer id when it has one.
function canonicalLink(link = '') {
  if (!link) return '';
  try {
    const u = new URL(link);
    const host = u.hostname.replace(/^(www|fr|m)\./, '');
    if (host.includes('linkedin.com')) {
      const id = u.pathname.match(/(\d{6,})\/?$/)?.[1] || u.searchParams.get('currentJobId');
      if (id) return `linkedin:${id}`;
    }
    if (host.includes('indeed.')) {
      const jk = u.searchParams.get('jk') || u.searchParams.get('vjk');
      if (jk) return `indeed:${jk}`;
    }
    if (host.includes('francetravail') || host.includes('pole-emploi')) {
      const id = u.pathname.match(/detail\/([\w]+)/)?.[1];
      if (id) return `ft:${id}`;
    }
    return `${host}${u.pathname.replace(/\/$/, '')}`.toLowerCase();
  } catch {
    return link.trim().toLowerCase();
  }
}

function titleSimilarity(a, b) {
  const ta = titleTokens(a);
  const tb = titleTokens(b);
  if (!ta.size || !tb.size) return 0;
  const common = [...ta].filter((w) => tb.has(w)).length;
  // Containment, not Jaccard: "Analyste SOC" vs "Analyste SOC N2 - Supervision".
  return common / Math.min(ta.size, tb.size);
}

function isDuplicate(a, b) {
  const la = canonicalLink(a.link);
  const lb = canonicalLink(b.link);
  if (la && la === lb) return true;

  const ca = companyKey(a.company);
  const cb = companyKey(b.company);
  const sim = titleSimilarity(a.title, b.title);
  if (!ca || !cb || ca === UNKNOWN_COMPANY || cb === UNKNOWN_COMPANY) {
    // Without a company, only an identical title in the same place counts.
    return sim === 1 && titleTokens(a.title).size >= 2 && norm(a.location) === norm(b.location);
  }
  const sameCompany = ca === cb || (Math.min(ca.length, cb.length) >= 5 && (ca.includes(cb) || cb.includes(ca)));
  return sameCompany && sim >= 0.8;
}

// Removes duplicates from a list, keeping the entry that is furthest along
// (applied, with a CV…) and otherwise the first one. Returns { kept, removed }.
function progress(a) {
  return (a.status !== 'todo' ? 4 : 0) + (a.cv?.file ? 2 : 0) + (a.notes ? 1 : 0) + (a.contact?.email ? 1 : 0);
}

function mergeDuplicates(list) {
  const kept = [];
  const removed = [];
  for (const item of list) {
    const i = kept.findIndex((k) => isDuplicate(k, item));
    if (i === -1) kept.push(item);
    else if (progress(item) > progress(kept[i])) {
      removed.push(kept[i]);
      kept[i] = item;
    } else removed.push(item);
  }
  return { kept, removed };
}

module.exports = { isDuplicate, mergeDuplicates, canonicalLink };
