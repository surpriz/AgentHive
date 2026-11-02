# Vision d'AgentHive

Document de référence, mis à jour le 2026-11-02. La partie « Vision validée » est
décidée par le porteur de projet. La partie « Roadmap » et les choix de conception
sont des propositions, sauf mention contraire.

## Vision validée

Le Hugging Face des agents IA, indépendant de GitHub, communautaire et gratuit pour
l'instant.

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
- Priorité au sandbox et au fork, cœur de la proposition de valeur.

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

## Stratégie

Décidée par le porteur de projet le 2026-11-02, après discussion. Elle précise la
vision sans la contredire : le hub, le sandbox et le remix sont des moyens, la
confiance mesurée est la fin.

### Positionnement

**La couche de confiance des agents IA, quel que soit l'outil.** Pas le plus gros
catalogue, mais le seul endroit où un agent, une skill ou un serveur MCP a un score
mesuré par un tiers neutre. Les éditeurs d'outils (Anthropic, Cursor, OpenAI) auront
leur propre hub et ne noteront jamais objectivement ce qui tourne chez un concurrent.
Les annuaires MCP ont déjà gagné la course au volume. La neutralité et la mesure sont
la place qui reste, et le code existant (audit, benchmark, classement) est déjà dessus.

### Pourquoi « le Hugging Face des agents » ne se copie pas tel quel

Hugging Face a gagné grâce à un artefact lourd que personne ne voulait héberger et à
une librairie installée partout. Un agent déclaratif fait quelques kilo-octets et se
copie-colle : aucune friction d'hébergement, donc aucune raison naturelle de passer
par un hub. La raison doit venir d'ailleurs : la confiance mesurée, et la présence
dans l'outil de l'utilisateur.

### Trois conséquences

1. **Indexer ce qui existe déjà, sans attendre les uploads.** Scanner et noter des
   skills et serveurs MCP publics (registre officiel, GitHub, autres hubs) donne un
   contenu international dès le premier mois, un référencement naturel sur les
   requêtes du type « is X safe », et une raison pour les auteurs de venir réclamer
   leur page et améliorer leur score. C'est la stratégie de Snyk Advisor et de
   Libraries.io. L'upload et le remix viennent par-dessus, pour ceux qui publient chez
   nous.
2. **L'audit de code et de sécurité comme preuve publique.** Un agent d'AgentHive qui
   trouve de vraies failles dans des apps vibe-codées de démonstration, résultats
   publiés. C'est ce qui fait un lancement sur Hacker News, pas l'annonce d'un hub.
3. **Préparer le revenu sans rien facturer.** Le business n'est pas la communauté.
   Hugging Face gagne de l'argent avec les hubs privés, le SSO et le compute. Pour les
   agents, l'équivalent est la gouvernance : quelles briques tournent dans l'équipe,
   avec quelles permissions et quelles clés, validées par qui. Les équipes sécurité
   bloquent déjà les MCP en entreprise. Chaque fonctionnalité communautaire doit avoir
   une version entreprise évidente (registre privé, politique d'approbation, audit des
   briques internes), et les premières conversations avec des équipes sécurité
   commencent au mois 3, pas au mois 7.

### Ce que les six mois doivent prouver

« Plateforme internationale » avec une personne, six mois et un budget modéré est une
levée de fonds à préparer, pas un plan d'exécution. Les six mois doivent produire des
preuves lisibles par un investisseur et par une communauté :

- des publications hebdomadaires par des tiers, pas seulement par le porteur ;
- des récupérations mesurables depuis Cursor et Claude Code ;
- deux ou trois équipes qui ont demandé une version privée.

Sans ces preuves, l'international n'arrive pas, quel que soit le produit.

### Ce que ça change dans l'ordre de travail

Le sandbox et le fork restent la différenciation produit. Ils passent après deux
preuves moins chères : que la confiance mesurée attire (indexation et preuve publique),
et que des gens récupèrent réellement les agents (test à la main). Un sandbox vide et
un fork sans forkeurs ne prouvent rien. Le fork, en particulier, est le pari le plus
incertain : réécrire un prompt localement coûte trente secondes, donc une version
republiée doit gagner quelque chose qu'une copie locale n'a pas, scores, place au
classement, filiation visible.

### Risque juridique

Héberger depuis l'UE des instructions que des gens exécutent sur leur machine, après
la campagne de skills malveillantes subie par ClawHub, impose CGU, procédure de
signalement et de retrait, et un avis d'avocat avant toute promotion. Un incident de
sécurité public tue un hub dont la promesse est la confiance.

## Où on en est

**Existe déjà :** catalogue, fiches, audit de sécurité, benchmark, classement, CLI,
serveur MCP du catalogue, gateway d'appel vers le serveur de l'auteur.

**N'existe pas encore :** format de package, sandbox réel, récupération en 1 clic qui
fonctionne (`agent-cli add` échoue), fork, republication avec filiation.

