# Progression : plantes, collections, cabane (décisions du 3 novembre 2026)

## Plantes
- Une plante est nourrie par plusieurs choses faites, au choix de l'utilisateur.
- Terminer une chose donne un **arrosoir plein**. On le verse en promenade sur la plante voulue. Les arrosoirs s'accumulent, rien ne se perd.
- Chose nouvelle : Ernest propose de planter une graine ou de nourrir une plante existante de la catégorie.
- Choses arrivées par un pont : chaque pont nourrit sa plante dédiée, sans geste.
- Croissance au nombre d'arrosages. Stades : graine 1, pousse 2, plante 5, grande 10, pleine terre 20.
- Pleine terre : la plante sort au jardin, libère son pot, continue de grandir dehors.
- Dormance : après trois semaines sans arrosage, Ernest propose de la ranger à la cabane. On peut **fixer** une plante sur place (compteur coupé).

## Ernest
- Taille et rempote à chaque passage de stade, et taille les plantes qui débordent. Petite scène en promenade.
- Porte les pots en dormance à la cabane et les ressort.
- Annonce les stades par une réplique. Jamais d'événement négatif.

## Graines et troc
- Gagnées par : pleine terre, taille, graines dorées de la promenade, journée pleine.
- Échangées avec Ernest contre une espèce du catalogue ou un décor de serre.

## Collections et rendu canon
- Une collection par serre, environ 12 espèces.
- Rendu visé : serre de botaniste, fleurie et végétalisée (lianes, géantes, tombantes).
- Plan prédéfini par serre, emplacements typés, espèce choisie par l'utilisateur parmi les débloquées.
- Déblocages au stade final : nouvelle espèce, pièce de décor, variante rare, graines.

## Cabane d'Ernest
- Intérieur 3D visitable en promenade.
- Étagère à bonsaïs : objectifs atteints, déplacés sur accord de l'utilisateur.
- Réserve des plantes en dormance.
- Un livre unique, aussi accessible depuis le Carnet : Catalogue (silhouette, nom, condition de déblocage), Herbier (une page par plante), Achèvements (botanique, régularité douce, objectifs, promenade).

## Migration
- Les pots actuels deviennent des arrosoirs déposés par Ernest, à verser en promenade.

## Ordre de travail
1. Maquette de la serre Bien-être accomplie, avec curseur de serre vide à serre accomplie. Fluide sur l'iPhone actuel.
2. Validation, puis Travail et Vie perso.
3. Mécanique (arrosoirs, stades, migration), puis cabane, livre, troc.

## Maquette Bien-être (`botaniste.html`)
- Page à part, sans effet sur l'app : `js/botaniste3d.js` (serre, plan, espèces, décors), `js/botaniste.js` (curseur, heure, livre).
- Le curseur rejoue une année : l'espèce se débloque, elle est semée en pot sur l'établi, puis passe en pleine terre dans son emplacement du plan.
- Pleine terre se fait dans les emplacements du plan de la serre (massif, rocaille, géantes, lianes, suspensions). Le jardin extérieur prendrait le surplus. À confirmer.
- Douze espèces : thym, basilic, romarin, camomille (massif), aloès (rocaille), fougère arborescente, citronnier, monstera (géantes), lierre, jasmin étoilé (lianes), misère, capucine (suspensions).
- Six décors à troquer : arrosoir de cuivre, étiquettes, banc, lanternes, bassin et fontaine, carillon.
