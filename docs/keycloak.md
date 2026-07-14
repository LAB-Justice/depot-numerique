# SSO SAML local

Keycloak simule en développement le fournisseur d'identité SAML de l'intranet. Il lit les utilisateurs
dans OpenLDAP, puis expose à l'application une assertion SAML avec les attributs attendus par le
contrat SSO.

::: warning Développement uniquement
Cette stack utilise HTTP, `start-dev`, une base H2 Keycloak éphémère, un annuaire OpenLDAP local et
des mots de passe publics. Elle ne doit jamais être déployée en recette ou en production.
:::

## Périmètre

La stack SSO locale fournit :

- OpenLDAP avec la base `dc=justice,dc=fr` ;
- une branche `ou=sites,dc=justice,dc=fr` contenant l'arborescence métier ;
- une branche `ou=people,dc=justice,dc=fr` contenant les utilisateurs de test ;
- phpLDAPadmin pour inspecter graphiquement l'annuaire ;
- Keycloak configuré comme fournisseur d'identité SAML ;
- une federation LDAP Keycloak vers OpenLDAP ;
- un client SAML `depot-numerique` ;
- des mappers SAML alignés sur les attributs transmis par le SSO intranet.

Keycloak conserve ses comptes de démonstration dans son stockage interne local. Dans l'application,
`AuthIdentity` porte l'identité technique Better Auth et `User` porte le profil métier. Le champ
`User.igcId` conserve l'identifiant annuaire stable en clair afin de retrouver le même profil même si
le nom ou l'adresse électronique change. Cet identifiant interne ne doit pas être journalisé ou
exposé sans nécessité métier.

## Fichiers de configuration

- `docker-compose.yml` démarre Keycloak et monte le fichier du realm en lecture seule ;
- `keycloak/realm.json` contient le realm, le client, les rôles, les mappers et les comptes de test ;
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

## Démarrage et import

Démarrer uniquement Keycloak et attendre son healthcheck :

```bash
docker compose up -d --wait keycloak
```

Vérifier son état et l'import :

```bash
docker compose ps keycloak
docker compose logs keycloak
```

La chaîne simulée est :

```text
OpenLDAP -> Keycloak User Federation -> Assertion SAML -> Application
```

## Fichiers

- `docker-compose.yml` démarre OpenLDAP, phpLDAPadmin et Keycloak ;
- `sso/keycloak/realm.json` contient le realm Keycloak, le client SAML, la federation LDAP et les
  mappers SAML ;
- `sso/openldap/schema/depot-numerique.schema` déclare les attributs LDAP custom utilisés localement ;
- `sso/openldap/ldif/bootstrap.ldif` initialise les structures et les utilisateurs de test ;
- `sso/README.md` documente le simulateur SSO local plus en détail.

## URLs Locales

- Keycloak Admin Console : `http://localhost:8080/admin/master/console/`
- Keycloak SAML metadata : `http://localhost:8080/realms/depot-numerique/protocol/saml/descriptor`
- OpenLDAP : `ldap://localhost:389`
- phpLDAPadmin : `http://localhost:8081`

Identifiants locaux :

| Service          | Identifiant                 | Mot de passe |
| ---------------- | --------------------------- | ------------ |
| Keycloak admin   | `root`                      | `password`   |
| LDAP admin       | `cn=admin,dc=justice,dc=fr` | `admin`      |
| Utilisateurs SSO | login LDAP                  | `password`   |

## Attributs SAML

L'assertion SAML expose les attributs du formulaire d'interface LDAP/SSO :

| Attribut SAML    | Source LDAP / Keycloak           | Exemple                          |
| ---------------- | -------------------------------- | -------------------------------- |
| `igcid`          | attribut LDAP custom `igcid`     | `00000004`                       |
| `nom`            | `sn`                             | `Agent Lille`                    |
| `prenom`         | `givenName`                      | `Olivier`                        |
| `logonId`        | attribut LDAP custom `logonId`   | `olivier.agent-lille`            |
| `mail`           | `mail`                           | `agent-lille.olivier@justice.fr` |
| `roles`          | attribut LDAP custom `roles`     | `DEPOT_NUMERIQUE:AGENT`          |
| `bureauIGC`      | attribut LDAP custom `bureauIGC` | `ou=00000004,...`                |
| `affectationOp2` | attribut LDAP custom optionnel   | selon utilisateur                |
| `affectationOp3` | attribut LDAP custom optionnel   | selon utilisateur                |
| `affectationOp4` | attribut LDAP custom optionnel   | selon utilisateur                |

Les utilisateurs sont stockés dans `ou=people`, et leur rattachement métier est porté par
`bureauIGC`. L'application ne doit donc pas déduire le rattachement depuis le DN utilisateur.
L'attribut `igcid` est la clé de rapprochement stable du profil métier ; `mail` ne doit jamais être
utilisé comme clé de reconnexion.

## Comptes De Test

