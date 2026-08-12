# SSO SAML local

Keycloak simule en développement le fournisseur d'identité SAML de l'intranet. Il lit les utilisateurs
dans OpenLDAP, puis expose à l'application une assertion SAML avec les attributs attendus par le
contrat SSO.

::: warning Développement uniquement
Cette stack utilise `start-dev`, une base H2 située dans le conteneur Keycloak, un annuaire OpenLDAP
local et des mots de passe publics. Traefik expose le flux navigateur en HTTPS, mais les échanges
internes restent adaptés au développement. Cette stack ne doit jamais être déployée en recette ou en
production.
:::

## Périmètre

La stack SSO locale fournit :

- OpenLDAP avec la base `dc=justice,dc=fr` ;
- une branche `ou=sites,dc=justice,dc=fr` contenant l'arborescence métier ;
- une branche `ou=people,dc=justice,dc=fr` contenant les utilisateurs de test ;
- phpLDAPadmin pour inspecter graphiquement l'annuaire ;
- Keycloak configuré comme fournisseur d'identité SAML ;
- une fédération LDAP Keycloak vers OpenLDAP ;
- un client SAML `depot-numerique` ;
- des mappers SAML alignés sur les attributs transmis par le SSO intranet.

OpenLDAP reste la source des comptes de démonstration ; Keycloak fédère ces identités et peut les
mettre en cache dans son stockage local. Dans l'application, `AuthIdentity` porte l'identité
technique Better Auth et `User` porte le profil métier. Le champ
`User.igcId` conserve l'identifiant annuaire stable en clair afin de retrouver le même profil même si
le nom ou l'adresse électronique change. Cet identifiant interne ne doit pas être journalisé ou
exposé sans nécessité métier.

## Fichiers de configuration

- `docker-compose.yml` démarre Keycloak et monte le fichier du realm en lecture seule ;
- `sso/keycloak/realm.json` contient le realm, le client et les mappers ;
- `sso/openldap/schema/depot-numerique.schema` déclare les attributs locaux ;
- `sso/openldap/ldif/bootstrap.ldif` contient l'arborescence et les comptes ;
- `infra/traefik` expose l'application et l'IdP avec deux noms HTTPS ;
- `.env` contient les identifiants locaux du compte administrateur ;
- `.env.example` documente les variables attendues sans fournir de secret de production.

Le profil utilisateur Keycloak est déclaré dans `realm.json` avec le provider
`declarative-user-profile`. Cette déclaration est nécessaire avec Keycloak 26 pour conserver et
exposer les attributs personnalisés. La valeur `kc.user.profile.config` est un JSON sérialisé dans le
format natif d'import/export de Keycloak.

## Variables d'environnement

Créer le fichier local si nécessaire :

```bash
cp .env.example .env
```

Variables utilisées :

```dotenv
KEYCLOAK_ADMIN_USERNAME=root
KEYCLOAK_ADMIN_PASSWORD=password
KEYCLOAK_PORT=8080
```

Le compte administrateur appartient au realm système `master`. Il est distinct des comptes métier du
realm `depot-numerique`.

Pour le parcours complet, générer au préalable les certificats de signature et de chiffrement du SP :

```bash
pnpm sso:certificates:generate
```

Ils sont placés dans `.secrets/saml`, qui est ignoré par Git. Keycloak récupère uniquement leurs
certificats publics depuis les métadonnées exposées par l'API.

Ces fichiers sont distincts du certificat HTTPS local de Traefik, généré avec
`pnpm tls:certificates:generate`.

## Démarrage et import

Démarrer l'infrastructure SSO seule pour inspecter LDAP ou Keycloak :

```bash
docker compose up -d --wait openldap phpldapadmin keycloak
```

Vérifier son état et l'import :

```bash
docker compose ps keycloak
docker compose logs keycloak
```

Ce mode publie Keycloak directement sur `http://localhost:8080`, mais ne démarre pas l'API dont il
doit lire les métadonnées SP. Pour tester la connexion SAML complète avec les URLs HTTPS du realm :

```bash
mkcert -install
pnpm tls:certificates:generate
pnpm sso:certificates:generate
pnpm stack:dev
```

La chaîne simulée est :

```text
OpenLDAP -> Keycloak User Federation -> Assertion SAML -> Application
```

## URLs locales

| Ressource                 | Infrastructure seule                         | Stack `app` HTTPS                                      |
| ------------------------- | -------------------------------------------- | ------------------------------------------------------ |
| console Keycloak          | `http://localhost:8080/admin/master/console/` | `https://idp.depot-numerique.localhost/admin/master/console/` |
| métadonnées IdP           | `http://localhost:8080/realms/depot-numerique/protocol/saml/descriptor` | `https://idp.depot-numerique.localhost/realms/depot-numerique/protocol/saml/descriptor` |
| métadonnées SP            | API requise                                  | `https://depot-numerique.localhost/api/auth/sso/saml2/sp/metadata?providerId=justice-saml&format=xml` |
| OpenLDAP                  | `ldap://localhost:389`                       | `ldap://localhost:389`                                 |
| phpLDAPadmin              | `http://localhost:8081`                      | `http://localhost:8081`                                |

