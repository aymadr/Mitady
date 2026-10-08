// The guided demo: the user's companion drives the real interface on sample data, with a visible
// cursor, a spotlight on what it shows and subtitles. Nothing real is touched: API calls are
// answered from sample data while the demo runs, and the real profile and offers come back after.
import { S, go, refreshNav, refreshPage } from './main.js';
import { hooks, toast, html } from './lib.js';
import { petSvg, petOf } from './pet.js';
import { celebrate } from './fx.js';

let active = false;
export const isDemo = () => active;

// ---------- Sample data ----------

const today = () => new Date().toISOString().slice(0, 10);
const ago = (d) => new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);

function sampleApps() {
  const base = { link: 'https://example.org/offre', description: '', appliedAt: '', contact: { name: '', email: '' }, notes: '', cv: null, followUps: 0, ai: null };
  const mk = (id, title, company, location, source, contract, score, skills, missing, status = 'todo', extra = {}) => ({
    ...base, id, title, company, location, source, contract, status, addedAt: today(), score,
    skills, matched: skills.filter((s) => !missing.includes(s)), missing, followUpDue: false,
    suggestedHeadline: title.replace(/\s+en alternance$/i, ''),
    description: `Missions : ${skills.join(', ')}. Au sein d'une équipe passionnée, tu participes à des projets concrets.`, ...extra,
  });
  return [
    mk('d1', 'Analyste SOC N1 en alternance', 'Orange Cyberdefense', 'Paris', 'LinkedIn', 'Alternance', 84, ['SIEM', 'Splunk', 'MITRE ATT&CK', 'Linux', 'Python', 'Wireshark', 'SOC'], ['SOC']),
    mk('d2', 'Stagiaire Pentest', 'Thales', 'Gennevilliers', 'Welcome to the Jungle', 'Stage', 62, ['Pentest', 'Burp Suite', 'Kali', 'Python', 'Linux'], ['Burp Suite']),
    mk('d3', 'Alternant GRC Cybersécurité', 'Société Générale', 'La Défense', 'HelloWork', 'Alternance', 48, ['ISO 27001', 'EBIOS RM', 'RGPD', 'GRC', 'Anglais'], ['ISO 27001', 'EBIOS RM']),
    mk('d4', 'Analyste Threat Intelligence', 'Airbus', 'Élancourt', 'France Travail', 'Alternance', 70, ['Threat Intelligence', 'OSINT', 'MITRE ATT&CK', 'Python'], ['OSINT']),
    mk('d5', 'Ingénieur Sécurité Cloud en alternance', 'Doctolib', 'Paris', 'Indeed', 'Alternance', 36, ['AWS', 'Azure', 'Terraform', 'IAM', 'Python'], ['AWS', 'Terraform', 'IAM']),
    mk('d6', 'Stage Data Analyst', 'Alan', 'Paris', 'JobTeaser', 'Stage', 55, ['Python', 'SQL', 'Power BI', 'Excel'], ['Power BI']),
    mk('d7', 'Stage SOC Analyst', 'Sekoia.io', 'Paris', 'Jobs That Make Sense', 'Stage', 77, ['SOC', 'SIEM', 'Splunk', 'Python'], [], 'interview', { appliedAt: ago(9) }),
    mk('d8', 'Technicien Support Sécurité', 'Capgemini', 'Lyon', 'Jobijoba', 'Alternance', 41, ['Active Directory', 'Windows Server', 'GLPI', 'PowerShell'], ['GLPI'], 'applied', { appliedAt: ago(9), followUpDue: true }),
  ];
}

// ---------- API answered from sample data ----------

let apps = [];
const clone = (x) => JSON.parse(JSON.stringify(x));

