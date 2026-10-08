# Tests à faire sur ton ordinateur

Ce fichier sert à tout vérifier **sur ton vrai PC**, avec une vraie connexion. Il est écrit pour que tu puisses le suivre seul, ou le donner à une nouvelle session Claude.

> **Règle : ne rien modifier dans le code avant d'avoir le compte rendu** (dernière section). Les tests servent à savoir ce qui marche vraiment ; on corrigera ensuite, avec les résultats sous les yeux.

## Pourquoi ces tests

Le code a été écrit et vérifié dans un environnement **sans accès aux sites d'offres** (réseau restreint). Ce qui a été essayé là-bas, et ce qui ne l'a pas été :

| | Vérifié | Pas vérifié |
|---|---|---|
| Filtrage des offres (périmètre, télétravail, date, score) | 8 tests automatiques (`npm test`) | |
| Liste des communes et distances | Lyon–Villeurbanne 3 km, Lyon–Paris 390 km, 30 formes d'adresses | |
| Site sur écran de téléphone | Chromium émulé (390, 360, 430, 768, 1024 px) | **Un vrai iPhone** |
| Appui long pour déplacer une carte du suivi | Toucher simulé | **Un vrai doigt** |
| Accès téléphone : code, QR, réouverture de l'adresse | Requêtes simulées (`curl`) | **Un vrai téléphone sur le Wi-Fi**, le pare-feu |
| Collecte sur HelloWork, LinkedIn, Indeed, WTTJ, JTMS, France Travail | | **Tout** : jamais lancée pour de vrai |
| Paramètres envoyés aux sites (`ray`, `distance`, `radius`, `fromage`, `f_TPR`, `f_WT`) | | **Tout** : noms et unités supposés |
| Son de la présentation dans Safari / Chrome | Lecture et synchronisation en Chromium | Safari (le son y exige un clic) |

## 0. Mise en route