**Écart à combler :** 6 des 7 agents en ligne sont fictifs, et le sandbox actuel rejoue
un scénario écrit à la main.

## Roadmap proposée

### Étape 1 : valider

Écrire 5 vrais agents à la main au format ci-dessous, sur les objectifs retenus. Les
donner à 10 personnes de la cible, nouveaux venus et développeurs. Observer s'ils
les installent seuls, s'ils y reviennent après une semaine et ce qu'ils modifient.

### Étape 2 : remettre le site au propre et indexer l'existant

Corriger ou retirer `agent-cli add` et remplacer le modal périmé. Retirer les agents
fictifs dès que les premiers vrais agents sont prêts, pour ne pas laisser un catalogue
vide. Ajouter une connexion Google et email, car la cible n'a pas toujours GitHub.

En parallèle, indexer et noter des skills et serveurs MCP publics avec l'audit
existant, avec page réclamable par l'auteur. C'est le contenu international du
premier mois (voir Stratégie).

### Étape 2 bis : la preuve publique

L'agent d'audit de code d'AgentHive tourne sur des apps vibe-codées de démonstration,
résultats publiés. C'est le matériau du lancement dans les communautés.

### Étape 3 : tester et récupérer

| Sous-étape | Contenu | Terminé quand |
|---|---|---|
| 3a. Format et catalogue | Format de package, catalogue par objectif, 20 à 30 vrais agents | Un agent se publie et s'affiche avec ses briques |
| 3b. Exemples réels | Runs enregistrés sur chaque fiche | Une fiche montre ce que fait l'agent sans rien lancer |
| 3c. Sandbox | Run en direct sur le site, avec trace visible | Un visiteur teste sans clone ni installation |
| 3d. Récupération | Export vers Cursor et Claude Code, puis autres outils | L'agent tourne dans l'outil après une seule action |

### Étape 4 : remix

| Sous-étape | Contenu | Terminé quand |
|---|---|---|
| 4a. Fork sur le site | Éditeur de prompt, réglages, skills et MCP | Un utilisateur modifie une copie sans rien installer |
| 4b. Test avant publication | Sandbox dans l'éditeur, comparaison avec l'original | Il voit l'effet de sa modification |
| 4c. Republication | Nouvelle version sous son nom, filiation, contrôles | La version publiée pointe vers son original |
| 4d. Aller-retour CLI | `pull` et `push` depuis Cursor ou le terminal | Une version modifiée en local revient en fork |
| 4e. Familles | Arbre des variantes, classement dans une même famille | Le catalogue n'est pas noyé sous les variantes |

### Étape 5 : élargir

Communauté (likes, tendances, discussions), agents avec code, personnalisation assistée
par IA, autres outils cibles.

### En continu : préparer l'offre équipes

Dès le mois 3, conversations avec des équipes sécurité et produit. Chaque brique
communautaire garde une déclinaison entreprise en tête : registre privé, politique
d'approbation, audit des briques internes, SSO. Rien n'est facturé avant la preuve
d'usage, mais la destination est connue.

## Choix de conception proposés

### Le package

```
my-agent/
  agent.yaml          objectif, réglages, briques, besoins du modèle, tests
  prompt.md           la logique de l'agent
  skills/<nom>/SKILL.md
  examples/           entrées et données d'exemple pour le sandbox
```

- **Déclaratif d'abord (décidé) :** pas de code à exécuter dans l'agent, ce qui rend le
  fork, le test et l'audit beaucoup plus simples. Le code vit dans les serveurs MCP.
- **Skills copiées dans le package :** un fork reste complet même si la skill d'origine
  change. Pas de scripts dans les skills pour commencer.
- **MCP référencés et épinglés :** par version exacte. Le package déclare les noms des
  variables nécessaires, jamais leurs valeurs.
- **Réglages typés :** déclarés dans `agent.yaml` et affichés en formulaire, pour
  personnaliser sans toucher au prompt.

### Les agents open source

Beaucoup sont du code (LangGraph, CrewAI) et n'entrent pas dans ce format. Proposition :
assembler de vrais agents déclaratifs à partir de skills et de serveurs MCP open source,
avec licence vérifiée et crédit aux auteurs. Les agents avec code arrivent à l'étape 5.
Le mode « hébergé par l'auteur » reste disponible via la gateway, sans fork.

### Le sandbox

Une boucle d'agent hébergée par AgentHive : modèle, prompt et skills, puis appels MCP.

- **Entrée :** formulaire simple ou texte collé, pré-rempli avec un exemple.
- **Trace visible :** skills chargées, appels MCP et réponses. C'est ce qui fait
  comprendre et donne envie de modifier.
- **Données :** exemples fournis, texte collé ou ressources publiques. Pas de connexion
  aux comptes de l'utilisateur à ce stade, avec un avertissement avant de coller des
  données pro.
- **Sécurité :** MCP en lecture seule, issus d'une liste validée, isolés. Une brique non
  validée rend l'agent non testable en direct, et la fiche l'indique.