async function demoApi(path, { method, body }) {
  const find = (id) => apps.find((a) => a.id === id);
  if (path === '/applications' && method === 'GET') return clone(apps);
  let m = path.match(/^\/applications\/([^/]+)$/);
  if (m && method === 'PUT') {
    const a = find(m[1]);
    if (body.status) {
      a.status = body.status;
      if (body.status === 'applied' && !a.appliedAt) a.appliedAt = today();
      a.followUpDue = false;
    }
    if (body.cvDraft) a.cv = { ...(a.cv || {}), ...body.cvDraft };
    for (const k of ['notes', 'title', 'company', 'location', 'link', 'description']) if (body[k] !== undefined) a[k] = body[k];
    if (body.contact) a.contact = { ...a.contact, ...body.contact };
    return clone(a);
  }
  if (path === '/profile' && method === 'PUT') {
    Object.assign(S.profile, body);
    if (Array.isArray(body.skills)) {
      // A new skill raises the score of the offers that ask for it.
      for (const a of apps) {
        a.matched = a.skills.filter((s) => body.skills.includes(s));
        a.missing = a.skills.filter((s) => !body.skills.includes(s));
        a.score = Math.round(((a.matched.length + 1) / (a.skills.length + 2)) * 100);
      }
    }
    return { profile: S.profile, applications: clone(apps) };
  }
  m = path.match(/^\/applications\/([^/]+)\/cv\/preview$/);
  if (m && method === 'POST') {
    const res = await fetch('/api/demo/cv-preview', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ headline: body.headline, summary: body.summary, cvStyle: S.profile.cvStyle }) });
    return res.text();
  }
  m = path.match(/^\/applications\/([^/]+)\/cv$/);
  if (m && method === 'POST') {
    await new Promise((r) => setTimeout(r, 1500));
    const a = find(m[1]);
    a.cv = { ...body, file: 'demo', generatedAt: new Date().toISOString() };
    return { application: clone(a), warning: '' };
  }
  m = path.match(/^\/applications\/([^/]+)\/email-draft$/);
  if (m) {
    const a = find(m[1]);
    return { to: 'prenom.nom@entreprise.fr', subject: `Candidature ${a.suggestedHeadline} · ${S.profile.name}`, body: `Bonjour,\n\nJe vous adresse ma candidature pour le poste ${a.suggestedHeadline} chez ${a.company}.\n\nVous trouverez mon CV en pièce jointe. Je serais ravi d'échanger avec vous à ce sujet.\n\nBien cordialement,\n${S.profile.name}` };
  }
  m = path.match(/^\/applications\/([^/]+)\/send$/);
  if (m && method === 'POST') {
    await new Promise((r) => setTimeout(r, 1200));
    const a = find(m[1]);
    a.status = 'applied';
    a.appliedAt = today();
    a.emails = [{ to: body.to, subject: body.subject, at: new Date().toISOString() }];
    return clone(a);
  }
  if (path === '/search/stop') {
    stopFake?.();
    return { ok: true };
  }
  if (path.startsWith('/profile/cv-preview') || path.startsWith('/state')) return undefined; // harmless: let it through
  throw new Error('Pas disponible pendant la démonstration.');
}

// A search that streams sample progress, like the real one.
let stopFake = null;
function fakeSearch() {
  const listeners = {};
  const timers = [];
  let ended = false;
  const emit = (name, data, t) => timers.push(setTimeout(() => !ended && (listeners[name] || []).forEach((f) => f({ data: JSON.stringify(data) })), t));
  const ids = Array.isArray(S.profile.search.sources) ? S.profile.search.sources : S.sources.filter((x) => x.on).map((x) => x.id);
  const labels = S.sources.filter((x) => ids.includes(x.id)).map((x) => x.label);
  const per = Object.fromEntries(labels.map((l) => [l, 0]));
  const kws = ['soc', 'pentest', 'grc', 'cyber'];
  emit('progress', { stage: 'start', sources: [], batches: kws.length }, 300);
  kws.forEach((kw, i) => {
    labels.forEach((l, k) => { if ((i + k) % 2 === 0) per[l] += 3 + k; });
    emit('progress', { stage: 'search', batch: i + 1, batches: kws.length, keyword: kw, contract: i % 2 ? 'Stage' : 'Alternance', perSource: { ...per }, seen: Object.values(per).reduce((a, b) => a + b, 0) }, 1100 + i * 1500);
  });
  emit('progress', { stage: 'filter', before: 60, kept: 41 }, 7600);
  emit('progress', { stage: 'dedupe', dupes: 8, fresh: 33 }, 8400);
  for (let i = 0; i <= 33; i += 11) emit('progress', { stage: 'read', done: i, total: 33 }, 8800 + i * 40);
  emit('done', { added: 33, merged: 0 }, 10600);
  stopFake = () => {
    timers.forEach(clearTimeout);
    emit('done', { added: 12, merged: 0, stopped: true }, 400);
  };
  return {
    addEventListener: (n, f) => (listeners[n] = listeners[n] || []).push(f),
    close: () => { ended = true; timers.forEach(clearTimeout); },
  };
}

