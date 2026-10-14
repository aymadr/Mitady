// Run with: npm test
const test = require('node:test');
const assert = require('node:assert/strict');
const geo = require('./geo');
const filters = require('./filters');

test('places are found from the many ways an offer writes them', () => {
  const where = (t) => geo.lookup(t)?.name;
  assert.equal(where('Lyon 3e'), 'Lyon');
  assert.equal(where('LYON 03'), 'Lyon');
  assert.equal(where('Villeurbanne (69)'), 'Villeurbanne');
  assert.equal(where('Lyon, Auvergne-Rhône-Alpes, France'), 'Lyon');
  assert.equal(where('69003 Lyon'), 'Lyon');
  assert.equal(where('92 - Boulogne-Billancourt'), 'Boulogne-Billancourt');
  assert.equal(where('St-Étienne'), 'Saint-Étienne');
  assert.equal(geo.lookup('Île-de-France').kind, 'region');
  assert.equal(geo.lookup('Rhône').kind, 'departement');
  assert.equal(geo.lookup('France'), null);
  assert.equal(geo.lookup('Télétravail'), null);
});

test('distances are the right order of magnitude', () => {
  const km = (a, b) => Math.round(geo.distanceKm(geo.lookup(a), geo.lookup(b)));
  assert.ok(km('Lyon', 'Villeurbanne') <= 5);
  assert.ok(Math.abs(km('Lyon', 'Saint-Étienne') - 51) <= 4);
  assert.ok(Math.abs(km('Lyon', 'Paris') - 392) <= 8);
});

test('suggestions while typing', () => {
  assert.equal(geo.searchPlaces('lyo')[0].name, 'Lyon');
  assert.equal(geo.searchPlaces('69003')[0].name, 'Lyon');
  assert.ok(geo.searchPlaces('ile de').some((p) => p.kind === 'region'));
  assert.deepEqual(geo.searchPlaces('x'), []);
});

test('a search is cleaned: type, range and legacy location text', () => {
  const s = filters.cleanSearch({ location: 'Lyon' }, { legacy: true });
  assert.equal(s.places[0].name, 'Lyon');
  assert.equal(s.radius, 30);
  assert.equal(s.remote, 'any');
  const bad = filters.cleanSearch({ places: 'x', radius: 'abc', remote: 'nope', posted: 5, maxOffers: 9999, minScore: -3 });
  assert.deepEqual([bad.places.length, bad.radius, bad.remote, bad.posted, bad.maxOffers, bad.minScore], [0, 30, 'any', 0, 200, 0]);
  assert.equal(filters.cleanSearch({ places: [{ name: 'a' }, { name: 'b' }, { name: 'c' }, { name: 'd' }] }).places.length, 3);
  assert.deepEqual(geo.cleanPlaces([null, 5, { name: {} }, { name: 'Lyon', lat: 'x' }, { name: '  ' }]).map((p) => p.label), ['Lyon (69)']);
  assert.equal(filters.cleanSearch({ places: [], location: 'Lyon' }).places.length, 0, 'removing every place must not bring the old text back');
});

test('perimeter keeps near and unknown places, drops far ones, spares full remote', () => {
  const s = filters.cleanSearch({ places: [{ name: 'Lyon' }], radius: 30 });
  const jobs = [
    { title: 'near', location: 'Villeurbanne (69)' },
    { title: 'far', location: 'Paris 8e' },
    { title: 'area', location: 'Rhône' },
    { title: 'unknown', location: 'France' },
    { title: 'guess', location: 'Paris', locationGuess: true },
    { title: 'remote', location: 'Paris', snippet: 'Poste en full remote' },
  ];
  const { kept, outside } = filters.prefilter(jobs, s, '2026-10-08');
  assert.deepEqual(kept.map((j) => j.title), ['near', 'area', 'unknown', 'guess', 'remote']);
  assert.equal(outside, 1);
  assert.equal(filters.prefilter(jobs, { ...s, radius: 0 }, '2026-10-08').outside, 0);
});

test('age and remote modes', () => {
  const s = filters.cleanSearch({ posted: 7 });
  const r = filters.prefilter([{ title: 'a', postedAt: '2026-10-06' }, { title: 'b', postedAt: '2026-09-01' }, { title: 'c' }], s, '2026-10-08');
  assert.deepEqual(r.kept.map((j) => j.title), ['a', 'c']);
  const profile = { skills: [] };
  const mk = (mode) => filters.refine([{ title: 'x', description: 'Télétravail 2 jours par semaine' }, { title: 'y', description: 'Full remote' }, { title: 'z', description: 'Sur site' }], { remote: mode }, profile).kept.map((j) => j.title);
  assert.deepEqual(mk('any'), ['x', 'y', 'z']);
  assert.deepEqual(mk('hybrid'), ['x', 'y']);
  assert.deepEqual(mk('remote'), ['y']);
  assert.deepEqual(mk('onsite'), ['z']);
});

test('minimum match drops weak offers but keeps the ones without skills listed', () => {
  const profile = { skills: ['Python'], search: { domain: 'cyber' } };
  const jobs = [{ title: 'weak', description: 'Splunk SIEM Wireshark Docker Linux' }, { title: 'strong', description: 'Python Python SIEM' }, { title: 'none', description: 'Rien de technique' }];
  const { kept, lowScore } = filters.refine(jobs, { remote: 'any', minScore: 50 }, profile);
  assert.ok(lowScore >= 1 && !kept.some((j) => j.title === 'weak'));
  assert.ok(kept.some((j) => j.title === 'none'));
});

test('the search pipeline asks each site for each place and applies the perimeter', async () => {
  const pw = require('playwright');
  const page = { goto: async () => {}, waitForTimeout: async () => {}, close: async () => {}, $: async () => null, evaluate: async () => 'Mission : Python, SIEM. Télétravail partiel.' };
  const fake = { newContext: async () => ({ newPage: async () => page, request: { get: async () => ({ ok: () => false }) } }), close: async () => {} };
  const realLaunch = pw.chromium.launch;
  pw.chromium.launch = async () => fake;
  const scraper = require('./scraper');
  const asked = [];
  scraper._sites.hellowork = async (ctx, kw, contract, search) => {
    asked.push([search.location, search.radius]);
    return [
      { title: `Alternant analyste ${search.location}`, company: `Boite ${search.location}`, link: `https://x.test/${search.location}`, location: search.location, source: 'HelloWork' },
      { title: 'Alternant analyste Brest', company: 'Boite Brest', link: 'https://x.test/brest', location: 'Brest', source: 'HelloWork' },
    ];
  };
  try {
    const profile = { skills: ['Python'], search: filters.cleanSearch({ domain: 'cyber', keywords: ['analyste'], contracts: ['Alternance'], sources: ['hellowork'], excluded: [], places: [{ name: 'Lyon' }, { name: 'Nantes' }], radius: 30, maxOffers: 20 }) };
    const jobs = await scraper.run(profile, [], () => {}, () => {});
    assert.deepEqual(asked.map((a) => a[0]), ['Lyon', 'Nantes']);
    assert.ok(asked.every((a) => a[1] === 30));
    assert.deepEqual(jobs.map((j) => j.location).sort(), ['Lyon', 'Nantes'], 'Brest is outside both perimeters');
  } finally {
    pw.chromium.launch = realLaunch;
  }
});