Il faut **Node.js 18 ou plus** (https://nodejs.org). Ensuite, dans un terminal, au choix :

**Si le projet est déjà sur ton PC**
```bash
cd Alternance-Automatisation
git fetch origin
git checkout claude/funny-ritchie-uk55hl     # ou "main" si la PR a été fusionnée depuis
git pull
npm run setup                                 # dépendances + navigateur Chromium (une fois)
```

**Sinon**
```bash
git clone https://github.com/aymadr/Alternance-Automatisation.git
cd Alternance-Automatisation
git checkout claude/funny-ritchie-uk55hl
npm run setup
```

**Utilise des données de test**, pour ne pas mélanger avec les tiens :

| Système | Commande |
|---|---|
| Mac / Linux | `DATA_DIR=~/mitady-test npm start` |
| Windows PowerShell | `$env:DATA_DIR="$HOME\mitady-test"; npm start` |
| Windows (cmd) | `set "DATA_DIR=%USERPROFILE%\mitady-test" && npm start` |

Puis ouvre http://localhost:3000. Garde le terminal visible : les erreurs s'y affichent.

- [ ] `npm test` affiche **8 réussis, 0 échec**
- [ ] `npm start` démarre sans erreur et la page s'ouvre
- [ ] Si « Executable doesn't exist » apparaît : `npx playwright install chromium`

## 1. La collecte d'offres (le plus important)

C'est la partie jamais essayée pour de vrai. Le plus simple pour obtenir un journal complet est de passer par le terminal.

**Crée un fichier `essai-recherche.js` à la racine du projet** (ne pas l'ajouter à git) avec ce contenu :

```js
// Lance UNE recherche depuis le terminal et affiche tout le journal. N'écrit rien dans tes données.
// Usage :  node essai-recherche.js                 (les sites cochés dans ton profil)
//          node essai-recherche.js hellowork       (un seul site)
//          node essai-recherche.js hellowork,linkedin,indeed
const scraper = require('./server/lib/scraper');
const store = require('./server/lib/store');

const profile = store.db.profile;
if (process.argv[2]) profile.search.sources = process.argv[2].split(',');
console.log('Recherche :', JSON.stringify({ ...profile.search, excluded: undefined }, null, 1));
const t0 = Date.now();
scraper
  .run(profile, store.db.applications, (line) => console.log('·', line), (e) => e.stage !== 'read' && console.log('  [événement]', JSON.stringify(e)))
  .then((jobs) => {
    console.log(`\n=== ${jobs.length} offres en ${Math.round((Date.now() - t0) / 1000)} s ===`);
    for (const j of jobs) console.log([j.source, j.title, j.company, j.location, j.remote || '-', j.postedAt || '-'].join(' | '));
  })
  .catch((e) => console.error('ERREUR :', e.message));
```

**Avant**, dans l'appli (Profil › Ce que tu cherches) : domaine « Cybersécurité » (ou le tien), lieu **Lyon** (ou ta ville), périmètre **30 km**, contrat **Alternance**. Utilise la même variable `DATA_DIR` que pour `npm start`.

### 1.1 Site par site

Lance un site à la fois et remplis le tableau :

```bash
node essai-recherche.js hellowork
node essai-recherche.js linkedin
node essai-recherche.js indeed
node essai-recherche.js wttj
node essai-recherche.js jtms
node essai-recherche.js francetravail
```

| Site | Offres trouvées | Message d'erreur | Les lieux sont corrects ? | Description lue ? |
|---|---|---|---|---|
| HelloWork | | | | |
| LinkedIn | | | | |
| Indeed | | | | |
| Welcome to the Jungle | | | | |
| Jobs That Make Sense | | | | |
| France Travail | | | | |

Comment lire le résultat :
- **0 offre et aucun message** : le site a changé de page ou bloque le navigateur automatique (très courant pour Indeed et LinkedIn). Note-le, ne cherche pas à corriger toi-même.
- **Des offres mais lieux vides ou faux** : à signaler avec un exemple.
- **« Executable doesn't exist »** : `npx playwright install chromium`.

### 1.2 Le périmètre fonctionne-t-il ?

Même recherche (un site qui marche, par exemple HelloWork), en changeant **seulement** le rayon dans l'appli. Note le nombre d'offres à la fin :

| Rayon | Offres | Ligne « hors périmètre » dans le journal |
|---|---|---|
| 10 km | | |
| 50 km | | |
| Toute la France | | |

- [ ] Le nombre d'offres **augmente** avec le rayon
- [ ] Avec 10 km, aucune offre ne vient d'une ville à plus de 10 km (vérifie 3 offres au hasard)
- [ ] Le journal contient « N offres hors périmètre » quand le rayon est petit

### 1.3 Les autres réglages

À chaque fois, une seule chose change par rapport à la recherche de base :

- [ ] **Deux lieux** (Lyon + Paris) : le journal montre les recherches pour chaque lieu
- [ ] **Télétravail « Complet »** : les offres gardées parlent bien de 100 % à distance
- [ ] **Télétravail « Possible »** : elles mentionnent le télétravail
- [ ] **Publiées depuis « La dernière semaine »** : les offres LinkedIn et Indeed sont récentes (la date n'est connue que de certains sites)
- [ ] **Correspondance minimale 50 %** : les offres faibles sont écartées (ligne « sous les 50 % » dans le journal)
- [ ] **Offres lues : 30** : pas plus de 30 offres analysées

### 1.4 Dans l'appli

Lance ensuite une recherche normale depuis le bouton « Chercher des offres » :

- [ ] L'écran de recherche avance, les animaux réagissent, il se termine par « N nouvelles offres »
- [ ] Dans **Offres**, chaque offre affiche son lieu et sa distance (« Villeurbanne (3 km) »)
- [ ] Le tri **Proches** apparaît et classe bien
- [ ] Une offre ouverte contient sa description et un score de correspondance
- [ ] Le bouton **Exporter** (Excel) a les colonnes « Distance (km) » et « Télétravail »

### 1.5 Si un site ne renvoie rien : comparer à la main

Ouvre l'adresse que Mitady construit, dans ton navigateur habituel, et compare. Remplace les mots entre `<>`.

| Site | Adresse |
|---|---|
| HelloWork | `https://www.hellowork.com/fr-fr/emploi/recherche.html?k=<mot-clé>&c=Alternance&l=<ville>&ray=<km>` |
| LinkedIn | `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=<mot-clé>%20alternance&location=<ville>&start=0&distance=<miles>&f_TPR=r604800&f_WT=2` |
| Indeed | `https://fr.indeed.com/jobs?q=<mot-clé>%20alternance&l=<ville>&radius=<km>&fromage=7` |
| WTTJ, JTMS, France Travail | passent par un moteur : `https://fr.search.yahoo.com/search?p=site:welcometothejungle.com/fr/companies "alternance" "<mot-clé>" <ville>` |

**Hypothèses à confirmer** (nom ou unité supposés, jamais vérifiés) :
- [ ] HelloWork : le paramètre **`ray`** (en km) change bien le rayon
- [ ] LinkedIn : **`distance`** est en **miles** (Mitady convertit les km), `f_TPR=r<secondes>` filtre la date, `f_WT` (1 sur place, 2 télétravail, 3 hybride) filtre le télétravail
- [ ] Indeed : **`radius`** est en km, **`fromage`** en jours (1, 3, 7, 14)
- [ ] Yahoo renvoie des résultats pour les trois sites passant par un moteur (sinon : zéro offre, sans erreur)

## 2. Le téléphone (iPhone ou Android)

**Prérequis** : le téléphone et le PC sont sur le **même Wi-Fi** (pas un Wi-Fi invité, qui isole souvent les appareils).

### 2.1 Activer l'accès
1. Lance Mitady (`npm start`), ouvre **Réglages › Sur ton téléphone**, clique **Activer l'accès téléphone**.
2. Windows ou Mac demande peut-être d'**autoriser Node** à accepter les connexions : accepte pour les réseaux **privés**.

- [ ] Une adresse du type `http://192.168.x.x:3000` s'affiche, avec un QR code et un code à 6 chiffres
- [ ] Si **plusieurs adresses** s'affichent (Docker, VirtualBox, WSL…), note laquelle fonctionne sur le téléphone, et laquelle est en premier dans la liste (le QR code encode la première)

### 2.2 Se connecter
- [ ] Scanner le **QR code** avec l'appareil photo du téléphone ouvre Mitady, déjà connecté
- [ ] Sinon, taper l'adresse dans Safari demande le **code** ; le bon code ouvre la page
- [ ] **5 mauvais codes** : message « Trop d'essais », blocage 5 minutes
- [ ] **Changer le code** (Réglages sur le PC) : le téléphone doit ressaisir le nouveau
- [ ] **Désactiver** : l'adresse ne répond plus sur le téléphone

### 2.3 L'affichage sur téléphone
Parcours chaque page, en portrait puis en paysage :

- [ ] Barre d'onglets en bas (Aujourd'hui, Offres, Suivi, Profil, Réglages), jamais cachée par la barre du navigateur ni par la zone du bouton d'accueil
- [ ] **Aucun défilement horizontal** de la page (sauf les colonnes du suivi, volontaire)
- [ ] Toucher un champ de texte **ne zoome pas** la page
- [ ] **Suivi** : balayer fait défiler le tableau ; **appui long** sur une carte la soulève (vibration légère sur Android), on la glisse vers une autre colonne ; près du bord de l'écran le tableau défile tout seul
- [ ] Un simple **toucher** sur une carte ouvre l'offre
- [ ] **Profil** : l'éditeur de CV, l'éditeur de photo, la recherche de lieu (suggestions qui s'affichent et se touchent)
- [ ] **Onboarding** complet si tu repars de zéro (`DATA_DIR` vide) : toutes les étapes lisibles, bouton « Continuer » toujours accessible
- [ ] Le **guide** (bouton ?) et la **démo en direct**

### 2.4 L'installer comme une appli
- **iPhone** (dans **Safari** uniquement) : Partager › **Sur l'écran d'accueil**
- **Android** (Chrome) : menu ⋮ › **Installer l'application**

- [ ] L'icône (le koala) apparaît avec le nom « Mitady »
- [ ] Ouverte depuis l'écran d'accueil, l'appli est en **plein écran** (sans barre d'adresse)
- [ ] Elle te **redemande le code** ou reste connectée ? (note ce qui se passe : sur iPhone, l'appli d'écran d'accueil peut ne pas partager la connexion de Safari)

### 2.5 Hors de chez toi (facultatif)
Installe **Tailscale** (gratuit) sur le PC et le téléphone, connecte-les au même compte. Dans Réglages, l'adresse en `100.x.x.x` doit s'afficher et fonctionner en 4G.

## 3. Le reste de l'appli (rapide)

Avec des données de test vides (`DATA_DIR` neuf) :

- [ ] Premier lancement : le guide plein écran, choix du nom, de l'animal, du CV, du contrat, du domaine, du lieu **avec rayon**
- [ ] Importer un CV (PDF ou Word) : nom, compétences, parcours remplis
- [ ] Créer un **CV en PDF** (Profil › éditeur) et une **lettre de motivation en PDF**
- [ ] Glisser une carte du suivi avec la souris, mode sombre, bouton « Voir la démo en direct »
- [ ] Envoyer un e-mail de test (Réglages › adresse d'envoi › Tester) si tu as un mot de passe d'application

## 4. La présentation animée

- [ ] Ouvrir `promo/mitady-promo.html` dans le navigateur : 72 s qui s'enchaînent sans saccade
- [ ] **Activer le son** (bouton en haut à droite) : la musique démarre, `M` la coupe, `←` / `→` sautent de 5 s en restant synchronisées
- [ ] Safari : le son ne démarre qu'après le clic (normal)
- [ ] Facultatif, avec `ffmpeg` installé : `node promo/export.mjs` crée `promo/mitady-promo.mp4` avec le son

## 5. À ne jamais partager

Quand tu envoies des résultats (journal, captures), **ne partage pas** ces fichiers du dossier de données : ils contiennent tes informations personnelles.

- `db.json` : ton profil, ton CV, tes candidatures
- `secrets.json` : ton mot de passe d'e-mail, ta clé d'API
- `mobile.json` : le code de l'accès téléphone

Le journal du terminal, lui, ne contient pas de secrets.

## 6. Compte rendu à renvoyer

Copie ce modèle et remplis-le (même partiellement) :

```
Machine : (Windows / Mac) — Node : (node -v) — Téléphone : (iPhone modèle / Android)

npm test : OK / échec (copier l'erreur)

Collecte (offres trouvées avec le périmètre de base) :
  HelloWork : ...   LinkedIn : ...   Indeed : ...
  WTTJ : ...   JTMS : ...   France Travail : ...
Journal d'un site qui a posé problème : (coller les lignes du terminal)

Périmètre : 10 km → ... offres, 50 km → ..., France → ...
Paramètres confirmés ou non : ray / distance / radius / fromage / f_TPR / f_WT

Téléphone : QR OK ? code OK ? installation OK ? suivi (appui long) OK ?
Adresses affichées dans Réglages (laquelle marche) : ...
Problèmes d'affichage (page + capture d'écran) : ...

Présentation : son OK ? saccades ?

Autre : ...
```

---

## Pour une nouvelle session Claude

1. **Lis ce fichier et le compte rendu de l'utilisateur d'abord. Ne modifie rien avant.**
2. La branche de travail est `claude/funny-ritchie-uk55hl` (plusieurs commits, **pas encore fusionnés dans `main`**, **aucune PR ouverte** : ne la créer que si l'utilisateur le demande). Ne pas pousser ailleurs.
3. Dans l'environnement cloud, les sites d'offres et `geo.api.gouv.fr` sont **inaccessibles** : les tests de collecte doivent venir de l'utilisateur. Pour tester le reste, lancer un serveur avec `DATA_DIR=/tmp/x PORT=3399 node server/index.js` ; Chromium est dans `/opt/pw-browsers/` (variable `CHROMIUM_PATH` si besoin).
4. Où regarder :
   - collecte : `server/lib/scraper.js` (`helloWork`, `linkedIn`, `indeed`, `viaSearchEngine`, puis `run`)
   - périmètre, télétravail, date, score : `server/lib/filters.js` ; lieux et distances : `server/lib/geo.js` + `server/data/geo-fr.json` (régénéré par `scripts/build-communes.mjs`)
   - accès téléphone et code : `server/lib/remote.js` ; interface : `public/mobile.css`, `public/js/places.js`, `public/js/views/settings.js`, `public/js/views/board.js`
   - présentation : `promo/` (`build.mjs`, `scenes.js`, `make-audio.mjs`, `export.mjs`)
   - tests : `server/lib/search.test.js` (`npm test`)
5. **Suite prévue, dans cet ordre** (à confirmer avec l'utilisateur après le compte rendu) :
   1. corriger les collecteurs d'après les journaux, et ajouter un bouton « Tester mes sites » qui dit quel site marche ;
   2. brancher les API officielles **France Travail** (offres d'emploi, clé gratuite sur francetravail.io) et **La bonne alternance**, qui filtrent lieu, distance, date et niveau côté serveur ;
   3. candidatures spontanées (entreprises susceptibles de recruter en alternance + contact + lettre) ;
   4. recherches enregistrées et alertes par e-mail ;
   5. filtres propres à l'alternance (niveau d'études, rythme, date de début, rémunération, écarter les offres « senior ») ;
   6. afficher la date de publication (`postedAt` est déjà enregistré mais jamais montré), détecter les offres disparues ;
   7. sauvegarde / restauration des données, vérification du nom d'hôte contre le « DNS rebinding », tests de l'interface dans le dépôt et vérification automatique à chaque modification.
6. Rappel : LinkedIn et Indeed interdisent la collecte automatisée dans leurs conditions d'utilisation ; ça peut les amener à bloquer. Les API officielles (étape 2) règlent ce point.