Tous les comptes utilisent le mot de passe `password`.

| Login                                  | Rôle SSO                                  | Rattachement    |
| -------------------------------------- | ----------------------------------------- | --------------- |
| `admin-general.sophie`                 | `DEPOT_NUMERIQUE:ADMINISTRATEUR_GENERAL`  | DSJ             |
| `admin-regional-douai.pierre`          | `DEPOT_NUMERIQUE:ADMINISTRATEUR_REGIONAL` | CA Douai        |
| `admin-local-ca-douai.anne`            | `DEPOT_NUMERIQUE:ADMINISTRATEUR_LOCAL`    | CA Douai        |
| `agent-ca-douai.louis`                 | `DEPOT_NUMERIQUE:AGENT`                   | CA Douai        |
| `admin-local-lille.claire`             | `DEPOT_NUMERIQUE:ADMINISTRATEUR_LOCAL`    | TJ Lille        |
| `admin-regional-lille.mathieu`         | `DEPOT_NUMERIQUE:ADMINISTRATEUR_REGIONAL` | TJ Lille        |
| `agent-lille.olivier`                  | `DEPOT_NUMERIQUE:AGENT`                   | TJ Lille        |
| `agent-lille.marie`                    | `DEPOT_NUMERIQUE:AGENT`                   | TJ Lille        |
| `admin-local-tprox-tourcoing.thomas`   | `DEPOT_NUMERIQUE:ADMINISTRATEUR_LOCAL`    | TPROX Tourcoing |
| `admin-regional-tprox-tourcoing.nora`  | `DEPOT_NUMERIQUE:ADMINISTRATEUR_REGIONAL` | TPROX Tourcoing |
| `admin-local-arras.nadia`              | `DEPOT_NUMERIQUE:ADMINISTRATEUR_LOCAL`    | TJ Arras        |
| `agent-arras.luc`                      | `DEPOT_NUMERIQUE:AGENT`                   | TJ Arras        |
| `admin-local-douai.elise`              | `DEPOT_NUMERIQUE:ADMINISTRATEUR_LOCAL`    | TJ Douai        |
| `agent-douai.hugo`                     | `DEPOT_NUMERIQUE:AGENT`                   | TJ Douai        |
| `admin-local-cph-lille.sarah`          | `DEPOT_NUMERIQUE:ADMINISTRATEUR_LOCAL`    | CPH Lille       |
| `admin-regional-amiens.julien`         | `DEPOT_NUMERIQUE:ADMINISTRATEUR_REGIONAL` | CA Amiens       |
| `admin-local-ca-amiens.camille`        | `DEPOT_NUMERIQUE:ADMINISTRATEUR_LOCAL`    | CA Amiens       |
| `agent-ca-amiens.emma`                 | `DEPOT_NUMERIQUE:AGENT`                   | CA Amiens       |
| `admin-local-amiens.manon`             | `DEPOT_NUMERIQUE:ADMINISTRATEUR_LOCAL`    | TJ Amiens       |
| `agent-amiens.ines`                    | `DEPOT_NUMERIQUE:AGENT`                   | TJ Amiens       |

## Arborescence Métier

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

- administration : `http://localhost:8080/admin/master/console/` ;
- compte utilisateur : `http://localhost:8080/realms/depot-numerique/account/`.

L'administration utilise les variables `KEYCLOAK_ADMIN_USERNAME` et
`KEYCLOAK_ADMIN_PASSWORD`. Utiliser de préférence une fenêtre privée pour passer du compte
administrateur à un compte métier sans réutiliser une session SSO existante.

## Limites et cible de production

Cette configuration ne reproduit que le contrat d'identité attendu par l'application. En production,
les comptes, mots de passe, rôles et rattachements proviendront du SSO institutionnel ou de son
annuaire. Le contrat exact des claims devra être validé avec son équipe avant l'intégration.

La configuration locale ne fournit notamment pas :

- TLS ni hostname de production ;
- base Keycloak PostgreSQL persistante ;
- haute disponibilité ;
- fédération LDAP ou Identity Provider ;
- MFA, protection contre les attaques ou politique de mot de passe institutionnelle ;
- gestion des secrets dans Vault ;
- compte administrateur permanent ;
- supervision et audit de production.

Le mode `start-dev`, le compte administrateur temporaire et les utilisateurs de démonstration doivent
rester strictement locaux.

## Dépannage

Si une modification du realm n'apparaît pas, forcer la recréation du conteneur :

```bash
docker compose up -d --force-recreate --wait keycloak
```
Chaque structure utilise son identifiant technique dans `ou` et son libellé lisible dans
`description`.

Les CPH sont simulés comme des structures directement rattachées à une cour d'appel, au même niveau
que les tribunaux judiciaires. Les tribunaux de proximité restent simulés comme des structures filles
d'un tribunal judiciaire.

Les cours d'appel ont aussi des utilisateurs `AGENT`, car elles peuvent déposer directement au même
titre que les autres structures.
