# Architecture

Cette page sépare l'architecture actuellement exécutable de la cible fonctionnelle. Les composants
futurs sont documentés pour guider les prochaines étapes, sans être présentés comme disponibles.

## État des composants

| Composant             | État actuel                                                               |
| --------------------- | ------------------------------------------------------------------------- |
| Angular               | coque applicative et redirection SSO automatique                          |
| API NestJS            | socle HTTP, Better Auth/SAML, provisioning, logs et healthchecks          |
| PostgreSQL/Prisma     | identités, profils, structures, services et premier modèle documentaire   |
| Redis/BullMQ          | connexion et queue de démonstration                                       |
| MinIO                 | client et contrôle de disponibilité du bucket brut                        |
| Worker                | processor de démonstration uniquement                                     |
| Keycloak/OpenLDAP     | simulation locale du contrat SSO                                          |
| Docker/Traefik/Nginx  | images API/web et exposition HTTPS locale                                 |
| Dépôt documentaire    | non implémenté                                                            |
| Analyse documentaire | non implémentée                                                            |
| Playwright            | non implémenté                                                            |
| Supervision/Vault     | cibles non intégrées                                                      |

## Architecture actuelle

```text
Navigateur
   |
   | HTTPS
   v
Traefik
   |-- /api/** ----------------------> API NestJS
   |                                     |-- Better Auth / SAML
   |                                     |-- PostgreSQL via Prisma
   |                                     |-- Redis
   |                                     `-- MinIO
   |-- autres chemins ----------------> Angular servi par Nginx
   `-- idp.depot-numerique.localhost -> Keycloak -> OpenLDAP

Worker NestJS/BullMQ -- exécution pnpm séparée --> Redis
```

Le réseau Docker `depot-numerique-app` relie Traefik, le web, l'API et Keycloak. L'API utilise aussi
le réseau Compose par défaut pour joindre PostgreSQL, Redis et MinIO. Les processus API sont conçus
sans état local de session : Better Auth persiste les sessions dans PostgreSQL.

## Flux d'identité actuel

```text
Angular
  -> Better Auth : session ?
  -> Keycloak : AuthnRequest SAML signée
  -> OpenLDAP : vérification de logonId et du mot de passe
  -> Keycloak : réponse signée, assertion chiffrée
  -> API : contrôles SAML et déchiffrement
  -> PostgreSQL : AuthIdentity, AuthAccount, AuthSession
  -> provisioning : User et Structure à partir des claims
  -> Angular : cookie de session HttpOnly
```

`igcid` relie l'identité technique au profil métier. `bureauIGC` fournit les codes de rattachement et
`siteDescription` le libellé du site final. Le détail se trouve dans
[Comprendre et raccorder le SSO SAML](../authentication/saml.md).

## Flux documentaire cible

Le parcours cible, encore à implémenter, est le suivant :

1. Angular envoie un document à une route authentifiée de l'API.
2. L'API valide taille, type MIME et autorisation, crée `Document`, stocke l'original dans MinIO et
   ajoute `DocumentFile`.
3. Une transaction ou une stratégie d'outbox garantit la cohérence entre l'état PostgreSQL et la
   publication BullMQ.
4. Un worker extrait le numéro de dossier et contrôle la trame.
5. Un document conforme est placé dans la queue de dépôt.
6. Un document non conforme conserve un état explicite et suit un traitement métier qui reste à
   définir.
7. Un worker Playwright effectue le dépôt sur la plateforme interne.
8. Chaque transition est persistée et visible par l'utilisateur ; Redis n'est pas la source de
   vérité métier.

```text
Angular -> API -> PostgreSQL + MinIO -> BullMQ/Redis -> Workers
                                               |          |-- analyse
                                               |          `-- Playwright
                                               `------ états persistés ------> Angular
```

## Responsabilités

### Frontend

- collecte et retour utilisateur ;
- affichage des statuts et vues autorisées ;
- aucune décision d'autorisation définitive ni secret.

### API

- authentification, autorisation et validation des entrées ;
- orchestration métier et persistance des statuts ;
- génération de références MinIO non sensibles ;
- publication des jobs et API de supervision.

### Base de données

- source de vérité des utilisateurs, rattachements, documents et transitions ;
- contraintes d'intégrité, audit et politiques de rétention ;
- aucune donnée binaire documentaire.

### Workers

- traitements asynchrones idempotents ;
- isolation des dépendances lourdes et de Playwright ;
- mise à jour atomique ou compensée des résultats et tentatives.

### MinIO

- originaux et versions dérivées ;
- clés déterministes sans données personnelles ;
- cycle de vie coordonné avec PostgreSQL.

## Scalabilité cible

Traefik sait répartir les requêtes entre plusieurs conteneurs, mais le Compose local ne constitue pas
un déploiement multi-serveurs. La cible doit permettre :

- plusieurs API stateless derrière un load balancer ;
- plusieurs workers avec concurrence réglée par queue ;
- PostgreSQL répliqué, sauvegardé et restaurable ;
- Redis en haute disponibilité compatible BullMQ ;
- MinIO distribué ou répliqué ;
- secrets injectés et renouvelés via Vault ;
- reprise d'un job après arrêt sans doublon métier.

## Décisions encore nécessaires

- contrat des routes et DTO documentaires ;
- types MIME, limites et règles exactes de conformité ;
- modèle persistant des analyses, jobs, tentatives et historiques ;
- stratégie de cohérence entre PostgreSQL, MinIO et BullMQ ;
- traitement métier des documents non conformes ;
- règles précises d'habilitation des administrateurs ;
- plateforme cible de Playwright et mécanisme d'authentification ;
- durées de rétention, sauvegardes, supervision et orchestrateur de production.
