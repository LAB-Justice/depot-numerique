# Frontend Angular

Le workspace `web`, situé dans `apps/web`, contient la coque Angular et le parcours
d'authentification automatique. Les écrans de dépôt, d'historique et d'administration restent à
implémenter.

## Organisation

```text
apps/web/
  src/app/
    app.ts                       # État racine de l'authentification
    app.html                     # Rendu selon l'état courant
    app.routes.ts                # Routes Angular
    auth/
      auth.client.ts             # Client Better Auth
      authentication.service.ts  # Session et redirection SSO
  proxy.conf.json                # Proxy de développement vers l'API
  nginx/default.conf             # Serveur statique du conteneur
  Dockerfile                     # Build Angular et runtime Nginx
```

## Parcours d'authentification

Au démarrage, le composant racine utilise quatre états :

- `checking` : la session Better Auth est en cours de vérification ;
- `authenticated` : le contenu applicatif peut être affiché ;
- `redirecting` : le navigateur est envoyé vers l'IdP SAML ;
- `error` : la session ou le SSO a échoué.

`AuthenticationService.requireAuthentication()` demande d'abord `/api/auth/get-session`. Sans
session, il appelle `signIn.sso` sans identifiant de provider : le patch Better Auth sélectionne
l'unique fournisseur SAML par défaut. L'URL courante sert d'URL de retour et d'erreur.

Si le retour contient un paramètre `error`, le service n'essaie pas une nouvelle redirection en
boucle. L'interface affiche un état fermé sans bouton. Une stratégie de reprise ou de support pourra
être ajoutée lorsque les écrans métier seront conçus.

Le frontend ne lit ni ne vérifie l'assertion SAML. Elle est postée à l'ACS de l'API, qui crée un
cookie de session `HttpOnly`. La protection visuelle Angular ne remplace jamais l'autorisation côté
API.

## Appels API et origine commune

Le client Better Auth utilise des chemins relatifs. En exécution directe, Angular sert
`http://localhost:4200` et transmet `/api/**` vers `http://localhost:3000` grâce à
`proxy.conf.json`. En conteneur, Traefik reproduit ce routage sur
`https://depot-numerique.localhost`.

L'origine commune simplifie les cookies et évite d'exposer l'adresse interne de NestJS au code
Angular. Le CORS de l'API reste configuré comme défense supplémentaire pour les appels directs.

## Conteneur web

Le Dockerfile compile Angular avec Node.js puis copie les fichiers dans
`nginxinc/nginx-unprivileged`. Nginx écoute sur `8080`, sert les assets et renvoie `index.html` pour
les routes de la SPA.

Le cache est long pour les assets nommés par le build et désactivé pour `index.html`. Traefik termine
TLS, applique les headers de sécurité du frontend et route les requêtes ; Nginx n'est pas le reverse
proxy public.

## Tests

```bash
pnpm web:test
pnpm web:typecheck
pnpm web:check
pnpm web:build
```

Les tests actuels utilisent une doublure d'`AuthenticationService` et vérifient les états principaux
du composant. Ils ne remplacent pas le test de connexion réel avec Keycloak.

## Prochaines responsabilités

Le frontend devra notamment fournir :

- le glisser-déposer et le retour immédiat de validation ;
- l'historique et les statuts des documents de l'agent ;
- les vues administrateur national, régional et local selon le périmètre renvoyé par l'API ;
- la gestion des structures, services et affectations autorisées ;
- la supervision métier des traitements et erreurs ;
- des états accessibles pour chargement, absence de données, erreur et reprise.

Les règles d'habilitation, les transitions de statut et les validations documentaires doivent rester
dans l'API. Angular ne doit recevoir que les données autorisées pour l'utilisateur connecté.
