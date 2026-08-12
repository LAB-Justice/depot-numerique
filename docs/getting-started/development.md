# Développement

Cette page décrit l'état actuel du projet et les commandes utiles pour travailler en local.

## Structure actuelle

Le dépôt est un monorepo `pnpm` piloté avec `Turbo`.

```text
apps/
  api/      # API NestJS et Dockerfile applicatif
  web/      # Frontend Angular, configuration Nginx et Dockerfile
  worker/   # Worker BullMQ de démonstration
docs/       # Documentation VitePress
infra/      # Configuration Traefik
packages/
  database/ # Schéma, migrations, seed et client Prisma
sso/        # Simulateur SSO local Keycloak SAML + OpenLDAP
```

Applications disponibles :

- `api` : backend NestJS ;
- `web` : frontend Angular ;
- `worker` : socle BullMQ avec un processor de démonstration ;
- `@depot-numerique/docs` : documentation VitePress.
- `@depot-numerique/database` : accès PostgreSQL partagé avec Prisma.

## Prérequis

- Node.js, version définie dans `.nvmrc`.
- pnpm `11.8.0`.
- Docker et Docker Compose.
- `mkcert` et `libnss3-tools` pour utiliser la stack conteneurisée en HTTPS.
- OpenSSL pour les clés de signature et de chiffrement SAML du Service Provider.

Activer la version Node attendue :

```bash
nvm use
```

Installer les dépendances :

```bash
pnpm install
```

Créer les fichiers d'environnement locaux :

```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp packages/database/.env.example packages/database/.env
cp apps/worker/.env.example apps/worker/.env
```

Le `.env` racine configure Docker Compose et expose les variables partagées (Redis, PostgreSQL, MinIO,
OpenLDAP, phpLDAPadmin, Keycloak, Traefik et applications conteneurisées).
Le `.env` du workspace API configure son port (`API_PORT`), son mode d'exécution (`NODE_ENV`), ses
services techniques et Better Auth. En local, `BETTER_AUTH_URL` et `BETTER_AUTH_WEB_ORIGIN` valent
`http://localhost:4200`, tandis que `BETTER_AUTH_SECRET` contient un secret local d'au moins 32
caractères. Le `.env` du workspace database contient uniquement `DATABASE_URL` pour les commandes
Prisma. Le `.env` du workspace worker contient son port (`WORKER_PORT`) et son mode d'exécution
(`NODE_ENV`). Aucun de ces fichiers ne doit être commité.

Installer les hooks Git locaux si nécessaire :

```bash
pnpm prepare
```

## Lancement local

Deux modes de lancement sont disponibles :

- le mode rapide exécute les applications avec `pnpm` et conserve uniquement l'infrastructure dans
  Docker ;
- le mode conteneurisé construit les images du frontend et de l'API, puis expose l'application et le
  fournisseur SSO en HTTPS derrière Traefik.

Le worker n'est pas encore conteneurisé. `pnpm stack:dev` lance donc l'API et le frontend, mais pas le
processus BullMQ.

### Applications exécutées avec pnpm

Les commandes de développement suivent la même convention que les autres tâches du monorepo :

- `pnpm dev` lance l'API, le frontend, le worker et la documentation avec Turbo.
- `pnpm infra:dev` démarre uniquement les services techniques Docker.
- `pnpm stack:dev` construit et démarre toute la stack conteneurisée en HTTPS.
- `pnpm apps:dev` lance uniquement les applications métier : `api`, `web` et `worker`.
- `pnpm <workspace>:dev` lance un seul workspace (`api:dev`, `web:dev`, `worker:dev`).

Les serveurs `dev` sont déclarés comme persistants dans Turbo : ils restent actifs tant que le terminal est ouvert et ne sont pas mis en cache.

Le développement local utilise deux terminaux. Dans le premier, démarrer l'infrastructure et attendre
que les conteneurs soient disponibles :

```bash
pnpm infra:dev
```

Lors de la première installation, appliquer les migrations et créer le bucket MinIO attendu :

```bash
pnpm database:migrate:deploy
docker compose exec minio sh -c 'mc alias set app http://localhost:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null && mc mb --ignore-existing app/documents-raw'
```

Le nom doit correspondre à `MINIO_RAW_BUCKET`. Compose ne possède pas encore de service
d'initialisation des buckets ; tant que le bucket est absent, `/api/health/ready` signale MinIO en
échec.

Dans le second, lancer tous les workspaces en développement :

```bash
pnpm dev
```

