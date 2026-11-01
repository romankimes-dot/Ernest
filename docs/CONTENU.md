# Formats de contenu d'Ernest

Tout le contenu est en français, tutoiement, destiné à Roman : expert-comptable stagiaire, chef de mission, 6 ans d'expérience, prépare le DEC (épreuve 1 déontologie le 10 nov 2026 10h30, épreuve 2 test le 10 nov 14h, vraie épreuve 2 le 4 mai 2027, mémoire épreuve 3 : notice avant le 5 déc 2026, dépôt mars 2027). Il révise seul, sans rythme imposé, veut prendre soin de lui (corps et esprit). Il aime Karpathy, le jeu, le design, l'humour sec.

Ernest : un gobelin jardinier-majordome, vert, bonnet terre cuite, qui vit dans une serre de nuit. Calme, un peu pince-sans-rire, affectueux sans mièvrerie, jamais culpabilisant, jamais d'injonction, jamais de question qui attend une réponse. Il a ses manies (compte les lucioles, n'aime pas le lundi, collectionne les cailloux, parle aux plantes). Il tutoie. Phrases courtes. Pas d'emoji. Pas de point d'exclamation sauf rare.

## data/ernest/repliques.json
```
[ { "ctx": "ouverture.matin", "t": "Bonjour. {plante} a bougé cette nuit.", "when": { "jmin": 1, "jmax": 3 } } ]
```
Contextes (tous doivent avoir ≥ 15 répliques, les ouvertures ≥ 60) :
ouverture.matin (5h–11h), ouverture.midi (11h–17h), ouverture.soir (17h–21h), ouverture.nuit (21h–5h),
coche (une chose faite), coche.derniere (la 3e du jour faite), demarre, retour (revient d'une app de révision), idee (idée ajoutée), liste (entrée de liste ajoutée), laisse (chose abandonnée sans reproche), reporte, dimanche, rituel.debut, rituel.fin, jmoins (compte à rebours examen, utiliser {j}), apres-examen, semaine-grise (humeur basse 3 jours), manies (sans déclencheur, au hasard), premiere.ouverture (toute première fois, 10 répliques en séquence : "seq": 1..10).
Variables : {plante} (nom d'une plante de la serre), {jours} (jours actifs cette semaine), {idee} (texte d'une idée posée récemment), {j} (jours avant l'examen), {n} (nombre de choses faites au total), {dimanches} (dimanches passés ensemble).
Conditions `when` (toutes facultatives) : jmin/jmax (jours avant examen), dow [0..6] (0 = dimanche), mood "low"|"ok"|"high" (moyenne 3 jours), doneYesterday true|false, hasIdea true, firstWeek true, month [1..12], minN (nombre total de choses faites ≥).

## data/cartes/<famille>.json
Familles : botanique, profession, tips, blagues, encouragements, feuilleton.
```
[ { "id": "bot-001", "titre": "Le Welwitschia", "texte": "…", "source": "Kew Gardens, fiche Welwitschia mirabilis, https://…", "fiabilite": "sourcee", "rarete": "courante" } ]
```
- fiabilite : "sourcee" (source réelle consultée ou connue avec certitude, URL ou référence précise), "aucune" (blague, encouragement d'Ernest), "fiction" (feuilleton).
- rarete : "courante" (sort à une coche, 2–3 lignes max), "longue" (sort après une journée pleine, 5–10 lignes), "rare" (jalons).
- Une carte "sourcee" sans source est refusée par les tests. Ne jamais inventer une source : si pas sûr, rarete "courante" et fiabilite "aucune" avec une tournure prudente ("on raconte que").
- feuilleton : 30 épisodes, "ep": 1..30, rarete "longue", lu un par dimanche. L'histoire d'Ernest : d'où il vient, pourquoi cette serre, qui l'a bâtie, ce qu'il attend. Fin ouverte, douce. Chaque épisode 8–15 lignes, autonome.
- tips : chaque tip = une pratique concrète + l'étude (auteur, année, revue) + la taille de l'effet en mots honnêtes. Sommeil, révision, sport, pause, lumière, alimentation, attention, stress d'examen.
- profession : histoires vraies de la comptabilité et de l'expertise comptable (Pacioli, Stavisky et le CAC, ordonnance 1945, Enron et la LSF, la H2A, premiers experts-comptables, anecdotes de jury), sourcées (Légifrance, CNOEC, CNCC, ouvrages d'histoire). Pas de donnée de cabinet.
- botanique : faits vrais sur les plantes de serre et d'ailleurs, sourcés (Kew, MNHN, Tela Botanica, publications).
