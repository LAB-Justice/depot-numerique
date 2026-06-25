# Dépôt Numérique

Application de dépôt automatisé de documents métier.

Le projet est initialisé en monorepo avec `pnpm` et `Turbo`. Il contient actuellement :

- `apps/api` : API NestJS ;
- `apps/web` : frontend Angular ;
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

## Lancer le projet

Pour lancer toutes les tâches de développement déclarées dans les workspaces :

```bash
pnpm dev
```

Cette commande passe par Turbo et lance les scripts `dev` des packages qui en possèdent un, actuellement l'API, le frontend et la documentation.

Pour lancer seulement le backend NestJS et le frontend Angular :

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

## Commandes utiles

Lister les packages du workspace :

```bash
pnpm -r list --depth -1
```

Compiler tous les packages qui exposent une tâche `build` :

```bash
pnpm build
```

Lancer les tests :

```bash
pnpm test
```

Lancer le lint Biome :

```bash
pnpm lint
```

Formater le code avec Biome :

```bash
pnpm format
```

Vérifier le formatage sans modifier les fichiers :

```bash
pnpm format:check
```

Vérifier le formatage, le lint et les règles Biome :

```bash
pnpm check
```

Corriger automatiquement ce qui peut l'être :

```bash
pnpm check:fix
```

Détecter les dépendances inutilisées et le code mort :

```bash
pnpm knip
```

## Qualité de code

Le projet utilise une configuration centralisée à la racine du monorepo.

- Biome : formatage et lint.
- Knip : détection des dépendances inutilisées, exports inutilisés et fichiers morts.
- Lefthook : hooks Git locaux.
- Commitlint : validation des messages de commit au format Conventional Commits.

Avant de commit, Lefthook lance Biome sur les fichiers staged et réajoute automatiquement les fichiers corrigés.

Au commit, Lefthook lance aussi Commitlint sur le message de commit.

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