// ---------- The robot ----------

class Abort extends Error {}
let ui = null;
let paused = false;
let aborted = false;
let cur = { x: 120, y: 120 };

const sleep = async (ms) => {
  const end = performance.now() + ms;
  while (performance.now() < end) {
    if (aborted) throw new Abort();
    await new Promise((r) => setTimeout(r, 40));
    if (paused) {
      const t = performance.now();
      while (paused && !aborted) await new Promise((r) => setTimeout(r, 80));
      if (aborted) throw new Abort();
      return sleep(Math.max(0, end - t));
    }
  }
};

const $ = (sel) => (typeof sel === 'string' ? document.querySelector(sel) : sel);

async function waitFor(sel, timeout = 6000) {
  const t0 = performance.now();
  while (performance.now() - t0 < timeout) {
    const el = $(sel);
    if (el) return el;
    await sleep(80);
  }
  return null;
}

function setCursor(x, y, { instant = false } = {}) {
  cur = { x, y };
  ui.cursor.style.transition = instant ? 'none' : '';
  ui.cursor.style.transform = `translate3d(${x}px, ${y}px, 0)`;
}

async function moveTo(target, { dx = 0, dy = 0 } = {}) {
  const el = $(target);
  if (!el) return null;
  const r0 = el.getBoundingClientRect();
  if (r0.top < 70 || r0.bottom > innerHeight - 140) {
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    await sleep(500);
  }
  const r = el.getBoundingClientRect();
  setCursor(r.left + r.width / 2 + dx, r.top + r.height / 2 + dy);
  await sleep(820);
  return el;
}

async function click(target, opts) {
  const el = await moveTo(target, opts);
  if (!el) return null;
  const ring = document.createElement('i');
  ring.className = 'robot-click';
  ring.style.cssText = `left:${cur.x}px;top:${cur.y}px`;
  ui.root.append(ring);
  setTimeout(() => ring.remove(), 700);
  await sleep(160);
  el.click();
  await sleep(260);
  return el;
}

async function type(target, text) {
  const el = await moveTo(target);
  if (!el) return;
  el.focus();
  el.dispatchEvent(new Event('focusin', { bubbles: true }));
  for (const ch of text) {
    el.value += ch;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(95);
  }
  await sleep(300);
}

function clear(target) {
  const el = $(target);
  if (!el) return;
  el.value = '';
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.blur();
  el.dispatchEvent(new Event('focusout', { bubbles: true }));
}

// Drag a board card to a column with the real pointer handlers.
async function drag(card, column) {
  const c = await moveTo(card);
  const col = $(column);
  if (!c || !col) return;
  ui.shield.style.pointerEvents = 'none';
  const a = c.getBoundingClientRect();
  const b = col.querySelector('.kcol-body').getBoundingClientRect();
  const sx = a.left + a.width / 2;
  const sy = a.top + a.height / 2;
  const tx = b.left + b.width / 2;
  const ty = b.top + 110;
  c.dispatchEvent(new PointerEvent('pointerdown', { clientX: sx, clientY: sy, button: 0, bubbles: true, pointerId: 1 }));
  const n = 30;
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const e = t * t * (3 - 2 * t);
    const x = sx + (tx - sx) * e;
    const y = sy + (ty - sy) * e - Math.sin(Math.PI * t) * 40;
    setCursor(x, y, { instant: true });
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: x, clientY: y, bubbles: true, cancelable: true, pointerId: 1 }));
    await sleep(26);
  }
  await sleep(250);
  window.dispatchEvent(new PointerEvent('pointerup', { clientX: tx, clientY: ty, bubbles: true, pointerId: 1 }));
  ui.shield.style.pointerEvents = '';
  ui.cursor.style.transition = '';
  await sleep(1400);
}

