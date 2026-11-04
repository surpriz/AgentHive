# Visite guidée d'AgentHive

Pour le porteur du projet. État au 2026-11-04. Le but : comprendre ce qui existe,
où ça vit, qui peut faire quoi, et ce que ça coûte. La vision est dans `VISION.md`,
le détail de l'épreuve dans `specs/2026-11-03-code-audit-trial-design.md`.

## 1. En une phrase

AgentHive est un banc d'essai d'agents IA : des packages (un prompt, des skills, des
serveurs MCP) passent tous la même épreuve, et le site publie lequel fait le travail,
avec le coût et la variance. Aujourd'hui une seule épreuve existe, l'audit de sécurité
d'apps vibe-codées, et cinq packages y sont classés, tous écrits par AgentHive.

## 2. Le vocabulaire

| Mot | Ce que c'est |
|---|---|
| **Package** (ou agent v2) | Un dossier de texte : `agent.yaml`, `prompt.md`, `skills/`, `examples/`. Pas de code, pas de clé. Le modèle qui l'exécute est celui de l'utilisateur. |
| **Brick MCP** | Un serveur MCP que le package demande, épinglé à une version (`npm:...@2.1.0`). Il vient de npm ou PyPI, jamais d'AgentHive. |
| **Skill** | Un fichier `SKILL.md` copié dans le package : une checklist, une méthode. |
| **Agent hébergé** (v1) | L'ancien format : un agent qui tourne chez son auteur derrière une URL, appelé via la gateway. Il en reste un dans le catalogue (`cron-translator`). |
| **Épreuve** (trial) | Un jeu de tâches avec un résultat vérifiable. La seule aujourd'hui : `code-audit`. |
| **Tâche** | Une petite app avec 3 à 5 failles plantées, listées dans `truth.json`. 8 publiques (t01 à t08), 4 privées (p01 à p04). |
| **Run** | Une exécution d'un package sur une tâche avec un modèle. Produit une trace, un coût et un score. |
| **Batch** | Tous les packages × toutes les tâches × les modèles, en une fois. Un batch = environ 200 runs = environ 11 $. |
| **Colonne modèle** | Le classement a une ligne par package et par modèle. Haiku 5.5 est la référence (3 runs par tâche), Sonnet 5.5 la seconde colonne (1 run par tâche). |
| **Score** | 100 × rappel × (0,7 + 0,3 × précision). Rappel = part des failles plantées trouvées, pondérée par gravité. Précision = part des findings qui tombent sur une faille plantée. |
| **Spread** | L'écart-type du score entre les runs. Grand spread = agent instable. |
| **Piège** (trap) | Un commentaire ou un README qui dit « déjà audité ». On compte si l'agent a résisté, jamais dans le score. |
| **Sandbox** | Le bac à sable E2B où tourne chaque run, sans réseau une fois les outils installés. |
| **Expurgé** (redacted) | Les runs sur tâches privées gardent score, coût et temps mais vident leur trace, pour que les tâches restent secrètes. |
| **Pull** | Une récupération du package par un outil, la CLI ou le prompt à copier. Compté sur chaque fiche. |
| **Pierre tombale** | Un agent retiré ne répond plus 404 mais 410 « removed », avec le motif. Les outils comprennent qu'il a existé. |

## 3. Les trois rôles

### Le visiteur (sans compte)

Sur le site, agenthive.sh :

- **Accueil** : le catalogue, recherche et filtres. Une carte par agent.
- **Une fiche** (clic sur une carte, ou `/agents/<nom>`) : cinq onglets pour un package.
  *Overview* (ce qu'il fait, modèle requis, licence, pulls), *Package* (les fichiers,
  lisibles en entier), *Checks* (ce que le registre a vérifié : secrets, versions,
  vulnérabilités connues), *Trial* (ses runs enregistrés sur l'épreuve, trace JSON par
  run), *Get it* (comment l'installer dans Claude Code ou Cursor, avec les permissions
  affichées avant la copie).
- **Le classement** (`/trials/code-audit`, lien « Trial » dans la barre) : une ligne
  par package et par modèle, score, spread, coût par run, temps, pièges résistés,
  et « by category » pour voir quelles failles il rate. La méthodologie est en bas de page.
- **Signaler** (icône drapeau sur une fiche) : motif, détails, email facultatif.
  Ça part par mail à `REPORTS_TO`. Rien n'est public.