Lancer les applications métier sans l'infrastructure Docker ni la documentation :

```bash
pnpm apps:dev
```

Lancer seulement l'API :

```bash
pnpm api:dev
```

Lancer seulement le frontend :

```bash
pnpm web:dev
```

Lancer seulement le worker :

```bash
pnpm worker:dev
```

Lancer seulement la documentation :

```bash
pnpm docs:dev
```

URLs locales dans ce mode :

- API : `http://localhost:3000`
- Frontend : `http://localhost:4200`
- Documentation : `http://localhost:5173/depot-numerique/`
- Prisma Studio : `http://localhost:5555`
- Administration Keycloak : `http://localhost:8080/admin/master/console/`
- Compte utilisateur Keycloak : `http://localhost:8080/realms/depot-numerique/account/`

Le frontend transmet `/api/**` à `http://localhost:3000` avec `apps/web/proxy.conf.json`. Le port
`4200` est donc l'origine publique du navigateur en développement, et le port `3000` la cible
interne du proxy. Le port `8080` de Keycloak reste exposé dans ce mode pour les échanges techniques
et le diagnostic local. Le parcours SSO complet avec les URLs HTTPS configurées dans le realm doit
être vérifié avec la stack conteneurisée décrite ci-dessous.

Le frontend déclenche automatiquement le SSO lorsqu'aucune session n'existe. Comme le client SAML du
realm versionné autorise l'ACS HTTPS de la stack conteneurisée, le mode pnpm ne constitue pas à lui
seul un environnement SSO navigateur complet.

### Stack conteneurisée avec HTTPS

Cette configuration lance PostgreSQL, Redis, MinIO, OpenLDAP, phpLDAPadmin, Keycloak, les migrations,
l'API, le frontend et Traefik. Les noms en `.localhost` sont réservés à la machine locale et ne
nécessitent normalement pas de modification de `/etc/hosts`.

Installer l'autorité de certification locale de `mkcert` :

```bash
sudo apt install mkcert libnss3-tools
mkcert -install
```

Générer le certificat utilisé par Traefik :

```bash
pnpm tls:certificates:generate
```

Générer séparément les deux paires de clés du Service Provider SAML :

```bash
pnpm sso:certificates:generate
```

Le certificat Traefik protège HTTPS. Les clés SAML servent à signer les `AuthnRequest` et à
déchiffrer les assertions ; elles ne sont pas interchangeables.

Le script conserve un certificat déjà présent et refuse de compléter un dossier partiellement
généré. Les domaines peuvent être remplacés avec les variables `PUBLIC_HOST` et
`IDP_PUBLIC_HOST`. Le realm fourni référence toutefois les deux noms `.localhost` : changer ces
variables demande aussi d'adapter les URLs du client SAML.

Les certificats locaux et leurs clés sont stockés dans `.secrets/`, qui ne doit jamais être commité.

Renseigner dans le `.env` racine un secret Better Auth d'au moins 32 caractères. Une valeur locale
peut être générée avec :

```bash
openssl rand -base64 48
```

Construire les images et démarrer la stack complète :

```bash
pnpm stack:dev
```

Le service `migrate` applique les migrations avant l'API. Créer une fois le bucket MinIO si le volume
est neuf :

```bash
docker compose exec minio sh -c 'mc alias set app http://localhost:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null && mc mb --ignore-existing app/documents-raw'
```

URLs HTTPS :

- Application : `https://depot-numerique.localhost/`
- Healthcheck API : `https://depot-numerique.localhost/api/health/live`
- Administration Keycloak : `https://idp.depot-numerique.localhost/admin/master/console/`
- Compte utilisateur Keycloak : `https://idp.depot-numerique.localhost/realms/depot-numerique/account/`
- Métadonnées SAML : `https://idp.depot-numerique.localhost/realms/depot-numerique/protocol/saml/descriptor`

Traefik redirige le port `80` vers `443`. Les routes `/api/**` sont envoyées à NestJS et les autres
routes du domaine applicatif au frontend Angular. Keycloak utilise un domaine séparé afin de simuler
le fournisseur d'identité externe.

Nginx, à l'intérieur du conteneur web, sert uniquement les fichiers Angular et le fallback de la SPA.
Traefik reste le reverse proxy public. Le détail des images, réseaux, volumes et headers se trouve
dans [Infrastructure locale](../infrastructure/local-stack.md).

Consulter les logs applicatifs :

```bash
docker compose --profile app logs -f traefik api web keycloak
```

Arrêter la stack complète :

