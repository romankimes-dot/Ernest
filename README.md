# Ernest

Trois choses par jour, une serre qui pousse, un gobelin qui raconte. Application web installable sur iPhone, hors ligne, sans compte.

Adresse : https://romankimes-dot.github.io/Ernest/ (GitHub Pages, branche `main`, dossier racine).

Page de présentation : https://romankimes-dot.github.io/Ernest/decouvrir.html (`decouvrir.html`, `css/decouvrir.css`, `js/decouvrir.js`, images dans `img/`) : serre 3D en direct au soir, mini-démo (trois cases, trois pots), carrousel de cartes tirées des vraies données, curseur jour/nuit, trois graines dorées cachées (carte rare).

## La boucle
- **Aujourd'hui** : les choses posées la veille (trois au plus, la première en évidence), Démarrer / Terminer avec le temps réel, la liste des entrées datées du jour. Si rien n'est posé, Ernest propose et un tap suffit.
- **Le soir** (bandeau « Préparer demain » à partir de 18 h) : une ligne sur la journée, l'humeur en un tap, le sort des choses non faites (demain, idée, laisser), puis les 3 de demain avec catégorie, moment (matin, midi, après-midi, soir) et durée estimée d'après tes durées réelles. Ernest y propose aussi une petite chose Bien-être ou Vie perso, dans la serre la moins fournie de la semaine (à prendre, changer ou laisser).
- **Liste** : tout le reste, sans limite (courses, colis, voiture), avec date facultative, et les idées, à trier quand tu veux. Le bouton + attrape tout, de partout.
- **Semaine** : jours actifs sur sept, fait par catégorie, minimums doux (actifs à partir du 11 novembre, réglables), objectifs avec jalons, point du dimanche (un épisode de l'histoire d'Ernest à chaque point).
- **Carnet** : ce qu'Ernest a dit aujourd'hui, et les cartes gagnées (botanique, histoires vraies de la profession, pratiques à preuve, blagues, mots, feuilleton). Une chose faite en ouvre une sur deux ; une journée pleine en ouvre une longue ; les jalons en ouvrent une rare.
- **Les serres** (bande du haut) : trois petites serres, « Travail » (Révision, Boulot), « Bien-être » (Corps, Esprit, Cuisine) et « Vie perso » (Perso) ; une plante par chose faite dans la serre de sa catégorie, une plante dans « Vie perso » par entrée de Liste cochée (ou dans sa catégorie), un bonsaï par objectif actif dans la serre de sa catégorie (une branche par jalon) ; grimpantes et suspensions suivent les choses faites de chaque serre. Croissance par jours actifs, cycle jour/nuit sur l'heure réelle, lumière réglée par l'humeur des trois derniers jours. Un jour sans ne fane rien.
- **Promenade** (serre en plein écran, bouton Promenade) : Ernest en 3D (`js/ernest3d.js`), à suivre de dos (3ᵉ personne) ou par ses yeux (1ʳᵉ personne) ; joystick sur téléphone, ZQSD ou flèches sur ordinateur, glisser pour regarder ; un tap sur une serre en haut et il y va tout seul, puis arrose. La nuit, il sort sa lanterne. Maquette du personnage seul : `ernest3d.html`.
- **Monde interactif** (serre en plein écran) : toucher une plante montre la chose faite qui l'a fait pousser (titre, durée, heure) et permet de l'arroser ; un bonsaï, son objectif et ses étapes à cocher ; le panneau d'une serre, les choses du jour de sa catégorie (Démarrer, Pause, Terminer, en poser une) ; la chaumière ouvre le rituel du soir dès 18 h ; Ernest parle quand on le touche et en entrant dans une serre (bulle au-dessus de lui). En promenade : bouton Arroser près d'une plante (les trois serres arrosées le même jour ouvrent une carte), trois graines dorées cachées chaque jour, à ramasser en passant (les trois : une carte rare).

