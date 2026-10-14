// What the user asks of a search besides "which job": where (one to three places, and how far around them), whether
// working from home is wanted, how recent, how many offers to read, how well they must match.
//
// The job sites only understand part of this (and each in its own way), so the sites are asked as well as they can,
// and Mitady then applies the same rules itself to every offer it gets back.
const geo = require('./geo');
const { analyzeOffer, norm } = require('./skills');

const RADII = [10, 20, 30, 50, 100]; // km; 0 = no limit
const REMOTE_MODES = ['any', 'hybrid', 'remote', 'onsite'];
const POSTED_DAYS = [0, 1, 3, 7, 14, 30];
const DEFAULTS = { radius: 30, remote: 'any', posted: 0, maxOffers: 60, minScore: 0 };

const clamp = (v, lo, hi, d) => (Number.isFinite(Number(v)) && v !== '' && v !== null ? Math.min(hi, Math.max(lo, Math.round(Number(v)))) : d);

// A search as stored: every field has the type and range the pages and the scraper rely on.
// `legacy`: an older profile only had a free "location" text; it becomes a place the first time.
function cleanSearch(search = {}, { legacy = false } = {}) {
  const places = geo.cleanPlaces(search.places, legacy ? search.location : '');
  return {
    ...search,
    places,
    location: places.map((p) => p.name).join(', ') || (legacy || !('places' in search) ? String(search.location || '').slice(0, 120) : ''),
    radius: 'radius' in search ? clamp(search.radius, 0, 500, DEFAULTS.radius) : DEFAULTS.radius,
    remote: REMOTE_MODES.includes(search.remote) ? search.remote : DEFAULTS.remote,
    posted: POSTED_DAYS.includes(Number(search.posted)) ? Number(search.posted) : DEFAULTS.posted,
    maxOffers: clamp(search.maxOffers, 20, 200, DEFAULTS.maxOffers),
    minScore: clamp(search.minScore, 0, 90, DEFAULTS.minScore),
  };
}

// "remote" (fully), "hybrid" (some days, or just "télétravail" mentioned), "onsite" (said explicitly), or '' (unknown).
function detectRemote(...texts) {
  const t = norm(texts.filter(Boolean).join(' \n '));
  if (!t) return '';
  if (/full[ -]?remote|remote[ -]?(only|first)|100 ?% ?(en )?(remote|teletravail|a distance)|teletravail (complet|total|integral)|(complet|total|integral)ement a distance|poste (en )?(full )?remote|entierement (en )?(remote|teletravail)/.test(t)) return 'remote';
  if (/hybrid|teletravail|telework|home office|work from home|\bremote\b|jours? (de |en )?(tt|remote)|a distance/.test(t)) return 'hybrid';
  if (/sur site|presentiel|sur place|pas de teletravail|aucun teletravail/.test(t)) return 'onsite';
  return '';
}

const located = (search) => (search.places || []).some((p) => typeof p.lat === 'number');

// Is this offer within the perimeter? Offers whose place we cannot tell are never dropped.
//   → { km, slack, inside }  or null
function distance(search, job) {
  if (job.locationGuess || !job.location || !located(search)) return null;
  const d = geo.distanceFrom(search.places, job.location);
  if (!d) return null;
  const radius = search.radius || 0;
  return { km: d.km, slack: d.slack, inside: !radius || d.km - d.slack <= radius };
}

const daysAgo = (iso, today) => (iso ? Math.floor((new Date(today) - new Date(iso)) / 86400000) : null);

// Before the announcements are read (cheap): too far, too old.
function prefilter(jobs, search, today = new Date().toISOString().slice(0, 10)) {
  let outside = 0, old = 0;
  const kept = jobs.filter((j) => {
    j.remote ||= detectRemote(j.title, j.location, j.snippet);
    const d = distance(search, j);
    if (d && !d.inside && j.remote !== 'remote') { outside++; return false; }
    const age = daysAgo(j.postedAt, today);
    if (search.posted && age !== null && age > search.posted) { old++; return false; }
    return true;
  });
  return { kept, outside, old };
}

// After the announcements are read: working from home, and how well the offer matches the profile.
function refine(jobs, search, profile) {
  let remoteOut = 0, lowScore = 0;
  const kept = jobs.filter((j) => {
    j.remote = detectRemote(j.title, j.location, j.snippet, j.description) || j.remote || '';
    const mode = search.remote || 'any';
    const ok = mode === 'any' || (mode === 'hybrid' && ['remote', 'hybrid'].includes(j.remote)) || (mode === 'remote' && j.remote === 'remote') || (mode === 'onsite' && !['remote', 'hybrid'].includes(j.remote));
    if (!ok) { remoteOut++; return false; }
    if (search.minScore) {
      const { score } = analyzeOffer(j, profile);
      if (score !== null && score < search.minScore) { lowScore++; return false; }
    }
    return true;
  });
  return { kept, remoteOut, lowScore };
}

// Every site gets the radius in its own unit and its own steps.
const nearest = (v, list) => list.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a));
const linkedinMiles = (km) => nearest(km * 0.621, [5, 10, 25, 50, 75, 100]);
const indeedKm = (km) => nearest(km, [5, 10, 15, 25, 50, 100]);
const indeedDays = (d) => [1, 3, 7, 14].filter((x) => x <= d).pop() || 1;

module.exports = { DEFAULTS, RADII, REMOTE_MODES, POSTED_DAYS, cleanSearch, detectRemote, distance, prefilter, refine, linkedinMiles, indeedKm, indeedDays };
