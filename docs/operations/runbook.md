# Exploitation

L'exploitation documentée ici couvre la stack locale et les principes attendus en production. Les
outils de supervision, sauvegarde et haute disponibilité ne sont pas encore intégrés au dépôt.

## Démarrage local

Infrastructure seule :

```bash
pnpm infra:dev
```

Stack applicative HTTPS :

```bash
pnpm stack:dev
```

La stack complète attend les healthchecks, applique les migrations Prisma avec le service ponctuel
`migrate`, puis démarre l'API. Le worker doit être lancé séparément avec `pnpm worker:dev`.

Sur un volume MinIO neuf, créer le bucket brut attendu par l'API :

```bash
docker compose exec minio sh -c 'mc alias set app http://localhost:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null && mc mb --ignore-existing app/documents-raw'
```

Adapter le dernier segment si `MINIO_RAW_BUCKET` utilise un autre nom.

## État et logs

```bash
docker compose --profile app ps
docker compose --profile app logs -f traefik api web keycloak
docker compose --profile app logs migrate
docker compose logs -f postgres redis minio openldap
```

Les conteneurs doivent produire leurs logs sur stdout/stderr. Traefik et l'API utilisent déjà un
format JSON. La centralisation, la rotation et la rétention ne sont pas encore configurées.

## Contrôles de santé

| Composant  | Contrôle local                                                         |
| ---------- | ---------------------------------------------------------------------- |
| Traefik    | ping interne utilisé par le healthcheck                                |
| API live   | `GET /api/health/live`                                                  |
| API ready  | `GET /api/health/ready`, vérifie PostgreSQL, Redis et MinIO             |
| web        | requête HTTP sur Nginx `:8080`                                         |
| Keycloak   | endpoint `/health/ready` sur son port de management                     |
| PostgreSQL | `pg_isready`                                                            |
| Redis      | `redis-cli ping` authentifié                                            |
| MinIO      | `mc ready local`                                                        |
| OpenLDAP   | recherche LDAP authentifiée sur la base                                |

La liveness répond tant que le processus API fonctionne. La readiness passe à `503` lorsqu'une
dépendance nécessaire est indisponible. Keycloak n'est pas inclus dans la readiness API, car il
n'intervient que pendant l'authentification ; l'API le charge toutefois au démarrage pour lire ses
métadonnées.

Le worker n'expose pas encore de healthcheck exploitable.

## Migrations

Créer et relire une migration en développement :

```bash
pnpm database:migrate:create --name description_courte
```

Appliquer les migrations versionnées :

```bash
pnpm database:migrate:deploy
```

En déploiement, l'opération doit s'exécuter une seule fois avec un compte dédié, avant les nouvelles
instances. Une migration destructive requiert une sauvegarde, un plan de compatibilité applicative
et une procédure de retour adaptée. Ne jamais modifier une migration déjà appliquée.

## Arrêt et réinitialisation

Arrêter la stack sans supprimer les volumes :

```bash
docker compose --profile app down
```

`docker compose down -v` supprime les volumes PostgreSQL, Redis, MinIO et OpenLDAP. Keycloak perd sa
base H2 dès que son conteneur est supprimé. Cette réinitialisation est réservée aux données locales de
développement et ne doit jamais servir de procédure de production.

## Données et sauvegardes

Aucune automatisation de sauvegarde n'est versionnée. Avant production, il faut définir et tester :

- sauvegardes PostgreSQL cohérentes, restauration ponctuelle et objectifs RPO/RTO ;
- réplication et procédure de bascule PostgreSQL ;
- persistance et haute disponibilité Redis compatibles avec BullMQ ;
- réplication ou erasure coding MinIO et restauration des objets ;
- sauvegarde de la configuration Vault et procédure d'unseal ;
- cohérence d'une restauration entre base, objets et jobs.

Une restauration ne doit pas réexécuter un dépôt Playwright déjà réussi. Les tentatives et preuves de
dépôt devront être persistées afin de prendre cette décision.

## Métriques cibles

Prometheus, Grafana et Alertmanager ne sont pas encore présents. La cible doit couvrir :

- HTTP : débit, latence, erreurs et saturation ;
- BullMQ : attente, actifs, retards, échecs, retries et durée ;
- PostgreSQL : connexions, locks, réplication et requêtes lentes ;
- Redis : mémoire, évictions, connexions et latence ;
- MinIO : disponibilité, capacité et erreurs S3 ;
- Playwright : durée, étape d'échec, timeout et taux de réussite ;
- métier : reçus, conformes, corrigés, déposés, rejetés et en erreur.

Les alertes doivent être actionnables, associées à une procédure et testées. Une absence de métrique
ou de logs doit être distinguée d'une valeur métier nulle.

## Procédure d'incident cible

1. identifier l'environnement et l'étendue sans exposer de donnée personnelle ;
2. relever `requestId`, `documentId` et `jobId` ;
3. vérifier healthchecks, saturation et dernières migrations ;
4. suspendre uniquement la queue ou le composant concerné si cela limite le risque ;
5. préserver les traces nécessaires selon la politique d'audit ;
6. corriger ou rejouer de façon idempotente ;
7. documenter la cause, l'impact, la chronologie et les actions préventives.

Les coordonnées d'astreinte, niveaux de sévérité et délais de réponse restent à définir avec
l'organisation d'exploitation.
