# Dépôt Numérique

Application de dépôt automatisé de documents métier.

Le projet est initialisé en monorepo avec `pnpm` et `Turbo`. Il contient actuellement :

- `apps/api` : API NestJS ;
- `apps/web` : frontend Angular ;
- `turbo.json` : configuration des tâches monorepo ;
- `pnpm-workspace.yaml` : déclaration des workspaces pnpm.

## Prérequis

- Node.js, via `nvm`.
- pnpm `11.8.0`.
- Docker et Docker Compose, pour les services techniques qui seront ajoutés ensuite.

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

## Lancer le projet

Pour lancer le backend NestJS et le frontend Angular en même temps :

```bash
pnpm turbo dev
```

Services exposés en développement :

- API NestJS : `http://localhost:3000`
- Frontend Angular : `http://localhost:4200`

## Lancer une application seule

API NestJS :

```bash
pnpm --filter api dev
```

Frontend Angular :

```bash
pnpm --filter web dev
```

## Commandes utiles

Lister les packages du workspace :

```bash
pnpm -r list --depth -1
```

Compiler tous les packages qui exposent une tâche `build` :

```bash
pnpm turbo build
```

Lancer les tests :

```bash
pnpm turbo test
```

Lancer le lint :

```bash
pnpm turbo lint
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

## Structure actuelle

```text
apps/
  api/    # API NestJS
  web/    # Frontend Angular
packages/
```

## Stack cible

- Monorepo : Turbo
- Gestionnaire de paquets : pnpm
- Backend : NestJS
- Frontend : Angular
- Base de données : PostgreSQL
- ORM : Prisma
- Queue et cache : BullMQ, Redis
- Stockage fichiers : MinIO
- Automatisation web : Playwright
- Documentation API : Swagger / OpenAPI
- Conteneurisation : Docker
