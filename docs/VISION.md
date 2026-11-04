# Vision d'AgentHive

Document de référence, mis à jour le 2026-11-04. La partie « Vision validée », les
décisions datées et la stratégie sont celles du porteur de projet. La roadmap et les
choix de conception sont des propositions, sauf mention contraire. Les arbitrages entre
décisions successives sont consignés dans « Arbitrages du 2026-11-03 ».

## Vision validée

Le banc d'essai des agents IA : on les fait passer sur les mêmes tests réels, et on
publie lequel fait vraiment le travail. Indépendant de GitHub, communautaire et gratuit
pour l'instant. (Formulation du 2026-11-03 ; « le Hugging Face des agents » reste une
image interne, jamais une accroche.)

### Cible

Deux mondes réunis :

- **Les nouveaux venus :** vibe coders, professionnels de la tech, product managers
  et fondateurs. Ils savent utiliser l'IA, manipuler des agents et intégrer des
  outils, sans être forcément ingénieurs logiciels.
- **Les développeurs confirmés :** ceux qui codaient déjà avant les LLM. On ne veut
  pas les perdre, car ils peuvent beaucoup apporter.

Hors cible : le grand public, pour qui l'IA se résume à l'interface de ChatGPT.

### Parcours « Test & Remix »

1. **Trouver :** un agent classé par objectif pro (audit de code, analyse financière,
   growth).
2. **Tester :** directement sur le site, dans un sandbox simple, sans cloner de repo.
3. **Récupérer :** en 1 clic, chez soi ou dans son outil (Cursor, Claude, etc.).
4. **Customiser et republier :** adapter le prompt ou les réglages, puis re-uploader
   avec sa patte, dans une boucle de type fork/remix.

### Agent, MCP et skills

Un agent est un package qui embarque sa logique (son prompt), se branche sur des MCP
(les connecteurs de données) et utilise des skills (les compétences). AgentHive rend
cet assemblage transparent et facile.

### Conséquences sur la roadmap

- Fin des agents fictifs, remplacés par de vrais agents, open source ou créés proprement.
- Priorité à l'épreuve et au classement. Sandbox en direct et fork sur le site viennent
  après les premières soumissions de tiers (arbitrage du 2026-11-03, qui remplace la
  priorité sandbox + fork du 2026-11-02).

### Décisions du 2026-11-02

- **Premier objectif :** audit de code et de sécurité. Le catalogue de départ s'y concentre.
- **Premiers utilisateurs :** communautés en ligne (Reddit, Discord, Hacker News, Product
  Hunt).
- **Après les 6 mois :** gratuit pour la communauté, puis offre payante pour les équipes
  une fois l'usage prouvé.
- **Plafond du modèle et du sandbox :** environ 300 EUR/mois, à confirmer une fois les prix
  vérifiés. Au-delà, les tests en direct s'arrêtent et les exemples enregistrés restent.
- **Agents déclaratifs d'abord :** pas de code dans l'agent, le code vit dans les MCP. Les
  agents avec code restent en mode hébergé par l'auteur, sans fork.
- **Noms `owner/name` :** chaque artefact vit sous un utilisateur ou une organisation, les
  noms plats redirigent. Conception détaillée dans `specs/2026-11-02-v2-hub-design.md`.

### Décision du 2026-11-03

- **Premier pool d'agents :** AgentHive constitue lui-même le premier pool, 5 à 10 agents,
  plus des assemblages de skills et de serveurs MCP open source connus, licence vérifiée
  et crédit aux auteurs. Les agents d'AgentHive sont identifiés comme tels et servent de
  référence de base.

## Arbitrages du 2026-11-03

Tranchés par le porteur de projet. La stratégie « couche de confiance neutre » du
2026-11-02 est abandonnée au profit du banc d'essai.