function spot(target, pad = 10) {
  const el = target ? $(target) : null;
  const s = ui.spot;
  if (!el) return void s.classList.remove('on');
  const r = el.getBoundingClientRect();
  s.style.cssText = `left:${r.left - pad}px;top:${r.top - pad}px;width:${r.width + pad * 2}px;height:${r.height + pad * 2}px`;
  s.classList.add('on');
}

// A subtitle: title + text, with the companion talking. Waits long enough to read it.
async function say(title, text, { mood = 'idle', target = null, hold } = {}) {
  spot(target);
  ui.title.textContent = title;
  ui.text.textContent = text;
  ui.pet.innerHTML = petSvg(petOf(S.profile), { size: 74, mood }).toString();
  ui.caption.classList.remove('swap');
  void ui.caption.offsetWidth;
  ui.caption.classList.add('swap');
  await sleep(hold ?? Math.max(2400, text.length * 52));
}

// ---------- The script ----------

const STEPS = 11;
async function script() {
  const name = (S.profile.name || '').split(' ')[0] || 'toi';
  const step = (n) => (ui.count.textContent = `${n} / ${STEPS}`);
  const safe = async (fn) => {
    try {
      await fn();
    } catch (e) {
      if (e instanceof Abort) throw e;
      console.warn('démo:', e);
    }
  };

  step(1);
  await say(`Salut ${name} !`, 'Je vais te montrer Mitady en vrai, avec des offres d’exemple. Je fais tout à ta place, regarde. Tes vraies données ne seront pas touchées.', { mood: 'wave', hold: 4600 });

  step(2);
  await safe(async () => {
    go('#/');
    await waitFor('.stats');
    await sleep(900);
    await say('Ton tableau de bord', 'Ici, l’essentiel d’un coup d’œil : ce qui reste à traiter, tes candidatures envoyées, tes entretiens et ton taux de réponse.', { target: '.stats', mood: 'idle' });
  });

  step(3);
  await safe(async () => {
    go('#/offres');
    await waitFor('#list .item');
    spot(null);
    await sleep(500);
    await say('Toutes les offres au même endroit', 'LinkedIn, Indeed, HelloWork, Welcome to the Jungle, France Travail… Une même offre trouvée sur plusieurs sites n’apparaît qu’une fois.', { target: '#list', mood: 'idle' });
    await say('Une barre de recherche vivante', 'Regarde mon petit camarade sur la barre : il se réveille quand j’écris, et suit mon texte des yeux.', { target: '.search-field', mood: 'wave', hold: 1800 });
    await type('#q', 'analyste');
    await sleep(1400);
    clear('#q');
    await say('Le score de correspondance', 'Chaque offre a un score, calculé avec tes compétences et celles demandées par l’annonce. Le vert, c’est une très bonne piste.', { target: '#list .item .mini-ring', mood: 'idle' });
  });

  step(4);
  await safe(async () => {
    await click('#list a.item');
    await waitFor('.sheet.open .match');
    await sleep(600);
    await say('La fiche d’une offre', 'Je vois ce que tu maîtrises (en vert) et ce qu’il te manque (en pointillés).', { target: '.sheet.open .match', mood: 'idle' });
    const chip = $('.sheet.open [data-skill]');
    if (chip) {
      await say('Une compétence qui manque ?', 'Si tu la maîtrises vraiment, un clic l’ajoute à ton profil : tous les scores se mettent à jour.', { target: chip, mood: 'idle', hold: 1800 });
      await click(chip);
      await sleep(1600);
    }
  });

  step(5);
  await safe(async () => {
    await click('.sheet.open [data-tab="cv"]');
    await waitFor('#template');
    await sleep(500);
    await say('Ton CV, au choix', 'Soit ton CV tel quel, soit ton Word adapté à l’offre, soit un modèle Mitady. Dans tous les cas, il est livré en PDF.', { target: '#template', mood: 'idle', hold: 4200 });
    await click('#template [data-v="builtin"]');
    await waitFor('#preview', 2500);
    await sleep(1200);
    await say('Un aperçu en direct', 'Le titre est accordé à ton genre, et je mets en avant les compétences que l’annonce demande.', { target: '.sheet.open .preview', mood: 'idle', hold: 3600 });
    await click('#generate');
    await sleep(2800);
  });

  step(6);
  await safe(async () => {
    await click('.sheet.open [data-tab="candidature"]');
    await waitFor('#to');
    await sleep(600);
    await say('La candidature', 'Je trouve un contact, je devine son e-mail, et le message est prêt avec ton CV en pièce jointe.', { target: '.sheet.open .sheet-body', mood: 'idle', hold: 3800 });
    const send = $('#send');
    if (send && !send.disabled) {
      await click('#send');
      await sleep(2800);
    }
  });

  step(7);
  await safe(async () => {
    go('#/suivi');
    await waitFor('.kcard');
    await sleep(800);
    await say('Le suivi, colonne par colonne', 'Tu fais glisser une offre d’une colonne à l’autre. Regarde.', { target: '#board', mood: 'idle', hold: 2400 });
    spot(null);
    await drag('.kcol[data-status="todo"] .kcard', '.kcol[data-status="applied"]');
    await say('Postulé !', 'La carte change de colonne, le statut est enregistré et on fête ça.', { mood: 'party', hold: 2200 });
    await drag('.kcol[data-status="todo"] .kcard', '.kcol[data-status="interview"]');
    await sleep(900);
  });

  step(8);
  await safe(async () => {
    await say('Clair ou sombre', 'Un clic sur le soleil et la page bascule en mode sombre.', { target: '[data-theme-toggle]', mood: 'idle', hold: 1800 });
    const toggle = $('.nav [data-theme-toggle]');
    await click(toggle);
    await sleep(2200);
    await click(toggle);
    await sleep(1400);
  });

  step(9);
  await safe(async () => {
    spot(null);
    await say('Lancer une recherche', 'Un clic sur « Chercher des offres » : mes amis partent sur tous les sites et jouent à saute-mouton avec les logos pendant ce temps.', { target: '#search-btn', mood: 'idle', hold: 3400 });
    await click('#search-btn');
    await waitFor('.srch', 3000);
    await sleep(4300);
    await say('Tu peux l’arrêter', 'Si ça dure trop, « Arrêter la recherche » garde ce qui a déjà été trouvé.', { target: '#srch-stop', mood: 'idle', hold: 2600 });
    spot(null);
    await waitFor('#srch-see', 14000);
    await sleep(1800);
    await click('#srch-see');
    await sleep(900);
  });

  step(10);
  await safe(async () => {
    go('#/profil');
    await waitFor('#avatar-editor .pet-opt');
    await sleep(700);
    await say('Ton animal', 'Choisis ton animal, sa couleur, un accessoire et, si tu veux, un nom. Il se perche sur tes barres de recherche, dort quand tu es ailleurs et réagit quand tu le touches.', { target: '#avatar-editor', mood: 'idle', hold: 4200 });
    await click('#avatar-editor .pet-opt[data-v="renard"]');
    await sleep(500);
    await click('#avatar-editor [data-k="accessory"] [data-v="fete"]');
    await sleep(1600);
    await sleep(900); // let the edit settle before the real profile comes back
  });

  step(11);
  go('#/');
  await sleep(600);
  celebrate({ y: innerHeight * 0.4, count: 160, power: 1.3 });
  await say('À toi de jouer !', 'Voilà l’essentiel. Le bouton « ? » en haut te permet de revoir cette démo quand tu veux.', { mood: 'party', hold: 4200 });
}