- **Coût :** limite d'étapes et de tokens par run, quota par compte, plafond mensuel.
  Une boucle d'agent consomme bien plus qu'un échange de chat.

Limite assumée : le sandbox montre le comportement sur des exemples, pas sur les
données réelles de l'utilisateur.

### La récupération en 1 clic

- **Cibles de départ :** Cursor et Claude Code, qui lisent déjà skills et configuration
  MCP. Cela correspond à la cible et évite l'incertitude sur les chats grand public.
- **Forme :** une seule action, commande ou prompt à copier, ou lien profond là où c'est
  possible (à vérifier par outil). Les clés restent à renseigner par l'utilisateur.
- **Sécurité :** installer un MCP revient à exécuter du code sur sa machine. Permissions
  affichées en clair avant la copie, versions épinglées, jamais de texte d'auteur dans
  un prompt généré.

### Le fork

- **Republication contrôlée :** brouillon privé d'abord, contrôle des secrets et des
  données d'entreprise, licence compatible obligatoire.
- **Filiation :** enregistrée par le serveur et affichée sur la fiche, avec crédit à
  l'auteur d'origine.
- **Scores :** jamais hérités. Chaque version publiée repasse l'audit et les tests.
- **Mises à jour :** versions immuables, et un fork est prévenu quand son original évolue.

### Garder les développeurs confirmés

CLI et API complètes, aller-retour `pull`/`push`, agents avec code à l'étape 5, et une
vraie place comme auteurs de serveurs MCP et de skills, dont dépendent les agents.

### Ce qu'on réutilise

Audit, benchmark, classement, CLI, comptes et clés d'API. Le benchmark tourne désormais
dans le sandbox, et ses runs alimentent les exemples enregistrés.

## Critiques et risques

Avis formulé le 2026-11-02, à discuter. La direction est cohérente, mais ces points
peuvent la faire échouer, du plus grave au moins grave.

1. **Pourquoi republier ?** La boucle repose sur des gens qui partagent leur version. Or
   une version adaptée à son entreprise contient souvent du contexte privé, et la plupart
   des utilisateurs consomment sans publier. Sans raison de publier (réputation, profil,
   classement des forks), la boucle reste vide.
2. **Sécurité :** la cible installe sans toujours lire, et n'importe qui peut republier
   une variante. ClawHub a déjà subi une campagne de centaines de skills malveillantes,
   dont certaines ont passé ses contrôles. Une note AAA sur un agent texte donnerait une
   fausse assurance : l'audit statique ne juge pas des instructions malveillantes écrites
   en langage naturel.
3. **Valeur par rapport à Cursor :** un agent déclaratif se réécrit vite avec l'IA et
   s'imite facilement. Ce qui est défendable : les mesures, la communauté, la filiation.
4. **Écart entre sandbox et usage réel :** le modèle, les outils et les données diffèrent.
   Un agent qui brille dans le sandbox peut décevoir dans Cursor, et l'export vers chaque
   outil peut en perdre une partie.
5. **Ordre de construction :** sandbox et fork sont les pièces les plus chères. Le fork
   n'a aucun intérêt sans utilisateurs à forker.
6. **Format :** les standards SKILL.md et MCP existent déjà. Personne n'adoptera un format
   propre à AgentHive, donc `agent.yaml` doit rester une fine couche au-dessus d'eux.
7. **Deux mondes :** les développeurs confirmés se méfient des catalogues pour vibe coders.
   Il faut un objectif qui parle aux deux.
8. **Durée :** gratuit, avec un coût qui grandit avec le succès et 6 mois de moyens. La
   réponse pour le mois 7 est dans la section Stratégie : preuves à produire pour lever,
   et offre équipes préparée dès le mois 3.

**Pourquoi l'audit de code et de sécurité (retenu).** Les études de 2026 trouvent
beaucoup de failles dans les apps vibe-codées (secrets exposés, contrôle d'accès). Les
vibe coders ont le problème, les développeurs ont l'expertise pour écrire et juger les
agents, et le résultat se mesure sur des failles connues placées dans un code de test.
L'audit fait aussi écho à l'ADN de confiance du projet.

## Questions ouvertes

1. **Modèle du sandbox :** lequel choisir dans le plafond de 300 EUR/mois ? Un petit modèle
   peut faire paraître un bon agent mauvais. Clé de l'utilisateur en option dans tous les cas.
2. **Raison de republier :** réputation, profil, classement des forks ? Et un fork est-il
   public par défaut ?
3. **Sécurité des agents texte :** comment présenter la note sans donner une fausse assurance ?
4. **Plan d'acquisition :** quelles communautés précises, avec quel message ?
5. **Offre payante :** son contenu et le seuil d'usage qui la déclenche.
6. **Fournisseurs :** sandbox et stockage, après vérification des prix.
7. **Licences :** quelles licences acceptées pour autoriser le fork ?
