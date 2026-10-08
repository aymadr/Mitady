// Places and distances in France, from a bundled dataset (server/data/geo-fr.json, see scripts/build-communes.mjs):
// no network, same answer on every machine. Used to centre a search on a city, to place the location an offer
// mentions ("Lyon 3e", "Villeurbanne (69)", "Lyon, Auvergne-Rhône-Alpes, France", "69003"), and to tell how far apart
// the two are.
const data = require('../data/geo-fr.json');

// "Saint-Étienne", "St-Etienne" and "saint etienne" are the same key; so are "Lyon 3e" and "Lyon".
function key(s) {
  return String(s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/œ/g, 'oe').replace(/æ/g, 'ae')
    .replace(/\(\s*\d{2,3}[ab]?\s*\)/g, ' ')
    .replace(/\b\d{5}\b/g, ' ')
    .replace(/\bcedex\b\s*\d*/g, ' ')
    .replace(/\b\d{1,2}\s*(?:er|e|eme)?\s*(?:arrondissement|arr)?(?![a-z0-9])/g, ' ')
    .replace(/\barrondissement\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\bst\b/g, 'saint').replace(/\bste\b/g, 'sainte')
    .replace(/\s+/g, ' ').trim();
}
const deptOf = (insee) => (insee.startsWith('2A') || insee.startsWith('2B') ? insee.slice(0, 2) : insee.startsWith('97') ? insee.slice(0, 3) : insee.slice(0, 2));

const communes = data.communes.map(([name, insee, cps, lat, lon, pop]) => ({ kind: 'commune', name, insee, cps: cps ? cps.split(' ') : [], lat, lon, pop, dept: deptOf(insee), k: key(name) }));
const departements = data.departements.map(([code, name, lat, lon, span, region]) => ({ kind: 'departement', code, name, lat, lon, slack: span, region, k: key(name) }));
const regions = data.regions.map(([code, name, lat, lon, span]) => ({ kind: 'region', code, name, lat, lon, slack: span, k: key(name) }));

const byName = new Map();
const byPostal = new Map();
for (const c of communes) { // already sorted by population, biggest first
  if (!byName.has(c.k)) byName.set(c.k, []);
  byName.get(c.k).push(c);
  for (const cp of c.cps) { if (!byPostal.has(cp)) byPostal.set(cp, []); byPostal.get(cp).push(c); }
}
const deptByCode = new Map(departements.map((d) => [d.code, d]));
const deptByName = new Map(departements.map((d) => [d.k, d]));
const regionByName = new Map(regions.map((r) => [r.k, r]));

