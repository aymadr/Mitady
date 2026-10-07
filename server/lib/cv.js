// CV import (PDF / Word), heuristic parsing, and tailored CV generation.
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');
const pdfParse = require('pdf-parse');
const { detectSkills, norm } = require('./skills');
const { escapeHtml, slug } = require('./text');
const store = require('./store');

const PY_SCRIPT = path.resolve(__dirname, '..', '..', 'scripts', 'docx_tools.py');

// Windows installs "python"; Linux and macOS usually only "python3".
const PYTHON = process.platform === 'win32' ? 'python' : 'python3';

function runPython(args, timeout = 180000) {
  return new Promise((resolve, reject) => {
    execFile(PYTHON, [PY_SCRIPT, ...args], { timeout, windowsHide: true, maxBuffer: 20e6 }, (err, stdout) => {
      let out;
      try {
        out = JSON.parse(String(stdout).trim().split('\n').pop());
      } catch {
        return reject(new Error(err ? `Python indisponible ou en erreur (${err.message}).` : 'Réponse Python illisible.'));
      }
      if (out.error) return reject(new Error(out.error));
      resolve(out);
    });
  });
}

async function extractText(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.pdf') {
    const data = await pdfParse(fs.readFileSync(filePath));
    return data.text;
  }
  if (ext === '.docx') return (await runPython(['extract', filePath])).text;
  if (ext === '.txt' || ext === '.md') return fs.readFileSync(filePath, 'utf8');
  throw new Error('Format non pris en charge. Utilise un PDF ou un .docx.');
}

const HEADINGS = [
  { key: 'summary', re: /^(profil|à propos|a propos|résumé|resume|summary|about me|objectif)\b/i },
  { key: 'skills', re: /^(compétences|competences|skills|savoir-faire|outils|technologies|hard skills)\b/i },
  { key: 'Expérience', re: /^(expériences?|experiences?|parcours professionnel|work experience)\b/i },
  { key: 'Formation', re: /^(formations?|éducation|education|diplômes|cursus|études)\b/i },
  { key: 'Projets', re: /^(projets?|projects?|réalisations)\b/i },
  { key: 'Certifications', re: /^(certifications?|certificats?)\b/i },
  { key: 'Langues', re: /^(langues?|languages?)\b/i },
  { key: "Centres d'intérêt", re: /^(centres? d.intérêts?|loisirs|intérêts|hobbies|interests)\b/i },
  { key: 'Engagements', re: /^(bénévolat|associatif|engagements?|volunteering)\b/i },
];

function titleCase(s) {
  return s.toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase());
}

const BULLET = /^[-•●▪*–]\s*/;
const DANGLING = /\b(in|of|and|the|de|du|des|la|le|les|et|à|en|pour|avec|sur)$/i;

