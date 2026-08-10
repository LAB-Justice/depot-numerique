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
session. À l'ouverture du site, Angular vérifie la session Better Auth et déclenche automatiquement
le fournisseur SAML par défaut si elle est absente. Il n'existe volontairement pas de page ni de
bouton de connexion ; la page applicative n'est rendue qu'après validation de la session. Le port
`3000` est une cible interne au poste de développement et ne doit pas être utilisé comme URL publique
par le client Angular.

Cette vérification frontend contrôle l'affichage et le parcours utilisateur ; elle ne constitue pas
une autorisation de sécurité. L'API applique indépendamment un garde Better Auth global à ses routes
métier.

En production conteneurisée, le reverse proxy sert le frontend et route `/api` vers NestJS sous une origine
HTTPS publique commune.

## Authentification

Le client Better Auth est déclaré dans `src/app/auth/auth.client.ts`. Il utilise l'origine courante
et appelle donc `/api/auth`. La redirection automatique vers le SSO est déclenchée par
`AuthenticationService` lorsque la session est absente.

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
