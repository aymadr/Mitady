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
    georgia: { label: 'Georgia', group: 'Serif', stack: 'Georgia, "Times New Roman", serif' },
    garamond: { label: 'Garamond', group: 'Serif', stack: 'Garamond, "EB Garamond", "Palatino Linotype", Georgia, serif' },
    times: { label: 'Times', group: 'Serif', stack: '"Times New Roman", "Liberation Serif", Times, serif' },
    cambria: { label: 'Cambria', group: 'Serif', stack: 'Cambria, Caladea, Georgia, serif' },
    merriweather: { label: 'Merriweather', group: 'Serif', g: 'Merriweather:wght@400;700', stack: 'Merriweather, Georgia, serif' },
    lora: { label: 'Lora', group: 'Serif', g: 'Lora:wght@400;600;700', stack: 'Lora, Georgia, serif' },
    playfair: { label: 'Playfair Display', group: 'Serif', g: 'Playfair+Display:wght@400;600;700', stack: '"Playfair Display", Georgia, serif' },
    baskerville: { label: 'Libre Baskerville', group: 'Serif', g: 'Libre+Baskerville:wght@400;700', stack: '"Libre Baskerville", Baskerville, Georgia, serif' },
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
  photoShapes: { carre: 'Carrée', arrondi: 'Arrondie', rond: 'Ronde' },
  photoSizes: { s: 'Petite', m: 'Moyenne', l: 'Grande' },
  get sectionTypes() { return SECTION_TYPES; },
  levels: ['Notions', 'Intermédiaire', 'Courant', 'Bilingue', 'Langue maternelle'],
};

// 0 / '' = the template's own value. Only what the user changes overrides the template.
const DEFAULT_STYLE = {
  layout: 'classique', font: 'calibri', accent: 'bleu',
  photo: true, photoShape: 'carre', photoSize: 'm', photoBorder: false,
  fontSize: 0, lineHeight: 0, margin: 0, gap: 0, nameSize: 0,
  headStyle: '', headCaps: '', dateFormat: 'mmyyyy', skillStyle: 'text', langStyle: 'text',
  icons: false, linkIcons: false, align: '', columns: 'one', summary: true,
};
// Photo box in mm, per size: portrait (4:5) for square and rounded, square for round.
const PHOTO_MM = { s: [18, 22.5, 20], m: [22, 27.5, 25], l: [27, 34, 31] };
const clampNum = (v, lo, hi) => (Number(v) > 0 ? Math.min(hi, Math.max(lo, Number(v))) : 0);
const oneOf = (v, list, d = '') => (list.includes(v) ? v : d);

function resolveStyle(style = {}) {
  const s = { ...DEFAULT_STYLE, ...style };
  const font = CV_STYLES.fonts[s.font] || CV_STYLES.fonts.calibri;
  return {
    layout: CV_STYLES.layouts[s.layout] ? s.layout : 'classique',
    font: font.stack,
    fontImport: font.g ? `https://fonts.googleapis.com/css2?family=${font.g}&display=swap` : '',
    // A preset name, or any #rrggbb picked by the user.
    accent: /^#[0-9a-f]{6}$/i.test(s.accent) ? s.accent : (CV_STYLES.accents[s.accent] || CV_STYLES.accents.bleu).color,
    photo: s.photo !== false,
    shape: ['carre', 'arrondi', 'rond'].includes(s.photoShape) ? s.photoShape : 'carre',
    size: PHOTO_MM[s.photoSize] ? s.photoSize : 'm',
    border: Boolean(s.photoBorder),
    fontSize: clampNum(s.fontSize, 7.5, 12),
    lineHeight: clampNum(s.lineHeight, 1, 1.8),
    margin: clampNum(s.margin, 6, 24),
    gap: clampNum(s.gap, 2, 20),
    nameSize: clampNum(s.nameSize, 14, 34),
    headStyle: oneOf(s.headStyle, ['line', 'plain', 'accent', 'bar', 'box']),
    headCaps: oneOf(s.headCaps, ['on', 'off']),
    dateFormat: oneOf(s.dateFormat, ['mmyyyy', 'mmm', 'yyyy'], 'mmyyyy'),
    skillStyle: oneOf(s.skillStyle, ['text', 'chips', 'bars', 'dots'], 'text'),
    langStyle: oneOf(s.langStyle, ['text', 'bars', 'dots'], 'text'),
    icons: Boolean(s.icons),
    linkIcons: Boolean(s.linkIcons),
    align: oneOf(s.align, ['center']),
    columns: s.columns === 'two' ? 'two' : 'one',
    summary: s.summary !== false,
  };
}

