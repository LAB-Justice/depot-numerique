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
    auth.ts                   # Better Auth, adapter Prisma et plugin SSO SAML
    auth.module.ts            # Chargement des métadonnées et credentials au démarrage
    saml-metadata.loader.ts   # Téléchargement borné des métadonnées IdP
    saml-sp-credentials.ts    # Validation des clés et certificats du SP
    saml-sp-metadata.ts       # Construction des métadonnées publiques du SP
    bureau-igc.ts             # Validation de la hiérarchie du DN de rattachement
    sso-user-provisioning.ts  # Synchronisation de l'identité et du profil métier
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

| Variable                                            | Rôle                                                        |
| --------------------------------------------------- | ----------------------------------------------------------- |
| `NODE_ENV`                                          | `development`, `test` ou `production`                       |
| `API_PORT`                                          | Port HTTP, `3000` par défaut                                |
| `LOG_LEVEL`                                         | Niveau Pino de `silent` à `fatal`                            |
| `DATABASE_URL`                                      | Connexion PostgreSQL                                        |
| `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`        | Connexion Redis                                             |
| `MINIO_ENDPOINT`, `MINIO_PORT`, `MINIO_USE_SSL`     | Adresse MinIO                                               |
| `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`              | Identifiants MinIO                                          |
| `MINIO_RAW_BUCKET`                                  | Bucket brut, au format de nom S3                            |
| `CORS_ALLOWED_ORIGINS`                              | Origines CORS séparées par des virgules                     |
| `THROTTLE_TTL_MS`, `THROTTLE_LIMIT`                 | Fenêtre et limite du throttling global                      |
| `BETTER_AUTH_URL`                                   | Origine publique utilisée pour construire les callbacks     |
| `BETTER_AUTH_WEB_ORIGIN`                            | Origine frontend autorisée par Better Auth                  |
| `BETTER_AUTH_SECRET`                                | Secret Better Auth d'au moins 32 caractères                 |
| `SSO_PROVIDER_ID`, `SSO_DOMAIN`                     | Identifiant interne du provider et domaine organisationnel  |
| `SSO_SP_ENTITY_ID`                                  | `entityID` stable du Service Provider                       |
| `SSO_IDP_METADATA_URL`                              | Métadonnées du fournisseur d'identité                       |
| `SSO_SP_SIGNING_*`, `SSO_SP_ENCRYPTION_*`           | Chemins des deux paires de clés et certificats du SP         |

Les valeurs locales de référence se trouvent dans `apps/api/.env.example`. En production, les
secrets doivent être injectés par l'orchestrateur ou Vault et non stockés dans un fichier versionné.

## Authentification

Better Auth est monté sous `/api/auth`. En développement, `BETTER_AUTH_URL` et
`BETTER_AUTH_WEB_ORIGIN` valent `http://localhost:4200` : le navigateur utilise l'origine du
frontend et le proxy Angular transmet `/api/**` à NestJS sur le port `3000`. Cette topologie prépare
l'utilisation de cookies de session sur une origine commune ; la cible de production devra être une
origine HTTPS servie par le reverse proxy.

Dans la topologie Docker `app`, Traefik est l'unique entrée HTTP publique de l'application. Angular et
NestJS sont sur un réseau applicatif privé ; NestJS n'est pas publié directement sur l'hôte. Traefik
termine TLS, route `/api` vers l'API et les autres chemins vers le frontend. Les ports des services
d'infrastructure restent publiés uniquement pour faciliter le développement local.

La connexion par email et mot de passe est désactivée. Les clés primaires des tables Better Auth
sont des UUID ; l'option `advanced.database.generateId = 'uuid'` impose le même format aux
identifiants créés par la bibliothèque. L'adapter Prisma et le plugin SSO SAML sont branchés. À chaque
connexion, le profil métier est retrouvé par `igcid`, jamais par email, puis synchronisé dans une
transaction.

Au démarrage, l'API télécharge les métadonnées IdP avec un timeout de cinq secondes, refuse les
redirections et limite la réponse à 100 Kio. En production, l'URL doit utiliser HTTPS. Elle lit aussi
les deux paires PEM du SP, vérifie leur format, la correspondance clé/certificat, leur période de
validité et une taille RSA minimale de 2048 bits. Une erreur bloque le démarrage plutôt que de laisser
un SSO partiellement configuré.

