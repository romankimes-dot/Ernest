# rythme-hebdo

Mod Claude Code qui améliore le suivi du crédit hebdomadaire (fenêtre `seven_day` des abonnements Pro/Max).

- **Indicateur discret au-dessus du prompt** : `● Semaine 70% · rythme 50% (+20)`, la pastille colorée indiquant si vous êtes dans le rythme. Un clic ouvre le détail.
- **Panneau « Crédit hebdo »** (clic sur l'indicateur ou `/hebdo`) : projection au reset, heure d'épuisement estimée, budget restant par jour, consommation par jour de la fenêtre, semaine précédente, fenêtre 5 h.
- **Alerte** (toast, une fois par semaine) quand vous dépassez le rythme de plus de 10 points.

Rythme attendu = temps écoulé dans la fenêtre de 7 jours (calculé depuis `resetsAt`). Les relevés sont gardés dans le store du mod pour l'historique par jour.

## Installation

À l'invite d'une session Claude Code dans un terminal :

```
/plugin install rythme-hebdo --marketplace romankimes-dot/Ernest
```

Depuis un shell :

```bash
claude plugin install rythme-hebdo --marketplace romankimes-dot/Ernest
```

Dans l'app desktop (où `/plugin` ne fonctionne pas) : cliquer sur **+** à côté du champ de saisie → **Plugins** → **Add marketplace** avec `romankimes-dot/Ernest` → **Add plugin**.

Pour développer : `claude --plugin-dir ./mods/rythme-hebdo`.