- **Arrosoirs et plantes** (`js/flore.js`, voir `docs/PROGRESSION.md`) : une chose faite (ou une entrée de Liste cochée) donne un arrosoir plein pour la serre de sa catégorie. On le verse sur la plante de son choix : en promenade (bouton Arroser), ou en touchant la plante, ou depuis le panneau de la serre (Semer une graine, Tout verser). Stades : graine 1, pousse 2, plante 5, grande 10, pleine terre 20. Ernest taille à chaque stade (une graine) et rempote à la pleine terre (trois graines) ; journée pleine et graines dorées en donnent aussi. Douze espèces par serre, ouvertes par les plantes en pleine terre ou troquées contre des graines. Trois semaines sans eau : Ernest propose de ranger la plante à la cabane, sauf si on l'a fixée. Les choses venues d'un pont nourrissent seules la plante de ce pont. Les anciens pots (une plante par chose faite) sont devenus des arrosoirs à verser.
- **Dans les serres** (`js/botaniste3d.js`) : « Entrer dans la serre » (en promenade, ou depuis le panneau). L'intérieur de botaniste montre les vraies plantes à leur place et les décors troqués. Chaque serre a son thème : l'herboristerie (Bien-être), le cabinet d'étude (Travail), l'orangerie du cottage (Vie perso).
- **La cabane d'Ernest** (`js/cabane3d.js`) : toucher la chaumière (ou « Entrer chez Ernest » en promenade). L'étagère à bonsaïs reçoit les objectifs atteints, sur accord. La réserve garde les plantes en dormance. Sur la table se trouvent le livre d'Ernest et le bocal à graines.
- **Le livre d'Ernest** (cabane ou Carnet) : catalogue des espèces et troc, herbier, achèvements, décors à troquer.
- **Maquette des serres de botaniste** : `botaniste.html?serre=bienetre|travail|perso`, de vide à accomplie.

Ernest parle à chaque ouverture et à chaque geste (`data/ernest/repliques.json`, ~480 répliques avec conditions et mémoire). Il ne demande rien, n'évalue rien, ne culpabilise jamais.

## Ponts
Format unique, transporté par lien profond `https://romankimes-dot.github.io/Ernest/#import=<base64url(JSON)>` ou collé dans Réglages › Pont :
```json
{ "v": 1, "src": "deonto|revision|memoire",
  "things": [{ "title": "…", "cat": "revision", "est": 75, "link": "https://…", "day": "2026-11-03", "note": "…" }],
  "goals": [{ "title": "…", "due": "2026-11-10", "milestones": [{ "text": "…", "due": "…", "done": false }] }],
  "history": [{ "day": "2026-10-30", "n": 2 }] }
```
- **Dec-Deonto** : par la synchronisation, tout seul (choses du jour, objectif Épreuve 1 avec examens blancs en jalons, historique des jours travaillés pour peupler la serre).
- **dec-revision** : même bouton sous la journée du parcours (la journée en une chose, objectif Épreuve 2 avec les annales en jalons).
- **dec-memoire** : `python3 -I scripts/export-ernest.py --lien` (lancé par `/fin-de-session`) : objectif Mémoire avec les échéances en jalons. Titres et dates seulement.
Ernest montre ce qui va être ajouté et demande confirmation ; rien n'est ajouté deux fois.

## Synchronisation
Réglages › Synchronisation : même serveur et même code que Dec-Deonto (Worker Cloudflare, voir `cloudflare/README.md` de Dec-Deonto ; pré-remplis si Deonto est connecté dans le même navigateur). L'état est envoyé au plus une fois par minute après un changement et à la mise en arrière-plan, relu à l'ouverture (`js/sync.js`). Copie en ligne versionnée : modifiée des deux côtés, la plus récente l'emporte et l'autre se reprend dans Réglages ; au premier branchement d'un appareil, la copie en ligne l'emporte. Les plans déposés par les apps de révision (casier `/pont/<src>`) arrivent tout seuls, une fois par version ; une chose supprimée n'est jamais remise.

## Données
Tout est sur le téléphone (`localStorage`, clé `ernest.state.v1`), copie automatique toutes les 3 heures, état précédent gardé avant un import ou un effacement. Réglages › Exporter (partage ou copie) : la Semaine le rappelle au-delà de 7 jours. Rappel du soir : iOS n'autorise pas une notification locale sans serveur ; une alarme à 21 h fait le travail.

## Développement
```
npm test                   # syntaxe + tests (modèle, ponts, contenu : sources obligatoires, ton d'Ernest)
python3 -m http.server 8080
```
Fichiers : `js/model.js` (fonctions pures), `js/store.js`, `js/bridge.js`, `js/ernest.js` (personnage et répliques), `js/garden2d.js` (serre canvas), `js/garden3d.js` (serres 3D, promenade), `js/ernest3d.js` (Ernest en 3D), `js/cards.js`, `js/app.js` (vues), `sw.js` (hors ligne : incrémenter `VERSION` à chaque changement de code). Formats de contenu : `docs/CONTENU.md`. Prochaine étape prévue : serre 3D (three.js), démonstration à juger avant d'y engager le reste.
