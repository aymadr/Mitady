const express = require('express');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const store = require('./lib/store');
const { analyzeOffer, domainList, norm } = require('./lib/skills');
const { adaptTitle, fill } = require('./lib/text');
const cv = require('./lib/cv');
const ai = require('./lib/ai');
const scraper = require('./lib/scraper');
const mailer = require('./lib/mailer');
const { mergeDuplicates } = require('./lib/dedupe');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '127.0.0.1';

app.use(express.json({ limit: '25mb' }));
app.use(express.static(path.resolve(__dirname, '..', 'public')));

// Wraps async handlers so thrown errors become JSON responses.
const route = (fn) => (req, res) =>
  Promise.resolve().then(() => fn(req, res)).catch((e) => {
    console.error(`[${req.method} ${req.path}]`, e.message);
    res.status(e.status || 500).json({ error: e.message });
  });

function fail(status, message) {
  return Object.assign(new Error(message), { status });
}

const STATUSES = ['todo', 'applied', 'interview', 'offer', 'rejected', 'archived'];

function daysBetween(a, b) {
  return Math.floor((new Date(b) - new Date(a)) / 86400000);
}

function enrich(a) {
  const { profile, settings } = store.db;
  const analysis = analyzeOffer(a, profile);
  const since = a.lastFollowUpAt || a.appliedAt;
  const followUpDue = a.status === 'applied' && since && daysBetween(since, store.today()) >= settings.followUpDays;
  return { ...a, ...analysis, followUpDue, suggestedHeadline: adaptTitle(a.title, profile.titleGender) };
}

function findApp(id) {
  const a = store.db.applications.find((x) => x.id === id);
  if (!a) throw fail(404, 'Offre introuvable.');
  return a;
}

function publicSecrets() {
  const s = store.getSecrets();
  return {
    smtp: { service: s.smtp.service, host: s.smtp.host, port: s.smtp.port, user: s.smtp.user, hasPass: Boolean(s.smtp.pass) },
    hasAnthropicKey: Boolean(s.anthropicKey),
    aiEnabled: ai.isEnabled(),
  };
}

// ---------- State ----------

app.get('/api/state', (req, res) => {
  const { profile, settings, applications } = store.db;
  res.json({ profile, settings, secrets: publicSecrets(), domains: domainList(), sources: scraper.SOURCES, contracts: Object.keys(scraper.CONTRACTS), cvStyles: cv.CV_STYLES, applications: applications.map(enrich) });
});

// ---------- Profile ----------

const PROFILE_FIELDS = ['name', 'headline', 'email', 'phone', 'location', 'links', 'summary', 'titleGender', 'skills', 'sections', 'docx', 'search', 'cvStyle', 'cvMode'];
const MERGED_FIELDS = ['search', 'docx', 'cvStyle'];

app.put('/api/profile', route((req, res) => {
  const p = store.db.profile;
  for (const k of PROFILE_FIELDS) {
    if (!(k in req.body)) continue;
    p[k] = MERGED_FIELDS.includes(k) ? { ...p[k], ...req.body[k] } : req.body[k];
  }
  if (Array.isArray(p.skills)) {
    const seen = new Set();
    p.skills = p.skills.map((s) => String(s).trim()).filter((s) => s && !seen.has(norm(s)) && seen.add(norm(s)));
  }
  store.save();
  res.json({ profile: p, applications: store.db.applications.map(enrich) });
}));

app.post('/api/profile/cv', route(async (req, res) => {
  const { name, data } = req.body;
  const ext = path.extname(name || '').toLowerCase();
  if (!['.pdf', '.docx'].includes(ext)) throw fail(400, 'Importe un fichier PDF ou Word (.docx).');
  const target = path.join(store.UPLOAD_DIR, `cv-original${ext}`);
  for (const old of ['.pdf', '.docx']) fs.rmSync(path.join(store.UPLOAD_DIR, `cv-original${old}`), { force: true });
  fs.writeFileSync(target, Buffer.from(data, 'base64'));

  const text = await cv.extractText(target);
  const p = store.db.profile;
  const previousText = p.cvText || '';
  p.cvFile = { name, path: target, type: ext.slice(1), uploadedAt: new Date().toISOString() };
  p.cvText = text;
  p.photo = await cv.extractPhoto(target);
  store.save();
  res.json({ profile: p, parsed: cv.parseCvText(text), previousText });
}));

