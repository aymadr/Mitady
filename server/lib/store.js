// Local JSON persistence, in data/ (git-ignored, created on first launch):
//  - db.json       profile, settings and applications
//  - secrets.json  SMTP password, API key
// DATA_DIR overrides the location, e.g. to try the app with an empty profile.
const fs = require('fs');
const path = require('path');
const { DEFAULT_EXCLUDED } = require('./skills');

const ROOT = path.resolve(__dirname, '..', '..');
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(ROOT, 'data'));
const DB_FILE = path.join(DATA_DIR, 'db.json');
const SECRETS_FILE = path.join(DATA_DIR, 'secrets.json');
const LEGACY_FILE = path.join(DATA_DIR, 'applications.json');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const CV_DIR = path.join(DATA_DIR, 'cvs');

for (const dir of [DATA_DIR, UPLOAD_DIR, CV_DIR]) fs.mkdirSync(dir, { recursive: true });

const DEFAULT_TEMPLATE = `Bonjour {{contact}},

Je vous adresse ma candidature pour le poste {{poste}} chez {{entreprise}}.

{{resume}}

Vous trouverez mon CV en pièce jointe. Je serais ravi d'échanger avec vous à ce sujet.

Bien cordialement,
{{nom}}
{{telephone}} · {{email}}`;

function defaultProfile() {
  return {
    name: '',
    headline: '',
    email: '',
    phone: '',
    location: '',
    links: [],
    summary: '',
    titleGender: 'neutre',
    pet: null, // the pixel companion: { animal, color, accessory, name }, see public/js/pet.js
    skills: [],
    sections: [], // { id, type, title, hidden, body | items }, see cv.js SECTION_TYPES
    details: [], // extra personal details: [{ label, value }]
    skillLevels: {}, // 1-5 per skill, for the bar / dot styles
    cvManaged: false, // true once the CV editor owns the section list
    cvFile: null, // { name, path, type, uploadedAt }
    photo: null, // path of the CV photo (edited)
    photoOriginal: null, // path of the picture it was cropped from
    photoCrop: null, // { zoom, x, y, rot, bw } to reopen the cropper where it was
    cvMode: 'own', // 'own' = keep my CV file, 'app' = use the app's templates
    cvStyle: { layout: 'classique', font: 'calibri', accent: 'bleu', photo: true, photoShape: 'portrait', photoSize: 'm', photoBorder: false },
    docx: { titleText: '', skillsAnchor: '' },
    search: {
      domain: '',
      keywords: [],
      location: '',
      contracts: ['Alternance'],
      sources: null, // null = the sources enabled by default
      excluded: [...DEFAULT_EXCLUDED],
    },
  };
}

function defaultSettings() {
  return {
    followUpDays: 7,
    emailSubject: 'Candidature {{poste}} · {{nom}}',
    emailTemplate: DEFAULT_TEMPLATE,
  };
}

function defaultSecrets() {
  return { smtp: { service: 'gmail', host: '', port: 465, user: '', pass: '' }, anthropicKey: '' };
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(file, data) {
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, file);
}

const STATUS_MAP = { todo: 'todo', applied: 'applied', interview: 'interview' };

// Converts records from the previous applications.json format.
function migrateLegacy(apps) {
  return apps.map((a) => ({
    id: String(a.id),
    title: a.title || '',
    company: a.company || '',
    link: a.link || '',
    location: a.location || '',
    source: sourceFromLink(a.link),
    description: a.description || '',
    status: STATUS_MAP[a.status] || 'todo',
    addedAt: a.dateAdded || today(),
    appliedAt: a.appliedDate || '',
    followUpAt: '',
    contact: { name: a.contactName || '', email: a.contactEmail || '' },
    notes: a.comments && !/import|détecté/i.test(a.comments) ? a.comments : '',
    cv: a.customCvPath
      ? { headline: a.customCvTitle || '', summary: '', skillsAdded: a.customCvSkills || [], file: a.customCvPath, generatedAt: '' }
      : null,
  }));
}

function sourceFromLink(link = '') {
  if (link.includes('hellowork')) return 'HelloWork';
  if (link.includes('welcometothejungle')) return 'Welcome to the Jungle';
  if (link.includes('makesense')) return 'Jobs That Make Sense';
  if (link.includes('linkedin')) return 'LinkedIn';
  if (link.includes('indeed')) return 'Indeed';
  if (link.includes('francetravail') || link.includes('pole-emploi')) return 'France Travail';
  if (link.includes('jobijoba')) return 'Jobijoba';
  if (link.includes('jobteaser')) return 'JobTeaser';
  if (link.includes('letudiant')) return "L'Étudiant";
  try {
    return new URL(link).hostname.replace(/^www\./, '');
  } catch {
    return 'Manuel';
  }
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

let db = readJson(DB_FILE, null);
if (!db) {
  db = { profile: defaultProfile(), settings: defaultSettings(), applications: [] };
  const legacy = readJson(LEGACY_FILE, null);
  if (Array.isArray(legacy)) {
    db.applications = migrateLegacy(legacy);
    console.log(`[store] ${db.applications.length} candidatures importées depuis applications.json`);
  }
  writeJson(DB_FILE, db);
}
// The previous scraper filled every offer with a made-up "Service Recrutement" /
// recrutement@<company>.com contact. Those addresses were never verified: drop them.
for (const a of db.applications) {
  if (a.contact?.name === 'Service Recrutement') a.contact = { name: '', email: /^recrutement@/.test(a.contact.email) ? '' : a.contact.email };
}
// The search used to take a single contract; it now takes several (alternance + stage…).
const oldSearch = (db.profile || {}).search || {};
if (oldSearch.contract && !oldSearch.contracts) oldSearch.contracts = [oldSearch.contract];
delete oldSearch.contract;
// Titles saved by earlier versions may end with the company name.
{
  const { stripCompany } = require('./text');
  for (const a of db.applications) a.title = stripCompany(a.title, a.company);
}
db.profile = {
  ...defaultProfile(),
  ...db.profile,
  search: { ...defaultProfile().search, ...(db.profile || {}).search },
  cvStyle: { ...defaultProfile().cvStyle, ...(db.profile || {}).cvStyle },
};
// Photo shapes were square / rounded (both portrait) before: keep their look.
if (db.profile.cvStyle && !db.profile.cvStyle.photoShapeV2) {
  const m = { carre: 'portrait', arrondi: 'portraitArrondi' };
  db.profile.cvStyle.photoShape = m[db.profile.cvStyle.photoShape] || db.profile.cvStyle.photoShape;
  db.profile.cvStyle.photoShapeV2 = true;
}
db.settings = { ...defaultSettings(), ...db.settings };

let secrets = { ...defaultSecrets(), ...readJson(SECRETS_FILE, {}) };

function save() {
  writeJson(DB_FILE, db);
}

module.exports = {
  DATA_DIR,
  UPLOAD_DIR,
  CV_DIR,
  today,
  sourceFromLink,
  get db() {
    return db;
  },
  save,
  getSecrets() {
    return secrets;
  },
  setSecrets(patch) {
    secrets = { ...secrets, ...patch, smtp: { ...secrets.smtp, ...(patch.smtp || {}) } };
    writeJson(SECRETS_FILE, secrets);
  },
  newId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  },
};
