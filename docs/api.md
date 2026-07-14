# API

L'API est construite avec NestJS. Son socle fournit un versionnement explicite, une validation
globale, des logs structurés, des contrôles de santé et une documentation OpenAPI.

## Organisation du code

```text
apps/api/src/
  main.ts                     # Création et démarrage de l'application NestJS
  app.module.ts               # Module racine et configuration globale
  app.controller.ts           # Route technique versionnée de base
  app.service.ts              # Service associé à la route de base
  bootstrap/
    configure-app.ts          # CORS, Helmet, versionnement et validation HTTP
    configure-swagger.ts      # Configuration OpenAPI
  config/
    environment.schema.ts     # Validation des variables d'environnement
    logger.config.ts          # Configuration des logs Pino
  auth/
    auth.ts                   # Options Better Auth indépendantes de NestJS
    auth.module.ts            # Intégration Better Auth/NestJS
  core/
    database/                 # Client Prisma et cycle de vie PostgreSQL
    redis/                    # Client Redis partagé par l'API
    storage/                  # Client MinIO et bucket des documents bruts
    health/                   # Liveness, readiness et indicateurs techniques
```

`bootstrap` regroupe la configuration appliquée au démarrage HTTP, tandis que `config` contient la
validation de l'environnement et la configuration du logger. `core` rassemble les composants
techniques transversaux utilisés par l'API. Les futurs modules fonctionnels seront ajoutés
séparément, sans transformer `core` en dossier métier.

## Adressage et versionnement

Toutes les routes applicatives utilisent le préfixe `/api` et déclarent explicitement leur version.
Une route versionnée en `1` est donc exposée sous `/api/v1/...`. Aucune version par défaut n'est
définie : oublier la version sur un contrôleur produit une erreur visible pendant le développement.

Les routes techniques de santé sont volontairement indépendantes de la version métier :

```text
GET /api/health/live
GET /api/health/ready
```

## Configuration

L'API valide son environnement au démarrage. Une variable obligatoire absente ou invalide empêche
le processus de démarrer au lieu de provoquer une erreur tardive.

| Variable | Rôle |
| --- | --- |
| `NODE_ENV` | Environnement : `development`, `test` ou `production` |
| `API_PORT` | Port HTTP de l'API |
| `LOG_LEVEL` | Niveau minimal des logs Pino |
| `DATABASE_URL` | Connexion PostgreSQL de l'application |
| `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` | Connexion Redis |
| `MINIO_ENDPOINT`, `MINIO_PORT`, `MINIO_USE_SSL` | Adresse du stockage objet |
| `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY` | Identifiants MinIO de l'application |
| `MINIO_RAW_BUCKET` | Bucket des documents bruts |
| `BETTER_AUTH_URL` | Origine publique utilisée pour les routes Better Auth |
| `BETTER_AUTH_WEB_ORIGIN` | Origine frontend autorisée par Better Auth |
| `BETTER_AUTH_SECRET` | Secret Better Auth d'au moins 32 caractères |

Les valeurs locales de référence se trouvent dans `apps/api/.env.example`. En production, les
secrets doivent être injectés par l'orchestrateur ou Vault et non stockés dans un fichier versionné.

## Authentification

Better Auth est monté sous `/api/auth`. En développement, `BETTER_AUTH_URL` et
`BETTER_AUTH_WEB_ORIGIN` valent `http://localhost:4200` : le navigateur utilise l'origine du
frontend et le proxy Angular transmet `/api/**` à NestJS sur le port `3000`. Cette topologie prépare
l'utilisation de cookies de session sur une origine commune ; la cible de production devra être une
origine HTTPS servie par le reverse proxy.

La connexion par email et mot de passe est désactivée. Les clés primaires des tables Better Auth
sont des UUID ; l'option `advanced.database.generateId = 'uuid'` impose le même format aux
identifiants créés par la bibliothèque. Le branchement de l'adapter Prisma et du plugin SSO constitue
l'étape suivante.

## Validation HTTP

Une `ValidationPipe` globale transforme les DTO et refuse les propriétés qui ne figurent pas dans
le contrat. Les DTO métier doivent utiliser `class-validator` et décrire leurs contraintes
explicitement.

La validation de l'environnement avec Joi et la validation des requêtes HTTP sont deux contrôles
distincts : la première sécurise le démarrage du processus, la seconde sécurise les entrées des
clients.

## Logs et identifiant de requête

Les requêtes HTTP produisent des logs JSON avec Pino. L'API accepte un header `X-Request-Id` s'il
respecte le format autorisé ; sinon elle génère un UUID. La valeur retenue est renvoyée dans la
réponse et apparaît sous `requestId` dans les logs.

Le niveau dépend du résultat HTTP : `info` pour les réponses normales, `warn` pour les erreurs 4xx
et `error` pour les erreurs 5xx. Les headers `Authorization`, `Cookie` et `Set-Cookie` sont remplacés
par `[REDACTED]` dans les logs.

Lorsqu'un traitement deviendra asynchrone, le producteur devra copier `requestId` dans les données
du job BullMQ. Le worker créera alors un logger enfant contenant ce même identifiant afin de
conserver la corrélation de bout en bout.

## Contrôles de santé

`GET /api/health/live` vérifie uniquement que le processus HTTP répond. Cette route peut rester au
vert lorsque Docker ou les dépendances techniques sont arrêtés.

`GET /api/health/ready` vérifie que l'instance peut traiter une requête nécessitant :

- PostgreSQL ;
- Redis ;
- MinIO.

Elle renvoie un statut HTTP `200` si tous les contrôles réussissent et `503` dès qu'une dépendance
est indisponible. Keycloak n'est pas contrôlé ici : il sera sollicité uniquement pendant les flux
SSO concernés. Le frontend et les workers doivent fournir leur propre mécanisme de santé, sans être
ajoutés artificiellement à la readiness de l'API.

## Swagger

En développement et en test, Swagger UI et la spécification JSON sont disponibles ici :

```text
http://localhost:3000/api/docs
http://localhost:3000/api/docs-json
```

Swagger est désactivé lorsque `NODE_ENV=production`. L'interface documente l'API ; elle ne constitue
pas le mécanisme d'authentification de l'application.

## Tests et commandes

```bash
pnpm api:dev
pnpm api:test
pnpm api:test:e2e
pnpm api:typecheck
pnpm api:check
pnpm api:build
```

Les tests e2e vérifient le routage, Swagger, la propagation de `X-Request-Id`, la liveness et la
readiness. Les clients PostgreSQL, Redis et MinIO y sont remplacés par des doublures déterministes ;
les tests d'intégration avec l'infrastructure réelle seront une suite distincte.