app.post('/api/profile/cv/ai', route(async (req, res) => {
  const text = store.db.profile.cvText;
  if (!text) throw fail(400, 'Importe d\'abord ton CV.');
  res.json({ parsed: await ai.parseCv(text) });
}));

// Photo shown on the app's CV template (taken from a Word CV, or uploaded here).
app.post('/api/profile/photo', route((req, res) => {
  const ext = path.extname(req.body.name || '').toLowerCase().replace('.jpeg', '.jpg');
  if (!['.jpg', '.png'].includes(ext)) throw fail(400, 'Choisis une image JPG ou PNG.');
  for (const old of ['.png', '.jpg', '.jpeg']) fs.rmSync(path.join(store.UPLOAD_DIR, 'photo' + old), { force: true });
  const target = path.join(store.UPLOAD_DIR, 'photo' + ext);
  fs.writeFileSync(target, Buffer.from(req.body.data, 'base64'));
  store.db.profile.photo = target;
  store.save();
  res.json({ profile: store.db.profile });
}));

app.delete('/api/profile/photo', route((req, res) => {
  const p = store.db.profile;
  if (p.photo) fs.rmSync(p.photo, { force: true });
  p.photo = null;
  store.save();
  res.json({ profile: p });
}));

app.get('/api/profile/photo', route((req, res) => {
  const f = store.db.profile.photo;
  if (!f || !fs.existsSync(f)) throw fail(404, 'Aucune photo.');
  res.sendFile(f);
}));

// Preview of the app template with the profile as it is, style included.
app.post('/api/profile/cv-preview', route((req, res) => {
  const p = { ...store.db.profile, cvStyle: { ...store.db.profile.cvStyle, ...(req.body.cvStyle || {}) } };
  res.type('html').send(cv.renderCvHtml(p, { headline: p.headline, summary: p.summary, skills: p.skills }));
}));

app.get('/api/profile/cv', route((req, res) => {
  const f = store.db.profile.cvFile;
  if (!f || !fs.existsSync(f.path)) throw fail(404, 'Aucun CV importé.');
  res.sendFile(f.path);
}));

// ---------- Settings ----------

app.put('/api/settings', route((req, res) => {
  const { followUpDays, emailSubject, emailTemplate, smtp, anthropicKey } = req.body;
  const s = store.db.settings;
  if (followUpDays !== undefined) s.followUpDays = Math.max(1, Number(followUpDays) || 7);
  if (emailSubject !== undefined) s.emailSubject = emailSubject;
  if (emailTemplate !== undefined) s.emailTemplate = emailTemplate;
  store.save();

  const patch = {};
  if (smtp) {
    patch.smtp = { ...smtp };
    if (!smtp.pass) delete patch.smtp.pass; // empty field = keep the saved password
  }
  if (anthropicKey !== undefined) patch.anthropicKey = anthropicKey.trim();
  if (Object.keys(patch).length) store.setSecrets(patch);
  res.json({ settings: s, secrets: publicSecrets() });
}));

app.post('/api/settings/test-smtp', route(async (req, res) => {
  await mailer.verify(store.getSecrets().smtp);
  res.json({ ok: true });
}));

// ---------- Applications ----------

app.get('/api/applications', (req, res) => res.json(store.db.applications.map(enrich)));

function newApplication(fields) {
  return {
    id: store.newId(),
    title: fields.title || 'Poste sans titre',
    company: fields.company || 'Entreprise non précisée',
    link: fields.link || '',
    location: fields.location || '',
    source: fields.source || store.sourceFromLink(fields.link),
    contract: fields.contract || scraper.detectContract(fields),
    description: fields.description || '',
    status: 'todo',
    addedAt: store.today(),
    appliedAt: '',
    contact: { name: '', email: '' },
    notes: '',
    cv: null,
  };
}

app.post('/api/applications', route((req, res) => {
  const a = newApplication(req.body);
  if (store.db.applications.some((x) => scraper.isDuplicate(x, a))) throw fail(409, 'Cette offre est déjà dans ta liste.');
  store.db.applications.unshift(a);
  store.save();
  res.status(201).json(enrich(a));
}));