| Avant | Tranché | Conséquence |
|---|---|---|
| « Le Hugging Face des agents IA » | Dire « banc d'essai des agents ». HF reste une image interne. | Pitch, page d'accueil et docs publics ne parlent ni de hub ni de registre. |
| « Priorité au sandbox et au fork » | Épreuve et classement d'abord. Sandbox en direct et fork après les soumissions de tiers. | Le sandbox sert à produire les runs de l'épreuve. Le fork passe par la CLI jusque-là. |
| Indexer et noter l'existant en premier | Abandonné comme pari. Complément possible plus tard. | Pas de job d'indexation au mois 1. |
| « Tester » = sandbox simple sur le site | « Tester » = regarder les runs enregistrés. L'essai en direct est un bonus. | Coût divisé, même étape du parcours. |

## Stratégie : le banc d'essai des agents par métier

Décidée par le porteur de projet le 2026-11-03. Elle remplace la stratégie « couche de
confiance » du 2026-11-02.

### Diagnostic

La couche de confiance neutre arrive tard :

- **Skills :** skills.sh (Vercel) indexe déjà toutes les skills publiques, les classe par
  installations et affiche des audits de partenaires (Socket, Snyk). Environ 1 million de
  skills et 280 millions d'installations en sept mois.
- **Serveurs MCP :** registre officiel, Glama (note de qualité, observation du comportement),
  Smithery (racheté par Arcade.dev en août 2026).
- **Notes de confiance :** une dizaine de projets font la même chose. La note devient une
  commodité.
- **Gouvernance entreprise :** Snyk Agent Scan et Evo imposent déjà une politique d'adoption
  des skills et MCP entre équipes.
- **Le scan statique ne protège pas :** skills piégées sur skills.sh malgré les audits
  (1,7 million d'installations), serveur empoisonné accepté par 9 registres sur 11,
  ClawHavoc sur ClawHub.

Conclusion : indexer et noter l'existant ferait d'AgentHive un scanner de plus, face à
Vercel et Snyk.

Le vrai trou : **l'agent assemblé** (prompt + skills + MCP), évalué sur un vrai travail.
Les composants sont couverts, l'assemblage ne l'est pas. Vercel prédit lui-même que la
mesure passera des installations à l'efficacité. C'est la fenêtre.

### Promesse

« AgentHive, c'est le banc d'essai des agents IA : on les fait passer sur les mêmes tests
réels, et on publie lequel fait vraiment le travail. »

Accroche : « Trouvez l'agent qui fait vraiment le travail, prouvé sur des tests publics. »

### Principe

Pour chaque objectif métier, AgentHive publie une **épreuve** : un jeu de tâches réalistes
avec résultat vérifiable. Les agents y sont classés sur ce qu'ils accomplissent. Chaque
fiche montre les runs enregistrés. Un SWE-bench ou un LMArena pour des agents métier
packagés, pas pour des modèles.

### Pourquoi ça tient mieux que le hub

- **Défendable :** un prompt se copie en trente secondes. Une épreuve et son historique
  de résultats, non.
- **Raison de publier :** on republie une variante pour monter au classement. Le fork
  devient « je bats l'original de 12 points ». La filiation prend sens.
- **Coût du sandbox réglé :** les runs de l'épreuve sont les exemples enregistrés. L'essai
  en direct devient un bonus.
- **Sécurité sans fausse promesse :** l'épreuve contient des pièges (injection,
  exfiltration). On affiche « a résisté à X sur Y », jamais une note AAA.
- **Offre entreprise évidente :** lancer la même épreuve sur son propre code avant de
  déployer un agent.

### Première épreuve

Audit de code et de sécurité sur des apps vibe-codées de démonstration, avec failles
placées. Cohérent avec le premier objectif décidé le 2026-11-02.

### Devenir la référence internationale

Une référence se construit niche par niche. Objectif des six mois : être la référence sur
une seule épreuve, l'audit de code d'apps vibe-codées. Pas sur les agents en général.

1. **Anglais par défaut**, dès la première page.
2. **Méthodologie publique et reproductible :** harness open source, protocole publié,
   plusieurs runs par agent avec variance affichée. Les classements de détection de failles
   sont instables d'une configuration à l'autre.
3. **Une partie des tâches privée et tournante**, comme Agents' Last Exam, pour éviter
   qu'on optimise pour l'épreuve.
4. **Coût et modèle affichés** pour chaque run, comme HAL : précision, coût, temps.
5. **Neutralité gravée :** jamais de classement payant ni de badge payant. Les agents
   d'AgentHive sont marqués comme tels.
