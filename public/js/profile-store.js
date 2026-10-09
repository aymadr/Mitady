// Everything the CV page and the Profil page share: each profile edit goes through update() (local state first,
// then a debounced save), and a CV file is read, parsed and merged into the profile without overwriting what was typed.
import { S } from './main.js';
import { studioChanged } from './views/cv-studio.js';
import { api, fail, toast, debounce, busy, fileToBase64, norm } from './lib.js';

let saveState = null;
// The page tells where to write "Enregistré".
export const setSaveIndicator = (el) => { saveState = el; };
let queued = {};
const flush = debounce(async () => {
  const patch = queued;
  queued = {};
  try {
    const res = await api('/profile', { method: 'PUT', body: patch });
    S.profile = { ...res.profile, ...queued }; // keep edits made while saving
    S.applications = res.applications;
    if (saveState) saveState.textContent = 'Enregistré';
  } catch (e) {
    fail(e);
  }
}, 500);

// Every edit goes through here: local state first, then a debounced save.
export function update(patch) {
  Object.assign(S.profile, patch);
  queued = { ...queued, ...patch };
  if (saveState) saveState.textContent = 'Enregistrement…';
  flush();
  studioChanged(patch);
}

// Merges parsed CV data into the profile without overwriting what the user typed.
// With overwrite (a CV replacing another one), the new CV wins; skills that were
// not in the previous CV text were added by hand and are kept.
export function applyParsed(parsed, { overwrite = false, previousText = null } = {}) {
  const p = S.profile;
  const pick = (k) => (overwrite ? parsed[k] || p[k] : p[k] || parsed[k]);
  const fromCv = parsed.skills || [];
  const previous = previousText === null ? null : norm(previousText);
  const kept = previous === null ? p.skills : p.skills.filter((s) => !previous.includes(norm(s)));
  const known = new Set(fromCv.map(norm));
  const next = {
    name: pick('name'),
    headline: pick('headline'),
    email: pick('email'),
    phone: pick('phone'),
    location: pick('location'),
    summary: pick('summary'),
    links: overwrite ? (parsed.links?.length ? parsed.links : p.links) : p.links?.length ? p.links : parsed.links || [],
    skills: [...fromCv, ...kept.filter((s) => !known.has(norm(s)))],
    sections: overwrite || !p.sections.length ? parsed.sections || p.sections : p.sections,
  };
  if (next.sections !== p.sections) next.cvManaged = false; // the editor re-adds ids and the skills section
  // Pre-fills the Word template settings: the exact headline and profile paragraph
  // to swap, and where added skills go.
  const d = p.docx || {};
  next.docx = {
    titleText: overwrite || !d.titleText ? next.headline : d.titleText,
    summaryText: overwrite || !d.summaryText ? parsed.summary || d.summaryText || '' : d.summaryText,
    skillsAnchor: overwrite || !d.skillsAnchor ? parsed.skillsAnchor || d.skillsAnchor || '' : d.skillsAnchor,
  };
  update(next);
  return { fromCv: fromCv.length, kept: kept.filter((s) => !known.has(norm(s))).length };
}

// `rerender` redraws the page once a CV has been read.
export function bindUpload(view, rerender) {
  const input = view.querySelector('#file');
  const drop = view.querySelector('#drop');
  const upload = async (file) => {
    if (!file) return;
    if (!/\.(pdf|docx)$/i.test(file.name)) return toast('Choisis un PDF ou un fichier .docx.', { error: true });
    toast('Lecture du CV…');
    try {
      const replacing = Boolean(S.profile.cvFile);
      const res = await api('/profile/cv', { method: 'POST', body: { name: file.name, data: await fileToBase64(file) } });
      S.profile = res.profile;
      const { fromCv, kept } = applyParsed(res.parsed, replacing ? { overwrite: true, previousText: res.previousText } : {});
      toast(`CV importé · ${fromCv} compétences lues${kept ? `, ${kept} ajoutée${kept > 1 ? 's' : ''} à la main conservée${kept > 1 ? 's' : ''}` : ''}. Vérifie ton profil.`);
      setTimeout(rerender, 600);
    } catch (e) {
      fail(e);
    }
  };
  input.addEventListener('change', () => upload(input.files[0]));
  view.querySelector('#replace')?.addEventListener('click', () => input.click());
  if (drop) {
    drop.addEventListener('click', () => input.click());
    drop.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && input.click());
    drop.addEventListener('dragover', (e) => {
      e.preventDefault();
      drop.classList.add('over');
    });
    drop.addEventListener('dragleave', () => drop.classList.remove('over'));
    drop.addEventListener('drop', (e) => {
      e.preventDefault();
      drop.classList.remove('over');
      upload(e.dataTransfer.files[0]);
    });
  }
  view.querySelector('#ai-parse')?.addEventListener('click', (e) =>
    busy(e.currentTarget, async () => {
      if (!confirm('Claude va relire ton CV et remplacer ton identité, ton résumé et ton parcours. Tes compétences sont conservées et complétées. Continuer ?')) return;
      try {
        const { parsed } = await api('/profile/cv/ai', { method: 'POST' });
        applyParsed(parsed, { overwrite: true });
        toast('Profil mis à jour depuis ton CV');
        setTimeout(rerender, 600);
      } catch (err) {
        fail(err);
      }
    }),
  );
}
