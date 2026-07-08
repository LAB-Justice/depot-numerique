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

## Comptes De Test

Tous les comptes utilisent le mot de passe `password`.

| Login                          | Rôle SSO                                  | Rattachement    |
| ------------------------------ | ----------------------------------------- | --------------- |
| `admin-general.sophie`         | `DEPOT_NUMERIQUE:ADMINISTRATEUR_GENERAL`  | DSJ             |
| `admin-regional.pierre`        | `DEPOT_NUMERIQUE:ADMINISTRATEUR_REGIONAL` | CA Douai        |
| `dg-lille.claire`              | `DEPOT_NUMERIQUE:ADMINISTRATEUR_LOCAL`    | TJ Lille        |
| `agent-lille.olivier`          | `DEPOT_NUMERIQUE:AGENT`                   | TJ Lille        |
| `agent-lille.marie`            | `DEPOT_NUMERIQUE:AGENT`                   | TJ Lille        |
| `agent-tprox-tourcoing.thomas` | `DEPOT_NUMERIQUE:AGENT`                   | TPROX Tourcoing |
| `dg-arras.nadia`               | `DEPOT_NUMERIQUE:ADMINISTRATEUR_LOCAL`    | TJ Arras        |
| `agent-arras.luc`              | `DEPOT_NUMERIQUE:AGENT`                   | TJ Arras        |
| `dg-douai.elise`               | `DEPOT_NUMERIQUE:ADMINISTRATEUR_LOCAL`    | TJ Douai        |
| `agent-douai.hugo`             | `DEPOT_NUMERIQUE:AGENT`                   | TJ Douai        |
| `admin-regional-amiens.julien` | `DEPOT_NUMERIQUE:ADMINISTRATEUR_REGIONAL` | CA Amiens       |
| `dg-amiens.camille`            | `DEPOT_NUMERIQUE:ADMINISTRATEUR_LOCAL`    | TJ Amiens       |
| `agent-amiens.ines`            | `DEPOT_NUMERIQUE:AGENT`                   | TJ Amiens       |

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
    00000008  Cour d'appel d'Amiens
      00000009  Tribunal judiciaire d'Amiens
```

Chaque structure utilise son identifiant technique dans `ou` et son libellé lisible dans
`description`.
