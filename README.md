# Candidatures

Un outil local pour chercher un poste sans s'épuiser : il collecte les offres, mesure ta correspondance avec chacune, adapte ton CV à l'offre et envoie ta candidature. Il fonctionne pour tous les domaines : cybersécurité, finance, data, développement, systèmes et réseaux, marketing, RH, commerce, ou tes propres mots-clés.

## Démarrer

```bash
npm run setup   # dépendances + navigateur Chromium (une seule fois)
npm start
```

Ouvre ensuite http://localhost:3000. Le serveur n'écoute que sur ta machine.

Prérequis : Node.js 18 ou plus récent. Python 3 avec `python-docx` est nécessaire uniquement pour importer un CV Word (`pip install python-docx pywin32`) ; la conversion Word → PDF utilise Microsoft Word ou LibreOffice.

## Comment ça marche

1. **Profil** : importe ton CV (PDF ou .docx), ou remplis tes rubriques à la main. Ton identité, ton parcours et tes compétences sont détectés, et tu les corriges si besoin. Choisis ton domaine, le lieu, le type de contrat et tes mots-clés.
2. **Chercher des offres** : l'outil parcourt HelloWork, Welcome to the Jungle et Jobs That Make Sense. Il écarte les organismes de formation qui publient de fausses offres ainsi que les doublons.
3. **Offres** : chaque offre affiche un score de correspondance calculé à partir des compétences citées dans l'annonce. Si l'annonce cite une compétence que tu maîtrises mais qui manque à ton profil, un clic l'y ajoute et les scores se recalculent partout.
4. **CV adapté** : pour chaque offre, tu ajustes le titre (accordé au masculin ou au féminin), le résumé et les compétences mises en avant, avec un aperçu en direct. Tu génères ensuite un PDF :
   - **avec ton propre fichier Word** : la mise en page est conservée à l'identique, et seuls le titre, le paragraphe de profil et les compétences ajoutées changent ;
   - **avec le modèle de l'app** : un format ATS (une colonne, texte réel, sans icône ni tableau). Dans Profil › Mise en page du CV, tu choisis le modèle (Classique, Moderne, Compact), la police, la couleur et la photo.
5. **Candidature** : trouve un contact (profils publics), devine son adresse e-mail selon le format de l'entreprise, puis envoie le message avec le CV adapté joint.
6. **Aujourd'hui** : les relances à faire (après 7 jours sans réponse, réglable), tes meilleures correspondances et tes statistiques.

### Claude (facultatif)

Avec une clé API Claude, ajoutée dans Réglages, l'outil peut :
- lire une offre et en dégager les attentes clés et les points à préparer ;
- proposer un titre et un résumé de CV ciblés ;
- rédiger l'e-mail de candidature ;
- structurer proprement le CV que tu importes.

Tout le reste fonctionne sans clé.

## Données

Tout est stocké en local dans `data/`. Ce dossier est créé au premier lancement et n'est jamais commité : chaque personne qui clone le projet part d'un profil vide.

| Fichier | Contenu |
| --- | --- |
| `data/db.json` | Profil, réglages et candidatures |
| `data/secrets.json` | Mot de passe d'application e-mail et clé API |
| `data/uploads/` | CV importé et photo |
| `data/cvs/` | CV générés |

Pour essayer l'app avec un profil vide sans toucher au tien : `DATA_DIR=/chemin/vers/un/dossier npm start`.

L'export Excel se fait depuis Offres › Exporter.

## Structure

```
server/
  index.js        API Express
  lib/store.js    persistance JSON
  lib/skills.js   domaines, dictionnaires de compétences, score
  lib/cv.js       import, analyse et génération de CV
  lib/scraper.js  collecte d'offres et recherche de contacts
  lib/ai.js       fonctions Claude
  lib/mailer.js   envoi SMTP
scripts/docx_tools.py   lecture et adaptation d'un CV Word
public/                 interface (HTML, CSS, modules JS sans build)
```