6. **Rendez-vous réguliers :** un rapport mensuel de résultats, citable par la presse et
   les chercheurs.
7. **Présence dans l'outil :** un serveur MCP ou une skill « trouve le meilleur agent pour
   X » interrogeable depuis Claude Code ou Cursor. La skill `find-skills` de Vercel prouve
   que ce canal marche à grande échelle. Le serveur MCP du catalogue existe déjà.
8. **S'allier aux benchmarks académiques** plutôt que les concurrencer : réutiliser leurs
   jeux quand la licence le permet, leur proposer des épreuves métier.

### Ce qu'on télécharge

Un agent déclaratif ne contient pas d'IA, il contient des instructions. Une recette, pas
un four.

```
audit-securite/
  agent.yaml        objectif, réglages, MCP et versions, modèle conseillé
  prompt.md         la méthode de l'agent
  skills/<nom>/SKILL.md
  examples/         app d'exemple et rapport attendu
```

- Le four est le modèle que le client utilise déjà dans Cursor, Codex ou Claude Code.
- Les serveurs MCP viennent de leur source officielle (npm, PyPI, serveur hébergé), pas
  d'AgentHive.
- L'export dépose les fichiers au bon endroit selon l'outil. Les clés restent chez le
  client et ne passent jamais par AgentHive.

### Personnalisation, pas de fine-tuning

Pas de poids à ajuster. On personnalise : réglages déclarés, prompt adapté aux règles du
client, skills et MCP ajoutés ou retirés, puis on relance l'épreuve sur la variante.
Personnaliser puis mesurer, c'est la différence avec une copie locale.

### Multi-outils

Cursor, Codex et Claude Code avec un seul format source. Ces outils convergent vers MCP et
des instructions en Markdown (SKILL.md, AGENTS.md). `agent.yaml` reste une fine couche qui
génère la forme attendue par chaque outil. À vérifier avant de figer l'export : la prise en
charge des skills, sous-agents et plugins dans chaque outil (le format plugin de Claude
Code regroupe déjà skills, MCP et sous-agents). Afficher le modèle de chaque run et, à
terme, des résultats par outil cible.

### Qui publie

