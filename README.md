# Mitady

*Mitady* veut dire « chercher » en malgache. Un outil local pour chercher un poste sans s'épuiser : il collecte les offres, mesure ta correspondance avec chacune, adapte ton CV à l'offre et envoie ta candidature. Il fonctionne pour tous les domaines : cybersécurité, finance, data, développement, systèmes et réseaux, marketing, RH, commerce, ou tes propres mots-clés.

## Démarrer

Aucun éditeur de code ni ligne de commande : télécharge le projet (bouton vert **Code › Download ZIP** sur GitHub), décompresse-le, puis double-clique sur :

| Système | Fichier |
| --- | --- |
| Windows | `Lancer.bat` |
| Mac | `Lancer.command` (au premier lancement : clic droit › Ouvrir) |
| Linux | `lancer.sh` |

Au premier lancement, l'outil installe tout seul ce qui manque (quelques minutes, une seule fois), puis ouvre l'application dans ton navigateur. Les fois suivantes, elle s'ouvre en quelques secondes. Pour arrêter, ferme la fenêtre noire.

Le seul prérequis est [Node.js](https://nodejs.org) 18 ou plus récent : sous Windows, `Lancer.bat` l'installe pour toi s'il manque. Python 3 est facultatif : il ne sert qu'à importer un CV Word, et la conversion Word → PDF utilise Microsoft Word ou LibreOffice.

Le serveur n'écoute que sur ta machine ; tes données restent dans le dossier `data/`.

Pour les développeurs : `npm run setup` puis `npm start`.

## Ton compagnon et l'accord du genre

À l'accueil, tu choisis ton compagnon en pixel art : un animal (chat, chien, renard, lapin, ours, grenouille, pingouin ou hibou), sa couleur, un accessoire et un nom. Il se perche sur le bord des barres de recherche : il dort tant que tu n'écris pas, se réveille quand tu cliques, suit ton texte des yeux, saute sur Entrée et fait une tête perplexe s'il n'y a aucun résultat. Tu le retrouves dans l'en-tête, sur l'accueil et dans les écrans vides. Modifiable dans Profil › Ton compagnon.

Tu indiques aussi si tu es un homme, une femme ou si tu préfères ne pas le préciser : ça accorde l'intitulé du poste sur ton CV. Une offre « Alternant(e) Chargé(e) de projet » devient « Alternant Chargé de projet » ou « Alternante Chargée de projet ».

## Suivi, recherche et petits moments de joie

- **Suivi** : un tableau par étape (À traiter, Envoyées, Entretiens, Offres reçues, Refusées). Tu fais glisser une offre d'une colonne à l'autre ; la carte s'incline et les confettis partent quand tu postules.
- **Recherche** : un écran plein écran où des animaux en pixel art, dont ton compagnon, portent chacun le logo d'un site et jouent à saute-mouton. Quand un site trouve des offres, son animal lance le logo en l'air et le rattrape, avec une bulle « +4 ». Des compteurs montrent offres vues, doublons écartés et nouvelles offres. Tu peux le réduire.
- **Jalons** : une petite fête pour ta première candidature, puis la 5ᵉ, la 10ᵉ, la 25ᵉ et la 50ᵉ, et à chaque entretien ou offre.

## Logos des sites

Chaque site d'emploi a une tuile 3D dessinée par Mitady. Pour afficher les logos officiels à la place, dépose un fichier par site dans `public/logos/` (voir `public/logos/README.md`).

## Apparence

Le bouton soleil / lune en haut à droite bascule entre mode clair et mode sombre (la bascule s'étend en cercle depuis le bouton). Le choix est mémorisé ; sans choix, l'appli suit le réglage de ton ordinateur.

## Comment ça marche

Au tout premier lancement, un guide plein écran en cinq étapes te fait importer ton CV, choisir tes types de contrat, ton domaine et ton lieu, puis lance ta première recherche. Il se rouvre depuis l'écran d'accueil (« Ouvrir le guide pas à pas »).

1. **Profil** : importe ton CV (PDF ou .docx), ou remplis tes rubriques à la main. Ton identité, ton parcours et tes compétences sont détectés, et tu les corriges si besoin. Choisis ton domaine, le lieu, les types de contrat (alternance, stage, CDI, CDD, freelance : plusieurs à la fois) et tes mots-clés.
2. **Chercher des offres** : l'outil parcourt HelloWork, LinkedIn, Indeed, Welcome to the Jungle, Jobs That Make Sense et France Travail (Jobijoba, JobTeaser et L'Étudiant sont disponibles en option). Tu actives ou non chaque site dans Profil › Ce que tu cherches. Il écarte les organismes de formation qui publient de fausses offres. Une même offre publiée sur plusieurs sites, ou sous un titre légèrement différent, n'apparaît qu'une fois ; le bouton « Fusionner les doublons » nettoie aussi les offres déjà enregistrées.
3. **Offres** : chaque offre affiche un score de correspondance calculé à partir des compétences citées dans l'annonce. Si l'annonce cite une compétence que tu maîtrises mais qui manque à ton profil, un clic l'y ajoute et les scores se recalculent partout.
4. **CV** : tout CV est livré **en PDF**. Dans Profil › Ton CV tu choisis ce qui part par défaut, et tu peux changer pour chaque offre :
   - **Mon CV tel quel** : ton fichier, sans aucun changement (un Word est converti en PDF) ;
   - **Mon Word adapté** : la mise en page de ton fichier Word est conservée, seuls le titre, le paragraphe de profil et les compétences ajoutées changent ;
   - **Modèle de l'app** : ton parcours est mis en page avec l'un des 7 modèles (Classique, Moderne, Compact, Élégant, Minimal en format ATS, une colonne et texte réel ; Bandeau et Colonne latérale, plus visuels), avec police, couleur et photo (carrée ou ronde, importée par toi ou reprise de ton Word).
   Pour chaque offre, tu ajustes le titre (accordé au masculin ou au féminin), le résumé et les compétences mises en avant, avec un aperçu en direct.
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
  lib/scraper.js  collecte d'offres (sites, contrats) et recherche de contacts
  lib/dedupe.js   détection des doublons entre sites
  lib/ai.js       fonctions Claude
  lib/mailer.js   envoi SMTP
scripts/docx_tools.py   lecture et adaptation d'un CV Word
public/                 interface (HTML, CSS, modules JS sans build)
```