// ---------- Setup and teardown ----------

function build() {
  const root = document.createElement('div');
  root.className = 'robot';
  root.innerHTML = html`
    <div class="robot-shield" id="rb-shield"></div>
    <div class="robot-spot" id="rb-spot"></div>
    <div class="robot-cursor" id="rb-cursor"><svg width="26" height="30" viewBox="0 0 26 30"><path d="M3 2v22l6-5 4 9 4-2-4-9h8L3 2Z" fill="#fff" stroke="#241a3a" stroke-width="2" stroke-linejoin="round"/></svg></div>
    <div class="robot-caption" id="rb-caption">
      <span class="robot-pet" id="rb-pet"></span>
      <div class="robot-words"><b id="rb-title"></b><p id="rb-text"></p></div>
      <div class="robot-controls"><span class="robot-count" id="rb-count"></span><button id="rb-pause">Pause</button><button id="rb-quit">Quitter</button></div>
    </div>`.toString();
  document.body.append(root);
  const q = (id) => root.querySelector(id);
  return { root, shield: q('#rb-shield'), spot: q('#rb-spot'), cursor: q('#rb-cursor'), caption: q('#rb-caption'), pet: q('#rb-pet'), title: q('#rb-title'), text: q('#rb-text'), count: q('#rb-count'), pause: q('#rb-pause'), quit: q('#rb-quit') };
}