// CSS for the options the user changed, appended after the template's own CSS.
function customCss(st) {
  const free = !['bandeau', 'lateral'].includes(st.layout);
  const c = [];
  if (st.fontSize) c.push(`body { font-size: ${st.fontSize}pt; }`);
  if (st.lineHeight) c.push(`body { line-height: ${st.lineHeight}; }`);
  if (st.gap) c.push(`section { margin-top: ${st.gap}pt; }`);
  if (st.nameSize) c.push(`h1 { font-size: ${st.nameSize}pt; }`);
  if (st.margin && free) c.push(`@page { margin: ${Math.max(6, st.margin - 3)}mm ${st.margin}mm; }`);
  const heads = {
    line: 'main h2, body > section h2, .side h2 { border-bottom: 0.8pt solid #000; color: #000; }',
    plain: 'main h2, body > section h2, .side h2 { border: 0; color: var(--accent); }',
    accent: 'main h2, body > section h2, .side h2 { border-bottom: 0.8pt solid var(--accent); color: var(--accent); }',
    bar: 'main h2, body > section h2, .side h2 { border: 0; border-left: 3pt solid var(--accent); padding-left: 6pt; color: #000; }',
    box: 'main h2, body > section h2, .side h2 { border: 0; background: var(--accent); color: #fff; padding: 2pt 6pt; }',
  };
  if (st.headStyle) c.push(heads[st.headStyle]);
  if (st.headCaps) c.push(`h2 { text-transform: ${st.headCaps === 'on' ? 'uppercase' : 'none'}; }`);
  if (st.align === 'center' && st.layout !== 'lateral' && st.layout !== 'bandeau') {
    c.push('header { text-align: center; } header .photo { float: none; display: block; margin: 0 auto 5pt; } header .contact { justify-content: center; }');
  }
  return c.join('\n  ');
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
  header .ic { color: #fff; }
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
  aside .photo { float: none; display: block; width: calc(var(--pw) * 1.65); height: calc(var(--ph) * 1.65); margin: 0 auto 7mm; border: 1.4pt solid #fff; }
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

// What each kind of section holds. `kind` drives the editor and the rendering.
const SECTION_TYPES = {
  employment: { label: 'Expérience professionnelle', kind: 'entries', f: { title: 'Poste', subtitle: 'Employeur', location: 'Lieu' } },
  education: { label: 'Formation', kind: 'entries', f: { title: 'Diplôme', subtitle: 'École', location: 'Lieu' } },
  projects: { label: 'Projets', kind: 'entries', f: { title: 'Projet', subtitle: 'Rôle ou technologies', location: 'Lieu' } },
  certificates: { label: 'Certifications', kind: 'entries', f: { title: 'Certification', subtitle: 'Organisme', location: 'Lieu' } },
  courses: { label: 'Formations complémentaires', kind: 'entries', f: { title: 'Formation', subtitle: 'Organisme', location: 'Lieu' } },
  awards: { label: 'Distinctions', kind: 'entries', f: { title: 'Distinction', subtitle: 'Décernée par', location: 'Lieu' } },
  organisations: { label: 'Associations et bénévolat', kind: 'entries', f: { title: 'Rôle', subtitle: 'Organisation', location: 'Lieu' } },
  skills: { label: 'Compétences', kind: 'skills' },
  languages: { label: 'Langues', kind: 'languages' },
  interests: { label: "Centres d'intérêt", kind: 'tags' },
  text: { label: 'Texte libre', kind: 'text' },
};
const LEVELS = ['Notions', 'Intermédiaire', 'Courant', 'Bilingue', 'Langue maternelle'];
const SIDE_TYPES = ['skills', 'languages', 'interests'];
const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

function fmtDate(v, fmt) {
  v = String(v || '').trim();
  let y;
  let mo;
  let m = v.match(/^(\d{4})-(\d{1,2})$/);
  if (m) [y, mo] = [m[1], m[2]];
  else if ((m = v.match(/^(\d{1,2})\/(\d{4})$/))) [y, mo] = [m[2], m[1]];
  else if (/^\d{4}$/.test(v)) [y, mo] = [v, ''];
  else return v;
  mo = mo && String(mo).padStart(2, '0');
  if (fmt === 'yyyy' || !mo) return y;
  if (fmt === 'mmm') return `${MONTHS[Number(mo) - 1] || mo} ${y}`;
  return `${mo}/${y}`;
}

function entryDates(it, fmt) {
  const a = fmtDate(it.start, fmt);
  const b = it.current ? "Aujourd'hui" : fmtDate(it.end, fmt);
  return a && b ? `${a} – ${b}` : a || b;
}

// Description: "- " lines are bullets, other lines paragraphs.
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
  return (items || [])
    .filter((it) => it && (it.title || it.subtitle || it.description))
    .map((it) => {
      const dates = entryDates(it, st.dateFormat);
      const sub = [it.subtitle, it.location].filter(Boolean).map(escapeHtml).join(' · ');
      return `<div class="entry"><div class="row"><h3>${escapeHtml(it.title || it.subtitle || '')}</h3>${dates ? `<em>${escapeHtml(dates)}</em>` : ''}</div>`
        + `${it.title && sub ? `<div class="sub">${sub}${it.link ? ` · <span class="lnk">${escapeHtml(it.link)}</span>` : ''}</div>` : ''}${renderDesc(it.description)}</div>`;
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
  return (items || [])
    .filter((it) => it && it.name)
    .map((it) => {
      const n = clampLevel(it.level, 3);
      const label = it.label || LEVELS[n - 1];
      if (st.langStyle === 'text') return `<p><strong>${escapeHtml(it.name)}</strong> : ${escapeHtml(label)}</p>`;
      return `<div class="lv"><span><strong>${escapeHtml(it.name)}</strong> <small>${escapeHtml(label)}</small></span>${(st.langStyle === 'bars' ? bar : dots)(n)}</div>`;
    })
    .join('');
}

// Plain-text version of a section (matching, AI prompts).
function sectionText(s) {
  if (!s) return '';
  const t = s.type || 'text';
  if (t === 'text') return s.body || '';
  if (t === 'languages') return (s.items || []).map((i) => `${i.name} ${i.label || LEVELS[clampLevel(i.level, 3) - 1]}`).join('\n');
  if (t === 'interests') return (s.items || []).map((i) => i.name).join(', ');
  if (t === 'skills') return '';
  return (s.items || []).map((i) => [i.title, i.subtitle, i.location, entryDates(i, 'mmyyyy'), i.description].filter(Boolean).join(' · ')).join('\n');
}

// ---------- Icons (inline SVG, so the PDF needs no font or network) ----------
const ICON_PATHS = {
  mail: ['0 0 24 24', 'M3 5h18a1 1 0 011 1v12a1 1 0 01-1 1H3a1 1 0 01-1-1V6a1 1 0 011-1zm1.4 2L12 12.6 19.6 7H4.4z'],
  phone: ['0 0 24 24', 'M6.6 10.8a15 15 0 006.6 6.6l2.2-2.2a1 1 0 011-.25c1.1.36 2.3.55 3.6.55a1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 4a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.2 2.45.57 3.57a1 1 0 01-.25 1z'],
  pin: ['0 0 24 24', 'M12 2a7 7 0 00-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 00-7-7zm0 9.5A2.5 2.5 0 119.5 9 2.5 2.5 0 0112 11.5z'],
  link: ['0 0 24 24', 'M10.6 13.4a1 1 0 010-1.4l3-3a3 3 0 114.2 4.2l-1.5 1.5-1.4-1.4 1.5-1.5a1 1 0 00-1.4-1.4l-3 3a1 1 0 01-1.4 0zm2.8-2.8a1 1 0 010 1.4l-3 3a3 3 0 11-4.2-4.2l1.5-1.5 1.4 1.4-1.5 1.5a1 1 0 001.4 1.4l3-3a1 1 0 011.4 0z'],
  github: ['0 0 16 16', 'M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z'],
  linkedin: ['0 0 24 24', 'M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 110-4.12 2.06 2.06 0 010 4.12zM7.12 20.45H3.56V9h3.56v11.45z'],
  globe: ['0 0 24 24', 'M12 2a10 10 0 100 20 10 10 0 000-20zm6.9 9h-3a15 15 0 00-1.2-5A8 8 0 0118.9 11zM12 4c.8 1 1.6 3 1.9 7h-3.8C10.4 7 11.2 5 12 4zM4.1 13h3a15 15 0 001.2 5A8 8 0 014.1 13zm3-2h-3a8 8 0 014.2-5 15 15 0 00-1.2 5zm4.9 9c-.8-1-1.6-3-1.9-7h3.8c-.3 4-1.1 6-1.9 7zm3.7-2a15 15 0 001.2-5h3a8 8 0 01-4.2 5z'],
};
const icon = (name) => {
  const [vb, d] = ICON_PATHS[name] || ICON_PATHS.link;
  return `<svg class="ic" viewBox="${vb}" width="9" height="9" aria-hidden="true"><path fill="currentColor" d="${d}"/></svg>`;
};
const linkIcon = (url) => (/linkedin/i.test(url) ? 'linkedin' : /github/i.test(url) ? 'github' : /^[^@\s]+@[^@\s]+$/.test(url) ? 'mail' : /https?:|www\.|\.[a-z]{2,}/i.test(url) ? 'globe' : 'link');

// On screen the page margins (@page) do not exist: they are drawn as padding.
function previewCss(st) {
  if (['bandeau', 'lateral'].includes(st.layout)) return 'html { background: #fff; }';
  const base = { compact: [8, 10], minimal: [14, 16] }[st.layout] || [10, 12];
  const [y, x] = st.margin ? [Math.max(6, st.margin - 3), st.margin] : base;
  return `html { background: #fff; } body { padding: ${y}mm ${x}mm; }`;
}

const SIDE_RE = /^(comp[ée]tences?|langues?|certifications?|centres? d.int[ée]r[êe]ts?|loisirs|outils)/i;

function renderCvHtml(profileIn, { headline, summary, skills, skillsAdded = [], preview = false }) {
  const empty = !profileIn.name && !(profileIn.sections || []).some((s) => sectionText(s).trim());
  const profile = empty ? { ...profileIn, ...SAMPLE, photo: profileIn.photo, cvStyle: profileIn.cvStyle } : profileIn;
  if (empty) {
    headline = headline || SAMPLE.headline;
    summary = summary || SAMPLE.summary;
    skills = skills?.length ? skills : SAMPLE.skills;
  }
  const style = resolveStyle(profile.cvStyle);
  const icons = style.icons;
  const details = (profile.details || []).filter((d) => d && d.value);
  const contact = [
    profile.email && [icons ? icon('mail') : '', icons ? profile.email : `Email : ${profile.email}`],
    profile.phone && [icons ? icon('phone') : '', icons ? profile.phone : `Téléphone : ${profile.phone}`],
    profile.location && [icons ? icon('pin') : '', icons ? profile.location : `Localisation : ${profile.location}`],
    ...details.map((d) => ['', d.label ? `${d.label} : ${d.value}` : d.value]),
  ].filter(Boolean);
  const links = (profile.links || []).filter(Boolean);
  const levels = profile.skillLevels || {};
  const all = (profile.sections || []).filter((s) => s && s.title && !s.hidden);
  const photo = style.photo ? profile.photoData || photoDataUri(profile.photo) : '';
  const skillNames = (skills || []).slice(0, MAX_CV_SKILLS);

  const blockOf = (s) => {
    const type = s.type || 'text';
    const kind = (SECTION_TYPES[type] || SECTION_TYPES.text).kind;
    let html;
    if (kind === 'entries') html = renderEntries(s.items, style);
    else if (kind === 'skills') html = renderSkillList(skillNames, style, levels) + (skillsAdded.length && !skillNames.length ? `<p>${escapeHtml(skillsAdded.join(', '))}</p>` : '');
    else if (kind === 'languages') html = renderLanguages(s.items, style);
    else if (kind === 'tags') html = renderSkillList((s.items || []).map((i) => i.name).filter(Boolean), { ...style, skillStyle: style.skillStyle === 'chips' ? 'chips' : 'text' });
    else if (isSkills(s)) html = renderSkills(s, skillsAdded);
    else html = renderBody(s.body, { boldLines: /formation|éducation|diplôme/i.test(s.title) });
    return { title: s.title, html, side: SIDE_TYPES.includes(type) || (type === 'text' && SIDE_RE.test(s.title)) };
  };

  const blocks = all.map(blockOf).filter((b) => b.html);
  // Without a skills section of its own, skills go before certifications / languages
  // (CVs the editor has not touched yet).
  const hasSkills = all.some((s) => (s.type || 'text') === 'skills' || (!s.type && isSkills(s)));
  if (!profile.cvManaged && !hasSkills && skillNames.length) {
    const at = blocks.findIndex((b) => /certif|langue|intér|loisir/i.test(b.title));
    blocks.splice(at === -1 ? blocks.length : at, 0, { title: 'Compétences', html: renderSkillList(skillNames, style, levels), side: true });
  }

  const [pw, ph, pr] = PHOTO_MM[style.size];
  const round = style.shape === 'rond';
  const photoTag = photo ? `<img class="photo ${style.shape}${style.border ? ' bordered' : ''}" style="--pw:${round ? pr : pw}mm;--ph:${round ? pr : ph}mm" src="${photo}" alt="">` : '';
  const idHtml = `<h1>${escapeHtml(profile.name || 'Ton nom')}</h1>${headline ? `<div class="headline">${escapeHtml(headline)}</div>` : ''}`;
  const span = ([ic, text]) => `<span>${ic}${escapeHtml(text)}</span>`;
  const linkSpan = (l) => `<span>${style.linkIcons ? icon(linkIcon(l)) : ''}${escapeHtml(l)}</span>`;
  const contactHtml = `<div class="contact">${contact.map(span).join('')}</div>${links.length ? `<div class="contact">${links.map(linkSpan).join('')}</div>` : ''}`;
  const section = (b) => `<section><h2>${escapeHtml(b.title)}</h2>${b.html}</section>`;
  const summaryHtml = summary && style.summary ? `<section><h2>Profil</h2><p class="summary">${escapeHtml(summary)}</p></section>` : '';

  let body;
  if (style.layout === 'lateral') {
    const side = blocks.filter((b) => b.side);
    const main = blocks.filter((b) => !b.side);
    body = `<div class="rail"></div><aside>${photoTag}<section><h2>Contact</h2>${contactHtml}</section>${side.map(section).join('')}</aside>
      <main>${idHtml}${summaryHtml}${main.map(section).join('')}</main>`;
  } else if (style.layout === 'bandeau') {
    body = `<header>${photoTag}<div class="id">${idHtml}${contactHtml}</div></header><main>${summaryHtml}${blocks.map(section).join('')}</main>`;
  } else if (style.columns === 'two') {
    body = `<header>${photoTag}${idHtml}${contactHtml}</header><div class="cols"><main>${summaryHtml}${blocks.filter((b) => !b.side).map(section).join('')}</main><div class="side">${blocks.filter((b) => b.side).map(section).join('')}</div></div>`;
  } else {
    body = `<header>${photoTag}${idHtml}${contactHtml}</header>${summaryHtml}${blocks.map(section).join('')}`;
  }

  return `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<style>
  ${style.fontImport ? `@import url('${style.fontImport}');` : ''}
  :root { --accent: ${style.accent}; }
  @page { size: A4; margin: 10mm 12mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: ${style.font}; color: #000; font-size: 9.2pt; line-height: 1.24; }
  header { overflow: hidden; }
  .photo { float: right; width: var(--pw, 22mm); height: var(--ph, 27.5mm); object-fit: cover; margin-left: 6mm; }
  .photo.arrondi { border-radius: 3.2mm; }
  .photo.rond { border-radius: 50%; }
  .photo.bordered { border: 0.55mm solid var(--accent); }
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
  .entry { margin-top: 4pt; break-inside: avoid-page; }
  section h2 + .entry { margin-top: 0; }
  .entry h3 { margin-top: 0; }
  .sub { font-style: italic; color: #333; }
  .lnk { color: var(--accent); }
  p { margin-bottom: 1.5pt; }
  p.strong-line { font-weight: 700; }
  ul { list-style: none; margin: 1pt 0 3pt; }
  li { padding-left: 9pt; text-indent: -6pt; margin-bottom: 1pt; break-inside: avoid; }
  .summary { text-align: justify; }
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
  ${LAYOUT_CSS[style.layout]}
  aside .chips span { border-color: #fff; }
  aside .bar::after, aside .dots b.on { background: #fff; }
  aside .bar, aside .dots b { background: rgba(255,255,255,.3); }
  aside .ic { color: #fff; }
  ${customCss(style)}
  ${preview ? previewCss(style) : ''}
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
      // The untouched CV as PDF: the tailored one must not have more pages than it.
      referencePdf: await originalPdf(profile).catch(() => ''),
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

// The CV photo, taken from a Word file (none for PDFs). The current photo is only replaced
// when one is found, so importing a PDF does not wipe a photo the user added.
async function extractPhoto(filePath) {
  if (path.extname(filePath).toLowerCase() !== '.docx') return null;
  try {
    const out = path.join(store.UPLOAD_DIR, 'photo-extracted');
    const found = (await runPython(['photo', filePath, out])).photo;
    if (!found) return null;
    for (const ext of ['.png', '.jpg', '.jpeg', '.webp']) fs.rmSync(path.join(store.UPLOAD_DIR, 'photo' + ext), { force: true });
    const target = path.join(store.UPLOAD_DIR, 'photo' + path.extname(found));
    fs.renameSync(found, target);
    return target;
  } catch {
    return null;
  }
}

function photoDataUri(file) {
  if (!file || !fs.existsSync(file)) return '';
  const type = file.endsWith('.png') ? 'image/png' : 'image/jpeg';
  return `data:${type};base64,${fs.readFileSync(file).toString('base64')}`;
}

module.exports = { originalPdf, CV_STYLES, SECTION_TYPES, LEVELS, sectionText, extractPhoto, extractText, parseCvText, generate, renderCvHtml, orderSkills };
