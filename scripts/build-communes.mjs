// Rebuilds server/data/geo-fr.json: the French places the search can be centred on (≈8 800 communes of 1 000+
// inhabitants, the départements and the régions), with their coordinates, so that "within 30 km of Lyon" works
// offline and the same way on every job site.
//
//   mkdir /tmp/geo && cd /tmp/geo && npm init -y && npm i all-the-cities @etalab/decoupage-administratif
//   GEO_SRC=/tmp/geo/node_modules node scripts/build-communes.mjs
//
// Sources: coordinates and populations © GeoNames (CC BY 4.0, via the all-the-cities package);
// codes, postal codes, départements and régions: Etalab, Licence Ouverte 2.0.
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const SRC = path.resolve(process.env.GEO_SRC || 'node_modules');
const req = createRequire(path.join(SRC, 'x.js'));
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'server', 'data', 'geo-fr.json');

const cities = req('all-the-cities').filter((c) => c.country === 'FR');
const communes = req('@etalab/decoupage-administratif/data/communes.json').filter((c) => c.type === 'commune-actuelle');
const departements = req('@etalab/decoupage-administratif/data/departements.json').filter((d) => d.zone === 'metro');
const regions = req('@etalab/decoupage-administratif/data/regions.json').filter((r) => r.zone === 'metro' || ['11', '24', '27', '28', '32', '44', '52', '53', '75', '76', '84', '93', '94'].includes(r.code));

const byInsee = new Map(communes.map((c) => [c.code, c]));
const r4 = (n) => Math.round(n * 1e4) / 1e4;
const rows = [];
for (const c of cities) {
  const insee = c.muniSub || (c.name === 'Paris' ? '75056' : '');
  const ref = byInsee.get(insee);
  if (!ref || !/^\d{2}|^2[AB]/.test(ref.departement)) continue; // metropolitan France only
  const [lon, lat] = c.loc.coordinates;
  rows.push([ref.nom, insee, (ref.codesPostaux || []).join(' '), r4(lat), r4(lon), ref.population || c.population, c.population]);
}
// GeoNames also lists the arrondissements of Paris, Lyon and Marseille: one row per commune, the one GeoNames
// itself ranks highest (the city proper, not an arrondissement) wins.
const best = new Map();
for (const r of rows) if (!best.has(r[1]) || r[6] > best.get(r[1])[6]) best.set(r[1], r);
rows.length = 0;
rows.push(...[...best.values()].sort((a, b) => b[5] - a[5]).map((r) => r.slice(0, 6)));

// A département / région sits at the population-weighted centre of its communes; `span` is roughly how far its
// edge is from there, used as slack when an offer only says "Rhône" or "Île-de-France".
const km = (a, b) => {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (b[0] - a[0]) * rad, dLon = (b[1] - a[1]) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};
function centre(list) {
  const w = list.reduce((s, r) => s + r[5], 0) || 1;
  const p = [list.reduce((s, r) => s + r[3] * r[5], 0) / w, list.reduce((s, r) => s + r[4] * r[5], 0) / w];
  const d = list.map((r) => km(p, [r[3], r[4]])).sort((a, b) => a - b);
  return [r4(p[0]), r4(p[1]), Math.round(d[Math.floor(d.length * 0.9)] || 20)];
}
const inDept = (code) => rows.filter((r) => (r[1].startsWith('2A') || r[1].startsWith('2B') ? r[1].slice(0, 2) : r[1].slice(0, r[1].startsWith('97') ? 3 : 2)) === code);
const depOut = departements.map((d) => {
  const list = inDept(d.code);
  return list.length ? [d.code, d.nom, ...centre(list), d.region] : null;
}).filter(Boolean);
const regOut = regions.map((r) => {
  const list = depOut.filter((d) => d[5] === r.code).flatMap((d) => inDept(d[0]));
  return list.length ? [r.code, r.nom, ...centre(list)] : null;
}).filter(Boolean);

fs.writeFileSync(OUT, JSON.stringify({ v: 1, source: 'GeoNames (CC BY 4.0) · Etalab (Licence Ouverte 2.0)', communes: rows, departements: depOut.map((d) => d.slice(0, 5).concat([d[5]])), regions: regOut }));
console.log(rows.length, 'communes,', depOut.length, 'départements,', regOut.length, 'régions →', OUT, (fs.statSync(OUT).size / 1024).toFixed(0) + ' Ko');
