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

Docker sera utilisé pour lancer les services techniques du projet.

Services prévus :

- PostgreSQL : base de données métier ;
- Redis : cache et backend BullMQ ;
- MinIO : stockage des documents ;
- plus tard, images séparées pour l'API, le frontend et les workers.

La commande cible sera :

```bash
docker compose up --build
```

Le fichier `docker-compose.yml` n'est pas encore créé à ce stade du projet.

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
