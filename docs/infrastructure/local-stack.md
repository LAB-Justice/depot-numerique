# Infrastructure locale

Cette page décrit la stack Docker réellement présente dans le dépôt. Elle concerne le développement
local : elle constitue une base de conteneurisation, pas encore une architecture de production à
haute disponibilité.

## Vue d'ensemble

Le fichier `docker-compose.yml` possède deux niveaux d'exécution :

- sans profil, il démarre PostgreSQL, Redis, MinIO, OpenLDAP, phpLDAPadmin et Keycloak ;
- avec le profil `app`, il ajoute les migrations Prisma, l'API, le frontend et Traefik.

```text
Navigateur
   |
   | HTTPS : 443
   v
Traefik
   |-- depot-numerique.localhost/api/** --> API NestJS : 3000
   |-- depot-numerique.localhost/**     --> Nginx/web : 8080
   `-- idp.depot-numerique.localhost/** --> Keycloak : 8080

API --> PostgreSQL
    --> Redis
    --> MinIO
    --> Keycloak (métadonnées SAML)

Keycloak --> OpenLDAP
```

Traefik publie les ports `80` et `443`. Les conteneurs API et web ne publient aucun port sur l'hôte
dans le profil `app` ; ils sont accessibles uniquement par le réseau Docker `depot-numerique-app`.
Les services d'infrastructure conservent des ports hôte pour faciliter le diagnostic local.

## Pourquoi Traefik et Nginx

Les deux composants n'ont pas le même rôle :

- Traefik est le reverse proxy d'entrée. Il termine TLS, redirige HTTP vers HTTPS, sélectionne un
  service selon le nom d'hôte et le chemin, et fournit le mécanisme de load balancing Docker ;
- Nginx est le serveur statique embarqué dans l'image web. Il sert les fichiers Angular, renvoie
  `index.html` pour les routes de la SPA et configure le cache des assets.

NestJS est déjà un serveur HTTP : l'image API peut donc exécuter directement Node.js. Angular produit
des fichiers statiques et a besoin d'un serveur HTTP dans son conteneur, d'où Nginx. Nginx n'est pas
exposé directement et ne remplace pas Traefik.

## Images applicatives

### API

`apps/api/Dockerfile` utilise un build multi-stage :

1. l'étape `build` installe le monorepo avec le lockfile, génère le client Prisma et compile l'API ;
2. `pnpm deploy --legacy --filter api --prod` produit un ensemble de dépendances de production ;
3. l'étape `runtime` copie uniquement ce résultat et `dist`, puis exécute Node.js avec l'utilisateur
   non privilégié `node`.

Le dossier `patches` est copié avant `pnpm install`, car pnpm doit appliquer le correctif Better Auth
SSO pendant l'installation des dépendances.

### Frontend

`apps/web/Dockerfile` compile Angular avec Node.js, puis copie le build dans
`nginxinc/nginx-unprivileged`. Le runtime écoute sur le port non privilégié `8080`.

`apps/web/nginx/default.conf` applique les règles suivantes :

- fallback SPA vers `index.html` ;
- cache long et immutable pour les assets versionnés ;
- absence de cache pour `index.html` afin de charger rapidement une nouvelle version.

Le dossier `patches` est également requis pendant le build web, car le client Angular dépend du
plugin Better Auth SSO patché.

### Worker

Le worker ne possède pas encore d'image Docker ni de service Compose. Il s'exécute avec
`pnpm worker:dev`. Une image séparée devra être ajoutée avant un déploiement de la pipeline métier,
notamment pour isoler Playwright et contrôler la concurrence des jobs.

## Routage Traefik

La configuration statique se trouve dans `infra/traefik/traefik.yml`. Elle :

- écoute sur `80` (`web`) et `443` (`websecure`) ;
- redirige définitivement HTTP vers HTTPS ;
- désactive l'exposition automatique des conteneurs Docker ;
- charge la configuration dynamique dans `infra/traefik/dynamic` ;
- produit des logs JSON et retire les headers des access logs ;
- expose le ping de santé uniquement dans le conteneur.

Les labels de `docker-compose.yml` déclarent trois routeurs :

| Routeur    | Règle                                                         | Cible           |
| ---------- | ------------------------------------------------------------- | --------------- |
| `api`      | hôte applicatif et préfixe `/api`                             | API, port `3000` |
| `web`      | hôte applicatif, priorité inférieure au routeur API           | web, port `8080` |
| `keycloak` | hôte IdP                                                      | Keycloak, `8080` |

La priorité du routeur API empêche le frontend d'intercepter `/api/**`. Le service Traefik associé à
chaque routeur est un load balancer, même si Compose ne lance qu'une instance par défaut. Le passage
à plusieurs replicas demande encore une validation d'exploitation, notamment pour la base, les
sessions, les migrations et les healthchecks.

Le middleware `web-defaults` applique au frontend la compression et des headers de sécurité : CSP,
HSTS, anti-framing, `nosniff`, `Referrer-Policy` et `Permissions-Policy`. L'API applique séparément
Helmet dans NestJS. Le dashboard Traefik n'est pas publié sur l'hôte.

## Certificat HTTPS local

Traefik charge un certificat couvrant les deux noms locaux :

- `depot-numerique.localhost` ;
- `idp.depot-numerique.localhost`.

Installer d'abord `mkcert`. Sous Debian ou Ubuntu :

```bash
sudo apt install mkcert libnss3-tools
mkcert -install
```

Puis générer les fichiers :

```bash
pnpm tls:certificates:generate
```

Le script écrit `.secrets/traefik/local-cert.pem` et `.secrets/traefik/local-key.pem`. Il conserve une
paire complète existante et refuse un dossier partiel pour éviter d'associer un certificat à la
mauvaise clé. `.secrets/` est ignoré par Git et par le contexte de build Docker.

`PUBLIC_HOST` et `IDP_PUBLIC_HOST` permettent de changer les domaines. Ils doivent être définis de
la même façon lors de la génération du certificat et du démarrage de Compose. Le realm Keycloak
fourni contient toutefois les URLs `.localhost` ; un autre domaine exige aussi d'adapter sa
configuration SAML. La directive CSP `form-action` de `infra/traefik/dynamic/middlewares.yml`
référence également le domaine IdP local et doit rester alignée.

Les certificats TLS de Traefik sont distincts des deux paires de clés SAML du Service Provider. Les
premiers chiffrent HTTPS ; les secondes signent les `AuthnRequest` et déchiffrent les assertions.

## Démarrage complet

Préparer l'environnement et les certificats :

```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp packages/database/.env.example packages/database/.env
cp apps/worker/.env.example apps/worker/.env
pnpm install
mkcert -install
pnpm tls:certificates:generate
pnpm sso:certificates:generate
```

Le `.env` racine doit contenir un `BETTER_AUTH_SECRET` aléatoire d'au moins 32 caractères. Démarrer
ensuite la stack :

```bash
pnpm stack:dev
```

Cette commande équivaut à :

```bash
docker compose --profile app up -d --build --wait
```

L'ordre utile est garanti par les healthchecks et `depends_on` : les dépendances deviennent saines,
le conteneur `migrate` applique `prisma migrate deploy`, puis l'API démarre. Une migration en échec
empêche l'API de démarrer.

Compose ne crée pas encore les buckets applicatifs. Sur un volume MinIO neuf, créer le bucket brut
configuré par `MINIO_RAW_BUCKET` :

```bash
docker compose exec minio sh -c 'mc alias set app http://localhost:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null && mc mb --ignore-existing app/documents-raw'
```

Le healthcheck du conteneur MinIO vérifie le serveur, tandis que la readiness API vérifie aussi
l'existence de ce bucket. Elle renvoie donc `503` tant qu'il manque.

## Commandes d'exploitation locale

```bash
docker compose --profile app ps
docker compose --profile app logs -f traefik api web keycloak
docker compose --profile app up -d --build --wait
docker compose --profile app down
```

Reconstruire seulement l'API après un changement :

```bash
docker compose --profile app up -d --build --wait api
```

Forcer la réimportation du realm en recréant Keycloak :

```bash
docker compose up -d --force-recreate --wait keycloak
```

La recréation génère un nouveau certificat de signature IdP. Si l'API tourne déjà, la redémarrer pour
qu'elle recharge les métadonnées :

```bash
docker compose --profile app restart api
```

Consulter les logs du job de migration :

```bash
docker compose --profile app logs migrate
```

## Données persistantes

| Service    | Stockage local                         | Effet d'une suppression              |
| ---------- | -------------------------------------- | ------------------------------------ |
| PostgreSQL | volume `postgres_data`                 | perte de la base applicative         |
| Redis      | volume `redis_data`, AOF activé        | perte des données Redis et des jobs  |
| MinIO      | volume `minio_data`                    | perte des objets                     |
| OpenLDAP   | volumes `openldap_data` et `openldap_config` | réimport du schéma et du LDIF  |
| Keycloak   | couche writable du conteneur, base H2  | réimport du realm après recréation   |

`docker compose down` supprime les conteneurs et le réseau Compose. Il supprime donc la base H2
éphémère de Keycloak, mais conserve les volumes nommés. `docker compose down -v` supprime en plus les
volumes PostgreSQL, Redis, MinIO et OpenLDAP. Cette dernière commande efface des données locales et
doit être utilisée uniquement lorsqu'une réinitialisation complète est voulue.

## Limites avant production

La stack locale ne fournit pas encore :

- une image et un service pour le worker ;
- un orchestrateur multi-nœuds et une stratégie de déploiement sans interruption ;
- la haute disponibilité de PostgreSQL, Redis, MinIO ou Vault ;
- une PKI de production ni la rotation automatisée des certificats ;
- un Keycloak de production — le vrai IdP doit être le SSO institutionnel ;
- Prometheus, Grafana, Alertmanager ou la centralisation des logs ;
- une gestion de secrets par Vault ;
- des sauvegardes et restaurations testées.

Les images et les services locaux sont un socle reproductible. Les exigences de sécurité,
supervision, réplication et rétention doivent être traitées séparément avant toute mise en service.
