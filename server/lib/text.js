// Text helpers shared by the server.

const TO_MASC = {
  alternante: 'alternant', apprentie: 'apprenti', 'ingénieure': 'ingénieur', collaboratrice: 'collaborateur',
  directrice: 'directeur', animatrice: 'animateur', administratrice: 'administrateur', 'chargée': 'chargé',
  analyste: 'analyste', consultante: 'consultant', 'développeuse': 'développeur', gestionnaire: 'gestionnaire',
  technicienne: 'technicien', assistante: 'assistant', responsable: 'responsable', auditrice: 'auditeur',
  commerciale: 'commercial', juriste: 'juriste', stagiaire: 'stagiaire', contrôleuse: 'contrôleur',
};
const TO_FEM = Object.fromEntries(Object.entries(TO_MASC).map(([f, m]) => [m, f]));

// Cleans an offer title for use as a CV headline: drops "(H/F)" markers,
// inclusive-writing suffixes, and agrees the title with the chosen gender.
function adaptTitle(title, gender = 'neutre') {
  if (!title) return '';
  let res = title
    .replace(/\s*[([]?\s*\b(f\s*\/\s*h|h\s*\/\s*f|f\s*\/\s*m|m\s*\/\s*f)(\s*\/\s*[xn])?\b\s*[)\]]?/gi, '')
    .replace(/\(e\)|\(es\)/gi, '')
    .replace(/[.·]e(s)?\b/gi, '')
    .replace(/(eur)[.·/]?(rice|euse)\b/gi, '$1');

  if (gender !== 'neutre') {
    const map = gender === 'feminin' ? TO_FEM : TO_MASC;
    res = res.replace(/[\p{L}]+/gu, (w) => {
      const mapped = map[w.toLowerCase()];
      if (!mapped) return w;
      return w[0] === w[0].toUpperCase() ? mapped[0].toUpperCase() + mapped.slice(1) : mapped;
    });
  }
  return res.replace(/\s{2,}/g, ' ').replace(/\s+([,-])\s*$/, '').trim();
}

function slug(str, max = 60) {
  return String(str)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, max);
}

function escapeHtml(s = '') {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function fill(template, vars) {
  return String(template || '').replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => (vars[k] ?? '').toString());
}

module.exports = { adaptTitle, slug, escapeHtml, fill };
