# Frontend Dépôt Numérique

Application Angular de Dépôt Numérique. Le workspace contient actuellement la coque du frontend et
le parcours d'authentification SSO automatique. Les écrans métier de dépôt, d'historique et
d'administration ne sont pas encore implémentés.

La documentation générale du développement se trouve dans
[`docs/getting-started/development.md`](../../docs/getting-started/development.md) et la topologie
conteneurisée dans
[`docs/infrastructure/local-stack.md`](../../docs/infrastructure/local-stack.md).

## Structure

```text
apps/web/
  src/app/
    app.ts                       # État racine de l'authentification
    app.html                     # États de chargement, redirection, erreur et contenu
    app.routes.ts                # Routes Angular
    auth/
      auth.client.ts             # Client Better Auth relatif à l'origine courante
      authentication.service.ts  # Vérification de session et redirection SSO
  proxy.conf.json                # Proxy `/api/**` vers NestJS en mode `ng serve`
  nginx/default.conf             # Serveur statique et fallback SPA du conteneur
  Dockerfile                     # Build Angular puis runtime Nginx non privilégié
```

## Authentification

Le client Better Auth ne déclare pas de `baseURL` : il utilise l'origine courante et appelle
`/api/auth`. À l'ouverture de l'application, `AuthenticationService` :

1. demande la session courante ;
2. affiche l'application lorsqu'une session valide existe ;
3. sinon, déclenche `signIn.sso` avec l'unique fournisseur SAML par défaut ;
4. conserve l'URL courante comme URL de retour et d'erreur ;
5. affiche un état fermé sans bouton de nouvelle tentative si le SSO renvoie une erreur.

Il n'existe volontairement ni formulaire ni bouton de connexion local. Le frontend ne voit jamais
l'assertion SAML : le navigateur la poste à l'ACS Better Auth de l'API, qui crée ensuite le cookie de
session `HttpOnly`.

Ce contrôle frontend protège l'affichage, pas l'autorisation. L'API applique indépendamment un garde
Better Auth global à toutes ses routes métier.

## Exécution directe

Depuis la racine du monorepo :

```bash
pnpm install
pnpm web:dev
```

Angular est exposé sur `http://localhost:4200`. `proxy.conf.json` transmet `/api/**` vers
`http://localhost:3000`, de sorte que le navigateur reste sur une origine unique pour les cookies.

Le realm Keycloak versionné utilise les URLs HTTPS de la stack Docker. `ng serve` reste utile pour
développer les composants, mais le parcours SSO complet doit être validé avec `pnpm stack:dev`.

## Exécution conteneurisée

```bash
pnpm tls:certificates:generate
pnpm sso:certificates:generate
pnpm stack:dev
```

Le frontend est alors disponible sur `https://depot-numerique.localhost`. Traefik route
`/api/**` vers NestJS et tout le reste vers le conteneur web.

Le Dockerfile est multi-stage : Node.js compile Angular, puis
`nginxinc/nginx-unprivileged:1.29-alpine` sert uniquement les fichiers produits sur le port `8080`.
Nginx gère le fallback de la SPA et le cache ; Traefik reste le reverse proxy public et termine TLS.

Le dossier racine `patches` est copié avant l'installation, car le client utilise le plugin Better
Auth SSO patché.

## Tests et commandes

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

Les tests vérifient la création du composant, son titre, l'absence d'affichage avant la validation de
session et l'état d'erreur lorsque le SSO échoue. Ils mockent `AuthenticationService` : ils ne
constituent pas un test SAML de bout en bout, lequel est couvert côté API et par la stack locale.