```bash
docker compose --profile app down
```

## Services Docker

Les services techniques locaux sont indépendants des processus applicatifs. Les démarrer avec :

```bash
pnpm infra:dev
```

Services disponibles :

- PostgreSQL : `localhost:5432`
- Redis : `localhost:6379`
- MinIO API : `http://localhost:9000`
- MinIO Console : `http://localhost:9001`
- OpenLDAP : `ldap://localhost:389`
- phpLDAPadmin : `http://localhost:8081`
- Keycloak : `http://localhost:8080`
- Administration Keycloak : `http://localhost:8080/admin/master/console/`
- Métadonnées SAML Keycloak : `http://localhost:8080/realms/depot-numerique/protocol/saml/descriptor`

Keycloak simule le fournisseur d'identité SAML et lit les utilisateurs dans OpenLDAP. Démarrer
uniquement les services SSO :

```bash
docker compose up -d --wait openldap keycloak phpldapadmin
```

Après une modification de `sso/keycloak/realm.json`, recréer le conteneur pour réimporter le realm :

```bash
docker compose up -d --force-recreate --wait keycloak
```

Après une modification de `sso/openldap/schema` ou `sso/openldap/ldif`, recréer les volumes
OpenLDAP locaux pour rejouer l'initialisation de l'annuaire. Consulter
[SSO SAML local](../authentication/local-sso.md) pour les comptes de démonstration, les attributs SAML, les
vérifications et les limites de cette configuration.

Arrêter les services :

```bash
docker compose down
```

Supprimer aussi les volumes locaux :

```bash
docker compose down -v
```

Attention : `docker compose down -v` supprime les volumes locaux PostgreSQL, Redis, MinIO et
OpenLDAP. Keycloak n'a pas de volume nommé : sa base H2 se trouve dans le conteneur et disparaît dès
que celui-ci est supprimé, même sans `-v`. Le realm est réimporté depuis
`sso/keycloak/realm.json` au démarrage suivant.

## Qualité

Le projet utilise :

- Biome pour le formatage et le lint ;
- Knip pour détecter les dépendances et fichiers inutilisés ;
- Commitlint pour valider les messages de commit ;
- Lefthook pour les hooks Git locaux.

Les commandes suivent une nomenclature commune :

```text
pnpm <tâche>              # tous les workspaces concernés
pnpm <workspace>:<tâche>  # un workspace précis
```

Workspaces disponibles :

- `api` : API NestJS.
- `web` : frontend Angular.
- `docs` : documentation VitePress.
- `database` : schéma et client Prisma.
- `worker` : traitements asynchrones BullMQ.

Tâches principales :

- `build` : compile le workspace.
- `test` : lance les tests.
- `typecheck` : vérifie les types TypeScript sans produire de build.
- `lint` : lance le lint Biome.
- `format` : formate le code avec Biome.
- `format:check` : vérifie le formatage sans modifier les fichiers.
- `check` : lance les vérifications Biome complètes.
- `check:fix` : applique les corrections Biome automatiques.
- `verify` : enchaîne les contrôles qualité principaux avant une PR ou un push important.

Les tâches monorepo passent par Turbo. Cela permet d'exécuter les workspaces en parallèle, d'utiliser le cache lorsque c'est possible et de cibler un workspace sans écrire `--filter` à la main.

Les hooks Git sont gérés par Lefthook :

- `pre-commit` lance Biome sur les fichiers staged et réajoute les fichiers corrigés.
- `commit-msg` valide le message de commit avec Commitlint.
- `pre-push` lance en parallèle `pnpm check`, `pnpm knip`, `pnpm typecheck` et `pnpm test`.

Commandes principales :

```bash
pnpm build
pnpm test
pnpm typecheck
pnpm lint
pnpm format
pnpm format:check
pnpm check
pnpm check:fix
pnpm verify
pnpm knip
pnpm prepare
```

La commande `pnpm verify` exécute dans l'ordre :

```bash
pnpm check
pnpm knip
pnpm typecheck
pnpm test
```

Commandes ciblées API :

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

Commandes ciblées frontend :

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

Commandes ciblées worker :

```bash
pnpm worker:dev
pnpm worker:build
pnpm worker:test
pnpm worker:typecheck
pnpm worker:lint
pnpm worker:format
pnpm worker:format:check
pnpm worker:check
pnpm worker:check:fix
```

Le test du worker vérifie le traitement et le résultat de la queue de démonstration sans nécessiter
de connexion à Redis.

Commandes ciblées documentation :

