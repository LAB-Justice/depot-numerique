# Dépôt Numérique

Application de dépôt automatisé de documents métier.

Le projet est initialisé en monorepo avec `pnpm` et `Turbo`. Il contient actuellement :

- `apps/api` : API NestJS ;
- `apps/web` : frontend Angular ;
- `apps/worker` : workers BullMQ ;
- `packages/database` : schéma, migrations, seed et client Prisma partagés ;
- `docs` : documentation VitePress ;
- `turbo.json` : configuration des tâches monorepo ;
- `pnpm-workspace.yaml` : déclaration des workspaces pnpm.

## Prérequis

- Node.js, via `nvm`.
- pnpm `11.8.0`.
- Docker et Docker Compose, pour les services techniques locaux.

La version Node attendue est indiquée dans `.nvmrc`.

```bash
nvm use
```

Si la version n'est pas installée :

```bash
nvm install
```

## Installation

Depuis la racine du dépôt :

```bash
pnpm install
```

Si pnpm demande d'approuver des scripts de build :

```bash
pnpm approve-builds
```

Puis relancer :

```bash
pnpm install
```

Installer les hooks Git locaux avec Lefthook :

```bash
pnpm exec lefthook install
```

La commande `pnpm install` exécute aussi le script `prepare`, qui installe Lefthook automatiquement. La commande ci-dessus reste utile si les hooks ne sont pas présents après un clone ou un changement d'environnement.

Créer les fichiers d'environnement locaux :

```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp packages/database/.env.example packages/database/.env
cp apps/worker/.env.example apps/worker/.env
```

Le fichier racine configure PostgreSQL, Redis et MinIO. Le fichier de l'API définit `API_PORT` et
`NODE_ENV`, celui de Prisma fournit `DATABASE_URL`, et celui du worker définit `WORKER_PORT` et
`NODE_ENV`. Ces fichiers ne doivent pas être commités.

## Lancer le projet

Pour démarrer les services Docker, attendre leur disponibilité, puis lancer toutes les tâches de
développement déclarées dans les workspaces :

```bash
pnpm dev
```

Cette commande lance PostgreSQL, Redis et MinIO, puis Turbo démarre l'API, le frontend, le worker et
la documentation.

Pour lancer l'API NestJS, le frontend Angular et le worker BullMQ sans démarrer l'infrastructure
Docker ni la documentation :

```bash
pnpm apps:dev
```

Services exposés en développement :

- API NestJS : `http://localhost:3000`
- Frontend Angular : `http://localhost:4200`
- Documentation VitePress : `http://localhost:5173/depot-numerique/`

## Lancer Un Service Applicatif

API NestJS :

```bash
pnpm api:dev
```

Frontend Angular :

```bash
pnpm web:dev
```

Documentation VitePress :

```bash
pnpm docs:dev
```

Worker BullMQ :

```bash
pnpm worker:dev
```

## Commandes utiles

Les commandes suivent une nomenclature simple :

- `pnpm <tâche>` lance la tâche sur tous les workspaces concernés via Turbo.
- `pnpm <workspace>:<tâche>` lance la même tâche sur un workspace précis.
- Les workspaces disponibles sont `api`, `web`, `worker`, `docs` et `database`.
- Les commandes `dev` sont des serveurs persistants et ne sont pas mises en cache par Turbo.

Exemples :

```bash
pnpm build
pnpm api:build
pnpm web:build
pnpm docs:build
pnpm database:build
pnpm worker:build
```

Lister les packages du workspace :

```bash
pnpm -r list --depth -1
```

Compiler tous les packages qui exposent une tâche `build` :

```bash
pnpm build
```

Compiler un workspace précis :

```bash
pnpm api:build
pnpm web:build
pnpm docs:build
```

Lancer les tests :

```bash
pnpm test
```

Lancer les tests d'un workspace précis :

```bash
pnpm api:test
pnpm web:test
pnpm worker:test
```

Le test du worker couvre le processor de la queue de démonstration sans nécessiter Redis. Il n'y a
pas de commande `docs:test`, car la documentation n'expose pas de script de test.

Lancer le lint Biome :

```bash
pnpm lint
```

Lancer le lint sur un workspace précis :

```bash
pnpm api:lint
pnpm web:lint
pnpm docs:lint
pnpm database:lint
pnpm worker:lint
```

Formater le code avec Biome :

```bash
pnpm format
```

Formater un workspace précis :

```bash
pnpm api:format
pnpm web:format
pnpm docs:format
pnpm database:format
pnpm worker:format
```

Vérifier le formatage sans modifier les fichiers :

```bash
pnpm format:check
```

Vérifier le formatage d'un workspace précis :

```bash
pnpm api:format:check
pnpm web:format:check
pnpm docs:format:check
pnpm database:format:check
pnpm worker:format:check
```

Vérifier le formatage, le lint et les règles Biome :

```bash
pnpm check
```

Vérifier un workspace précis :

```bash
pnpm api:check
pnpm web:check
pnpm docs:check
pnpm database:check
pnpm worker:check
```

Vérifier les types TypeScript :

```bash
pnpm typecheck
```

Vérifier les types d'un workspace précis :

```bash
pnpm api:typecheck
pnpm web:typecheck
pnpm database:typecheck
pnpm worker:typecheck
```

Il n'y a pas de commande `docs:typecheck`, car VitePress est vérifié via `pnpm docs:build`.

Corriger automatiquement ce qui peut l'être :

```bash
pnpm check:fix
```

Corriger automatiquement un workspace précis :

```bash
pnpm api:check:fix
pnpm web:check:fix
pnpm docs:check:fix
pnpm database:check:fix
pnpm worker:check:fix
```

