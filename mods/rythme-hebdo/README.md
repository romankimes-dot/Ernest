# rythme-hebdo

Mod Claude Code qui améliore le suivi du crédit hebdomadaire (fenêtre `seven_day` des abonnements Pro/Max).

- **Bandeau au-dessus du prompt** : barre d'utilisation de la semaine avec un repère `┃` indiquant où vous devriez être si vous consommiez de façon régulière, et l'écart en points (Trop rapide / Légèrement en avance / Dans le rythme / Sous-utilisé).
- **Ligne de statut** : `Hebdo 42% · rythme 38% (+4 pts) · proj. 110%`.
- **Panneau « Crédit hebdo »** (bouton *Détails* ou `/hebdo`) : projection au reset, heure d'épuisement estimée, budget restant par jour, consommation par jour de la fenêtre, semaine précédente, fenêtre 5 h.
- **Alerte** (toast, une fois par semaine) quand vous dépassez le rythme de plus de 10 points.

Rythme attendu = temps écoulé dans la fenêtre de 7 jours (calculé depuis `resetsAt`). Les relevés sont gardés dans le store du mod pour l'historique par jour.

## Installation

```bash
claude --plugin-dir ./mods/rythme-hebdo
```
