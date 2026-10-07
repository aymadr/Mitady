// Text helpers shared by the server.

// Masculine / feminine pairs of job-title words. Invariable words (analyste, responsable,
// gestionnaire, stagiaire, chef de projet…) need no entry.
const PAIRS = [
  ['alternant', 'alternante'], ['apprenti', 'apprentie'], ['ingénieur', 'ingénieure'], ['collaborateur', 'collaboratrice'],
  ['directeur', 'directrice'], ['animateur', 'animatrice'], ['administrateur', 'administratrice'], ['chargé', 'chargée'],
  ['consultant', 'consultante'], ['développeur', 'développeuse'], ['technicien', 'technicienne'], ['assistant', 'assistante'],
  ['auditeur', 'auditrice'], ['contrôleur', 'contrôleuse'], ['conseiller', 'conseillère'], ['coordinateur', 'coordinatrice'],
  ['formateur', 'formatrice'], ['recruteur', 'recruteuse'], ['chercheur', 'chercheuse'], ['rédacteur', 'rédactrice'],
  ['vendeur', 'vendeuse'], ['commercial', 'commerciale'], ['expert', 'experte'], ['agent', 'agente'], ['acheteur', 'acheteuse'],
  ['programmeur', 'programmeuse'], ['opérateur', 'opératrice'], ['superviseur', 'superviseuse'], ['intégrateur', 'intégratrice'],
  ['employé', 'employée'], ['ambassadeur', 'ambassadrice'], ['concepteur', 'conceptrice'], ['instructeur', 'instructrice'],
  ['étudiant', 'étudiante'], ['diplômé', 'diplômée'], ['délégué', 'déléguée'], ['préparateur', 'préparatrice'],
  ['producteur', 'productrice'], ['président', 'présidente'], ['adjoint', 'adjointe'], ['gérant', 'gérante'],
  ['traducteur', 'traductrice'], ['créateur', 'créatrice'], ['éditeur', 'éditrice'], ['monteur', 'monteuse'],
  ['serveur', 'serveuse'], ['cuisinier', 'cuisinière'], ['infirmier', 'infirmière'], ['pâtissier', 'pâtissière'],
  ['boulanger', 'boulangère'], ['ouvrier', 'ouvrière'], ['électricien', 'électricienne'], ['mécanicien', 'mécanicienne'],
  ['trésorier', 'trésorière'], ['analyste-programmeur', 'analyste-programmeuse'], ['administratif', 'administrative'],
  ['marketeur', 'marketeuse'], ['pilote', 'pilote'],
];
const TO_MASC = Object.fromEntries(PAIRS.map(([m, f]) => [f, m]));
const TO_FEM = Object.fromEntries(PAIRS.map(([m, f]) => [m, f]));

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