Détecter les dépendances inutilisées et le code mort :

```bash
pnpm knip
```

Lancer tous les contrôles qualité avant une PR ou un push important :

```bash
pnpm verify
```

Cette commande enchaîne `pnpm check`, `pnpm knip`, `pnpm typecheck` et `pnpm test`.

## Base de données

Le workspace `@depot-numerique/database` centralise Prisma pour l'API et les futurs workers.
PostgreSQL stocke les métadonnées métier et les références MinIO ; les fichiers binaires restent
dans MinIO.

Commandes principales :

```bash
pnpm database:build
pnpm database:lint
pnpm database:format
pnpm database:format:check
pnpm database:check
pnpm database:check:fix
pnpm database:typecheck
pnpm database:generate
pnpm database:validate
pnpm database:migrate:dev --name description
pnpm database:migrate:deploy
pnpm database:migrate:status
pnpm database:seed
pnpm database:studio
```

Le workspace database n'a pas encore de commande de test dédiée.

Les migrations créées en développement sont versionnées dans
`packages/database/prisma/migrations`. En recette et en production, la CI/CD applique ces mêmes
migrations avec `pnpm database:migrate:deploy` sur la base de l'environnement concerné.

Le seed initial crée les juridictions `TJ-LILLE`, `TJ-ARRAS`, `TJ-DOUAI` et `TJ-CAMBRAI`, chacune
avec les services `AUD`, `BAJ`, `BOG`, `JAF` et `JAP`. Il est destiné au développement et aux tests.

La documentation détaillée se trouve dans [`docs/database.md`](docs/database.md).

## Qualité de code

Le projet utilise une configuration centralisée à la racine du monorepo.

- Biome : formatage et lint.
- Knip : détection des dépendances inutilisées, exports inutilisés et fichiers morts.
- Lefthook : hooks Git locaux.
- Commitlint : validation des messages de commit au format Conventional Commits.

Avant de commit, Lefthook lance Biome sur les fichiers staged et réajoute automatiquement les fichiers corrigés.

Au commit, Lefthook lance aussi Commitlint sur le message de commit.

Avant un push, Lefthook lance en parallèle `pnpm check`, `pnpm knip`, `pnpm typecheck` et `pnpm test`.

Tester le dernier commit :

```bash
pnpm commitlint
```

Commandes principales :

```bash
pnpm format
pnpm format:check
pnpm lint
pnpm check
pnpm check:fix
pnpm verify
pnpm typecheck
pnpm knip
pnpm prepare
```

## Docker

Docker Compose lance les services techniques utilisés en développement local.

Services disponibles :

- PostgreSQL : base de données métier ;
- Redis : cache et backend BullMQ ;
- MinIO : stockage des documents ;
- plus tard, images séparées pour l'API, le frontend et les workers.

Les versions d'images sont volontairement fixées dans `docker-compose.yml`. Ne pas utiliser `latest` pour les services d'infrastructure.

Versions locales actuelles :

- PostgreSQL : `postgres:17.10-bookworm`
- Redis : `redis:7.4.9-bookworm`
- MinIO : `minio/minio:RELEASE.2025-09-07T16-13-09Z`

Dependabot surveille les mises à jour Docker Compose, GitHub Actions et npm/pnpm via `.github/dependabot.yml`.

Créer un fichier `.env` local à partir de l'exemple si nécessaire :

```bash
cp .env.example .env
```

Le fichier `.env` ne doit pas être commit. Il est ignoré par Git.

Lancer les services :

```bash
docker compose up -d
```

Lancer uniquement PostgreSQL :

```bash
docker compose up -d postgres
```

Lancer uniquement Redis :

```bash
docker compose up -d redis
```

Lancer uniquement MinIO :

```bash
docker compose up -d minio
```

Vérifier leur état :

```bash
docker compose ps
```

Afficher les logs :

```bash
docker compose logs -f
```

Arrêter les services :

```bash
docker compose down
```

Supprimer aussi les volumes locaux :

```bash
docker compose down -v
```

Attention : `docker compose down -v` supprime les données PostgreSQL, Redis et MinIO locales.

Accès locaux par défaut :

- PostgreSQL : `localhost:5432`
- Redis : `localhost:6379`
- MinIO API : `http://localhost:9000`
- MinIO Console : `http://localhost:9001`

Les identifiants locaux sont définis dans `.env`.

## Documentation

La documentation technique est dans `docs/` et utilise VitePress.

Commandes disponibles :

```bash
pnpm docs:dev
pnpm docs:build
pnpm docs:preview
```

Le package documentation est déclaré comme workspace `@depot-numerique/docs` dans `docs/package.json`.

La configuration VitePress utilise `base: '/depot-numerique/'` pour une publication GitHub Pages sur ce dépôt.

## Structure actuelle

```text
apps/
  api/    # API NestJS
  web/    # Frontend Angular
docs/     # Documentation VitePress
packages/
  database/ # Schéma, migrations, seed et client Prisma
```

## Stack

- Monorepo : `Turbo`
- Gestionnaire de paquets : `pnpm`
- Backend : `NestJS`
- Frontend : `Angular`
- Documentation projet : `VitePress`
- Base de données : `PostgreSQL`
- ORM : `Prisma`
- Queue et cache : `BullMQ`, `Redis`
- Stockage fichiers : `MinIO`
- Automatisation web : `Playwright`
- Documentation API : `Swagger / OpenAPI`
- Conteneurisation : `Docker`, `Docker Compose`
- Qualité de code : `Biome`, `Knip`, `Lefthook`, `Commitlint`
- CI/CD : `GitHub Actions`
- Secrets : `Vault`
- Supervision : `Prometheus`, `Grafana`