```bash
pnpm docs:dev
pnpm docs:build
pnpm docs:preview
pnpm docs:lint
pnpm docs:format
pnpm docs:format:check
pnpm docs:check
pnpm docs:check:fix
```

La documentation n'a pas encore de commande `docs:test` ni `docs:typecheck`. Le build VitePress
avec `pnpm docs:build` sert de vérification principale.

Commandes ciblées base de données :

```bash
pnpm database:build
pnpm database:typecheck
pnpm database:lint
pnpm database:format
pnpm database:format:check
pnpm database:check
pnpm database:check:fix
pnpm database:validate
pnpm database:generate
pnpm database:migrate:create
pnpm database:migrate:dev
pnpm database:migrate:deploy
pnpm database:migrate:status
pnpm database:seed
pnpm database:studio
```

Une création de migration doit recevoir un nom explicite :

```bash
pnpm database:migrate:create --name description_courte
```

Le schéma Prisma est formaté séparément de Biome. Pour l'aligner manuellement :

```bash
pnpm --filter @depot-numerique/database exec prisma format
```

Pour le faire automatiquement à l'enregistrement, configurer l'extension Prisma de l'éditeur comme
formateur par défaut des fichiers `.prisma` et activer le formatage à la sauvegarde.

Le script `pnpm database:studio` force Prisma Studio sur `http://localhost:5555`.

Le workspace database n'a pas encore de commande de test dédiée.

## Intégration continue

Le workflow `.github/workflows/ci.yml` s'exécute sur les pull requests vers `main`, les pushes sur
`main`, les merge queues et les déclenchements manuels. Il lance trois contrôles en parallèle :

- `Quality` : Biome, Knip, vérification TypeScript et validation du schéma Prisma ;
- `Tests` : tests de tous les workspaces qui exposent une commande `test` ;
- `Build` : construction de tous les workspaces.

Chaque job utilise la version Node.js de `.nvmrc`, la version pnpm déclarée dans `package.json` et
installe les dépendances avec `pnpm install --frozen-lockfile`. Le workflow dispose uniquement d'un
accès en lecture au dépôt et ne reçoit aucun secret applicatif.

Pour empêcher la fusion d'une pull request en échec, configurer le ruleset de la branche `main`
dans GitHub et rendre obligatoires les checks `Quality`, `Tests` et `Build`.

## Base de données locale

Lancer PostgreSQL puis générer, sans l'appliquer, la migration correspondant à une modification du
schéma :

```bash
docker compose up -d postgres
pnpm database:migrate:create --name description
```

Après relecture du SQL, `pnpm database:migrate:dev` applique localement les migrations en attente.

Initialiser ou remettre à jour les données de développement :

```bash
pnpm database:seed
```

Le seed possède une arborescence simplifiée qui ne reprend pas les mêmes codes de structure que le
LDIF OpenLDAP complet. Il ne faut pas le mélanger par défaut avec un test de provisioning SSO sur la
même base ; consulter [Base de données et migrations](../data/database.md#seed-de-développement).

Une migration est un historique SQL versionné, pas une copie de la base locale. Les dossiers
créés dans `packages/database/prisma/migrations` sont commités puis appliqués sur les autres bases
avec `pnpm database:migrate:deploy` par la CI/CD.

Consulter [Base de données et migrations](../data/database.md) pour le modèle, le seed et les règles de
déploiement.

## Documentation

La documentation est construite avec VitePress.

```bash
pnpm docs:build
```

Prévisualiser le build localement :

```bash
pnpm docs:preview
```

La documentation est configurée pour GitHub Pages avec :

```ts
base: "/depot-numerique/";
```

Le workflow GitHub Actions `.github/workflows/deploy.yml` construit `docs/.vitepress/dist` et le publie sur GitHub Pages.

Les pages VitePress couvrent le développement, l'infrastructure Docker, l'API, la base de données,
les workers et les deux niveaux de documentation SSO. Les README placés dans les workspaces restent
des points d'entrée courts pour les développeurs qui travaillent dans un sous-dossier.

## Commandes utiles

Lister les workspaces :

```bash
pnpm -r list --depth -1
```

Construire tout le monorepo :

```bash
pnpm build
```

Lancer tous les tests :

```bash
pnpm test
pnpm api:test:e2e
```

`pnpm test` exécute les tests unitaires des workspaces. Les tests e2e HTTP de l'API sont séparés et
utilisent des doublures pour PostgreSQL, Redis et MinIO ; ils ne nécessitent donc pas Docker.