Identifiants locaux :

| Service          | Identifiant                 | Mot de passe |
| ---------------- | --------------------------- | ------------ |
| Keycloak admin   | `root`                      | `password`   |
| LDAP admin       | `cn=admin,dc=justice,dc=fr` | `admin`      |
| Utilisateurs SSO | login LDAP                  | `password`   |

## Attributs SAML

L'assertion SAML expose les attributs du formulaire d'interface LDAP/SSO :

| Attribut SAML     | Source LDAP              | Exemple                          |
| ----------------- | ------------------------ | -------------------------------- |
| `igcid`           | personnalisé `igcid`     | `00000006`                       |
| `nom`             | standard `sn`            | `Agent Lille`                    |
| `prenom`          | standard `givenName`     | `Olivier`                        |
| `logonId`         | personnalisé `logonId`   | `agent-lille.olivier`            |
| `mail`            | standard `mail`          | `agent-lille.olivier@justice.fr` |
| `roles`           | personnalisé `roles`     | `DEPOT_NUMERIQUE:AGENT`          |
| `bureauIGC`       | personnalisé `bureauIGC` | `ou=00000004,...`                |
| `siteDescription` | personnalisé             | `Tribunal judiciaire de Lille`   |
| `affectationOp2`  | personnalisé optionnel   | absent du LDIF actuel            |
| `affectationOp3`  | personnalisé optionnel   | absent du LDIF actuel            |
| `affectationOp4`  | personnalisé optionnel   | absent du LDIF actuel            |

Les utilisateurs sont stockés dans `ou=people`, et leur rattachement métier est porté par
`bureauIGC`. L'application ne doit donc pas déduire le rattachement depuis le DN utilisateur.
L'attribut `igcid` est la clé de rapprochement stable du profil métier ; `mail` ne doit jamais être
utilisé comme clé de reconnexion.

`bureauIGC` et `siteDescription` sont complémentaires. Le premier est le DN technique qui permet à
l'API de retrouver les codes de la cour et du site final. Le second est le libellé humain du site
final. L'API exige les deux pour tous les rôles sauf `ADMINISTRATEUR_NATIONAL`, crée ou actualise les
structures, puis stocke uniquement leurs relations dans `User`. Les affectations secondaires sont
mappées lorsqu'elles existent, mais aucun compte du LDIF actuel ne les renseigne et l'API ne les
utilise pas encore.

Le chemin complet d'un attribut est donc :

```text
OpenLDAP -> mapper LDAP Keycloak -> profil Keycloak -> mapper SAML -> Better Auth -> provisioning User
```

Keycloak utilise l'attribut LDAP `logonId` comme identifiant de connexion. L'attribut `uid` reste le
RDN technique des entrées sous la forme `uid=<valeur>,ou=people,dc=justice,dc=fr`. Les deux
valeurs sont identiques dans le jeu de données local afin de simplifier la simulation.

## Comptes de test

Tous les comptes utilisent le mot de passe `password`.

| Login                                 | Rôle SSO                                  | Rattachement    |
| ------------------------------------- | ----------------------------------------- | --------------- |
| `admin-national.sophie`               | `DEPOT_NUMERIQUE:ADMINISTRATEUR_NATIONAL` | DSJ             |
| `admin-regional-douai.pierre`         | `DEPOT_NUMERIQUE:ADMINISTRATEUR_REGIONAL` | CA Douai        |
| `admin-local-ca-douai.anne`           | `DEPOT_NUMERIQUE:ADMINISTRATEUR_LOCAL`    | CA Douai        |
| `agent-ca-douai.louis`                | `DEPOT_NUMERIQUE:AGENT`                   | CA Douai        |
| `admin-local-lille.claire`            | `DEPOT_NUMERIQUE:ADMINISTRATEUR_LOCAL`    | TJ Lille        |
| `admin-regional-lille.mathieu`        | `DEPOT_NUMERIQUE:ADMINISTRATEUR_REGIONAL` | TJ Lille        |
| `agent-lille.olivier`                 | `DEPOT_NUMERIQUE:AGENT`                   | TJ Lille        |
| `agent-lille.marie`                   | `DEPOT_NUMERIQUE:AGENT`                   | TJ Lille        |
| `admin-local-tprox-tourcoing.thomas`  | `DEPOT_NUMERIQUE:ADMINISTRATEUR_LOCAL`    | TPROX Tourcoing |
| `admin-regional-tprox-tourcoing.nora` | `DEPOT_NUMERIQUE:ADMINISTRATEUR_REGIONAL` | TPROX Tourcoing |
| `admin-local-arras.nadia`             | `DEPOT_NUMERIQUE:ADMINISTRATEUR_LOCAL`    | TJ Arras        |
| `agent-arras.luc`                     | `DEPOT_NUMERIQUE:AGENT`                   | TJ Arras        |
| `admin-local-douai.elise`             | `DEPOT_NUMERIQUE:ADMINISTRATEUR_LOCAL`    | TJ Douai        |
| `agent-douai.hugo`                    | `DEPOT_NUMERIQUE:AGENT`                   | TJ Douai        |
| `admin-local-cph-lille.sarah`         | `DEPOT_NUMERIQUE:ADMINISTRATEUR_LOCAL`    | CPH Lille       |
| `admin-regional-amiens.julien`        | `DEPOT_NUMERIQUE:ADMINISTRATEUR_REGIONAL` | CA Amiens       |
| `admin-local-ca-amiens.camille`       | `DEPOT_NUMERIQUE:ADMINISTRATEUR_LOCAL`    | CA Amiens       |
| `agent-ca-amiens.emma`                | `DEPOT_NUMERIQUE:AGENT`                   | CA Amiens       |
| `admin-local-amiens.manon`            | `DEPOT_NUMERIQUE:ADMINISTRATEUR_LOCAL`    | TJ Amiens       |
| `agent-amiens.ines`                   | `DEPOT_NUMERIQUE:AGENT`                   | TJ Amiens       |