Règle 90-9-1 : 90 % lisent, 9 % contribuent un peu, 1 % créent. Dans un hub communautaire,
c'est grave, la boucle remix repose sur le 1 %. Dans un banc d'essai, c'est moins grave :
les 90 % qui consomment sont la cible, et les publieurs sont motivés par le classement
(auteurs de MCP, éditeurs d'outils sécurité, consultants, freelances IA).

Plan, à partir du premier pool décidé le 2026-11-03 :

- Aller chercher les auteurs un par un : « ton MCP est 6e sur l'épreuve d'audit, tu veux
  soumettre ta propre configuration ? »
- Signal de réussite : un tiers soumet un agent sans qu'on le lui ait demandé.

## Concurrence

État au 2026-11-03.

### Registres et annuaires de composants

| Acteur | Ce qu'il fait | Menace |
|---|---|---|
| skills.sh (Vercel) | Index de skills, installations, audits partenaires | Forte sur les skills. Pas de classement d'agents assemblés. |
| Glama, registre MCP officiel | Index MCP, notes de qualité, observation | Forte sur les MCP. |
| Smithery / Arcade.dev | Registre MCP et skills, hébergement, OAuth | Moyenne. |
| Snyk Agent Scan / Evo | Scan et gouvernance entreprise | Forte sur l'offre équipes « registre privé ». |
| Petits registres de confiance | Notes de sécurité MCP et skills | Commodité. |

### Benchmarks d'agents

| Acteur | Ce qu'il mesure | Différence |
|---|---|---|
| HAL (Princeton) | Coût et précision, modèles × scaffolds | Recherche, agents génériques, rien d'installable. |
| Agents' Last Exam (Berkeley) | Travail professionnel réel, tâches privées tournantes | Mesure les modèles. |
| Artificial Analysis, DeepsecBench-AA (Vercel) | Modèles sur la recherche de failles dans du code web | Classe des modèles. Vercel a donc déjà une épreuve d'audit. |
| Endor Labs Agent Security League | Code sûr écrit par modèle × outil | Mesure l'écriture, pas l'audit par un agent packagé. |
| Arena (agent leaderboard) | Sessions réelles d'utilisateurs, par modèle | Modèles, pas packages. |

### Où AgentHive se démarque

Tous ces classements répondent à « quel modèle ou quel outil ? ». Personne ne répond à la
question du praticien : « avec mon modèle et mon outil, quelle configuration installable
fait le mieux ce travail, et combien elle coûte ? » Les benchmarks montrent que le harness
et la configuration changent fortement le résultat. C'est ce qu'AgentHive mesure et rend
installable en un clic.

### Menace principale

Vercel possède skills.sh (distribution) et DeepsecBench (épreuve d'audit). S'ils relient les
deux, ils occupent la place. Réponse : vitesse sur une niche, neutralité, méthodologie,
installabilité.

## Modèle économique

Proposé, à valider. Le freelance ou intégrateur IA est peut-être le premier client payant :
il doit prouver à ses clients que l'agent fonctionne, et il facture déjà ce travail.

1. **Gratuit pour toujours :** classements publics, fiches, runs enregistrés,
   téléchargement, soumission d'agents.
2. **Offre pro freelances et intégrateurs** (premier revenu, cycle court) : épreuves privées
   sur le code ou les données d'un client, rapport comparatif à son nom ou en marque
   blanche, historique des versions de ses agents.
3. **Offre équipes** (plus tard) : épreuves sur le code interne avant déploiement, registre
   des agents approuvés, politique d'approbation, SSO. Angle face à Snyk et Vercel :
   hébergement UE, conformité AI Act.

Règle absolue : on ne paie jamais pour son classement. On vend l'accès aux épreuves privées,
jamais la position publique.

Validation sans coder : montrer un classement fait à la main à 5 freelances IA (Malt,
LinkedIn) et demander s'ils paieraient pour lancer la même épreuve chez un client.

## Décisions du 2026-11-03 (épreuve)

- Modèle de référence : `claude-haiku-5-5`, 3 runs par tâche. Deuxième colonne : `claude-sonnet-5-5`, 1 run. Autres modèles (Kimi, GPT, DeepSeek, Qwen, GLM, Mistral) en colonnes plus tard, jamais en référence au départ.
- Sandbox d'exécution des outils : E2B, plan Hobby. Runner hébergé sur GitHub Actions (dépôt public). Clé modèle jamais dans la sandbox.
- Budget : 300 €/mois, arrêt dur dans le runner. Estimation : ~175 $/mois avec les deux colonnes.
- Détail dans `docs/specs/2026-11-03-code-audit-trial-design.md`.

## Où on en est

État au 2026-11-04, vérifié sur le site et le dépôt.

**Existe :** catalogue avec trente-cinq packages signés AgentHive : quinze d'audit de code
(un généraliste, quatre généralistes par stack, dix spécialistes avec périmètre déclaré),
classés sur l'épreuve, et vingt agents « untested » sur quatre métiers (growth, writing,
research, data-analysis), à entrée en texte collé, sans serveur MCP ; fiches,
audit statique, classement, CLI (`search`, `info`, `pull`, `push`), serveur MCP du
catalogue, gateway, comptes GitHub, Google et email (mails par SES), clés d'API.
Première épreuve `code-audit` en production : harness open source (`packages/harness`),
8 tâches publiques et 4 privées tournantes dans un dépôt privé, sandbox E2B sans
réseau, Haiku 5.5 ×3 et Sonnet 5.5 ×1, batch hebdomadaire sur GitHub Actions, page
`/trials/code-audit` avec score, variance, coût, temps, pièges et détail par catégorie,
onglet Trial sur chaque fiche avec les runs enregistrés, méthodologie sur la page.
Trois batches, environ 20 $ au total. Toute personne connectée peut déjà publier un
package avec `agent-cli push` et il entre dans le batch suivant. Règle du catalogue
(décidée le 2026-11-04) : un package sans run d'épreuve porte un badge « untested » et
l'accueil a un filtre « tested only » ; le badge tombe dès que son métier a une épreuve. Signalement depuis
chaque fiche (mail aux mainteneurs), dépublication par l'auteur, retrait par un admin
avec pierre tombale sur le nom (410), résultats d'épreuve conservés ; compteur de
récupérations (`pulls`) sur chaque package.

**N'existe pas encore :** CGU publiées (brouillon dans `legal/terms-draft.md`, à faire
relire) ; résultats publiés hors du site ; agents tiers classés ; retrait vers Codex ;
rapport mensuel ; deuxième épreuve ; fork avec filiation.