// PDF extraction breaks visual lines: re-join wrapped text and split glued words.
function cleanLines(text) {
  const out = [];
  for (let line of text.split(/\r?\n/)) {
    line = line.replace(/\s+/g, ' ').trim();
    if (!line) continue;
    line = line.replace(/(\p{Ll})(\d{2}\/\d{4})/gu, '$1 · $2'); // "Bovis04/2026"
    if (!line.includes(' ') && line.length > 16) line = line.replace(/(\p{Ll})(\p{Lu})/gu, '$1 · $2'); // "FootballVoyage"
    const prev = out[out.length - 1];
    const continues =
      prev &&
      !BULLET.test(line) &&
      ((BULLET.test(prev) && (/^\p{Ll}/u.test(line) || /[,(-]$/.test(prev))) || DANGLING.test(prev) || /,$/.test(prev));
    const dateOnly = prev && !BULLET.test(prev) && /^\d{2}\/\d{4}\b/.test(line) && line.length < 40;
    if (dateOnly) out[out.length - 1] = `${prev} · ${line}`;
    else if (continues) out[out.length - 1] = `${prev} ${line}`;
    else out.push(BULLET.test(line) ? `- ${line.replace(BULLET, '')}` : line);
  }
  return out;
}

// Splits "a, b (x, y), c" on top-level commas only.
function splitList(str) {
  const out = [];
  let depth = 0;
  let cur = '';
  for (const ch of str) {
    if (ch === '(') depth++;
    if (ch === ')') depth = Math.max(0, depth - 1);
    if ((ch === ',' || ch === ';') && depth === 0) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  return [...out, cur].map((x) => x.trim()).filter(Boolean);
}

// Items listed in the CV's own skills section, e.g. "Réseau : Fortinet, SD-WAN, VPN".
function listedSkills(lines) {
  const skills = [];
  const categories = [];
  for (const line of lines) {
    const m = line.match(/^([^:]{2,40})\s:\s*(.+)$/);
    if (m) categories.push(m[1].trim());
    // Without "Catégorie :", only comma-separated lines are lists; others are sub-headings.
    if (!m && !line.includes(',')) continue;
    for (const item of splitList(m ? m[2] : line.replace(BULLET, ''))) {
      const clean = item.replace(/\s*\([^)]*\)\s*$/, '').replace(/\.$/, '').trim();
      if (/[&/-]$/.test(clean)) continue; // fragment cut by a line break
      if (clean.length >= 2 && clean.length <= 40 && clean.split(' ').length <= 5) skills.push(clean);
    }
  }
  return { skills, categories };
}

// Best-effort parse of raw CV text into profile fields. The user reviews everything.
function parseCvText(text) {
  const lines = cleanLines(text);
  const email = (text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/) || [''])[0];
  const phone = (text.match(/(?:\+33\s?|0)[1-9](?:[\s.-]?\d{2}){4}/) || [''])[0];
  const links = [...new Set(text.match(/(?:https?:\/\/)?(?:www\.)?(?:linkedin\.com\/in|github\.com)\/[\w-]+/gi) || [])];
  const location = ((text.match(/(?:localisation|adresse|ville)\s*:\s*([^|\n]+)/i) || [])[1] || '').trim();

  // Name: words of a line that also appear in the e-mail address. Whatever follows
  // on that line, or the next short line, is usually the headline.
  let name = '';
  let headline = '';
  const local = norm(email.split('@')[0]).replace(/[^a-z]/g, '');
  for (const [i, line] of (local ? lines : []).entries()) {
    const words = line.split(' ');
    const hits = words.map((w) => {
      const n = norm(w).replace(/[^a-z]/g, '');
      return n.length >= 3 && local.includes(n);
    });
    const first = hits.indexOf(true);
    if (first === -1) continue;
    let last = first;
    while (hits[last + 1]) last++;
    if (last > first) {
      name = words.slice(first, last + 1).join(' ');
      headline = words.slice(last + 1).join(' ').replace(/^[-–|·,\s]+/, '');
      const next = lines[i + 1] || '';
      if (!headline && next.length < 70 && !/[@|:]|\d{2}/.test(next) && !HEADINGS.some((h) => h.re.test(next))) headline = next;
      break;
    }
  }
  if (!name) {
    name = lines.slice(0, 8).find((l) => /^[\p{L}' -]{4,40}$/u.test(l) && l.split(' ').length >= 2 && l.split(' ').length <= 4 && !HEADINGS.some((h) => h.re.test(l))) || '';
  }

  const sections = [];
  const skillLines = [];
  let summary = '';
  let current = null;
  for (const line of lines) {
    const heading = line.length < 45 ? HEADINGS.find((h) => h.re.test(line)) : null;
    if (heading) {
      // The skills section is kept as written (with its categories) for the CV template.
      current = { key: heading.key, title: heading.key === 'skills' ? 'Compétences' : heading.key, lines: [] };
      if (heading.key === 'summary') current.isSummary = true;
      else sections.push(current);
      continue;
    }
    if (!current) continue;
    if (current.isSummary) summary += (summary ? ' ' : '') + line;
    else current.lines.push(line);
    if (current.key === 'skills') skillLines.push(line);
  }

  const listed = listedSkills(skillLines);
  const seen = new Set(listed.skills.map(norm));
  const detected = detectSkills(text).filter((s) => !seen.has(norm(s)));

  return {
    name: name ? titleCase(name) : '',
    headline,
    email,
    phone,
    location,
    links,
    summary,
    skills: [...listed.skills, ...detected],
    // First category of the skills section: where extra skills go in the Word file.
    skillsAnchor: listed.categories[0] || '',
    sections: sections
      .filter((s) => s.lines.length)
      .map((s) => ({ title: s.title, body: s.lines.join('\n') })),
  };
}

// ---------- Built-in template ----------
// Single-column, text-only layout that applicant tracking systems read reliably:
// no columns, no icons, no skill "pills", dates as plain text.

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

const isSkills = (s) => /^comp[ée]tences?$/i.test(s.title.trim());
const MAX_CV_SKILLS = 30;

// Templates. "ats" ones keep the rules applicant tracking systems read reliably:
// one column, real text, no icons or tables. The others are more designed (header
// band, side column); their text is still real text, but a parser may mix up the columns.
const CV_STYLES = {
  layouts: {
    classique: { label: 'Classique', ats: true },
    moderne: { label: 'Moderne', ats: true },
    compact: { label: 'Compact', ats: true },
    elegant: { label: 'Élégant', ats: true },
    minimal: { label: 'Minimal', ats: true },
    bandeau: { label: 'Bandeau', ats: false },
    lateral: { label: 'Colonne latérale', ats: false },
  },
  fonts: {
    calibri: { label: 'Calibri', stack: 'Calibri, Carlito, "Segoe UI", Arial, sans-serif' },
    arial: { label: 'Arial', stack: 'Arial, "Liberation Sans", Helvetica, sans-serif' },
    georgia: { label: 'Georgia', stack: 'Georgia, "Times New Roman", serif' },
    garamond: { label: 'Garamond', stack: 'Garamond, "EB Garamond", "Palatino Linotype", Georgia, serif' },
    trebuchet: { label: 'Trebuchet', stack: '"Trebuchet MS", "Fira Sans", Verdana, sans-serif' },
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
  photoShapes: { carre: 'Carrée', rond: 'Ronde' },
};

const DEFAULT_STYLE = { layout: 'classique', font: 'calibri', accent: 'bleu', photo: true, photoShape: 'carre' };

function resolveStyle(style = {}) {
  const s = { ...DEFAULT_STYLE, ...style };
  return {
    layout: CV_STYLES.layouts[s.layout] ? s.layout : 'classique',
    font: (CV_STYLES.fonts[s.font] || CV_STYLES.fonts.calibri).stack,
    // A preset name, or any #rrggbb picked by the user.
    accent: /^#[0-9a-f]{6}$/i.test(s.accent) ? s.accent : (CV_STYLES.accents[s.accent] || CV_STYLES.accents.bleu).color,
    photo: s.photo !== false,
    round: s.photoShape === 'rond',
  };
}

const LAYOUT_CSS = {
  classique: '',
  moderne: `
  body { font-size: 8.9pt; }
  h1 { text-transform: none; font-size: 21pt; letter-spacing: -0.01em; }
  .headline { color: #444; font-weight: 400; font-size: 12.5pt; }
  h2 { color: var(--accent); border-bottom: 0.6pt solid var(--accent); text-transform: uppercase; letter-spacing: 0.08em; font-size: 9.5pt; }
  .row em { color: #555; font-style: normal; }
  section { margin-top: 6pt; }`,
  compact: `
  @page { margin: 8mm 10mm; }
  body { font-size: 8.7pt; line-height: 1.2; }
  h1 { font-size: 17pt; }
  .headline { font-size: 11pt; }
  h2 { font-size: 9.8pt; margin-bottom: 3pt; }
  h3 { font-size: 9.2pt; margin-top: 3pt; }
  section { margin-top: 4pt; }`,
  elegant: `
  header { text-align: center; padding-bottom: 6pt; border-bottom: 1.2pt solid var(--accent); }
  .photo { float: none; display: block; margin: 0 auto 5pt; }
  h1 { font-size: 22pt; font-weight: 400; letter-spacing: 0.14em; }
  .headline { color: #333; font-weight: 400; font-style: italic; font-size: 12pt; }
  .contact span + span::before { content: "·"; }
  h2 { color: var(--accent); border: 0; text-align: center; letter-spacing: 0.18em; font-size: 10pt; margin-top: 4pt; }
  h2::before, h2::after { content: ""; display: inline-block; width: 22pt; border-top: 0.6pt solid var(--accent); vertical-align: middle; margin: 0 8pt; }
  section { margin-top: 8pt; }`,
  minimal: `
  @page { margin: 14mm 16mm; }
  body { font-size: 9pt; line-height: 1.32; color: #1a1a1a; }
  h1 { font-size: 24pt; text-transform: none; font-weight: 300; }
  .headline { font-weight: 400; color: var(--accent); font-size: 11.5pt; }
  h2 { border: 0; color: var(--accent); font-size: 8.6pt; letter-spacing: 0.16em; margin-bottom: 3pt; }
  h3 { font-size: 9.4pt; }
  section { margin-top: 10pt; }`,
  bandeau: `
  @page { margin: 10mm 0; }
  @page :first { margin-top: 0; }
  header { background: var(--accent); color: #fff; padding: 11mm 14mm 7mm; display: flex; align-items: center; gap: 8mm; flex-direction: row-reverse; justify-content: space-between; }
  header .id { flex: 1; }
  .photo { float: none; margin: 0; border: 1.4pt solid #fff; }
  h1 { font-size: 23pt; }
  .headline { color: #fff; font-weight: 400; opacity: 0.95; }
  .contact { color: #fff; }
  main { padding: 0 14mm; }
  h2 { color: var(--accent); border-bottom: 0.8pt solid var(--accent); }
  section { margin-top: 7pt; }`,
  lateral: `
  @page { margin: 8mm 0; }
  @page :first { margin-top: 0; }
  /* Fixed elements repeat on every printed page: the accent column is one of them. */
  .rail { position: fixed; left: 0; top: 0; bottom: 0; width: 66mm; background: var(--accent); z-index: -1; }
  aside { position: absolute; top: 0; left: 0; width: 66mm; color: #fff; padding: 12mm 7mm 8mm 8mm; }
  main { margin-left: 66mm; padding: 4mm 12mm 0 9mm; }
  aside .photo { float: none; display: block; width: 36mm; height: 44mm; margin: 0 auto 7mm; border: 1.4pt solid #fff; }
  aside .photo.round { width: 40mm; height: 40mm; }
  aside h2 { color: #fff; border-bottom: 0.6pt solid rgba(255,255,255,.6); font-size: 9.6pt; letter-spacing: 0.08em; }
  aside .contact { font-size: 8.4pt; margin: 0 0 4pt; word-break: break-word; }
  aside .contact span { display: block; margin-bottom: 2pt; }
  aside .contact span + span::before { content: none; }
  aside li, aside p { font-size: 8.6pt; }
  main h1 { font-size: 22pt; margin-top: 8mm; }
  main h2 { color: var(--accent); border-bottom: 0.8pt solid var(--accent); }`,
};

// Sample content so every template can be previewed before the profile is filled in.
const SAMPLE = {
  name: 'Camille Martin',
  email: 'camille.martin@email.fr',
  phone: '06 12 34 56 78',
  location: 'Paris',
  links: ['linkedin.com/in/camille-martin'],
  headline: 'Étudiante en Master',
  summary: "Étudiante rigoureuse et curieuse, je cherche une première expérience où mettre en pratique mes compétences au sein d'une équipe.",
  skills: ['Excel', 'Python', 'SQL', 'Anglais'],
  sections: [
    { title: 'Expérience', body: 'Assistante projet, Société Exemple - Paris · 06/2025 - 09/2025\n- Suivi de projet et reporting hebdomadaire\n- Coordination de 4 équipes' },
    { title: 'Formation', body: 'Master 1 Management, Université Exemple · 2025 - 2026\n- Spécialisation en analyse de données' },
    { title: 'Compétences', body: 'Outils : Excel, Python, SQL\nLangues : Français, Anglais' },
  ],
};

const SIDE_RE = /^(comp[ée]tences?|langues?|certifications?|centres? d.int[ée]r[êe]ts?|loisirs|outils)/i;

function renderCvHtml(profileIn, { headline, summary, skills, skillsAdded = [] }) {
  const empty = !profileIn.name && !(profileIn.sections || []).length;
  const profile = empty ? { ...profileIn, ...SAMPLE, photo: profileIn.photo, cvStyle: profileIn.cvStyle } : profileIn;
  if (empty) {
    headline = headline || SAMPLE.headline;
    summary = summary || SAMPLE.summary;
    skills = skills?.length ? skills : SAMPLE.skills;
  }
  const style = resolveStyle(profile.cvStyle);
  const contact = [
    profile.email && `Email : ${profile.email}`,
    profile.phone && `Téléphone : ${profile.phone}`,
    profile.location && `Localisation : ${profile.location}`,
  ].filter(Boolean);
  const links = profile.links || [];
  const sections = (profile.sections || []).filter((s) => s.title && s.body);
  const skillsSection = sections.find(isSkills);
  const photo = style.photo ? photoDataUri(profile.photo) : '';

  const skillsHtml = skillsSection
    ? renderSkills(skillsSection, skillsAdded)
    : skills.length
      ? `<p>${escapeHtml(skills.slice(0, MAX_CV_SKILLS).join(', '))}</p>`
      : '';

  // Sections keep the CV's order. Without a skills section of its own, skills go
  // before certifications / languages.
  const blocks = sections.map((s) => ({ title: s.title, html: isSkills(s) ? skillsHtml : renderBody(s.body, { boldLines: /formation|éducation|diplôme/i.test(s.title) }) }));
  if (!skillsSection && skillsHtml) {
    const at = blocks.findIndex((b) => /certif|langue|intér|loisir/i.test(b.title));
    blocks.splice(at === -1 ? blocks.length : at, 0, { title: 'Compétences', html: skillsHtml });
  }

  const photoTag = photo ? `<img class="photo${style.round ? ' round' : ''}" src="${photo}" alt="">` : '';
  const idHtml = `<h1>${escapeHtml(profile.name || 'Ton nom')}</h1>${headline ? `<div class="headline">${escapeHtml(headline)}</div>` : ''}`;
  const contactHtml = `<div class="contact">${contact.map((c) => `<span>${escapeHtml(c)}</span>`).join('')}</div>${links.length ? `<div class="contact">${links.map((c) => `<span>${escapeHtml(c)}</span>`).join('')}</div>` : ''}`;
  const section = (b) => `<section><h2>${escapeHtml(b.title)}</h2>${b.html}</section>`;
  const summaryHtml = summary ? `<section><h2>Profil</h2><p class="summary">${escapeHtml(summary)}</p></section>` : '';

  let body;
  if (style.layout === 'lateral') {
    const side = blocks.filter((b) => SIDE_RE.test(b.title));
    const main = blocks.filter((b) => !SIDE_RE.test(b.title));
    body = `<div class="rail"></div><aside>${photoTag}<section><h2>Contact</h2>${contactHtml}</section>${side.map(section).join('')}</aside>
      <main>${idHtml}${summaryHtml}${main.map(section).join('')}</main>`;
  } else if (style.layout === 'bandeau') {
    body = `<header>${photoTag}<div class="id">${idHtml}${contactHtml}</div></header><main>${summaryHtml}${blocks.map(section).join('')}</main>`;
  } else {
    body = `<header>${photoTag}${idHtml}${contactHtml}</header>${summaryHtml}${blocks.map(section).join('')}`;
  }

  return `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<style>
  :root { --accent: ${style.accent}; }
  @page { size: A4; margin: 10mm 12mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: ${style.font}; color: #000; font-size: 9.2pt; line-height: 1.24; }
  header { overflow: hidden; }
  .photo { float: right; width: 21mm; height: 25mm; object-fit: cover; margin-left: 6mm; }
  .photo.round { width: 24mm; height: 24mm; border-radius: 50%; }
  h1 { font-size: 19pt; font-weight: 700; text-transform: uppercase; line-height: 1.1; }
  .headline { font-size: 12pt; font-weight: 700; color: var(--accent); margin-top: 2pt; }
  .contact { font-size: 8.6pt; margin-top: 4pt; }
  .contact span + span::before { content: "|"; margin: 0 6pt; }
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
  ${LAYOUT_CSS[style.layout]}
</style></head><body>
  ${body}
</body></html>`;
}

let browserPromise = null;
function getBrowser() {
  if (!browserPromise) {
    const { chromium } = require('playwright');
    browserPromise = chromium.launch({ headless: true }).catch((e) => {
      browserPromise = null;
      throw new Error('Chromium introuvable. Lance « npx playwright install chromium ». ' + e.message);
    });
  }
  return browserPromise;
}

async function htmlToPdf(html, outPath) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: 'networkidle', timeout: 15000 }).catch(() => page.setContent(html));
    await page.pdf({ path: outPath, format: 'A4', printBackground: true, preferCSSPageSize: true });
  } finally {
    await page.close();
  }
}

