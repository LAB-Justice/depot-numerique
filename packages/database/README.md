# Package database

Package Prisma partagé par l'API et, à terme, les workers métier. Il contient le schéma PostgreSQL,
les migrations, le seed, le client généré et la fabrique de `PrismaClient`.

La documentation du modèle, des migrations et du seed se trouve dans
[`docs/data/database.md`](../../docs/data/database.md).

## Préparation

Depuis la racine du monorepo :

```bash
cp packages/database/.env.example packages/database/.env
pnpm database:generate
pnpm database:validate
```

`DATABASE_URL` est la seule variable requise par les commandes Prisma. Le client généré est écrit
dans `packages/database/generated/prisma` et n'est pas versionné.

## Migrations

Créer une migration relisible sans l'appliquer :

```bash
pnpm database:migrate:create --name description_courte
```

Après relecture du SQL, l'appliquer en développement :

```bash
pnpm database:migrate:dev
```

En recette et en production, utiliser uniquement les migrations déjà versionnées :

```bash
pnpm database:migrate:deploy
```

Ne pas modifier une migration déjà partagée : une correction doit prendre la forme d'une nouvelle
migration afin de préserver l'historique des bases existantes.

## Commandes

```bash
pnpm database:build
pnpm database:typecheck
pnpm database:generate
pnpm database:validate
pnpm database:migrate:create --name description_courte
pnpm database:migrate:dev
pnpm database:migrate:deploy
pnpm database:migrate:status
pnpm database:seed
pnpm database:studio
pnpm database:check
```

Le seed est réservé au développement. Il décrit un jeu de données simplifié qui n'est pas identique
à l'arborescence OpenLDAP complète ; consulter la mise en garde dans `docs/data/database.md` avant de
le combiner avec un test SSO.
