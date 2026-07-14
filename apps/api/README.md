# API Dépôt Numérique

API HTTP NestJS de Dépôt Numérique. Ce workspace fournit le socle applicatif : configuration
validée, logs structurés, sécurité HTTP, versionnement, authentification Better Auth, documentation
OpenAPI et contrôles de santé de PostgreSQL, Redis et MinIO.

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
    auth/
      auth.ts                    # Configuration Better Auth
      auth.module.ts             # Intégration de Better Auth dans NestJS
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

Le fichier `apps/api/.env.example` documente les variables propres à l'API, ses connexions à
PostgreSQL, Redis et MinIO, ainsi que `BETTER_AUTH_URL`, `BETTER_AUTH_WEB_ORIGIN` et
`BETTER_AUTH_SECRET`. Le secret doit contenir au moins 32 caractères et être injecté par le système
de secrets hors développement. Les fichiers `.env` locaux ne doivent pas être commités.

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
- Better Auth via le proxy web : `http://localhost:4200/api/auth/...`

`BETTER_AUTH_URL` désigne l'URL publique vue par le navigateur. En local, elle vaut donc
`http://localhost:4200`, et non l'adresse interne de l'API, car Angular transmet `/api/**` au port
`3000`. `BETTER_AUTH_WEB_ORIGIN` autorise cette origine pour les requêtes d'authentification.

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