// Skills shown on the tailored CV: the ones the offer asks for first.
function orderSkills(profileSkills, offerSkills, added) {
  const wanted = new Set(offerSkills.map(norm));
  const all = [...profileSkills, ...added.filter((a) => !profileSkills.some((p) => norm(p) === norm(a)))];
  return [...all.filter((s) => wanted.has(norm(s))), ...all.filter((s) => !wanted.has(norm(s)))];
}

async function generate(app, profile, { headline, summary, skillsAdded = [], template = 'builtin' }, offerSkills = []) {
  const base = slug(`CV_${profile.name || 'candidat'}_${app.company}_${app.title}`, 90);

  if (template === 'original') {
    if (!profile.cvFile) throw new Error('Importe d\'abord ton CV.');
    const out = path.join(store.CV_DIR, base + '.pdf');
    fs.copyFileSync(await originalPdf(profile), out);
    return { file: out, warning: '' };
  }

  if (template === 'docx') {
    if (!profile.cvFile || !profile.cvFile.path.endsWith('.docx')) throw new Error('Importe d\'abord ton CV au format .docx.');
    const job = {
      source: profile.cvFile.path,
      output: path.join(store.CV_DIR, base + '.pdf'),
      titleText: profile.docx.titleText || profile.headline,
      newTitle: headline,
      summaryText: profile.docx.summaryText || '',
      newSummary: summary,
      skillsAnchor: profile.docx.skillsAnchor,
      skills: skillsAdded,
    };
    const jobFile = path.join(os.tmpdir(), `cv-job-${app.id}.json`);
    fs.writeFileSync(jobFile, JSON.stringify(job), 'utf8');
    try {
      const res = await runPython(['tailor', jobFile]);
      // A CV is always sent as a PDF: without Word or LibreOffice the .docx cannot be converted.
      if (!String(res.output).endsWith('.pdf')) {
        fs.rmSync(res.output, { force: true });
        throw new Error('Impossible de produire un PDF depuis ton fichier Word (Microsoft Word ou LibreOffice requis). Choisis « Modèle de l\'app », qui génère le PDF sans rien installer.');
      }
      return { file: res.output, warning: res.warning || (res.titleReplaced ? '' : 'Titre introuvable dans le fichier Word : vérifie le « texte du titre » dans ton profil.') };
    } finally {
      fs.rmSync(jobFile, { force: true });
    }
  }

  const out = path.join(store.CV_DIR, base + '.pdf');
  const skills = orderSkills(profile.skills || [], offerSkills, skillsAdded);
  await htmlToPdf(renderCvHtml(profile, { headline, summary, skills, skillsAdded }), out);
  return { file: out, warning: '' };
}