### Problèmes du site, relevés le 2026-11-03

Les cinq points relevés ce jour-là (message « registry for interoperable AI agents »,
rien sans JavaScript, agents fictifs, modal v0, connexion GitHub seule) sont corrigés
au 2026-11-04 : page d'accueil et modal en anglais autour du banc d'essai, rendu
serveur des fiches, du classement et de l'épreuve, fictifs retirés, Google et email.

## Roadmap proposée

Six mois, dimensionnés pour une seule épreuve bien faite. Le porteur a deux emplois à côté.

| Période | Contenu | Terminé quand |
|---|---|---|
| Mois 1 | Retirer les fictifs, nouveau modal, rendu serveur, page d'accueil en anglais, login Google et email | Le site dit la même chose que la vision. **Fait le 2026-11-04.** |
| Mois 1 à 2 | Première épreuve d'audit (apps vibe-codées, failles placées), harness, 5 à 10 agents classés, runs enregistrés avec coût et variance | Un classement crédible existe. **Fait le 2026-11-04** avec 5 agents ; le pool monte à 10 au fil de l'eau. |
| Mois 2 à 3 | Résultats publiés (Hacker News, Reddit), soumission ouverte aux tiers, CGU et retrait en place | Des agents externes sont soumis. **En cours :** la soumission marche déjà, CGU et retrait à écrire, publication à faire. |
| Mois 3 | Conversations avec 5 freelances et de premières équipes sur l'épreuve privée | On sait si quelqu'un paierait |
| Mois 3 à 4 | Export en un clic vers Claude Code et Cursor, puis Codex | L'agent tourne dans l'outil après une seule action |
| Mois 4 à 6 | Deuxième épreuve, rapport mensuel, serveur MCP « meilleur agent pour X » | AgentHive est cité comme source |

Sandbox en direct et fork sur le site : après ces preuves.

### Indicateurs des six mois

- Agents soumis par des tiers sur l'épreuve (indicateur principal).
- Récupérations mesurées depuis Claude Code, Cursor et Codex.
- Freelances ou équipes prêts à payer une épreuve privée.

## Choix de conception

Détail dans `specs/2026-11-02-v2-hub-design.md`. Ce qui reste valable :

- **Déclaratif d'abord (décidé) :** pas de code dans l'agent, le code vit dans les MCP.
- **Package :** `agent.yaml`, `prompt.md`, `skills/`, `examples/`. Fine couche au-dessus de
  SKILL.md et MCP. Skills copiées, MCP épinglés, réglages typés, jamais de valeur de clé.
- **Export :** Cursor et Claude Code d'abord, puis Codex. Permissions affichées avant la
  copie, versions épinglées, jamais de texte d'auteur dans un prompt généré.
- **Épreuve :** une partie publique, une partie privée tournante, plusieurs runs par
  agent, modèle et coût affichés, pièges de sécurité comptés à part.
- **Fork (plus tard) :** republication contrôlée, filiation, scores jamais hérités, chaque
  variante repasse l'épreuve.

## Critiques et risques

Mis à jour le 2026-11-03.

1. **Vercel relie skills.sh et DeepsecBench** et occupe la place. Réponse : vitesse sur la
   niche, neutralité, installabilité.
2. **Crédibilité de l'épreuve :** des tâches mal construites et les développeurs confirmés
   décrochent. Réponse : méthodologie publique, variance, revue par des experts sécurité.
3. **Gaming de l'épreuve :** les auteurs optimisent pour le test. Réponse : tâches privées
   tournantes.
4. **Écart épreuve / usage réel :** modèle, outil et données diffèrent. Réponse : afficher
   modèle et outil, résultats par outil à terme.
