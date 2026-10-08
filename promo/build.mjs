// Builds promo/mitady-promo.html: one self-contained file (sprites, logos, CV pages and screenshots inlined).
// Run: node --experimental-default-type=module promo/build.mjs
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { petSvg, defaultPet, ANIMALS } from '../public/js/pet.js';
import { scene } from '../public/js/scenery.js';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const P = (...a) => path.join(ROOT, ...a);
process.env.DATA_DIR = process.env.DATA_DIR || '/tmp/mitady-promo-build';
const cv = require(P('server/lib/cv.js'));

const dataUri = (file, type) => `data:${type};base64,${fs.readFileSync(file).toString('base64')}`;
const parts = (markup) => {
  const m = String(markup).match(/<svg[^>]*viewBox="([^"]+)"[^>]*>([\s\S]*)<\/svg>/);
  return { vb: m[1], inner: m[2].replace(/<i class="pet-sh"><\/i>[\s\S]*$/, '') };
};

const assets = { pets: {}, scenery: {}, logos: {}, shots: {}, cv: {}, letter: '' };
for (const a of ANIMALS) assets.pets[a.id] = parts(petSvg({ ...defaultPet(a.id) }, { size: 64 }));
assets.petsSleep = parts(petSvg(defaultPet('hibou'), { size: 64, mood: 'sleep' }));
for (const n of ['tree', 'gum', 'bush', 'flower', 'mushroom', 'cloud', 'butterfly', 'leaf', 'star', 'rock']) assets.scenery[n] = parts(scene(n, { size: 64 }));
const logoFiles = { hellowork: 'svg', linkedin: 'svg', indeed: 'svg', wttj: 'png', jtms: 'png', francetravail: 'svg', jobteaser: 'svg', letudiant: 'svg', jobijoba: 'png' };
for (const [id, ext] of Object.entries(logoFiles)) assets.logos[id] = dataUri(P('public/logos', `${id}.${ext}`), ext === 'svg' ? 'image/svg+xml' : 'image/png');
for (const n of ['suivi-clair', 'suivi-sombre', 'accueil-clair', 'offres-clair']) assets.shots[n] = dataUri(P('promo/assets', `${n}.jpg`), 'image/jpeg');
assets.logoSvg = fs.readFileSync(P('public/favicon.svg'), 'utf8');

