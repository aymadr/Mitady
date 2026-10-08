// The app's own CV templates: profile + style -> HTML (shown as a preview and printed to PDF).
// Content is made of sections (entries, skills, languages…); the look comes from a template
// (structure + CSS) and from the options of the editor (fonts, colours, headings, photo…).
const fs = require('fs');
const { norm } = require('./skills');
const { escapeHtml } = require('./text');

const BULLET = /^[-•●▪*–]\s*/;
const MAX_CV_SKILLS = 30;

// ---------- Free text sections (CVs imported as text) ----------

const DATE_AT_END =
  /^(.*?)[\s·|,–-]+((?:\d{2}\/)?\d{4}(?:\s*[-–]\s*(?:(?:\d{2}\/)?\d{4}|aujourd'hui|en cours|présent|now))?)$/i;

// "Rôle, Entreprise - Ville · 04/2026 - aujourd'hui" -> text + right-aligned date.
function withDate(line) {
  const m = line.match(DATE_AT_END);
  return m && m[1].length > 3 ? { text: m[1], date: m[2] } : { text: line, date: '' };
}

// "Nom du projet (stack) : description" -> bold lead before the colon.
// Only leads with a stack in parentheses: "Analyse SOC : …" stays plain.
function boldLead(text) {
  const i = text.indexOf(' : ');
  if (i > 0 && i < 90 && text.slice(0, i).includes('(')) return `<strong>${escapeHtml(text.slice(0, i))}</strong> : ${escapeHtml(text.slice(i + 3))}`;
  return escapeHtml(text);
}

function entry(tag, line, cls = '') {
  const { text, date } = withDate(line);
  const lead = tag === 'li' ? '- ' : '';
  if (!date) return `<${tag} class="${cls}">${lead}${boldLead(text)}</${tag}>`;
  return `<${tag} class="row ${cls}"><span>${lead}${boldLead(text)}</span><em>${escapeHtml(date)}</em></${tag}>`;
}

// Plain lines become paragraphs, "- " lines become bullets, and a plain line
// directly followed by bullets is treated as an entry heading (role, school…).
function renderBody(body, { boldLines = false } = {}) {
  const lines = String(body || '').split('\n').map((l) => l.trim()).filter(Boolean);
  let html = '';
  let list = false;
  for (const [i, line] of lines.entries()) {
    const bullet = BULLET.test(line);
    if (bullet && !list) {
      html += '<ul>';
      list = true;
    }
    if (!bullet && list) {
      html += '</ul>';
      list = false;
    }
    if (bullet) html += entry('li', line.replace(BULLET, ''));
    else if (lines[i + 1] && BULLET.test(lines[i + 1])) html += entry('h3', line);
    else html += entry('p', line, boldLines ? 'strong-line' : '');
  }
  return html + (list ? '</ul>' : '');
}

// Skills section as written in the CV ("Catégorie : a, b"), with the skills added
// for this offer appended to the first category, like in the Word file.
function renderSkills(section, added) {
  const lines = String(section?.body || '').split('\n').map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return added.length ? `<p>${escapeHtml(added.join(', '))}</p>` : '';
  const missing = added.filter((a) => !norm(section.body).includes(norm(a)));
  if (missing.length) lines[0] = `${lines[0].replace(/[.,;\s]+$/, '')}, ${missing.join(', ')}`;
  return lines
    .map((l) => {
      const m = l.match(/^([^:]{2,40})\s:\s*(.+)$/);
      return m ? `<p><strong>${escapeHtml(m[1])} :</strong> ${escapeHtml(m[2])}</p>` : `<p>${escapeHtml(l)}</p>`;
    })
    .join('');
}

const isSkills = (s) => /^comp[ée]tences?$/i.test((s.title || '').trim());

// ---------- Section types ----------

// What each kind of section holds. `kind` drives the editor and the rendering.
const SECTION_TYPES = {
  employment: { label: 'Expérience professionnelle', en: 'Professional Experience', kind: 'entries', desc: 'Tes postes et employeurs, stages et alternances compris.', f: { title: 'Poste', subtitle: 'Employeur', location: 'Lieu' } },
  education: { label: 'Formation', en: 'Education', kind: 'entries', desc: 'Tes diplômes et écoles, avec option, mention ou échange.', f: { title: 'Diplôme', subtitle: 'École', location: 'Lieu' } },
  skills: { label: 'Compétences', en: 'Skills', kind: 'skills', desc: 'Tes compétences techniques et humaines, avec niveaux si tu veux.' },
  languages: { label: 'Langues', en: 'Languages', kind: 'languages', desc: 'Tes langues et ton niveau pour montrer ton aisance.' },
  certificates: { label: 'Certifications', en: 'Certificates', kind: 'entries', desc: 'Tes certifications et permis, avec organisme et date.', f: { title: 'Certification', subtitle: 'Organisme', location: 'Lieu' } },
  interests: { label: "Centres d'intérêt", en: 'Interests', kind: 'tags', desc: 'Ce qui te passionne et dit quelque chose de toi.' },
  projects: { label: 'Projets', en: 'Projects', kind: 'entries', desc: 'Tes projets marquants : défi, rôle, résultat.', f: { title: 'Projet', subtitle: 'Rôle ou technologies', location: 'Lieu' } },
  courses: { label: 'Formations complémentaires', en: 'Courses', kind: 'entries', desc: 'Tes cours en ligne ou en présentiel suivis jusqu\'au bout.', f: { title: 'Formation', subtitle: 'Organisme', location: 'Lieu' } },
  awards: { label: 'Distinctions', en: 'Awards', kind: 'entries', desc: 'Tes prix et reconnaissances (concours, école, entreprise).', f: { title: 'Distinction', subtitle: 'Décernée par', location: 'Lieu' } },
  organisations: { label: 'Associations', en: 'Organisations', kind: 'entries', desc: 'Tes engagements associatifs ou bénévoles, avec ton rôle.', f: { title: 'Rôle', subtitle: 'Organisation', location: 'Lieu' } },
  publications: { label: 'Publications', en: 'Publications', kind: 'entries', desc: 'Tes articles, livres ou travaux publiés.', f: { title: 'Titre', subtitle: 'Éditeur ou revue', location: 'Lieu' } },
  references: { label: 'Références', en: 'References', kind: 'entries', desc: 'Des personnes qui peuvent témoigner de ton travail, avec leurs coordonnées.', f: { title: 'Nom', subtitle: 'Poste et entreprise', location: 'Coordonnées' } },
  declaration: { label: 'Déclaration', en: 'Declaration', kind: 'text', desc: 'Une phrase d\'engagement ou une déclaration sur l\'honneur.' },
  custom: { label: 'Personnalisé', en: 'Custom', kind: 'entries', desc: 'Une rubrique libre pour tout le reste, avec des fiches.', f: { title: 'Titre', subtitle: 'Sous-titre', location: 'Lieu' } },
  text: { label: 'Texte libre', en: 'Free text', kind: 'text', desc: 'Un bloc de texte simple, sans fiches.' },
};
const LEVELS = { fr: ['Notions', 'Intermédiaire', 'Courant', 'Bilingue', 'Langue maternelle'], en: ['Basic', 'Intermediate', 'Fluent', 'Bilingual', 'Native'] };
const SIDE_TYPES = ['skills', 'languages', 'interests', 'certificates'];

// Words the app adds itself, per document language.
const I18N = {
  fr: {
    profile: 'Profil', contact: 'Contact', email: 'Email', phone: 'Téléphone', location: 'Localisation', present: "Aujourd'hui",
    months: ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'],
    monthsLong: ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'],
  },
  en: {
    profile: 'Summary', contact: 'Contact', email: 'Email', phone: 'Phone', location: 'Location', present: 'Present',
    months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    monthsLong: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  },
};
// Old free-text titles, in English.
const TITLES_EN = [
  [/^exp[ée]riences?( professionnelles?)?$/i, 'Professional Experience'], [/^formations?( acad[ée]miques?)?$/i, 'Education'], [/^[ée]ducation$/i, 'Education'],
  [/^comp[ée]tences?$/i, 'Skills'], [/^langues?$/i, 'Languages'], [/^projets?$/i, 'Projects'], [/^certifications?$/i, 'Certificates'],
  [/^centres? d.int[ée]r[êe]ts?$/i, 'Interests'], [/^loisirs$/i, 'Interests'], [/^distinctions?$/i, 'Awards'], [/^associations?$/i, 'Organisations'],
];

function sectionTitle(s, lang) {
  const t = (s.title || '').trim();
  if (lang !== 'en') return t;
  const type = SECTION_TYPES[s.type || 'text'];
  if (s.type && type && t === type.label) return type.en;
  for (const [re, en] of TITLES_EN) if (re.test(t)) return en;
  return t;
}

// ---------- Dates ----------

function fmtDate(v, fmt, lang = 'fr') {
  v = String(v || '').trim();
  let y;
  let mo;
  let m = v.match(/^(\d{4})-(\d{1,2})$/);
  if (m) [y, mo] = [m[1], m[2]];
  else if ((m = v.match(/^(\d{1,2})\/(\d{4})$/))) [y, mo] = [m[2], m[1]];
  else if (/^\d{4}$/.test(v)) [y, mo] = [v, ''];
  else return v;
  mo = mo && String(mo).padStart(2, '0');
  const t = I18N[lang] || I18N.fr;
  if (fmt === 'yyyy' || !mo) return y;
  if (fmt === 'mmm') return `${t.months[Number(mo) - 1] || mo} ${y}`;
  if (fmt === 'mmmm') return `${t.monthsLong[Number(mo) - 1] || mo} ${y}`;
  if (fmt === 'yyyymm') return `${y}/${mo}`;
  return `${mo}/${y}`;
}

function entryDates(it, st) {
  const t = I18N[st.docLang];
  const a = fmtDate(it.start, st.dateFormat, st.docLang);
  const b = it.current ? t.present : fmtDate(it.end, st.dateFormat, st.docLang);
  return a && b ? `${a} – ${b}` : a || b;
}

// ---------- Icons ----------

const ICON_PATHS = {
  mail: ['0 0 24 24', 'M3 5h18a1 1 0 011 1v12a1 1 0 01-1 1H3a1 1 0 01-1-1V6a1 1 0 011-1zm1.4 2L12 12.6 19.6 7H4.4z'],
  phone: ['0 0 24 24', 'M6.6 10.8a15 15 0 006.6 6.6l2.2-2.2a1 1 0 011-.25c1.1.36 2.3.55 3.6.55a1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 4a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.2 2.45.57 3.57a1 1 0 01-.25 1z'],
  pin: ['0 0 24 24', 'M12 2a7 7 0 00-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 00-7-7zm0 9.5A2.5 2.5 0 119.5 9 2.5 2.5 0 0112 11.5z'],
  link: ['0 0 24 24', 'M10.6 13.4a1 1 0 010-1.4l3-3a3 3 0 114.2 4.2l-1.5 1.5-1.4-1.4 1.5-1.5a1 1 0 00-1.4-1.4l-3 3a1 1 0 01-1.4 0zm2.8-2.8a1 1 0 010 1.4l-3 3a3 3 0 11-4.2-4.2l1.5-1.5 1.4 1.4-1.5 1.5a1 1 0 001.4 1.4l3-3a1 1 0 011.4 0z'],
  external: ['0 0 24 24', 'M14 3h7v7h-2V6.4l-8.3 8.3-1.4-1.4L17.6 5H14V3zM5 5h6v2H6v11h11v-5h2v6a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1z'],
  github: ['0 0 16 16', 'M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z'],
  linkedin: ['0 0 24 24', 'M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 110-4.12 2.06 2.06 0 010 4.12zM7.12 20.45H3.56V9h3.56v11.45z'],
  globe: ['0 0 24 24', 'M12 2a10 10 0 100 20 10 10 0 000-20zm6.9 9h-3a15 15 0 00-1.2-5A8 8 0 0118.9 11zM12 4c.8 1 1.6 3 1.9 7h-3.8C10.4 7 11.2 5 12 4zM4.1 13h3a15 15 0 001.2 5A8 8 0 014.1 13zm3-2h-3a8 8 0 014.2-5 15 15 0 00-1.2 5zm4.9 9c-.8-1-1.6-3-1.9-7h3.8c-.3 4-1.1 6-1.9 7zm3.7-2a15 15 0 001.2-5h3a8 8 0 01-4.2 5z'],
};
const icon = (name) => {
  const [vb, d] = ICON_PATHS[name] || ICON_PATHS.link;
  return `<svg class="ic" viewBox="${vb}" width="9" height="9" aria-hidden="true"><path fill="currentColor" d="${d}"/></svg>`;
};
const linkIcon = (url, ext) =>
  /linkedin/i.test(url) ? 'linkedin' : /github/i.test(url) ? 'github' : /^[^@\s]+@[^@\s]+$/.test(url) ? 'mail' : ext ? 'external' : /https?:|www\.|\.[a-z]{2,}/i.test(url) ? 'globe' : 'link';

// Section heading icons: stroked glyphs on a 24 grid.
const HEAD_ICONS = {
  profile: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 20c0-4 3.6-6 8-6s8 2 8 6',
  employment: 'M3 8h18v11H3zM8 8V5h8v3M3 13h18',
  education: 'M2 9l10-5 10 5-10 5-10-5zM6 11.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-4.5',
  skills: 'M13 2L4 14h7l-1 8 9-12h-7l1-8z',
  languages: 'M12 3a9 9 0 100 18 9 9 0 000-18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18',
  certificates: 'M6 3h12v11a6 6 0 01-12 0V3zM9 21l3-2 3 2M9.5 8h5M9.5 11h5',
  interests: 'M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16',
  projects: 'M3 6a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V6z',
  courses: 'M4 4h6v16H4zM12 4h4l4 2v14h-8',
  awards: 'M12 14a5 5 0 100-10 5 5 0 000 10zM8.5 13L7 21l5-3 5 3-1.5-8',
  organisations: 'M9 11a3 3 0 100-6 3 3 0 000 6zM3 20c0-3.5 2.7-5.5 6-5.5s6 2 6 5.5M16 5.5a3 3 0 010 5.5M18 14.5c1.8.8 3 2.6 3 5.5',
  publications: 'M5 3h11l3 3v15H5zM8 9h8M8 13h8M8 17h5',
  references: 'M4 5h16v14H4zM8 10a2 2 0 104 0 2 2 0 00-4 0zM6.5 16c.5-1.5 2-2 3.5-2s3 .5 3.5 2M15 10h3M15 13h3',
  declaration: 'M4 20l4-1L19 8l-3-3L5 16l-1 4zM14 7l3 3',
  custom: 'M10 4a2 2 0 114 0v2h4v4h-2a2 2 0 100 4h2v4h-4v-2a2 2 0 10-4 0v2H6v-4h2a2 2 0 100-4H6V6h4V4z',
  text: 'M5 6h14M5 11h14M5 16h9',
};
function headIcon(type, mode) {
  const d = HEAD_ICONS[type] || HEAD_ICONS.text;
  const svg = `<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
  return `<i class="hi hi-${mode}">${svg}</i>`;
}
const iconType = (s) => {
  const t = s.type || 'text';
  if (t !== 'text') return t;
  return /exp[ée]rience/i.test(s.title) ? 'employment' : /formation|[ée]ducation/i.test(s.title) ? 'education' : /comp[ée]tence/i.test(s.title) ? 'skills'
    : /langue/i.test(s.title) ? 'languages' : /projet/i.test(s.title) ? 'projects' : /certif/i.test(s.title) ? 'certificates' : /int[ée]r[êe]t|loisir/i.test(s.title) ? 'interests' : 'text';
};

// ---------- Templates ----------
// struct: header (single column), band (coloured header band), side (side panel), colsleft
// (narrow left column). `css` is the template's own CSS; `preset` holds option defaults.

const TEMPLATES = {
  classique: { label: 'Classique', ats: true, struct: 'header', css: '' },
  moderne: {
    label: 'Moderne', ats: true, struct: 'header',
    css: `
  body { font-size: 8.9pt; }
  h1 { text-transform: none; font-size: 21pt; letter-spacing: -0.01em; }
  .headline { color: #444; font-weight: 400; font-size: 12.5pt; }
  h2 { color: var(--accent); border-bottom: 0.6pt solid var(--accent); letter-spacing: 0.08em; font-size: 9.5pt; }
  .e-d, .row em { color: #555; font-style: normal; }
  section { margin-top: 6pt; }`,
  },
  compact: {
    label: 'Compact', ats: true, struct: 'header', margins: [8, 10],
    css: `
  body { font-size: 8.7pt; line-height: 1.2; }
  h1 { font-size: 17pt; }
  .headline { font-size: 11pt; }
  h2 { font-size: 9.8pt; margin-bottom: 3pt; }
  h3 { font-size: 9.2pt; margin-top: 3pt; }
  section { margin-top: 4pt; }`,
  },
  elegant: {
    label: 'Élégant', ats: true, struct: 'header',
    css: `
  header { flex-direction: column; align-items: center; text-align: center; padding-bottom: 6pt; border-bottom: 1.2pt solid var(--accent); gap: 2mm; }
  h1 { font-size: 22pt; font-weight: 400; letter-spacing: 0.14em; }
  .headline { color: #333; font-weight: 400; font-style: italic; font-size: 12pt; }
  .contact { justify-content: center; }
  .contact span + span::before { content: "·"; }
  h2 { color: var(--accent); border: 0; text-align: center; letter-spacing: 0.18em; font-size: 10pt; margin-top: 4pt; }
  section { margin-top: 8pt; }`,
  },
  minimal: {
    label: 'Minimal', ats: true, struct: 'header', margins: [14, 16],
    css: `
  body { font-size: 9pt; line-height: 1.32; color: #1a1a1a; }
  h1 { font-size: 24pt; text-transform: none; font-weight: 300; }
  .headline { font-weight: 400; color: var(--accent); font-size: 11.5pt; }
  h2 { border: 0; color: var(--accent); font-size: 8.6pt; letter-spacing: 0.16em; margin-bottom: 3pt; }
  h3 { font-size: 9.4pt; }
  section { margin-top: 10pt; }`,
  },
  net: {
    label: 'Net', ats: true, struct: 'header',
    css: `
  header { flex-direction: column; align-items: center; text-align: center; gap: 1.5mm; }
  h1 { text-transform: none; font-size: 19pt; }
  .headline { color: #222; font-weight: 400; font-style: italic; font-size: 11pt; }
  .contact { justify-content: center; }
  h2 { font-size: 9.6pt; letter-spacing: 0.04em; }
  .sub { font-style: italic; }`,
  },
  bleu: {
    label: 'Bleu franc', ats: true, struct: 'header',
    css: `
  h1 { color: var(--accent); text-transform: none; font-size: 20pt; }
  .headline { color: #444; font-weight: 500; }
  h2 { color: var(--accent); border-bottom: 0.8pt solid var(--accent); text-transform: none; font-size: 10.5pt; }
  .e-d, .row em { color: #555; }`,
  },
  editorial: {
    label: 'Éditorial', ats: true, struct: 'header',
    css: `
  header { flex-direction: column; align-items: center; text-align: center; padding-bottom: 5pt; border-bottom: 0.5pt solid #bbb; gap: 1.5mm; }
  h1 { text-transform: none; font-size: 22pt; font-weight: 600; letter-spacing: -0.01em; }
  .headline { color: #555; font-weight: 400; font-size: 11pt; }
  .contact { justify-content: center; }
  h2 { font-size: 8.8pt; letter-spacing: 0.14em; border-bottom: 0.4pt solid #999; color: #222; }
  section { margin-top: 8pt; }`,
  },
  regulier: {
    label: 'Régulier', ats: true, struct: 'header', preset: { entryStruct: 'cols', datePos: 'left' },
    css: `
  h1 { text-transform: none; font-size: 19pt; color: var(--accent); }
  .headline { color: #333; font-weight: 500; font-size: 11pt; }
  h2 { background: rgba(0,0,0,.065); border: 0; text-align: center; padding: 3pt 6pt; text-transform: none; font-size: 9.6pt; }`,
  },
  precision: {
    label: 'Précision', ats: true, struct: 'header', margins: [9, 11],
    css: `
  body { font-size: 8.5pt; line-height: 1.2; }
  header { flex-direction: column; align-items: center; text-align: center; gap: 1mm; }
  h1 { text-transform: none; font-size: 18pt; color: var(--accent); }
  .headline { font-weight: 600; font-size: 10.5pt; color: #222; }
  .contact { justify-content: center; }
  h2 { font-size: 9pt; margin-bottom: 3pt; }
  section { margin-top: 5pt; }`,
  },
  corporate: {
    label: 'Corporate', ats: true, struct: 'header', preset: { headStyle: 'center' },
    css: `
  header { flex-direction: column; align-items: center; text-align: center; gap: 1.5mm; }
  h1 { text-transform: none; font-size: 21pt; color: var(--accent); }
  .headline { color: #333; font-weight: 400; font-style: italic; }
  .contact { justify-content: center; }`,
  },
  studio: {
    label: 'Studio', ats: true, struct: 'header', preset: { headStyle: 'plain' },
    css: `
  header .hd { border-bottom: 2.4pt solid var(--accent); padding-bottom: 3mm; }
  h1 { text-transform: none; font-size: 22pt; }
  .headline { font-weight: 400; color: #333; }
  h2 { color: var(--accent); letter-spacing: 0.1em; font-size: 9.6pt; }`,
  },
  ruban: {
    label: 'Ruban', ats: true, struct: 'header',
    css: `
  header .hd { background: var(--panel); color: var(--panel-ink); padding: 6mm 7mm; border-radius: 2mm; }
  h1 { text-transform: none; font-size: 21pt; }
  .headline { color: var(--panel-ink); opacity: 0.92; font-weight: 400; }
  header .hd .ic { color: var(--panel-ink); }
  h2 { color: var(--accent); }`,
  },
  mercure: {
    label: 'Mercure', ats: true, struct: 'band', panel: '#e7e9ee',
    css: `
  header { background: var(--panel); color: var(--panel-ink); padding: 9mm 14mm 6mm; flex-direction: row; }
  h1 { text-transform: none; font-size: 20pt; }
  .headline { color: inherit; opacity: 0.8; font-weight: 500; }
  main { padding: 0 14mm; }
  h2 { text-align: center; text-transform: none; border-bottom: 0.4pt solid #c9ccd4; color: #222; }`,
  },
  bandeau: {
    label: 'Bandeau', ats: false, struct: 'band', panel: 'accent',
    css: `
  header { background: var(--panel); color: var(--panel-ink); padding: 11mm 14mm 7mm; flex-direction: row-reverse; justify-content: space-between; }
  .photo { border: 1.4pt solid var(--panel-ink); }
  h1 { font-size: 23pt; }
  .headline { color: var(--panel-ink); font-weight: 400; opacity: 0.95; }
  .contact { color: var(--panel-ink); }
  header .ic { color: var(--panel-ink); }
  main { padding: 0 14mm; }
  h2 { color: var(--accent); border-bottom: 0.8pt solid var(--accent); }
  section { margin-top: 7pt; }`,
  },
  lateral: {
    label: 'Colonne latérale', ats: false, struct: 'side', panel: 'accent',
    css: `
  .rail { position: fixed; left: 0; top: 0; bottom: 0; width: 66mm; background: var(--panel); z-index: -1; }
  aside { position: absolute; top: 0; left: 0; width: 66mm; color: var(--panel-ink); padding: 12mm 7mm 8mm 8mm; }
  main { margin-left: 66mm; padding: 4mm 12mm 0 9mm; }
  aside .photo { margin: 0 auto 7mm; border: 1.4pt solid var(--panel-ink); }
  aside h2 { color: var(--panel-ink); border-bottom: 0.6pt solid rgba(255,255,255,.6); font-size: 9.6pt; letter-spacing: 0.08em; }
  main h1 { font-size: 22pt; margin-top: 8mm; }
  main h2 { color: var(--accent); border-bottom: 0.8pt solid var(--accent); }`,
  },
  atlantique: {
    label: 'Atlantique', ats: false, struct: 'side', nameInSide: true, panel: 'accent',
    css: `
  .rail { position: fixed; left: 0; top: 0; bottom: 0; width: 70mm; background: var(--panel); z-index: -1; }
  aside { position: absolute; top: 0; left: 0; width: 70mm; color: var(--panel-ink); padding: 12mm 7mm 8mm 8mm; }
  main { margin-left: 70mm; padding: 10mm 11mm 0 10mm; }
  aside .photo { margin: 0 0 6mm; border: 1.4pt solid var(--panel-ink); }
  aside h1 { font-size: 19pt; text-transform: none; }
  aside .headline { color: var(--panel-ink); opacity: 0.85; font-weight: 400; font-size: 11pt; margin-bottom: 6mm; }
  aside h2 { color: var(--panel-ink); border: 0; background: rgba(255,255,255,.14); padding: 3pt 6pt; border-radius: 2pt; font-size: 9.4pt; }
  main h2 { border: 0; background: rgba(0,0,0,.06); padding: 3pt 6pt; color: #111; }`,
  },
  argent: {
    label: 'Argent', ats: false, struct: 'side', nameInSide: true, panel: '#e8e9ed',
    css: `
  .rail { position: fixed; left: 0; top: 0; bottom: 0; width: 68mm; background: var(--panel); z-index: -1; }
  aside { position: absolute; top: 0; left: 0; width: 68mm; color: #222; padding: 12mm 7mm 8mm 8mm; }
  main { margin-left: 68mm; padding: 11mm 11mm 0 10mm; }
  aside .photo { margin: 0 0 6mm; }
  aside h1 { font-size: 19pt; text-transform: none; color: #222; }
  aside .headline { color: #555; font-weight: 400; font-size: 11pt; margin-bottom: 6mm; }
  aside h2 { color: var(--accent); border-bottom: 0.6pt solid #b9bcc6; font-size: 9.6pt; }
  aside .chips span { border-color: var(--accent); }
  aside .bar::after, aside .dots b.on { background: var(--accent); }
  aside .bar, aside .dots b { background: rgba(0,0,0,.14); }
  aside .ic { color: var(--accent); }
  main h2 { color: #222; border-bottom: 0.6pt solid #b9bcc6; }`,
  },
  nordique: {
    label: 'Nordique', ats: false, struct: 'side', panel: 'accent',
    css: `
  .rail { position: fixed; right: 0; top: 0; bottom: 0; width: 64mm; background: var(--panel); z-index: -1; }
  aside { position: absolute; top: 0; right: 0; width: 64mm; color: var(--panel-ink); padding: 12mm 7mm 8mm 8mm; }
  main { margin-right: 64mm; padding: 4mm 9mm 0 12mm; }
  aside .photo { margin: 0 auto 7mm; border: 1.4pt solid var(--panel-ink); }
  aside h2 { color: var(--panel-ink); border-bottom: 0.6pt solid rgba(255,255,255,.6); font-size: 9.6pt; letter-spacing: 0.08em; }
  main h1 { font-size: 22pt; margin-top: 8mm; }
  main h2 { color: var(--accent); border-bottom: 0.8pt solid var(--accent); }`,
  },
  safran: {
    label: 'Safran', ats: false, struct: 'colsleft', preset: { headStyle: 'accent', headIcons: 'outline' },
    css: `
  header .hd { flex: 1; }
  h1 { text-transform: none; font-size: 20pt; }
  .headline { font-weight: 500; }
  .cols.left { grid-template-columns: 54mm 1fr; }
  h2 { font-size: 10pt; border-bottom-width: 1.4pt; }`,
  },
  pilier: {
    label: 'Pilier', ats: false, struct: 'colsleft',
    css: `
  h1 { text-transform: none; font-size: 21pt; color: var(--accent); }
  .headline { font-weight: 500; color: #333; }
  .cols.left { grid-template-columns: 56mm 1fr; gap: 7mm; }
  .cols.left > .side { background: #f1f2f5; padding: 4mm 4mm 5mm; border-radius: 2mm; }
  .cols.left > .side h2 { border-color: #c4c8d2; }
  h2 { color: var(--accent); }`,
  },
};

// ---------- Options ----------

const PHOTO_SHAPES = { rond: 'Ronde', carre: 'Carrée', arrondi: 'Arrondie', portrait: 'Portrait', portraitArrondi: 'Portrait arrondi' };
const PHOTO_SIZES = { xs: 'XS', s: 'S', m: 'M', l: 'L', xl: 'XL' };
const PHOTO_W = { xs: 16, s: 19, m: 23, l: 28, xl: 34 }; // mm

const DEFAULT_STYLE = {
  layout: 'classique', font: 'calibri', nameFont: '', accent: 'bleu', textColor: '', bgColor: '', bgMode: 'header', accentOn: null,
  photo: true, photoShape: 'portrait', photoSize: 'm', photoBorder: false, photoGray: false, photoPos: '',
  fontSize: 0, lineHeight: 0, margin: 0, gap: 0, nameSize: 0,
  headStyle: '', headCaps: '', headIcons: '', dateFormat: 'mmyyyy', skillStyle: 'text', langStyle: 'text',
  entryStruct: '', datePos: '', subPos: '',
  icons: false, linkIcons: false, linkIconType: 'link', linkUnderline: false, linkBlue: false,
  align: '', contactArr: 'line', columns: 'one', summary: true, docLang: 'fr', pageFormat: 'A4',
};

const clampNum = (v, lo, hi) => (Number(v) > 0 ? Math.min(hi, Math.max(lo, Number(v))) : 0);
const oneOf = (v, list, d = '') => (list.includes(v) ? v : d);
const hex = (v) => (/^#[0-9a-f]{6}$/i.test(v || '') ? v : '');
const lum = (h) => {
  const n = parseInt(h.slice(1), 16);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const inkFor = (bg) => (lum(bg) > 0.45 ? '#1a1a1a' : '#ffffff');

const ACCENT_KEYS = ['name', 'jobTitle', 'headings', 'headerIcons', 'bars', 'dates', 'entryTitle', 'entrySubtitle', 'linkIcons'];

function resolveStyle(style = {}) {
  // '' and 0 mean "the template decides": only real choices override its preset.
  const set = {};
  for (const [k, v] of Object.entries(style || {})) if (v !== '' && v !== 0 && v !== null && v !== undefined) set[k] = v;
  const t = TEMPLATES[set.layout] ? set.layout : 'classique';
  const s = { ...DEFAULT_STYLE, ...(TEMPLATES[t].preset || {}), ...set, layout: t };
  const font = CV_STYLES.fonts[s.font] || CV_STYLES.fonts.calibri;
  const nameFont = s.nameFont && CV_STYLES.fonts[s.nameFont] ? CV_STYLES.fonts[s.nameFont] : font;
  const imports = [...new Set([font, nameFont].map((f) => f.g).filter(Boolean))];
  const accent = hex(s.accent) || (CV_STYLES.accents[s.accent] || CV_STYLES.accents.bleu).color;
  const bg = hex(s.bgColor);
  const tpl = TEMPLATES[t];
  const panelDef = tpl.panel === 'accent' || !tpl.panel ? accent : tpl.panel;
  const panel = bg && s.bgMode !== 'page' && s.bgMode !== 'border' ? bg : panelDef;
  return {
    layout: t,
    tpl,
    font: font.stack,
    nameFont: nameFont.stack,
    imports: imports.map((g) => `https://fonts.googleapis.com/css2?family=${g}&display=swap`),
    accent,
    textColor: hex(s.textColor),
    bg,
    bgMode: oneOf(s.bgMode, ['header', 'page', 'border'], 'header'),
    panel,
    panelInk: inkFor(panel),
    accentOn: Array.isArray(s.accentOn) ? s.accentOn.filter((k) => ACCENT_KEYS.includes(k)) : null,
    photo: s.photo !== false,
    shape: oneOf(s.photoShape, Object.keys(PHOTO_SHAPES), 'portrait'),
    size: PHOTO_W[s.photoSize] ? s.photoSize : 'm',
    border: Boolean(s.photoBorder),
    gray: Boolean(s.photoGray),
    photoPos: oneOf(s.photoPos, ['left', 'top', 'right'], ''),
    fontSize: clampNum(s.fontSize, 7.5, 12),
    lineHeight: clampNum(s.lineHeight, 1, 1.8),
    margin: clampNum(s.margin, 6, 24),
    gap: clampNum(s.gap, 2, 20),
    nameSize: clampNum(s.nameSize, 14, 34),
    headStyle: oneOf(s.headStyle, ['line', 'accent', 'shade', 'center', 'bar', 'plain', 'short', 'wavy', 'box']),
    headCaps: oneOf(s.headCaps, ['on', 'off']),
    headIcons: oneOf(s.headIcons, ['none', 'outline', 'filled'], 'none'),
    dateFormat: oneOf(s.dateFormat, ['mmyyyy', 'mmm', 'mmmm', 'yyyymm', 'yyyy'], 'mmyyyy'),
    skillStyle: oneOf(s.skillStyle, ['text', 'chips', 'bars', 'dots'], 'text'),
    langStyle: oneOf(s.langStyle, ['text', 'bars', 'dots'], 'text'),
    entryStruct: oneOf(s.entryStruct, ['full', 'cols'], 'full'),
    datePos: oneOf(s.datePos, ['right', 'left', 'split'], 'right'),
    subPos: oneOf(s.subPos, ['same', 'below'], 'below'),
    icons: Boolean(s.icons),
    linkIcons: Boolean(s.linkIcons),
    linkIconType: s.linkIconType === 'external' ? 'external' : 'link',
    linkUnderline: Boolean(s.linkUnderline),
    linkBlue: Boolean(s.linkBlue),
    align: oneOf(s.align, ['center']),
    contactArr: oneOf(s.contactArr, ['line', 'cols', 'stack'], 'line'),
    columns: s.columns === 'two' ? 'two' : 'one',
    summary: s.summary !== false,
    docLang: s.docLang === 'en' ? 'en' : 'fr',
    pageFormat: s.pageFormat === 'Letter' ? 'Letter' : 'A4',
  };
}

const FIXED_MARGIN = (st) => ['band', 'side'].includes(st.tpl.struct) || (st.bg && st.bgMode === 'header');

// The options the user changed, as CSS appended after the template's own.
function customCss(st) {
  const P = 'html body';
  const free = !FIXED_MARGIN(st);
  const c = [];
  if (st.fontSize) c.push(`body { font-size: ${st.fontSize}pt; }`);
  if (st.lineHeight) c.push(`body { line-height: ${st.lineHeight}; }`);
  if (st.gap) c.push(`section { margin-top: ${st.gap}pt; }`);
  if (st.nameSize) c.push(`h1 { font-size: ${st.nameSize}pt; }`);
  if (st.margin && free) c.push(`@page { margin: ${Math.max(6, st.margin - 3)}mm ${st.margin}mm; }`);

  // Headings
  const H = `${P} > section > h2, ${P} main > section > h2, ${P} .cols > main > section > h2, ${P} .cols > .side > section > h2`;
  const heads = {
    line: 'border: 0; border-bottom: 0.8pt solid var(--ink); background: none; color: var(--ink); padding: 0 0 1pt;',
    accent: 'border: 0; border-bottom: 0.8pt solid var(--accent); background: none; color: var(--accent); padding: 0 0 1pt;',
    shade: 'border: 0; background: rgba(0,0,0,.07); color: var(--ink); padding: 2.5pt 6pt;',
    center: 'border: 0; background: none; color: var(--ink); padding: 0; display: flex; align-items: center; gap: 8pt; text-align: center;',
    bar: 'border: 0; border-left: 3pt solid var(--accent); background: none; color: var(--ink); padding: 0 0 0 6pt;',
    plain: 'border: 0; background: none; color: var(--ink); padding: 0;',
    short: 'border: 0; background: none; color: var(--ink); padding: 0 0 3pt; position: relative;',
    wavy: 'border: 0; background: none; color: var(--ink); padding: 0; text-decoration: underline wavy var(--accent); text-underline-offset: 3pt;',
    box: 'border: 0; background: var(--accent); color: #fff; padding: 2.5pt 7pt;',
  };
  if (st.headStyle) {
    c.push(`${H} { ${heads[st.headStyle]} }`);
    if (st.headStyle === 'center') c.push(`${H}::before, ${H}::after { content: ""; flex: 1; border-top: 0.6pt solid var(--ink); }`);
    else c.push(`${H}::before, ${H}::after { content: none; }`);
    if (st.headStyle === 'short') c.push(`${H}::after { content: ""; position: absolute; left: 0; bottom: 0; width: 22pt; height: 2pt; background: var(--accent); }`);
  }
  if (st.headCaps) c.push(`h2 { text-transform: ${st.headCaps === 'on' ? 'uppercase' : 'none'}; }`);
  if (st.headIcons !== 'none') c.push('h2 .hi { display: inline-block; width: 1.15em; height: 1.15em; margin-right: 5pt; vertical-align: -0.2em; flex: none; }');
  if (st.headIcons === 'filled') c.push('h2 .hi-filled { background: var(--accent); color: #fff; border-radius: 50%; padding: 0.2em; width: 1.5em; height: 1.5em; vertical-align: -0.35em; }');

  // Header
  if (st.photoPos && st.tpl.struct !== 'side') {
    c.push(`header { flex-direction: ${{ left: 'row', right: 'row-reverse', top: 'column' }[st.photoPos]}; ${st.photoPos === 'top' ? `align-items: ${st.align === 'center' ? 'center' : 'flex-start'};` : 'align-items: center;'} }`);
  }
  if (st.align === 'center' && st.tpl.struct !== 'side') {
    c.push('header { flex-direction: column; align-items: center; text-align: center; } header .contact { justify-content: center; }');
  }
  if (st.contactArr === 'cols') c.push('.contact { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5pt 12pt; } .contact span::before { content: none !important; }');
  if (st.contactArr === 'stack') c.push('.contact { display: block; } .contact span { display: flex; margin-bottom: 1.5pt; } .contact span::before { content: none !important; }');

  // Links
  if (st.linkUnderline) c.push('.lnk, .contact .lk { text-decoration: underline; }');
  if (st.linkBlue) c.push('.lnk, .contact .lk { color: #1a56c8; }');

  // Accent on / off, element by element
  if (st.accentOn) {
    const on = new Set(st.accentOn);
    const col = (k) => (on.has(k) ? 'var(--accent)' : 'var(--ink)');
    c.push(`h1 { color: ${col('name')}; }`);
    c.push(`.headline { color: ${on.has('jobTitle') ? 'var(--accent)' : 'inherit'}; }`);
    if (!st.headStyle || !['box'].includes(st.headStyle)) c.push(`${H} { color: ${col('headings')}; }`);
    c.push(`header .ic, aside .ic { color: ${on.has('headerIcons') ? 'var(--accent)' : 'inherit'}; }`);
    c.push(`.bar::after, .dots b.on { background: ${on.has('bars') ? 'var(--accent)' : 'var(--ink)'}; } .chips span { border-color: ${on.has('bars') ? 'var(--accent)' : 'var(--ink)'}; }`);
    c.push(`.e-d, .row em { color: ${on.has('dates') ? 'var(--accent)' : 'inherit'}; }`);
    c.push(`.entry h3 { color: ${col('entryTitle')}; }`);
    c.push(`.sub { color: ${on.has('entrySubtitle') ? 'var(--accent)' : '#333'}; }`);
    c.push(`.ic.lk { color: ${on.has('linkIcons') ? 'var(--accent)' : 'inherit'}; }`);
  }

  // Colours: text, page / header background, border
  if (st.textColor) c.push('body { color: var(--ink); }');
  if (st.bg && st.bgMode === 'page') c.push(`html { background: ${st.bg}; } body { color: ${st.textColor || inkFor(st.bg)}; }`);
  if (st.bg && st.bgMode === 'header' && st.tpl.struct === 'header') {
    const ink = inkFor(st.bg);
    const [my, mx] = st.margin ? [Math.max(6, st.margin - 3), st.margin] : st.tpl.margins || [10, 12];
    c.push(`@page { margin: ${my}mm 0; } @page :first { margin-top: 0; }`);
    c.push(`header { background: ${st.bg}; color: ${ink}; padding: ${my}mm ${mx}mm 5mm; margin-bottom: 3mm; } header .headline { color: ${st.accentOn?.includes('jobTitle') ? 'var(--accent)' : 'inherit'}; opacity: .92; }`);
    c.push(`header h1 { color: ${st.accentOn?.includes('name') ? 'var(--accent)' : 'inherit'}; } header .ic { color: inherit; }`);
    c.push(`body > section, body > .cols { padding-left: ${mx}mm; padding-right: ${mx}mm; }`);
  }
  if (st.bg && st.bgMode === 'border') c.push('.frame { display: block; }');
  return c.join('\n  ');
}

// On screen the page margins (@page) do not exist: they are drawn as padding.
function previewCss(st) {
  const bleed = ['band', 'side'].includes(st.tpl.struct) || (st.bg && st.bgMode === 'header' && st.tpl.struct === 'header');
  const bg = st.bg && st.bgMode === 'page' ? st.bg : '#fff';
  if (bleed) return `html { background: ${bg}; }`;
  const [y, x] = st.margin ? [Math.max(6, st.margin - 3), st.margin] : st.tpl.margins || [10, 12];
  return `html { background: ${bg}; } body { padding: ${y}mm ${x}mm; }`;
}

// ---------- Options shown by the editor ----------

const CV_STYLES = {
  get layouts() {
    return Object.fromEntries(Object.entries(TEMPLATES).map(([k, t]) => [k, { label: t.label, ats: t.ats }]));
  },
  // `g` = Google Fonts family: loaded when online, otherwise the fallback stack is used.
  fonts: {
    calibri: { label: 'Calibri', group: 'Sans', stack: 'Calibri, Carlito, "Segoe UI", Arial, sans-serif' },
    arial: { label: 'Arial', group: 'Sans', stack: 'Arial, "Liberation Sans", Helvetica, sans-serif' },
    trebuchet: { label: 'Trebuchet', group: 'Sans', stack: '"Trebuchet MS", "Fira Sans", Verdana, sans-serif' },
    inter: { label: 'Inter', group: 'Sans', g: 'Inter:wght@400;600;700', stack: 'Inter, "Segoe UI", Arial, sans-serif' },
    opensans: { label: 'Open Sans', group: 'Sans', g: 'Open+Sans:wght@400;600;700', stack: '"Open Sans", "Segoe UI", Arial, sans-serif' },
    roboto: { label: 'Roboto', group: 'Sans', g: 'Roboto:wght@400;500;700', stack: 'Roboto, "Segoe UI", Arial, sans-serif' },
    lato: { label: 'Lato', group: 'Sans', g: 'Lato:wght@400;700', stack: 'Lato, Carlito, Arial, sans-serif' },
    sourcesans: { label: 'Source Sans', group: 'Sans', g: 'Source+Sans+3:wght@400;600;700', stack: '"Source Sans 3", "Source Sans Pro", Arial, sans-serif' },
    montserrat: { label: 'Montserrat', group: 'Sans', g: 'Montserrat:wght@400;600;700', stack: 'Montserrat, Verdana, sans-serif' },
    poppins: { label: 'Poppins', group: 'Sans', g: 'Poppins:wght@400;500;700', stack: 'Poppins, Verdana, sans-serif' },
    worksans: { label: 'Work Sans', group: 'Sans', g: 'Work+Sans:wght@400;600;700', stack: '"Work Sans", Arial, sans-serif' },
    dmsans: { label: 'DM Sans', group: 'Sans', g: 'DM+Sans:wght@400;500;700', stack: '"DM Sans", Arial, sans-serif' },
    nunito: { label: 'Nunito', group: 'Sans', g: 'Nunito:wght@400;600;700', stack: 'Nunito, Arial, sans-serif' },
    raleway: { label: 'Raleway', group: 'Sans', g: 'Raleway:wght@400;600;700', stack: 'Raleway, Arial, sans-serif' },
    spacegrotesk: { label: 'Space Grotesk', group: 'Sans', g: 'Space+Grotesk:wght@400;500;700', stack: '"Space Grotesk", Arial, sans-serif' },
    georgia: { label: 'Georgia', group: 'Serif', stack: 'Georgia, "Times New Roman", serif' },
    garamond: { label: 'Garamond', group: 'Serif', stack: 'Garamond, "EB Garamond", "Palatino Linotype", Georgia, serif' },
    times: { label: 'Times', group: 'Serif', stack: '"Times New Roman", "Liberation Serif", Times, serif' },
    cambria: { label: 'Cambria', group: 'Serif', stack: 'Cambria, Caladea, Georgia, serif' },
    merriweather: { label: 'Merriweather', group: 'Serif', g: 'Merriweather:wght@400;700', stack: 'Merriweather, Georgia, serif' },
    lora: { label: 'Lora', group: 'Serif', g: 'Lora:wght@400;600;700', stack: 'Lora, Georgia, serif' },
    playfair: { label: 'Playfair Display', group: 'Serif', g: 'Playfair+Display:wght@400;600;700', stack: '"Playfair Display", Georgia, serif' },
    baskerville: { label: 'Libre Baskerville', group: 'Serif', g: 'Libre+Baskerville:wght@400;700', stack: '"Libre Baskerville", Baskerville, Georgia, serif' },
    crimson: { label: 'Crimson Text', group: 'Serif', g: 'Crimson+Text:wght@400;600;700', stack: '"Crimson Text", Georgia, serif' },
    cormorant: { label: 'Cormorant Garamond', group: 'Serif', g: 'Cormorant+Garamond:wght@400;600;700', stack: '"Cormorant Garamond", Georgia, serif' },
    zilla: { label: 'Zilla Slab', group: 'Slab', g: 'Zilla+Slab:wght@400;500;700', stack: '"Zilla Slab", Georgia, serif' },
    robotoslab: { label: 'Roboto Slab', group: 'Slab', g: 'Roboto+Slab:wght@400;500;700', stack: '"Roboto Slab", Georgia, serif' },
    bitter: { label: 'Bitter', group: 'Slab', g: 'Bitter:wght@400;600;700', stack: 'Bitter, Georgia, serif' },
    plexmono: { label: 'IBM Plex Mono', group: 'Mono', g: 'IBM+Plex+Mono:wght@400;600;700', stack: '"IBM Plex Mono", "Courier New", monospace' },
    robotomono: { label: 'Roboto Mono', group: 'Mono', g: 'Roboto+Mono:wght@400;600;700', stack: '"Roboto Mono", "Courier New", monospace' },
    courier: { label: 'Courier', group: 'Mono', stack: '"Courier New", "Liberation Mono", monospace' },
  },
  accents: {
    bleu: { label: 'Bleu', color: '#1f3a93' },
    azur: { label: 'Azur', color: '#1c7ed6' },
    marine: { label: 'Marine', color: '#14274e' },
    turquoise: { label: 'Turquoise', color: '#0f6b73' },
    vert: { label: 'Vert', color: '#1d5e3a' },
    olive: { label: 'Olive', color: '#5c6b2f' },
    jaune: { label: 'Moutarde', color: '#a87b0a' },
    orange: { label: 'Terracotta', color: '#b24a1d' },
    rouge: { label: 'Rouge', color: '#b3261e' },
    bordeaux: { label: 'Bordeaux', color: '#7a1f3d' },
    rose: { label: 'Rose', color: '#b83280' },
    violet: { label: 'Violet', color: '#5b2a86' },
    marron: { label: 'Chocolat', color: '#5a3a29' },
    gris: { label: 'Ardoise', color: '#3c4a5c' },
    noir: { label: 'Noir', color: '#111111' },
  },
  // Colour sets: header / page background, text, accent.
  palettes: [
    { label: 'Marine & corail', bg: '#2b3a67', text: '#222222', accent: '#ff6b6b' },
    { label: 'Crème & sarcelle', bg: '#f4f1e8', text: '#222222', accent: '#1f5f6b' },
    { label: 'Pétrole & sable', bg: '#14313d', text: '#222222', accent: '#b8a47e' },
    { label: 'Gris & brun', bg: '#e4e4e4', text: '#2a2a2a', accent: '#8a6f5a' },
    { label: 'Ciel & marine', bg: '#dce6ee', text: '#222222', accent: '#2b3a67' },
    { label: 'Nuit & azur', bg: '#2b3a67', text: '#222222', accent: '#6ec6ff' },
    { label: 'Pêche & ardoise', bg: '#f7efe6', text: '#2a2a2a', accent: '#5b6b8c' },
    { label: 'Prune & rose', bg: '#5b2144', text: '#222222', accent: '#d65a9a' },
  ],
  photoShapes: PHOTO_SHAPES,
  photoSizes: PHOTO_SIZES,
  dateFormats: { mmyyyy: '09/2024', mmm: 'sept. 2024', mmmm: 'septembre 2024', yyyymm: '2024/09', yyyy: '2024' },
  pageFormats: { A4: 'A4 (210 × 297 mm)', Letter: 'Letter (8,5 × 11 po)' },
  langs: { fr: 'Français', en: 'English' },
  accentKeys: { name: 'Nom', jobTitle: 'Titre du poste', headings: 'Titres', headerIcons: "Icônes de l'en-tête", bars: 'Points, barres, pastilles', dates: 'Dates', entryTitle: 'Titre des fiches', entrySubtitle: 'Sous-titre des fiches', linkIcons: 'Icônes de liens' },
  get sectionTypes() { return SECTION_TYPES; },
  levels: LEVELS.fr,
};

// ---------- Section rendering ----------

function renderDesc(text) {
  const lines = String(text || '').split('\n').map((l) => l.trim()).filter(Boolean);
  let out = '';
  let list = false;
  for (const l of lines) {
    const bullet = BULLET.test(l);
    if (bullet !== list) out += list ? '</ul>' : '<ul>';
    list = bullet;
    out += bullet ? `<li>- ${escapeHtml(l.replace(BULLET, ''))}</li>` : `<p>${escapeHtml(l)}</p>`;
  }
  return out + (list ? '</ul>' : '');
}

function renderEntries(items, st) {
  const cls = `entry es-${st.entryStruct} dp-${st.datePos} sp-${st.subPos}`;
  return (items || [])
    .filter((it) => it && !it.hidden && (it.title || it.subtitle || it.description))
    .map((it) => {
      const dates = entryDates(it, st);
      const title = escapeHtml(it.title || it.subtitle || '');
      const sub = it.title ? escapeHtml(it.subtitle || '') : '';
      const link = it.link ? `<span class="lnk">${escapeHtml(it.link)}</span>` : '';
      const subLine = [sub, link].filter(Boolean).join(' · ');
      const same = st.subPos === 'same' && subLine;
      const when = `<div class="e-w">${dates ? `<em class="e-d">${escapeHtml(dates)}</em>` : ''}${it.location ? `<span class="e-l">${escapeHtml(it.location)}</span>` : ''}</div>`;
      return `<div class="${cls}"><div class="e-t"><h3>${title}</h3>${same ? `<span class="sub sub-in">${subLine}</span>` : ''}</div>`
        + `${!same && subLine ? `<div class="sub e-s">${subLine}</div>` : ''}${dates || it.location ? when : ''}<div class="e-x">${renderDesc(it.description)}</div></div>`;
    })
    .join('');
}

const clampLevel = (v, d = 4) => Math.min(5, Math.max(1, Math.round(Number(v)) || d));
const dots = (n) => `<span class="dots">${[1, 2, 3, 4, 5].map((i) => `<b class="${i <= n ? 'on' : ''}"></b>`).join('')}</span>`;
const bar = (n) => `<i class="bar" style="--v:${n * 20}%"></i>`;

function renderSkillList(names, st, levels = {}) {
  if (!names.length) return '';
  if (st.skillStyle === 'chips') return `<div class="chips">${names.map((n) => `<span>${escapeHtml(n)}</span>`).join('')}</div>`;
  if (st.skillStyle === 'bars' || st.skillStyle === 'dots') {
    return names.map((n) => `<div class="lv"><span>${escapeHtml(n)}</span>${(st.skillStyle === 'bars' ? bar : dots)(clampLevel(levels[n]))}</div>`).join('');
  }
  return `<p>${escapeHtml(names.join(', '))}</p>`;
}

function renderLanguages(items, st) {
  const labels = LEVELS[st.docLang];
  return (items || [])
    .filter((it) => it && it.name && !it.hidden)
    .map((it) => {
      const n = clampLevel(it.level, 3);
      const label = it.label || labels[n - 1];
      if (st.langStyle === 'text') return `<p><strong>${escapeHtml(it.name)}</strong> : ${escapeHtml(label)}</p>`;
      return `<div class="lv"><span><strong>${escapeHtml(it.name)}</strong> <small>${escapeHtml(label)}</small></span>${(st.langStyle === 'bars' ? bar : dots)(n)}</div>`;
    })
    .join('');
}

// Plain-text version of a section (matching, AI prompts).
function sectionText(s) {
  if (!s) return '';
  const t = s.type || 'text';
  const kind = (SECTION_TYPES[t] || SECTION_TYPES.text).kind;
  if (kind === 'text') return s.body || '';
  if (kind === 'languages') return (s.items || []).map((i) => `${i.name} ${i.label || LEVELS.fr[clampLevel(i.level, 3) - 1]}`).join('\n');
  if (kind === 'tags') return (s.items || []).map((i) => i.name).join(', ');
  if (kind === 'skills') return '';
  return (s.items || []).map((i) => [i.title, i.subtitle, i.location, [i.start, i.end].filter(Boolean).join('-'), i.description].filter(Boolean).join(' · ')).join('\n');
}

// ---------- Sample content (previews of an empty profile) ----------

const SAMPLE = {
  name: 'Camille Martin',
  email: 'camille.martin@email.fr',
  phone: '06 12 34 56 78',
  location: 'Paris',
  links: ['linkedin.com/in/camille-martin'],
  headline: 'Étudiante en Master',
  summary: "Étudiante rigoureuse et curieuse, je cherche une première expérience où mettre en pratique mes compétences au sein d'une équipe.",
  skills: ['Excel', 'Python', 'SQL', 'Gestion de projet'],
  cvManaged: true,
  sections: [
    { type: 'employment', title: 'Expérience professionnelle', items: [
      { title: 'Assistante projet', subtitle: 'Société Exemple', location: 'Paris', start: '2025-06', end: '2025-09', description: '- Suivi de projet et reporting hebdomadaire\n- Coordination de 4 équipes' },
      { title: 'Stagiaire analyste', subtitle: 'Cabinet Modèle', location: 'Lyon', start: '2024-06', end: '2024-08', description: '- Analyse de données et tableaux de bord' },
    ] },
    { type: 'education', title: 'Formation', items: [
      { title: 'Master 1 Management', subtitle: 'Université Exemple', location: 'Paris', start: '2025-09', end: '2026-06', description: '- Spécialisation en analyse de données' },
    ] },
    { type: 'skills', title: 'Compétences' },
    { type: 'languages', title: 'Langues', items: [{ name: 'Français', level: 5 }, { name: 'Anglais', level: 3 }] },
  ],
};

// ---------- Page ----------

const SIDE_RE = /^(comp[ée]tences?|langues?|certifications?|centres? d.int[ée]r[êe]ts?|loisirs|outils)/i;

function photoDataUri(file) {
  if (!file || !fs.existsSync(file)) return '';
  const type = file.endsWith('.png') ? 'image/png' : 'image/jpeg';
  return `data:${type};base64,${fs.readFileSync(file).toString('base64')}`;
}

function photoDims(st) {
  const w = PHOTO_W[st.size];
  const sq = +(w * 1.1).toFixed(1);
  if (st.shape === 'rond' || st.shape === 'carre' || st.shape === 'arrondi') return [sq, sq];
  return [w, +(w * 1.28).toFixed(1)];
}

function renderCvHtml(profileIn, { headline, summary, skills, skillsAdded = [], preview = false }) {
  const empty = !profileIn.name && !(profileIn.sections || []).some((s) => sectionText(s).trim());
  const profile = empty ? { ...profileIn, ...SAMPLE, photo: profileIn.photo, cvStyle: profileIn.cvStyle } : profileIn;
  if (empty) {
    headline = headline || SAMPLE.headline;
    summary = summary || SAMPLE.summary;
    skills = skills?.length ? skills : SAMPLE.skills;
  }
  const st = resolveStyle(profile.cvStyle);
  const tx = I18N[st.docLang];
  const struct = st.tpl.struct;
  const contactItems = [
    profile.email && ['mail', st.icons ? profile.email : `${tx.email} : ${profile.email}`],
    profile.phone && ['phone', st.icons ? profile.phone : `${tx.phone} : ${profile.phone}`],
    profile.location && ['pin', st.icons ? profile.location : `${tx.location} : ${profile.location}`],
    ...(profile.details || []).filter((d) => d && d.value).map((d) => [null, d.label ? `${d.label} : ${d.value}` : d.value]),
  ].filter(Boolean);
  const links = (profile.links || []).filter(Boolean);
  const levels = profile.skillLevels || {};
  const all = (profile.sections || []).filter((s) => s && s.title && !s.hidden);
  const photo = st.photo ? profile.photoData || photoDataUri(profile.photo) : '';
  const skillNames = (skills || []).slice(0, MAX_CV_SKILLS);

  const blockOf = (s) => {
    const type = s.type || 'text';
    const kind = (SECTION_TYPES[type] || SECTION_TYPES.text).kind;
    let html;
    if (kind === 'entries') html = renderEntries(s.items, st);
    else if (kind === 'skills') html = renderSkillList(skillNames, st, levels) + (skillsAdded.length && !skillNames.length ? `<p>${escapeHtml(skillsAdded.join(', '))}</p>` : '');
    else if (kind === 'languages') html = renderLanguages(s.items, st);
    else if (kind === 'tags') html = renderSkillList((s.items || []).filter((i) => !i.hidden).map((i) => i.name).filter(Boolean), { ...st, skillStyle: st.skillStyle === 'chips' ? 'chips' : 'text' });
    else if (!s.type && isSkills(s)) html = renderSkills(s, skillsAdded);
    else html = renderBody(s.body, { boldLines: /formation|éducation|diplôme/i.test(s.title) });
    return {
      title: sectionTitle(s, st.docLang), html, type: iconType(s),
      side: SIDE_TYPES.includes(type) || (type === 'text' && SIDE_RE.test(s.title)),
    };
  };

  const blocks = all.map(blockOf).filter((b) => b.html);
  // Without a skills section of its own, skills go before certifications / languages
  // (CVs the editor has not touched yet).
  const hasSkills = all.some((s) => (s.type || 'text') === 'skills' || (!s.type && isSkills(s)));
  if (!profile.cvManaged && !hasSkills && skillNames.length) {
    const at = blocks.findIndex((b) => /certif|langue|intér|loisir|language|interest/i.test(b.title));
    blocks.splice(at === -1 ? blocks.length : at, 0, { title: SECTION_TYPES.skills[st.docLang === 'en' ? 'en' : 'label'], html: renderSkillList(skillNames, st, levels), type: 'skills', side: true });
  }

  const [pw, ph] = photoDims(st);
  const photoTag = photo
    ? `<img class="photo sh-${st.shape}${st.border ? ' bordered' : ''}${st.gray ? ' gray' : ''}" style="--pw:${pw}mm;--ph:${ph}mm" src="${photo}" alt="">`
    : '';
  const idHtml = `<h1>${escapeHtml(profile.name || 'Ton nom')}</h1>${headline ? `<div class="headline">${escapeHtml(headline)}</div>` : ''}`;
  const span = ([ic, text]) => `<span>${st.icons && ic ? icon(ic) : ''}${escapeHtml(text)}</span>`;
  const lk = (l) => `<span class="lk">${st.linkIcons ? icon(linkIcon(l, st.linkIconType === 'external')).replace('class="ic"', 'class="ic lk"') : ''}${escapeHtml(l)}</span>`;
  const contactHtml = st.contactArr === 'line'
    ? `<div class="contact">${contactItems.map(span).join('')}</div>${links.length ? `<div class="contact links">${links.map(lk).join('')}</div>` : ''}`
    : `<div class="contact links">${contactItems.map(span).join('')}${links.map(lk).join('')}</div>`;
  const iconMode = st.headIcons === 'none' ? '' : st.headIcons;
  const section = (b) => `<section><h2>${iconMode ? headIcon(b.type, iconMode) : ''}<span>${escapeHtml(b.title)}</span></h2>${b.html}</section>`;
  const summaryBlock = summary && st.summary ? { title: tx.profile, type: 'profile', html: `<p class="summary">${escapeHtml(summary)}</p>` } : null;
  const summaryHtml = summaryBlock ? section(summaryBlock) : '';

  const hd = `<div class="hd">${idHtml}${contactHtml}</div>`;
  let body;
  if (struct === 'side') {
    const sideOnes = blocks.filter((b) => b.side);
    const mainOnes = blocks.filter((b) => !b.side);
    const inSide = st.tpl.nameInSide;
    body = `<div class="rail"></div><aside>${photoTag}${inSide ? idHtml : ''}<section><h2>${escapeHtml(tx.contact)}</h2>${contactHtml}</section>${sideOnes.map(section).join('')}</aside>
      <main>${inSide ? '' : idHtml}${summaryHtml}${mainOnes.map(section).join('')}</main>`;
  } else if (struct === 'band') {
    body = `<header>${photoTag}${hd}</header><main>${summaryHtml}${blocks.map(section).join('')}</main>`;
  } else if (struct === 'colsleft') {
    const left = [...(summaryBlock ? [summaryBlock] : []), ...blocks.filter((b) => b.side)];
    body = `<header>${photoTag}${hd}</header><div class="cols left"><div class="side">${left.map(section).join('')}</div><main>${blocks.filter((b) => !b.side).map(section).join('')}</main></div>`;
  } else if (st.columns === 'two') {
    body = `<header>${photoTag}${hd}</header><div class="cols"><main>${summaryHtml}${blocks.filter((b) => !b.side).map(section).join('')}</main><div class="side">${blocks.filter((b) => b.side).map(section).join('')}</div></div>`;
  } else {
    body = `<header>${photoTag}${hd}</header>${summaryHtml}${blocks.map(section).join('')}`;
  }
  const pos = st.photoPos || 'right';
  const ink = st.textColor || (st.bg && st.bgMode === 'page' ? inkFor(st.bg) : '#000');

  return `<!doctype html><html lang="${st.docLang}"><head><meta charset="utf-8">
<style>
  ${st.imports.map((u) => `@import url('${u}');`).join('\n  ')}
  :root { --accent: ${st.accent}; --ink: ${ink}; --panel: ${st.panel}; --panel-ink: ${st.panelInk}; }
  @page { size: ${st.pageFormat}; margin: ${(st.tpl.margins || [10, 12]).join('mm ')}mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: ${st.font}; color: var(--ink); font-size: 9.2pt; line-height: 1.24; }
  h1, .headline { font-family: ${st.nameFont}; }
  header { display: flex; align-items: center; gap: 6mm; }
  header .hd { flex: 1; min-width: 0; }
  :where(body.pp-right) header { flex-direction: row-reverse; }
  :where(body.pp-top) header { flex-direction: column; align-items: flex-start; }
  .photo { flex: none; width: var(--pw, 22mm); height: var(--ph, 27.5mm); object-fit: cover; }
  .photo.sh-rond { border-radius: 50%; }
  .photo.sh-arrondi, .photo.sh-portraitArrondi { border-radius: 3.2mm; }
  .photo.bordered { border: 0.55mm solid var(--accent); }
  .photo.gray { filter: grayscale(1); }
  aside .photo { display: block; width: calc(var(--pw) * 1.5); height: calc(var(--ph) * 1.5); }
  h1 { font-size: 19pt; font-weight: 700; text-transform: uppercase; line-height: 1.1; }
  .headline { font-size: 12pt; font-weight: 700; color: var(--accent); margin-top: 2pt; }
  .contact { font-size: 8.6pt; margin-top: 4pt; display: flex; flex-wrap: wrap; align-items: center; }
  .contact span { display: inline-flex; align-items: center; gap: 3pt; }
  .contact span + span::before { content: "|"; margin: 0 6pt; }
  .ic { color: var(--accent); flex: none; }
  section { margin-top: 6pt; }
  h2 { font-size: 10.5pt; font-weight: 700; text-transform: uppercase; border-bottom: 0.8pt solid #000; padding-bottom: 1pt; margin-bottom: 4pt; break-after: avoid; }
  .row { display: flex; justify-content: space-between; gap: 10pt; }
  .row em { font-style: italic; white-space: nowrap; flex: none; }
  h3 { font-size: 9.8pt; font-weight: 700; margin-top: 4pt; break-after: avoid; }
  section h2 + h3 { margin-top: 0; }
  p { margin-bottom: 1.5pt; }
  p.strong-line { font-weight: 700; }
  ul { list-style: none; margin: 1pt 0 3pt; }
  li { padding-left: 9pt; text-indent: -6pt; margin-bottom: 1pt; break-inside: avoid; }
  .summary { text-align: justify; }

  /* Entries: grid areas by structure and date position */
  .entry { display: grid; column-gap: 10pt; margin-top: 4pt; break-inside: avoid-page; }
  section h2 + .entry { margin-top: 0; }
  .entry h3 { margin-top: 0; }
  .e-t { grid-area: t; }
  .e-s { grid-area: s; }
  .e-w { grid-area: w; font-size: .95em; }
  .e-x { grid-area: x; }
  .e-d { font-style: italic; }
  .e-l { display: block; }
  .sub { color: #333; }
  .sub-in::before { content: ", "; }
  .sp-same .e-t h3 { display: inline; }
  .lnk { color: var(--accent); }
  .es-full.dp-right { grid-template-columns: 1fr auto; grid-template-areas: "t w" "s ." "x x"; }
  .es-full.dp-right .e-w { text-align: right; justify-self: end; }
  .es-full.dp-right .e-l { display: inline; }
  .es-full.dp-right .e-d + .e-l::before { content: " · "; }
  .es-full.dp-split { grid-template-columns: 1fr auto; grid-template-areas: "t d" "s l" "x x"; }
  .es-full.dp-split .e-w { display: contents; }
  .es-full.dp-split .e-d { grid-area: d; justify-self: end; }
  .es-full.dp-split .e-l { grid-area: l; justify-self: end; }
  .es-full.dp-left { grid-template-columns: 27mm 1fr; grid-template-areas: "w t" "w s" "x x"; }
  .es-cols.dp-left { grid-template-columns: 27mm 1fr; grid-template-areas: "w t" "w s" "w x"; }
  .es-cols.dp-right { grid-template-columns: 1fr 27mm; grid-template-areas: "t w" "s w" "x w"; }
  .es-cols.dp-right .e-w { text-align: right; }
  .es-cols.dp-split { grid-template-columns: 24mm 1fr 22mm; grid-template-areas: "d t l" "d s l" "d x l"; }
  .es-cols.dp-split .e-w { display: contents; }
  .es-cols.dp-split .e-d { grid-area: d; }
  .es-cols.dp-split .e-l { grid-area: l; text-align: right; }
  .es-cols .e-x ul, .es-cols .e-x p { margin-left: 0; }

  .chips { display: flex; flex-wrap: wrap; gap: 3pt; }
  .chips span { border: 0.6pt solid var(--accent); border-radius: 8pt; padding: 0.5pt 6pt; }
  .lv { display: flex; align-items: center; justify-content: space-between; gap: 8pt; margin-bottom: 2pt; }
  .lv small { color: #555; }
  .bar { display: block; width: 22mm; height: 3pt; background: rgba(0,0,0,.14); border-radius: 2pt; position: relative; flex: none; }
  .bar::after { content: ""; position: absolute; inset: 0 auto 0 0; width: var(--v); background: var(--accent); border-radius: 2pt; }
  .dots { display: inline-flex; gap: 2pt; flex: none; }
  .dots b { width: 5pt; height: 5pt; border-radius: 50%; background: rgba(0,0,0,.16); }
  .dots b.on { background: var(--accent); }
  .cols { display: grid; grid-template-columns: 1fr 52mm; gap: 8mm; }
  .cols .side section:first-child, .cols main section:first-child { margin-top: 6pt; }
  .cols .bar { width: 16mm; }
  .frame { display: none; position: fixed; inset: 4mm; border: 1.2pt solid var(--accent); pointer-events: none; z-index: -1; }
  aside .contact { font-size: 8.4pt; margin: 0 0 4pt; word-break: break-word; display: block; }
  aside .contact span { display: flex; margin-bottom: 2pt; }
  aside .contact span + span::before { content: none; }
  aside li, aside p { font-size: 8.6pt; }
  aside .chips span { border-color: var(--panel-ink); }
  aside .bar::after, aside .dots b.on { background: var(--panel-ink); }
  aside .bar, aside .dots b { background: rgba(255,255,255,.3); }
  aside .ic { color: var(--panel-ink); }
  ${st.tpl.struct === 'band' || st.tpl.struct === 'side' ? '@page { margin: 10mm 0; } @page :first { margin-top: 0; }' : ''}
  ${st.tpl.css}
  ${customCss(st)}
  ${preview ? previewCss(st) : ''}
</style></head><body class="pp-${pos}">
  ${st.bg && st.bgMode === 'border' ? '<div class="frame"></div>' : ''}
  ${body}
</body></html>`;
}

module.exports = { CV_STYLES, SECTION_TYPES, LEVELS, TEMPLATES, sectionText, renderCvHtml, renderBody, renderSkills, isSkills, photoDataUri, MAX_CV_SKILLS };