5. **Coût des runs :** plusieurs runs par agent et par modèle. Réponse : plafond mensuel
   d'environ 300 EUR, runs mutualisés entre classement et exemples.
6. **Risque juridique :** on héberge depuis l'UE des instructions que des tiers exécutent.
   CGU, signalement et retrait, avis d'avocat avant toute promotion.
7. **Personne ne soumet :** à mesurer dès le mois 3, avant de construire sandbox et fork.

## Pitch

**Une phrase :** « AgentHive, c'est le banc d'essai des agents IA : on les fait passer sur
les mêmes tests réels, et on publie lequel fait vraiment le travail. »

**30 secondes :**

1. Problème : des milliers d'agents IA, personne ne sait lesquels marchent. On choisit aux
   étoiles ou au marketing.
2. Solution : des épreuves publiques, par exemple 20 apps avec des failles cachées. Chaque
   agent passe la même épreuve, classement sur le résultat.
3. Usage : regarder le classement, voir l'agent travailler, l'installer en un clic dans son
   outil. Si on l'améliore, on le resoumet.
4. Pourquoi maintenant : les agents se multiplient plus vite que la confiance, les
   annuaires comptent les téléchargements, personne ne mesure l'efficacité de l'agent
   installable.

**Analogies :** Que Choisir des agents IA (grand public), SWE-bench pour agents métier
(développeurs), Lighthouse pour les agents (investisseurs).

**À éviter :** ouvrir par « hub », « registre » ou « Hugging Face des agents ». Parler de
MCP, skills ou fork dans les deux premières minutes. Toujours avoir un résultat chiffré
sous la main.

## Questions ouvertes

1. ~~Quelle part des tâches de l'épreuve rendre publique, et à quel rythme les renouveler ?~~ Tranché le 2026-11-04 : 8 publiques, 4 privées, une privée remplacée par trimestre.
2. ~~Combien de runs par agent pour une variance acceptable ?~~ 3 runs sur le modèle de référence ; Sonnet à 1 run tant que le budget ne permet pas 3.
3. ~~Classement par modèle et outil, ou classement unique ?~~ Un classement par épreuve, une ligne par modèle, détail par catégorie de faille (2026-11-04).
4. Qui revoit les épreuves (experts sécurité externes) ?
5. Prix et contenu exact de l'offre pro freelances.
6. Positionnement face à Vercel si skills.sh et DeepsecBench se rapprochent.
7. ~~Modèle de référence pour les runs de l'épreuve.~~ Haiku 5.5 (2026-11-03) ; un batch complet coûte environ 11 $.
8. Fork public par défaut une fois publié ?
9. Licences acceptées pour autoriser le fork.
10. ~~Fournisseur du harness d'exécution.~~ E2B, plan Hobby (2026-11-03).

## Sources

- skills.sh : https://skills.sh/about
- Vercel State of Agent Skills (résumé) : https://ecosistemastartup.com/vercel-skills-sh-alcanza-1-millon-de-agent-skills/
- Comparatif registres MCP : https://qveris.ai/guides/mcp-registry-comparison/index.html
- Smithery / Arcade.dev : https://www.ai.engineer/orgs/smithery
- Snyk Agent Scan : https://dev.co/ai/mcp/agent-scan
- mcpm, registres et serveur empoisonné : https://socket.dev/npm/package/@getmcpm/cli/overview/0.29.0
- HAL (Princeton) : https://hal.cs.princeton.edu/
- Agents' Last Exam : https://noqta.tn/en/blog/agents-last-exam-ale-benchmark-ai-agents-real-work-2026
- DeepsecBench-AA : https://benchlm.ai/benchmarks/aadeepsecbench
- Agent Security League (Endor Labs) : https://benchmarklist.com/benchmarks/agent_security_league/
- Instabilité des classements de détection (EVMbench) : https://arxiv.org/html/2603.10795v1
- Arena agent leaderboard : https://casrai.org/news/agentic-ai-benchmarks-research-automation-governance
- find-skills (Vercel) : https://skillselion.com/skills/vercel-labs/skills/find-skills
- Sources de la session du 2026-11-02 : dans `HANDOFF-2026-11-02.md`.
