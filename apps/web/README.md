# Frontend Dépôt Numérique

Application Angular de Dépôt Numérique. Le frontend utilise le client Better Auth et communique avec
l'API par des chemins relatifs sous `/api`.

La documentation générale du développement se trouve dans [`docs/development.md`](../../docs/development.md).

## Démarrage local

Depuis la racine du monorepo :

```bash
pnpm install
pnpm web:dev
```

Le frontend est exposé sur `http://localhost:4200`.

## Proxy vers l'API

La configuration de développement transmet `/api/**` vers `http://localhost:3000`. Le navigateur
reste ainsi sur l'origine `http://localhost:4200`, y compris pour Better Auth et ses cookies de
session. Le port `3000` est une cible interne au poste de développement et ne doit pas être utilisé
comme URL publique par le client Angular.

En production, le reverse proxy de la plateforme devra appliquer le même principe : servir le
frontend et router `/api` vers NestJS sous une origine HTTPS publique commune.

## Authentification

Le client Better Auth est déclaré dans `src/app/auth/auth.client.ts`. Il utilise l'origine courante
et appelle donc `/api/auth`. La redirection automatique vers le SSO sera ajoutée avec le plugin SSO
et un guard Angular ; elle n'est pas encore implémentée à ce stade.

## Commandes

Les commandes sont lancées depuis la racine du monorepo :

```bash
pnpm web:dev
pnpm web:build
pnpm web:test
pnpm web:typecheck
pnpm web:lint
pnpm web:format
pnpm web:format:check
pnpm web:check
pnpm web:check:fix
```