Le garde Better Auth est enregistré globalement : tout nouveau contrôleur NestJS est protégé par
défaut et renvoie `401` sans session valide. Seuls les endpoints techniques de santé sont annotés
`AllowAnonymous`, car l'orchestrateur doit pouvoir les appeler sans cookie. Les routes Better Auth
restent gérées par le module d'authentification.

### Contrat de provisioning

Les claims SAML sont mappés vers les informations Better Auth, puis validés une seconde fois avant
d'écrire le profil métier :

| Claim               | Traitement actuel                                                                  |
| ------------------- | --------------------------------------------------------------------------------- |
| `igcid`             | clé unique de rapprochement vers `User.igcId`                                     |
| `nom`, `prenom`     | synchronisés dans `User` et dans le nom de `AuthIdentity`                         |
| `mail`              | synchronisé, normalisé en minuscules, jamais utilisé comme clé de reconnexion     |
| `roles`             | exactement un rôle `DEPOT_NUMERIQUE:*` reconnu est exigé                          |
| `bureauIGC`         | requis hors administrateur national, valide les codes de la hiérarchie            |
| `siteDescription`   | requis hors administrateur national, nom lisible de la structure de travail       |
| `logonId`           | reçu à titre informatif, non persisté actuellement                                |
| `affectationOp2-4`  | reçus mais non exploités actuellement                                              |

L'administrateur national n'a ni structure de travail ni périmètre d'administration imposé. Pour les
autres rôles, `bureauIGC` détermine la cour et la structure finale, tandis que `siteDescription`
nomme cette structure finale. Lorsque le libellé de la cour n'est pas disponible, une valeur
temporaire `Libellé indisponible — SRJ <code>` est créée sans écraser un libellé déjà connu.

Le provisioning refuse un compte désactivé, un rôle absent, multiple ou inconnu, un claim obligatoire
multivalué, et toute tentative de relier un `igcid` à deux identités. Si le rattachement de travail
change, le service est retiré pour éviter une affectation incohérente.

## Validation HTTP

Une `ValidationPipe` globale transforme les DTO et refuse les propriétés qui ne figurent pas dans
le contrat. Les DTO métier doivent utiliser `class-validator` et décrire leurs contraintes
explicitement.

La validation de l'environnement avec Joi et la validation des requêtes HTTP sont deux contrôles
distincts : la première sécurise le démarrage du processus, la seconde sécurise les entrées des
clients.

Helmet applique les headers de sécurité de l'API. CORS autorise les credentials et les méthodes HTTP
usuelles uniquement pour les origines configurées. Le `ThrottlerGuard` est global ; les valeurs
locales par défaut sont 100 requêtes par fenêtre de 60 secondes.

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

Le contrôle MinIO vérifie précisément l'existence de `MINIO_RAW_BUCKET`, pas seulement la réponse du
serveur. Sur une stack neuve, créer le bucket avec :

```bash
docker compose exec minio sh -c 'mc alias set app http://localhost:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null && mc mb --ignore-existing app/documents-raw'
```

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

## Image et démarrage conteneurisé

L'image API est multi-stage et s'exécute avec l'utilisateur non privilégié `node`. Le profil Compose
`app` monte les clés SAML en lecture seule, applique les migrations avec un conteneur ponctuel, puis
démarre l'API lorsque PostgreSQL, Redis, MinIO et Keycloak sont sains.

Les détails de routage, de TLS et de persistance se trouvent dans
[Infrastructure locale](../infrastructure/local-stack.md).

## Tests et commandes

```bash
pnpm api:dev
pnpm api:test
pnpm api:test:e2e
pnpm api:typecheck
pnpm api:check
pnpm api:build
```

Les tests unitaires couvrent les indicateurs de santé, l'environnement, `bureauIGC`, le provisioning,
le téléchargement des métadonnées, les credentials et les métadonnées du SP. Les tests e2e vérifient
les routes protégées, Swagger, `X-Request-Id`, les healthchecks et le pont HTTP-POST utilisé par le
patch SAML. PostgreSQL, Redis, MinIO et l'IdP y sont remplacés par des doublures déterministes ; les
tests d'intégration avec l'infrastructure réelle devront former une suite distincte.