function distanceKm(a, b) {
  const rad = Math.PI / 180, R = 6371;
  const dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// What is stored in a profile and sent to the pages: the plain facts about a place.
function toPlace(x) {
  const label = x.kind === 'commune' ? `${x.name} (${x.dept})` : x.kind === 'departement' ? `${x.name} (département)` : `${x.name} (région)`;
  return { name: x.name, label, kind: x.kind, lat: x.lat, lon: x.lon, slack: x.slack || 0, ...(x.kind === 'commune' ? { dept: x.dept, insee: x.insee } : {}) };
}

// The place a free text points at, or null. Prefers the most populated homonym unless a postal code or a
// département hint ("(69)", "69 - Lyon") says otherwise.
function lookup(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;
  const cp = raw.match(/\b(\d{5})\b/)?.[1] || '';
  const parts = raw.split(/[,;|\n/]|\s[-–]\s/).map((s) => s.trim()).filter(Boolean);
  const hint = raw.match(/\(\s*(\d{2,3}|2[ab])\s*\)/i)?.[1]?.toUpperCase() || parts.find((p) => /^(\d{2,3}|2[ab])$/i.test(p))?.toUpperCase() || (cp ? (cp.startsWith('20') ? '' : cp.slice(0, cp.startsWith('97') ? 3 : 2)) : '');
  const pick = (list) => list.find((c) => cp && c.cps.includes(cp)) || list.find((c) => hint && c.dept === hint) || list[0];

  const tried = new Set();
  for (const part of [...parts, raw]) {
    const k = key(part);
    if (!k || tried.has(k) || /^(france|metropole|international)$/.test(k)) continue;
    tried.add(k);
    const list = byName.get(k);
    if (list) return pick(list);
  }
  if (cp && byPostal.has(cp)) return pick(byPostal.get(cp));
  for (const k of tried) {
    const d = deptByName.get(k);
    if (d) return d;
    const r = regionByName.get(k);
    if (r) return r;
  }
  if (hint && deptByCode.has(hint)) return deptByCode.get(hint);
  return null;
}

// Suggestions while typing: communes first (biggest first), then a département or a région.
function searchPlaces(query, limit = 8) {
  const q = key(query);
  const digits = String(query || '').replace(/\s/g, '');
  const out = [];
  if (/^\d{2,5}$/.test(digits)) {
    const seen = new Set();
    for (const c of communes) {
      if ((c.cps.some((cp) => cp.startsWith(digits)) || (digits.length === 2 && c.dept === digits)) && !seen.has(c.insee)) { seen.add(c.insee); out.push(c); if (out.length >= limit - 1) break; }
    }
    const d = digits.length === 2 && deptByCode.get(digits);
    if (d) out.push(d);
    return out.map(toPlace);
  }
  if (q.length < 2) return [];
  const starts = [], inside = [];
  for (const c of communes) {
    if (c.k.startsWith(q)) starts.push(c);
    else if (starts.length < limit && c.k.includes(' ' + q)) inside.push(c);
    if (starts.length >= limit) break;
  }
  out.push(...starts, ...inside);
  const areas = [...departements, ...regions].filter((a) => a.k.startsWith(q) || a.k.includes(' ' + q));
  const room = Math.max(1, Math.min(2, limit - out.length));
  return [...out.slice(0, limit - Math.min(areas.length, room)), ...areas.slice(0, room)].map(toPlace);
}

// A profile's `places`, whatever was typed or stored: only well-formed ones survive, at most three. A text we cannot
// place is kept as a free place (no coordinates): the job sites still get it, but no distance is computed.
function cleanPlaces(list, legacyText = '') {
  const out = [];
  const seen = new Set();
  const add = (p) => { const id = key(p.name) + '|' + p.kind; if (p.name && !seen.has(id) && out.length < 3) { seen.add(id); out.push(p); } };
  for (const item of Array.isArray(list) ? list : []) {
    if (!item || typeof item !== 'object' || typeof item.name !== 'string') continue;
    const name = item.name.trim().slice(0, 80);
    if (!name) continue;
    const found = lookup(item.label && item.kind === 'commune' && item.insee ? `${name} (${item.dept || ''})` : name);
    add(found && key(found.name) === key(name) ? toPlace(found) : found && !item.lat ? toPlace(found) : { name, label: name, kind: 'libre', lat: null, lon: null, slack: 0 });
  }
  if (!out.length && typeof legacyText === 'string' && legacyText.trim()) {
    const found = lookup(legacyText);
    add(found ? toPlace(found) : { name: legacyText.trim().slice(0, 80), label: legacyText.trim().slice(0, 80), kind: 'libre', lat: null, lon: null, slack: 0 });
  }
  return out;
}

// How far an offer's location is from the nearest of the chosen places.
//   → { km, slack }  (slack: how imprecise the offer's location is, e.g. 60 km for "Rhône")  or null when unplaceable.
function distanceFrom(places, locationText) {
  const where = lookup(locationText);
  const located = places.filter((p) => typeof p.lat === 'number');
  if (!where || !located.length) return null;
  let best = null;
  for (const p of located) {
    const km = distanceKm(p, where);
    const slack = (where.kind === 'commune' ? 0 : where.slack || 0) + (p.kind === 'commune' ? 0 : p.slack || 0);
    if (!best || km - slack < best.km - best.slack) best = { km: Math.round(km), slack };
  }
  return best;
}

module.exports = { key, lookup, searchPlaces, cleanPlaces, distanceKm, distanceFrom, toPlace };