app.put('/api/applications/:id', route((req, res) => {
  const a = findApp(req.params.id);
  const { status, notes, contact, title, company, location, link, description, cvDraft } = req.body;
  if (status !== undefined) {
    if (!STATUSES.includes(status)) throw fail(400, 'Statut inconnu.');
    if (status === 'applied' && !a.appliedAt) a.appliedAt = store.today();
    a.status = status;
  }
  Object.assign(a, Object.fromEntries(Object.entries({ notes, title, company, location, link, description }).filter(([, v]) => v !== undefined)));
  if (contact) a.contact = { ...a.contact, ...contact };
  if (cvDraft) a.cv = { ...(a.cv || {}), ...cvDraft };
  store.save();
  res.json(enrich(a));
}));

app.delete('/api/applications/:id', route((req, res) => {
  findApp(req.params.id);
  store.db.applications = store.db.applications.filter((x) => x.id !== req.params.id);
  store.save();
  res.json({ ok: true });
}));

app.post('/api/applications/:id/followed-up', route((req, res) => {
  const a = findApp(req.params.id);
  a.lastFollowUpAt = store.today();
  a.followUps = (a.followUps || 0) + 1;
  store.save();
  res.json(enrich(a));
}));

// ---------- Tailored CV ----------

// Which CV an offer starts from, unless the user picked one by hand:
//  original = the user's own file, untouched (as PDF)
//  docx     = the user's Word file with title, profile paragraph and skills adapted
//  builtin  = the app's templates
function defaultTemplate(profile) {
  if (profile.cvMode === 'app' || !profile.cvFile) return 'builtin';
  return profile.cvFile.type === 'docx' ? 'docx' : 'original';
}

function cvOptions(a, body) {
  const { profile } = store.db;
  return {
    headline: body.headline ?? a.cv?.headline ?? adaptTitle(a.title, profile.titleGender),
    summary: body.summary ?? a.cv?.summary ?? profile.summary,
    skillsAdded: body.skillsAdded ?? a.cv?.skillsAdded ?? [],
    template: body.template || (a.cv?.templateChosen && a.cv.template) || defaultTemplate(profile),
    templateChosen: Boolean(body.templateChosen ?? a.cv?.templateChosen),
  };
}

app.post('/api/applications/:id/cv/preview', route((req, res) => {
  const a = findApp(req.params.id);
  const opts = cvOptions(a, req.body);
  const { profile } = store.db;
  const { skills: offerSkills } = analyzeOffer(a, profile);
  const skills = cv.orderSkills(profile.skills, offerSkills, opts.skillsAdded);
  res.type('html').send(cv.renderCvHtml(profile, { headline: opts.headline, summary: opts.summary, skills, skillsAdded: opts.skillsAdded }));
}));

app.post('/api/applications/:id/cv', route(async (req, res) => {
  const a = findApp(req.params.id);
  const opts = cvOptions(a, req.body);
  const { skills } = analyzeOffer(a, store.db.profile);
  const { file, warning } = await cv.generate(a, store.db.profile, opts, skills);
  a.cv = { ...opts, file, generatedAt: new Date().toISOString() };
  store.save();
  res.json({ application: enrich(a), warning });
}));

app.get('/api/applications/:id/cv', route((req, res) => {
  const a = findApp(req.params.id);
  if (!a.cv?.file || !fs.existsSync(a.cv.file)) throw fail(404, 'CV pas encore généré.');
  if (req.query.download) return res.download(a.cv.file);
  res.sendFile(a.cv.file);
}));

// ---------- Claude ----------

app.post('/api/applications/:id/ai', route(async (req, res) => {
  const a = findApp(req.params.id);
  a.ai = { ...(await ai.tailor(a, store.db.profile)), at: new Date().toISOString() };
  store.save();
  res.json(enrich(a));
}));

// ---------- Contacts & e-mail ----------

app.get('/api/applications/:id/contacts', route(async (req, res) => {
  const a = findApp(req.params.id);
  res.json(await scraper.findContacts(a.company, a.title));
}));

function emailVars(a) {
  const { profile } = store.db;
  return {
    contact: a.contact?.name || '',
    poste: adaptTitle(a.title),
    entreprise: a.company,
    nom: profile.name,
    email: profile.email,
    telephone: profile.phone,
    titre: a.cv?.headline || adaptTitle(a.title, profile.titleGender),
    resume: a.cv?.summary || profile.summary,
  };
}