## Arborescence métier

Les structures sont dans `ou=sites,dc=justice,dc=fr`.

```text
00000001  Ministere de la Justice
  00000002  Direction des services judiciaires
    00000003  Cour d'appel de Douai
      00000004  Tribunal judiciaire de Lille
        00000005  Tribunal de proximite de Tourcoing
      00000006  Tribunal judiciaire d'Arras
      00000007  Tribunal judiciaire de Douai
      00000010  Conseil de prud'hommes de Lille
    00000008  Cour d'appel d'Amiens
      00000009  Tribunal judiciaire d'Amiens
      00000011  Conseil de prud'hommes d'Amiens
```

## Accès graphiques

- administration : `https://idp.depot-numerique.localhost/admin/master/console/` ;
- compte utilisateur : `https://idp.depot-numerique.localhost/realms/depot-numerique/account/`.

L'administration utilise les variables `KEYCLOAK_ADMIN_USERNAME` et
`KEYCLOAK_ADMIN_PASSWORD`. Utiliser de préférence une fenêtre privée pour passer du compte
administrateur à un compte métier sans réutiliser une session SSO existante.

## Limites et cible de production

Cette configuration ne reproduit que le contrat d'identité attendu par l'application. En production,
les comptes, mots de passe, rôles et rattachements proviendront du SSO institutionnel ou de son
annuaire. Le contrat exact des claims devra être validé avec son équipe avant l'intégration.

La configuration locale ne fournit notamment pas :

- certificat TLS ni hostname de production ;
- base Keycloak PostgreSQL persistante ;
- haute disponibilité ;
- MFA, protection contre les attaques ou politique de mot de passe institutionnelle ;
- gestion des secrets dans Vault ;
- compte administrateur permanent ;
- supervision et audit de production.

Le mode `start-dev`, le compte administrateur temporaire et les utilisateurs de démonstration doivent
rester strictement locaux.

Le fonctionnement du protocole, le vocabulaire, les paramètres par environnement et les points
d'audit sont détaillés dans [Comprendre et raccorder le SSO SAML](./saml.md).

## Dépannage

Si une modification du realm n'apparaît pas, forcer la recréation du conteneur :

```bash
docker compose up -d --force-recreate --wait keycloak
```

Keycloak n'a pas de volume nommé dans Compose. La recréation supprime sa base H2 et réimporte le
realm. Les utilisateurs restent dans les volumes OpenLDAP et sont retrouvés par la fédération. Une
nouvelle clé de signature IdP est alors générée ; redémarrer une API déjà active afin qu'elle recharge
les métadonnées.

Une modification du schéma ou du LDIF OpenLDAP n'est pas rejouée sur un volume déjà initialisé. Il
faut alors réinitialiser les deux volumes OpenLDAP — ou toute la stack locale avec
`docker compose down -v` si la perte de PostgreSQL, Redis et MinIO est acceptable.

Chaque structure utilise son identifiant technique dans `ou` et son libellé lisible dans
`description`.

Les CPH sont simulés comme des structures directement rattachées à une cour d'appel, au même niveau
que les tribunaux judiciaires. Les tribunaux de proximité restent simulés comme des structures filles
d'un tribunal judiciaire.

Les cours d'appel ont aussi des utilisateurs `AGENT`, car elles peuvent déposer directement au même
titre que les autres structures.
