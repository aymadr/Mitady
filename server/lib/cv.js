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

const { CV_STYLES, SECTION_TYPES, LEVELS, sectionText, renderCvHtml, renderBody, renderSkills, isSkills, photoDataUri, MAX_CV_SKILLS } = require('./cv-render');

let browserPromise = null;
function getBrowser() {
  if (!browserPromise) {
    const { chromium } = require('playwright');
    browserPromise = chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined }).catch((e) => {
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
    // Web fonts load after the stylesheet: wait for them (a failure just means the fallback font).
    await page.evaluate(() => document.fonts.ready).catch(() => {});
    await page.pdf({ path: outPath, format: 'A4', printBackground: true, preferCSSPageSize: true });
  } finally {
    await page.close();
  }
}

// The cover letter as a PDF, in the look of the CV (or of the template picked for letters).
async function generateLetter(app, profile, letter, headline) {
  const out = path.join(store.CV_DIR, slug(`Lettre_${profile.name || 'candidat'}_${app.company}_${app.title}`, 90) + '.pdf');
  await htmlToPdf(renderLetterFor(profile, letter, headline), out);
  return out;
}

function renderLetterFor(profile, letter, headline, preview = false) {
  const layout = profile.letter?.layout || profile.cvStyle?.layout;
  const p = { ...profile, cvStyle: { ...profile.cvStyle, layout } };
  return renderCvHtml(p, { headline: headline ?? profile.headline, summary: '', skills: [], preview, letter });
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


module.exports = { generateLetter, renderLetterFor, originalPdf, CV_STYLES, SECTION_TYPES, LEVELS, sectionText, extractPhoto, extractText, parseCvText, generate, renderCvHtml, orderSkills };