const tidy = (s) => s.replace(/[ \t]+([,.])/g, '$1').replace(/\n{3,}/g, '\n\n').trim();

app.get('/api/applications/:id/email-draft', route((req, res) => {
  const a = findApp(req.params.id);
  const { settings } = store.db;
  const vars = emailVars(a);
  const fromAi = a.ai?.emailBody;
  res.json({
    to: a.contact?.email || '',
    subject: tidy(fromAi ? a.ai.emailSubject : fill(settings.emailSubject, vars)),
    body: tidy(fromAi ? a.ai.emailBody : fill(settings.emailTemplate, vars)),
  });
}));

app.post('/api/applications/:id/send', route(async (req, res) => {
  const a = findApp(req.params.id);
  const { to, subject, body, attach } = req.body;
  if (!to || !subject || !body) throw fail(400, 'Destinataire, objet et message sont requis.');
  const { profile } = store.db;
  let attachment = null;
  if (attach === 'tailored') attachment = a.cv?.file;
  if (attach === 'original') attachment = await cv.originalPdf(profile);
  if (attachment && !fs.existsSync(attachment)) throw fail(400, 'La pièce jointe est introuvable, régénère le CV.');

  await mailer.send(store.getSecrets().smtp, { fromName: profile.name, to, subject, body, attachment });
  a.emails = [...(a.emails || []), { to, subject, at: new Date().toISOString() }];
  if (a.status === 'todo') {
    a.status = 'applied';
    a.appliedAt = store.today();
  } else {
    a.lastFollowUpAt = store.today();
  }
  a.contact = { ...a.contact, email: to };
  store.save();
  res.json(enrich(a));
}));

// ---------- Duplicates ----------

// Merges duplicates among offers not yet worked on; applied or annotated ones are kept.
function dedupeTodo() {
  const open = store.db.applications.filter((a) => a.status === 'todo' && !a.cv?.file && !a.notes);
  const { removed } = mergeDuplicates(open);
  const gone = new Set(removed);
  store.db.applications = store.db.applications.filter((a) => !gone.has(a));
  return removed;
}

app.post('/api/applications/dedupe', route((req, res) => {
  const removed = dedupeTodo();
  store.save();
  res.json({ removed: removed.length, applications: store.db.applications.map(enrich) });
}));

// ---------- Search (Server-Sent Events) ----------

let searching = false;
app.get('/api/search', async (req, res) => {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  res.flushHeaders();
  const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  if (searching) {
    send('error', { message: 'Une recherche est déjà en cours.' });
    return res.end();
  }
  searching = true;
  try {
    const jobs = await scraper.run(store.db.profile, store.db.applications, (line) => send('log', { line }));
    const added = jobs.map((j) => newApplication(j));
    store.db.applications.unshift(...added);
    const merged = dedupeTodo();
    store.save();
    send('done', { added: added.length - merged.filter((a) => added.includes(a)).length, merged: merged.length });
  } catch (e) {
    send('error', { message: e.message });
  } finally {
    searching = false;
    res.end();
  }
});

// ---------- Export ----------

const STATUS_LABELS = { todo: 'À traiter', applied: 'Envoyée', interview: 'Entretien', offer: 'Offre reçue', rejected: 'Refusée', archived: 'Écartée' };

app.get('/api/export.xlsx', (req, res) => {
  const rows = store.db.applications.map(enrich).map((a) => ({
    Ajoutée: a.addedAt,
    Entreprise: a.company,
    Poste: a.title,
    Lieu: a.location,
    Source: a.source,
    Statut: STATUS_LABELS[a.status],
    'Envoyée le': a.appliedAt,
    'Correspondance (%)': a.score ?? '',
    'Compétences demandées': a.skills.join(', '),
    Contact: a.contact?.name,
    'E-mail contact': a.contact?.email,
    Lien: a.link,
    Notes: a.notes,
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = Object.keys(rows[0] || {}).map((k) => ({ wch: ['Poste', 'Lien', 'Compétences demandées', 'Notes'].includes(k) ? 40 : 16 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Candidatures');
  res.attachment(`candidatures-${store.today()}.xlsx`);
  res.send(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
});

app.listen(PORT, HOST, () => {
  console.log(`Prêt sur http://localhost:${PORT}`);
});