// The user's own CV, unchanged, as a PDF (Word files are converted once and cached).
async function originalPdf(profile) {
  const f = profile.cvFile;
  if (!f || !fs.existsSync(f.path)) throw new Error('Importe d\'abord ton CV.');
  if (f.path.endsWith('.pdf')) return f.path;
  const out = f.path.replace(/\.docx$/i, '.pdf');
  if (!fs.existsSync(out) || fs.statSync(out).mtimeMs < fs.statSync(f.path).mtimeMs) await runPython(['topdf', f.path, out]);
  return out;
}

// The CV photo, taken from a Word file (none for PDFs).
async function extractPhoto(filePath) {
  for (const ext of ['.png', '.jpg', '.jpeg']) fs.rmSync(path.join(store.UPLOAD_DIR, 'photo' + ext), { force: true });
  if (path.extname(filePath).toLowerCase() !== '.docx') return null;
  try {
    return (await runPython(['photo', filePath, path.join(store.UPLOAD_DIR, 'photo')])).photo;
  } catch {
    return null;
  }
}

function photoDataUri(file) {
  if (!file || !fs.existsSync(file)) return '';
  const type = file.endsWith('.png') ? 'image/png' : 'image/jpeg';
  return `data:${type};base64,${fs.readFileSync(file).toString('base64')}`;
}

module.exports = { originalPdf, CV_STYLES, extractPhoto, extractText, parseCvText, generate, renderCvHtml, orderSkills };
