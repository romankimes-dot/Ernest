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

## Maquette des trois serres (`botaniste.html?serre=bienetre|travail|perso`)
- Page à part, sans effet sur l'app : `js/botaniste3d.js` (serre, plan, espèces, décors), `js/botaniste.js` (curseur, heure, livre).
- Le curseur rejoue une année : l'espèce se débloque, elle est semée en pot sur l'établi, puis passe en pleine terre dans son emplacement du plan.
- Pleine terre se fait dans les emplacements du plan de la serre (massif, rocaille, géantes, lianes, suspensions). Le jardin extérieur prendrait le surplus. À confirmer.
- Même plan pour les trois serres : 4 espèces de massif, 1 de rocaille (ou prairie), 3 géantes, 2 lianes, 2 suspensions.
- Bien-être : thym, basilic, romarin, camomille, aloès, fougère arborescente, citronnier, monstera, lierre, jasmin étoilé, misère, capucine. Décors : arrosoir, étiquettes, banc, lanternes, bassin, carillon.
- Travail : pensée, lavande, iris, calathéa, sansevière, palmier kentia, figuier lyre, oiseau de paradis, philodendron, glycine, pothos, orchidée. Décors : arrosoir, étiquettes, banc de lecture, lampes de bibliothèque, cadran solaire, horloge de gare.
- Vie perso : marguerite, coquelicot, bleuet, cosmos, graminées, hortensia, figuier, olivier, chèvrefeuille, rosier grimpant, géranium-lierre, fuchsia. Décors : arrosoir, étiquettes peintes, banc, guirlande lumineuse, vasque aux oiseaux, carillon.
- Photophores au sol le soir et la nuit, dans l'allée et sous les massifs.

## Mécanique dans l'app (`js/flore.js`)
- Fait : arrosoirs, semis, versement (un ou tous), stades et événements, graines (taille, pleine terre, journée pleine, graines dorées), espèces ouvertes par la pleine terre ou troquées, plantes des ponts, dormance proposée, plante fixée, ranger et ressortir, migration des anciens pots.
- Rendu : les plantes vont dans les petites serres actuelles, avec le dessin de leur espèce le plus proche et une taille selon le stade. Le rendu de botaniste dans l'app reste à faire.

## La cabane et le livre (`js/cabane3d.js`)
- On entre chez Ernest en touchant la chaumière, ou par le bouton « Entrer chez Ernest » en promenade. Le soir, la chaumière propose aussi de préparer demain.
- Dedans, il y a une pièce ronde sous le chaume avec un feu et deux fenêtres qui suivent l'heure. On y trouve l'étagère à bonsaïs à gauche, la réserve à droite, et la table au milieu avec le livre et le bocal à graines.
- Un objectif atteint garde son bonsaï dans la serre jusqu'à décision. Ernest propose alors l'étagère, et on peut aussi le garder en serre ou l'y remettre.
- Le livre s'ouvre depuis la table de la cabane ou depuis le Carnet. Il a quatre onglets : le catalogue des espèces de chaque serre avec le troc, l'herbier avec une page par plante, les achèvements calculés depuis les données, et les décors à troquer.
- Les décors troqués sont enregistrés, mais ils ne s'affichent pas encore. Ils arriveront avec les serres de botaniste dans l'app.

## Les serres de botaniste dans l'app
- Le village reste tel quel. On entre dans une serre par le bouton « Entrer dans la serre » en promenade, ou depuis le panneau de la serre. On en voit alors l'intérieur de botaniste avec ses vraies plantes.
- Placement automatique :
  - une plante en pleine terre prend l'emplacement de son type (massif, rocaille, géante, liane, suspension), la plus arrosée d'abord ;
  - les autres restent en pot sur l'établi, près de la porte.
- Changer de place : la fiche d'une plante en pleine terre propose « Changer de place » quand on est dans la serre. Les emplacements de son type s'allument : vert s'il est libre, bleu s'il est occupé (les deux plantes échangent), ambre pour la place actuelle. La place choisie est gardée ; les autres plantes se rangent autour.
- Dehors, chaque serre du village a l'architecture de son intérieur : voûte ronde en fonte verte, briques et épis en boule (Bien-être) ; ogive en fonte noire avec tirants, soubassement de pierre sombre, allée en damier et flèches de faîtage (Travail) ; deux pans en bois blanc, planches peintes et jardinières fleuries (Vie perso).
- Toucher une plante ouvre sa fiche pour l'arroser. Les décors troqués apparaissent.
- Trois thèmes, trois architectures :
  - **Bien-être, l'herboristerie** : voûte ronde en fonte verte, briques, dalles de pierre, bouquets qui sèchent, pile de pots.
  - **Travail, le cabinet d'étude** : ogive haute en fonte noire avec tirants, damier, bibliothèques basses, globe, échelle, lampes vertes.
  - **Vie perso, l'orangerie du cottage** : toit à deux pans en bois peint en blanc, gravier et pas japonais, planches peintes, fanions, brouette.
- La cabane est texturée (chaux, pierre, chaume, bois, plancher, tapis) et meublée : manteau de cheminée et bocaux, marmite, casseroles de cuivre, bûches, fauteuil, tableau, balai, panier de pommes, livres, bouquets aux poutres, tresse d'ail, lanterne, basilic à la fenêtre.
