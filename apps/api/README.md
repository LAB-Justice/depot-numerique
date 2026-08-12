# API Dépôt Numérique

API HTTP NestJS de Dépôt Numérique. Ce workspace fournit actuellement le socle technique :
configuration validée, logs structurés, sécurité HTTP, limitation de débit, versionnement,
authentification Better Auth/SAML, provisioning des profils métier, OpenAPI et contrôles de santé de
PostgreSQL, Redis et MinIO.

Les routes métier de dépôt de documents ne sont pas encore implémentées. La documentation détaillée
du socle se trouve dans [`docs/applications/api.md`](../../docs/applications/api.md) et le
raccordement SAML dans [`docs/authentication/saml.md`](../../docs/authentication/saml.md).

## Structure

```text
apps/api/
  src/
    main.ts                         # Création et démarrage de NestJS
    app.module.ts                   # Module racine, throttling et garde global
    app.controller.ts               # Route versionnée de diagnostic
    bootstrap/
      configure-app.ts              # CORS, Helmet, versionnement et validation HTTP
      configure-swagger.ts          # OpenAPI en développement et en test
    config/
      environment.schema.ts         # Validation Joi de l'environnement
      logger.config.ts              # Pino, requestId et masquage des données sensibles
    auth/
      auth.ts                       # Better Auth, adapter Prisma et plugin SSO
      auth.module.ts                # Chargement des métadonnées et clés au démarrage
      saml-metadata.loader.ts       # Téléchargement borné des métadonnées IdP
      saml-sp-credentials.ts        # Validation des clés et certificats du SP
      saml-sp-metadata.ts           # Métadonnées publiques du SP
      bureau-igc.ts                 # Validation du DN de rattachement
      sso-user-provisioning.ts      # Synchronisation AuthIdentity/User/Structure
    core/
      database/                     # Cycle de vie du client Prisma
      redis/                        # Client Redis partagé
      storage/                      # Client MinIO et bucket brut
      health/                       # Liveness, readiness et indicateurs techniques
  test/                             # Tests HTTP end-to-end avec doublures
  Dockerfile                        # Image multi-stage de l'API
```

`core` contient les composants techniques transversaux. Les futurs modules fonctionnels doivent
rester séparés de cette couche.

## Préparation locale

Depuis la racine du monorepo :

```bash
pnpm install
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp packages/database/.env.example packages/database/.env
pnpm sso:certificates:generate
```

`BETTER_AUTH_SECRET` doit contenir au moins 32 caractères. Les quatre fichiers PEM du Service
Provider sont créés dans `.secrets/saml` et ne doivent jamais être commités.

## Variables d'environnement

| Groupe             | Variables                                                                 |
| ------------------ | ------------------------------------------------------------------------- |
| application        | `NODE_ENV`, `API_PORT`, `LOG_LEVEL`                                       |
| PostgreSQL         | `DATABASE_URL`                                                            |
| Redis              | `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`                              |
| MinIO              | `MINIO_ENDPOINT`, `MINIO_PORT`, `MINIO_USE_SSL`, identifiants et bucket   |
| sécurité HTTP      | `CORS_ALLOWED_ORIGINS`, `THROTTLE_TTL_MS`, `THROTTLE_LIMIT`               |
| Better Auth        | `BETTER_AUTH_URL`, `BETTER_AUTH_WEB_ORIGIN`, `BETTER_AUTH_SECRET`         |
| fournisseur SAML   | `SSO_PROVIDER_ID`, `SSO_DOMAIN`, `SSO_SP_ENTITY_ID`, métadonnées IdP      |
| clés du SP         | chemins des clés et certificats de signature et de chiffrement            |

`CORS_ALLOWED_ORIGINS` accepte une liste d'origines séparées par des virgules. En production, les
secrets et clés privées doivent être injectés par l'orchestrateur ou Vault et montés avec des droits
minimaux.

## Adressage

En exécution directe avec pnpm :

- route versionnée : `http://localhost:3000/api/v1` ;
- Swagger UI : `http://localhost:3000/api/docs` ;
- OpenAPI JSON : `http://localhost:3000/api/docs-json` ;
- liveness : `http://localhost:3000/api/health/live` ;
- readiness : `http://localhost:3000/api/health/ready` ;
- Better Auth via le proxy Angular : `http://localhost:4200/api/auth/**`.

Avec le profil Docker `app`, NestJS n'est pas publié sur l'hôte. Traefik expose les mêmes routes sous
`https://depot-numerique.localhost/api/**`.

Swagger est désactivé lorsque `NODE_ENV=production`. La route `/api/v1` est protégée par le garde
Better Auth global et renvoie `401` sans session. Les deux routes de santé portent
`AllowAnonymous()` afin que Docker ou un orchestrateur puissent les appeler sans cookie.

## Authentification et provisioning

La connexion email/mot de passe est désactivée. Le frontend déclenche le fournisseur SAML par défaut,
Better Auth vérifie la réponse puis persiste l'identité, le compte et une session de six heures dans
PostgreSQL.

À chaque connexion, `sso-user-provisioning.ts` :

1. exige une valeur unique pour `igcid`, `mail`, `prenom` et `nom` ;
2. sélectionne exactement un rôle `DEPOT_NUMERIQUE:*` reconnu ;
3. retrouve le profil métier exclusivement par `User.igcId`, jamais par email ;
4. refuse un profil désactivé ou une liaison d'identité contradictoire ;
5. pour tout rôle sauf administrateur national, valide `bureauIGC` et exige `siteDescription` ;
6. crée ou actualise les structures et calcule les périmètres de travail et d'administration ;
7. synchronise le profil et remet `serviceId` à `null` si la structure de travail change.

`bureauIGC` fournit les codes techniques de la hiérarchie. `siteDescription` fournit le libellé de la
structure finale : sans lui, un utilisateur non national est refusé. `logonId` et les affectations
secondaires sont transmis dans les informations SAML mais ne sont pas persistés dans `User` à ce
stade.

## Démarrage

Pour travailler sur l'API directement :

```bash
pnpm infra:dev
pnpm database:migrate:deploy
docker compose exec minio sh -c 'mc alias set app http://localhost:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null && mc mb --ignore-existing app/documents-raw'
pnpm api:dev
```

Pour tester le parcours SSO navigateur complet avec les URLs du realm fourni :

```bash
pnpm tls:certificates:generate
pnpm sso:certificates:generate
pnpm stack:dev
```

Consulter
[`docs/getting-started/development.md`](../../docs/getting-started/development.md) pour la
préparation de `mkcert` et les différences entre les deux modes.

## Image Docker

`apps/api/Dockerfile` compile l'API et le package database dans une étape Node.js, produit les
dépendances de production avec `pnpm deploy`, puis exécute le build avec l'utilisateur non privilégié
`node`. Le patch Better Auth est copié avant `pnpm install`, car pnpm l'applique lors de la résolution
des dépendances.

Dans Compose, le service ponctuel `migrate` réutilise l'étape de build pour exécuter
`prisma migrate deploy`. L'API ne démarre qu'après sa réussite et après les healthchecks de
PostgreSQL, Redis, MinIO et Keycloak.

## Commandes

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

Les tests unitaires couvrent notamment la configuration, les indicateurs de santé, le parsing de
`bureauIGC`, le provisioning, les métadonnées et les credentials SAML. Les tests e2e couvrent les
routes protégées et anonymes, Swagger, `X-Request-Id` et le pont HTTP-POST SAML. Ils utilisent des
doublures pour PostgreSQL, Redis, MinIO et les métadonnées IdP ; Docker n'est pas requis.