// The same persona as the README screenshots, rendered by the app's own templates.
const photo = dataUri(P('promo/assets/koala-photo.png'), 'image/png');
const persona = {
  name: 'Camille Martin', headline: 'Étudiante en Master Cybersécurité', email: 'camille.martin@email.fr', phone: '06 12 34 56 78', location: 'Lyon',
  links: ['linkedin.com/in/camille-martin', 'github.com/camille-m'], titleGender: 'feminin', photoData: photo, cvManaged: true,
  summary: "Étudiante en Master Cybersécurité, rigoureuse et curieuse, je cherche une alternance de 24 mois en analyse SOC pour mettre en pratique la détection d'incidents.",
  skills: ['Python', 'SQL', 'Splunk', 'SIEM', 'Wireshark', 'Linux', 'Réseaux', 'MITRE ATT&CK'], skillLevels: { Python: 5, SQL: 4, Splunk: 4, Linux: 4, Wireshark: 3 },
  sections: [
    { type: 'employment', title: 'Expérience professionnelle', items: [
      { title: 'Stagiaire analyste SOC', subtitle: 'Orange Cyberdefense', location: 'Lyon', start: '2025-04', end: '2025-09', description: "- Surveillance des alertes SIEM et qualification des incidents\n- Création de règles de détection Splunk" },
      { title: 'Technicienne support', subtitle: 'Mairie de Villeurbanne', location: 'Villeurbanne', start: '2023-06', end: '2023-08', description: '- Support de 120 postes Windows et Linux' },
    ] },
    { type: 'education', title: 'Formation', items: [
      { title: 'Master Cybersécurité', subtitle: 'Université Claude Bernard Lyon 1', location: 'Lyon', start: '2024-09', end: '2026-06', description: '- Spécialisation détection et réponse aux incidents' },
      { title: 'Licence Informatique', subtitle: 'Université Lumière Lyon 2', location: 'Lyon', start: '2021-09', end: '2024-06', description: '' },
    ] },
    { type: 'projects', title: 'Projets', items: [{ title: 'Home lab SOC', subtitle: 'Splunk, Wazuh, Docker', description: "- SIEM complet sur machines virtuelles\n- Simulation d'attaques MITRE ATT&CK" }] },
    { type: 'skills', title: 'Compétences' },
    { type: 'languages', title: 'Langues', items: [{ name: 'Français', level: 5 }, { name: 'Anglais', level: 4 }] },
  ],
};
const looks = {
  classique: { layout: 'classique', accent: '#1f3a93', photoShape: 'rond', headStyle: 'accent' },
  atlantique: { layout: 'atlantique', accent: '#2f7d5b', photoShape: 'rond', photoSize: 'l', skillStyle: 'dots', headIcons: 'outline' },
  mercure: { layout: 'mercure', accent: '#14274e', photoShape: 'rond', bgColor: '#dce6ee', bgMode: 'header' },
  safran: { layout: 'safran', accent: '#b24a1d', photoShape: 'arrondi', headIcons: 'outline' },
  ruban: { layout: 'ruban', accent: '#5b2a86', photoShape: 'rond' },
  argent: { layout: 'argent', accent: '#0f6b73', photoShape: 'rond', photoSize: 'l', skillStyle: 'bars' },
};
// Pages are shown in iframes with the print margins turned into padding, so they look like a sheet of paper.
const sheet = (h) => h.replace('</head>', '<style>html { background: #fff; padding: 10mm 12mm; }</style></head>');
const tailored = { headline: persona.headline, summary: persona.summary, skills: persona.skills };
for (const [k, style] of Object.entries(looks)) assets.cv[k] = sheet(cv.renderCvHtml({ ...persona, cvStyle: style }, tailored));
assets.cvAccent = {};
for (const c of ['#2f7d5b', '#1f4fd1', '#b24a1d', '#0f6b73', '#7a3fb0', '#b0306a']) {
  assets.cvAccent[c] = sheet(cv.renderCvHtml({ ...persona, cvStyle: { ...looks.atlantique, accent: c } }, tailored));
}
assets.letter = sheet(cv.renderLetterFor(
  { ...persona, letter: { layout: '' }, cvStyle: looks.atlantique },
  {
    subject: 'Candidature : Alternante Analyste SOC', opening: 'Madame, Monsieur,', place: 'Lyon', date: '8 octobre 2026', align: 'right',
    body: "Je me permets de vous adresser ma candidature pour le poste d'Alternante Analyste SOC au sein de Thales. Votre offre a retenu toute mon attention : elle correspond au projet professionnel que je construis.\n\nMon parcours m'a permis de développer des compétences solides, notamment en Splunk, SIEM et Python, que j'ai mises en pratique à travers mes expériences et mes projets.\n\nJe serais ravie de vous présenter plus en détail ma motivation lors d'un échange.",
    closing: "Je vous prie d'agréer, Madame, Monsieur, l'expression de mes salutations distinguées.",
    recipient: { name: 'Mme Dupont', role: 'Responsable recrutement', company: 'Thales', address: 'Lyon' },
  },
  persona.headline,
));

const template = fs.readFileSync(P('promo/template.html'), 'utf8');
const scenes = fs.readFileSync(P('promo/scenes.js'), 'utf8');
const font = `@font-face { font-family: 'Bricolage Grotesque'; font-weight: 600 800; font-style: normal; src: url(${dataUri(P('promo/assets/bricolage-latin.woff2'), 'font/woff2')}) format('woff2'); }`;
const html = template
  .replace('/*__FONT__*/', () => font)
  .replace('/*__ASSETS__*/', () => `const ASSETS = ${JSON.stringify(assets)};`)
  .replace('/*__SCENES__*/', () => scenes);
fs.writeFileSync(P('promo/mitady-promo.html'), html);
console.log('promo/mitady-promo.html', (html.length / 1024).toFixed(0) + ' Ko');
