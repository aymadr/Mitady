// Optional Claude features. Enabled when an API key is saved in Réglages
// (or ANTHROPIC_API_KEY is set). Everything else in the app works without it.
const Anthropic = require('@anthropic-ai/sdk');
const store = require('./store');
const { sectionText } = require('./cv');

const MODEL = 'claude-opus-5';

function client() {
  const apiKey = store.getSecrets().anthropicKey || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('Ajoute une clé API Claude dans Réglages pour utiliser cette fonction.');
  return new Anthropic({ apiKey });
}

function isEnabled() {
  return Boolean(store.getSecrets().anthropicKey || process.env.ANTHROPIC_API_KEY);
}

async function ask({ system, prompt, schema, effort = 'medium' }) {
  let response;
  try {
    response = await client().beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      thinking: { type: 'adaptive' },
      output_config: { effort, format: { type: 'json_schema', schema } },
      system,
      messages: [{ role: 'user', content: prompt }],
    });
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) throw new Error('Clé API Claude invalide. Vérifie-la dans Réglages.');
    if (e instanceof Anthropic.RateLimitError) throw new Error('Limite d\'utilisation de Claude atteinte, réessaie dans une minute.');
    if (e instanceof Anthropic.APIConnectionError) throw new Error('Impossible de joindre Claude. Vérifie ta connexion.');
    throw e;
  }
  if (response.stop_reason === 'refusal') throw new Error('Claude a refusé cette demande.');
  if (response.stop_reason === 'max_tokens') throw new Error('Réponse de Claude tronquée, réessaie.');
  const text = response.content.find((b) => b.type === 'text')?.text;
  if (!text) throw new Error('Réponse vide de Claude.');
  return JSON.parse(text);
}

const str = { type: 'string' };
const strList = { type: 'array', items: str };

function profileBlock(profile) {
  return [
    `Nom : ${profile.name}`,
    `Titre actuel : ${profile.headline}`,
    `Résumé : ${profile.summary}`,
    `Compétences : ${(profile.skills || []).join(', ')}`,
    ...(profile.sections || []).map((s) => `## ${s.title}\n${sectionText(s)}`),
  ].join('\n');
}

// Reads an offer against the profile and proposes CV + e-mail content.
async function tailor(app, profile) {
  const genderRule = {
    masculin: 'Accorde le titre au masculin.',
    feminin: 'Accorde le titre au féminin.',
    neutre: 'Garde un titre épicène si possible.',
  }[profile.titleGender || 'neutre'];

  return ask({
    system:
      "Tu aides un candidat à adapter sa candidature à une offre d'emploi, en français. " +
      "N'invente jamais d'expérience, de diplôme ni de compétence : reformule et mets en avant uniquement ce que le profil contient. " +
      'Une compétence de l\'offre ne peut aller dans skillsToAdd que si le profil montre qu\'elle est réellement pratiquée (projet, expérience, outil proche).',
    prompt: `<profil>\n${profileBlock(profile)}\n</profil>\n\n<offre>\nPoste : ${app.title}\nEntreprise : ${app.company}\nLieu : ${app.location}\n\n${app.description}\n</offre>\n\n` +
      `Produis :\n- headline : le titre du CV pour ce poste, court, sans (H/F). ${genderRule}\n` +
      '- summary : 2 à 3 phrases de profil ciblées sur cette offre, à la première personne, sans formule creuse.\n' +
      "- requirements : les 3 à 6 attentes clés de l'offre, en quelques mots chacune.\n" +
      '- skillsToAdd : compétences demandées par l\'offre, absentes de la liste « Compétences » mais justifiées par le parcours.\n' +
      '- gaps : attentes de l\'offre que le profil ne couvre pas (pour que le candidat sache quoi préparer).\n' +
      "- emailSubject et emailBody : un e-mail de candidature court (120 mots max), direct, signé avec le nom du candidat. Commence par « Bonjour, » sauf si un contact est connu : " +
      (app.contact?.name || 'aucun') + '.',
    schema: {
      type: 'object',
      properties: {
        headline: str, summary: str, requirements: strList, skillsToAdd: strList, gaps: strList, emailSubject: str, emailBody: str,
      },
      required: ['headline', 'summary', 'requirements', 'skillsToAdd', 'gaps', 'emailSubject', 'emailBody'],
      additionalProperties: false,
    },
  });
}

// Turns raw CV text into structured profile fields.
async function parseCv(text) {
  return ask({
    system: 'Tu extrais les informations d\'un CV en JSON, fidèlement, sans rien inventer. Conserve la langue du CV.',
    prompt:
      `<cv>\n${text}\n</cv>\n\nRemplis les champs. sections : les rubriques du CV hors profil et compétences (Expérience, Formation, Projets, Certifications, Langues…), ` +
      'chaque body en texte brut : une ligne d\'en-tête par entrée (intitulé, organisation, dates, lieu) suivie de ses points, chaque point commençant par « - ». ' +
      'skills : compétences techniques et outils, un élément par compétence, sans doublon.',
    schema: {
      type: 'object',
      properties: {
        name: str, headline: str, email: str, phone: str, location: str, links: strList, summary: str, skills: strList,
        sections: {
          type: 'array',
          items: { type: 'object', properties: { title: str, body: str }, required: ['title', 'body'], additionalProperties: false },
        },
      },
      required: ['name', 'headline', 'email', 'phone', 'location', 'links', 'summary', 'skills', 'sections'],
      additionalProperties: false,
    },
  });
}

module.exports = { isEnabled, tailor, parseCv };