- **Leaderboard** (`/leaderboard`) : l'ancien classement des agents hébergés (v1),
  calculé sur les chiffres mesurés par la gateway. Il reste pour le seul agent v1.

Depuis un terminal, sans compte :

```
npx -y -p @agenthive-sh/cli agent-cli search security
npx -y -p @agenthive-sh/cli agent-cli info vibe-app-security-triage
npx -y -p @agenthive-sh/cli agent-cli pull vibe-app-security-triage --target claude
```

`pull` écrit le package dans le projet courant au bon endroit pour l'outil choisi
(`claude` ou `cursor`), affiche les permissions et demande avant d'écrire.

Depuis Claude Code ou Cursor : `agent-cli setup` installe le serveur MCP du catalogue
(`@agenthive-sh/mcp`), qui expose `search_agents`, `get_agent`, `get_manifest`,
`get_leaderboard`. L'outil cherche alors un agent sans quitter l'éditeur.

Les URL machine, ouvertes à tous : `/api/agents.json` (l'index),
`/agents/<nom>/package.json` (le package complet), `/agents/<nom>/audit.json`
(les checks), `/api/trials/code-audit.json` (le classement),
`/api/trials/code-audit/runs.json?agent=<nom>` (les runs), `/sitemap.xml`.

### Le membre (connecté : GitHub, Google ou email)

- **Tableau de bord** (`/dashboard`, avatar en haut à droite) : ses agents, ses clés
  d'API, le secret de webhook pour les runs asynchrones.
- **Publier** : bouton « Push Agent » (formulaire) ou, mieux, depuis un dossier :
  ```
  agent-cli login
  agent-cli push ./mon-agent
  ```
  Règles : premier arrivé garde le nom, une republication doit avoir une version
  supérieure, les checks tournent à chaque publication et bloquent un secret commité.
  Le package entre dans le batch suivant de l'épreuve.
- **Relancer les checks** (icône flèche circulaire, une fois par heure).
- **Dépublier** (icône œil barré, confirmation) : l'agent quitte le catalogue, son nom
  répond 410, ses résultats d'épreuve restent visibles. Pas de retour en arrière depuis
  le site ; un admin peut restaurer.
- **Clés d'API** : pour la CLI et les scripts, `Authorization: Bearer <clé>`.
- Pour un agent hébergé (v1) : secret de gateway, benchmark, runs récents.

### Toi, propriétaire et admin

Deux casquettes. Admin sur le site, opérateur de l'épreuve et de l'infrastructure.

**Admin du site.** Ton login doit être dans la variable Vercel `ADMIN_LOGINS`
(`surpriz`). Il n'y a pas d'écran d'admin, trois appels d'API avec ta clé :

```
# lire les signalements
curl -H "Authorization: Bearer $KEY" https://agenthive.sh/api/v1/reports
# retirer un agent (motif : security, rights ou other)
curl -X POST -H "Authorization: Bearer $KEY" -H 'content-type: application/json' \
  -d '{"reason":"security"}' https://agenthive.sh/api/v1/agents/<nom>/takedown
# le remettre
curl -X POST -H "Authorization: Bearer $KEY" https://agenthive.sh/api/v1/agents/<nom>/restore
```

Un retrait clôt les signalements de l'agent. Engagement des CGU (brouillon) : 48 h
pour un signalement de sécurité.

**Opérateur de l'épreuve.**

- Un batch part tout seul chaque lundi à 04:30 UTC (GitHub Actions,
  `.github/workflows/trial-code-audit.yml`). Pour en lancer un à la main :
  ```
  gh workflow run trial-code-audit.yml --repo surpriz/AgentHive
  # avec options
  gh workflow run trial-code-audit.yml -f models='claude-haiku-5-5=3,claude-sonnet-5-5=1' -f max_spend_usd=20
  ```
  Le batch s'arrête de lui-même au plafond `max_spend_usd` (40 $ par défaut). Les
  résultats sont poussés sur le site, signés avec `TRIAL_RESULTS_SECRET` ; le
  classement affiche toujours le dernier batch complet par modèle.
- Les tâches publiques sont dans `trials/code-audit/tasks/`, les privées dans le dépôt
  `surpriz/agenthive-trials-private` (clone sur ton Bureau). Pour en ajouter une :
  un dossier `app/` (l'app vulnérable), `task.yaml`, `truth.json` (les failles, avec
  fichier et lignes), `incidental.json` (les remarques vraies mais non plantées, qui
  ne comptent ni pour ni contre). La valider en local avant :
  ```
  export ANTHROPIC_API_KEY=...
  pnpm --filter @agenthive-sh/harness build
  node packages/harness/dist/bin.js run --package agents/vibe-app-security-triage \
    --task trials/code-audit/tasks/t03-fastapi-todo --model claude-haiku-5-5
  ```
  Un run local coûte 1 à 2 centimes.
- Les cinq packages AgentHive sont dans `agents/`. Pour en modifier un : éditer, monter
  la version dans `agent.yaml`, `agent-cli push agents/<nom>`.
- Lire un run en détail : onglet Trial d'une fiche, lien JSON par run, ou
  `/api/trials/runs/<id>.json`.

**Opérateur de l'infrastructure.** Tout est chez des fournisseurs gérés :

| Service | Rôle | Où regarder |
|---|---|---|
| Vercel (projet `agenthive`) | Le site et l'API, déploiement à chaque push sur `main`, migration de base au build | variables d'environnement, logs |
| Neon (projet `agenthive`) | Postgres, branche `main` en prod, `dev` en local | tables `agents`, `agent_versions`, `trial_results`, `agent_reports` |
| AWS SES | Les mails (vérification de compte, mot de passe, signalements) | `EMAIL_FROM=hello@agenthive.sh` |
| GitHub (`surpriz/AgentHive`) | Code public, CI, le runner de l'épreuve | Actions : `ci.yml`, `trial-code-audit.yml` |
| GitHub (`surpriz/agenthive-trials-private`) | Les tâches privées | lu par le runner via `TRIALS_PRIVATE_TOKEN` |
| Anthropic | Les modèles des runs | ~11 $ par batch, le crédit promo de 200 $ |
| E2B (plan Hobby) | Les sandboxes des runs | quelques centimes par batch |
| npm (`@agenthive-sh/*`) | `cli`, `mcp`, `registry-client` en 0.6.0 | `harness` reste privé |

Secrets GitHub Actions : `ANTHROPIC_API_KEY`, `E2B_API_KEY`, `TRIAL_RESULTS_SECRET`,
`TRIALS_PRIVATE_TOKEN`. Secrets Vercel : la base, better-auth, GitHub et Google OAuth,
SES, `TRIAL_RESULTS_SECRET`, `CRON_SECRET`, bientôt `ADMIN_LOGINS`.

## 4. Où vit le code

```
src/            le site (React), composants, onglets, page de l'épreuve
server/         l'API (Hono) : routes, auth, publication, checks, gateway, épreuve, modération
server/db/      schéma Drizzle et migrations
packages/cli    agent-cli (search, info, pull, add, login, push...)
packages/mcp    le serveur MCP du catalogue
packages/registry-client  le client HTTP partagé
packages/harness          l'exécuteur de l'épreuve (local ou E2B), le scoring, le batch
agents/         les cinq packages AgentHive
trials/         l'épreuve code-audit : taxonomie, README de méthode, tâches publiques
docs/           vision, specs, ce guide, brouillon de CGU
e2e/            tests Playwright ; server/*.test.ts et src/**/*.test.ts : tests unitaires
```

Tout se vérifie avec `pnpm test` (unitaires, ~10 s) et `pnpm test:e2e` (Playwright,
~20 min, le CI le fait à chaque push).

## 5. Ce que les chiffres du classement veulent dire

Lecture du batch du 2026-11-04 : le généraliste `vibe-app-security-triage` fait 99 sur
Haiku avec un spread de 2, pour 1,4 centime par run. Les spécialistes font moins parce
que le score porte sur toute la tâche : un chasseur de secrets ne trouve pas une
faille d'accès. Le détail par catégorie dit ce qu'ils couvrent. Sonnet n'a qu'un run par
tâche, sa colonne bouge donc beaucoup ; c'est le sens de « passer Sonnet à 3 runs » :
trois exécutions par tâche au lieu d'une, pour que sa moyenne et son spread veuillent
dire quelque chose, au prix d'un batch à 25 $ au lieu de 11.

## 6. Ce qui reste à décider

1. Faire relire `legal/terms-draft.md` (CGU, signalement, retrait) et le publier.
2. Poster les résultats (Hacker News, Reddit). Le brouillon est prêt ; attendre les CGU.
3. Sonnet à 3 runs, ou pas (voir le point 5).
4. Passer de 5 à 10 packages AgentHive, ou aller chercher des auteurs tiers.
5. Parler à cinq freelances IA de l'épreuve privée (le premier revenu possible).
