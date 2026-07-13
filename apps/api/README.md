# API Dépôt Numérique

API HTTP NestJS de Dépôt Numérique. Ce workspace fournit le socle applicatif : configuration
validée, logs structurés, sécurité HTTP, versionnement, documentation OpenAPI et contrôles de santé
de PostgreSQL, Redis et MinIO.

La documentation technique détaillée se trouve dans [`docs/api.md`](../../docs/api.md).

## Structure

```text
apps/api/
  src/
    main.ts                     # Création et démarrage de l'application NestJS
    app.module.ts               # Module racine et configuration globale
    app.controller.ts           # Route technique versionnée de base
    app.service.ts              # Service associé à la route de base
    bootstrap/
      configure-app.ts          # CORS, Helmet, versionnement et validation HTTP
      configure-swagger.ts      # Configuration OpenAPI
    config/
      environment.schema.ts     # Validation Joi des variables d'environnement
      logger.config.ts          # Configuration des logs Pino
    core/
      database/                 # Client Prisma et cycle de vie PostgreSQL
      redis/                    # Client Redis partagé par l'API
      storage/                  # Client MinIO et bucket des documents bruts
      health/                   # Liveness, readiness et indicateurs techniques
  test/                         # Tests HTTP end-to-end
```

Le dossier `core` contient uniquement les composants techniques transversaux existants. Les futurs
modules fonctionnels seront ajoutés séparément, au fil des fonctionnalités.

## Installation locale

Depuis la racine du monorepo :

```bash
pnpm install
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp packages/database/.env.example packages/database/.env
```

Le fichier `apps/api/.env.example` documente les variables propres à l'API et ses connexions à
PostgreSQL, Redis et MinIO. Les fichiers `.env` locaux ne doivent pas être commités.

## Démarrage

Démarrer d'abord les dépendances techniques :

```bash
pnpm infra:dev
```

Puis lancer l'API en mode développement :

```bash
pnpm api:dev
```

Services exposés localement :

- API : `http://localhost:3000/api/v1`
- Swagger UI : `http://localhost:3000/api/docs`
- OpenAPI JSON : `http://localhost:3000/api/docs-json`
- Liveness : `http://localhost:3000/api/health/live`
- Readiness : `http://localhost:3000/api/health/ready`

Swagger est désactivé lorsque `NODE_ENV=production`.

## Commandes

Les commandes sont lancées depuis la racine du monorepo :

```bash
pnpm api:dev
pnpm api:build
pnpm api:test
pnpm api:test:e2e
pnpm api:typecheck
pnpm api:lint
pnpm api:format
pnpm api:format:check
pnpm api:check
pnpm api:check:fix
```

Les tests unitaires et end-to-end utilisent des doublures pour les dépendances techniques et ne
nécessitent pas de lancer Docker.