export async function startDemo() {
  if (active) return;
  active = true;
  aborted = false;
  paused = false;

  // Swap in sample data; the real ones come back at the end.
  const real = { profile: S.profile, applications: S.applications, secrets: S.secrets };
  apps = sampleApps();
  S.applications = clone(apps);
  S.profile = {
    ...clone(S.profile),
    name: S.profile.name || 'Camille Martin',
    headline: S.profile.headline || 'Étudiante en Master Cybersécurité',
    summary: S.profile.summary || 'Étudiante rigoureuse, passionnée par la détection des menaces.',
    skills: ['SIEM', 'Splunk', 'Python', 'Linux', 'Wireshark', 'MITRE ATT&CK', 'Anglais'],
    cvFile: { name: 'MonCV.docx', type: 'docx', path: 'demo' },
    cvMode: 'app',
    search: { ...S.profile.search, domain: S.profile.search.domain || 'cyber', contracts: ['Alternance', 'Stage'] },
  };
  S.secrets = { ...S.secrets, smtp: { ...S.secrets.smtp, user: 'demo@mitady.app', hasPass: true } };
  hooks.demo = demoApi;
  hooks.fakeSearch = fakeSearch;
  document.body.classList.add('demo');
  ui = build();
  refreshNav();

  const quit = () => {
    aborted = true;
  };
  ui.quit.addEventListener('click', quit);
  ui.pause.addEventListener('click', () => {
    paused = !paused;
    ui.pause.textContent = paused ? 'Reprendre' : 'Pause';
    ui.root.classList.toggle('paused', paused);
  });
  const key = (e) => {
    if (e.key === 'Escape') quit();
    if (e.key === ' ' && e.target === document.body) {
      e.preventDefault();
      ui.pause.click();
    }
  };
  document.addEventListener('keydown', key);

  setCursor(innerWidth * 0.5, innerHeight * 0.4, { instant: true });
  let finished = false;
  try {
    await script();
    finished = true;
  } catch (e) {
    if (!(e instanceof Abort)) console.error(e);
  } finally {
    // A profile edit made during the demo is saved 500 ms later: let it land on the sample data first.
    await new Promise((r) => setTimeout(r, 700));
    document.removeEventListener('keydown', key);
    stopFake?.();
    stopFake = null;
    document.querySelector('.srch')?.remove();
    document.body.classList.remove('ob-open');
    ui.root.classList.add('out');
    setTimeout(() => ui.root.remove(), 500);
    hooks.demo = null;
    hooks.fakeSearch = null;
    S.profile = real.profile;
    S.applications = real.applications;
    S.secrets = real.secrets;
    document.body.classList.remove('demo');
    active = false;
    refreshNav();
    go('#/');
    refreshPage();
    toast(finished ? 'Démo terminée : tes vraies données n’ont pas été touchées.' : 'Démo interrompue. Tes vraies données n’ont pas été touchées.');
  }
}
