# Simulateur SSO Local

Ce dossier contient la configuration locale du SSO de développement. Il simule un annuaire LDAP
client et un fournisseur d'identité SAML afin de tester l'application avec des attributs proches du
contrat réel.

La chaîne locale est :

```text
OpenLDAP -> Keycloak User Federation -> Assertion SAML -> Application
```

## Organisation

```text
sso/
  keycloak/
    realm.json
  openldap/
    schema/
      depot-numerique.schema
    ldif/
      bootstrap.ldif
```

`keycloak/realm.json` configure :

- le realm `depot-numerique` ;
- le client SAML `depot-numerique` ;
- la federation LDAP vers OpenLDAP ;
- les mappers LDAP vers le modèle utilisateur Keycloak ;
- les mappers SAML vers les attributs attendus par l'application.

`openldap/schema/depot-numerique.schema` déclare les attributs LDAP custom utilisés pour la simulation
locale :

- `igcid`
- `logonId`
- `roles`
- `bureauIGC`
- `affectationOp2`
- `affectationOp3`
- `affectationOp4`

Les attributs standards comme `uid`, `cn`, `sn`, `givenName`, `mail`, `userPassword` et
`description` existent déjà dans les schémas LDAP chargés par OpenLDAP. Ils ne sont donc pas
redéclarés.

Les OID `1.3.6.1.4.1.55555.*` du schéma sont des identifiants privés fictifs réservés au
développement local. Ils ne correspondent pas à un schéma officiel Justice.

`openldap/ldif/bootstrap.ldif` initialise les données de test : arborescence métier, libellés,
utilisateurs, rôles et rattachements.

LDIF signifie `LDAP Data Interchange Format`. C'est un format texte standard pour importer ou exporter
des entrées LDAP.

## Annuaire

OpenLDAP porte la base :

```text
dc=justice,dc=fr
```

Les structures métier sont dans :

```text
ou=sites,dc=justice,dc=fr
```

Les utilisateurs sont dans :

```text
ou=people,dc=justice,dc=fr
```

Le DN utilisateur ne représente pas son rattachement métier. Le rattachement métier est porté par
`bureauIGC`.

Exemple :

```text
uid=agent-lille.olivier,ou=people,dc=justice,dc=fr
bureauIGC=ou=00000004,ou=00000003,ou=00000002,ou=00000001,ou=sites,dc=justice,dc=fr
```

Cela signifie que l'utilisateur est stocké dans la branche utilisateurs, mais rattaché au Tribunal
judiciaire de Lille.

## Structures

Les structures de test sont :

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

Chaque structure utilise :

- `ou` pour l'identifiant technique stable ;
- `description` pour le libellé lisible.

Les CPH sont volontairement placés au même niveau que les tribunaux judiciaires sous leur cour
d'appel. Le tribunal de proximité de Tourcoing reste placé sous le TJ de Lille pour tester le cas
d'une structure fille.

Les cours d'appel ont aussi des utilisateurs `AGENT`, car elles peuvent déposer directement au même
titre que les autres structures.

## Rôles

Les rôles sont portés par l'attribut LDAP `roles`, puis exposés dans l'assertion SAML sous le même nom.

Rôles simulés :

- `DEPOT_NUMERIQUE:ADMINISTRATEUR_GENERAL`
- `DEPOT_NUMERIQUE:ADMINISTRATEUR_REGIONAL`
- `DEPOT_NUMERIQUE:ADMINISTRATEUR_LOCAL`
- `DEPOT_NUMERIQUE:AGENT`

Les valeurs utilisent des identifiants techniques sans espace pour rester cohérentes avec le format
`APPLICATION:PROFIL`.

## Comptes De Test

Tous les comptes utilisent le mot de passe `password`.

| Login | Rôle SSO | Rattachement |
| --- | --- | --- |
| `admin-general.sophie` | `DEPOT_NUMERIQUE:ADMINISTRATEUR_GENERAL` | DSJ |
| `admin-regional-douai.pierre` | `DEPOT_NUMERIQUE:ADMINISTRATEUR_REGIONAL` | CA Douai |
| `admin-local-ca-douai.anne` | `DEPOT_NUMERIQUE:ADMINISTRATEUR_LOCAL` | CA Douai |
| `agent-ca-douai.louis` | `DEPOT_NUMERIQUE:AGENT` | CA Douai |
| `admin-local-lille.claire` | `DEPOT_NUMERIQUE:ADMINISTRATEUR_LOCAL` | TJ Lille |
| `admin-regional-lille.mathieu` | `DEPOT_NUMERIQUE:ADMINISTRATEUR_REGIONAL` | TJ Lille |
| `agent-lille.olivier` | `DEPOT_NUMERIQUE:AGENT` | TJ Lille |
| `agent-lille.marie` | `DEPOT_NUMERIQUE:AGENT` | TJ Lille |
| `admin-local-tprox-tourcoing.thomas` | `DEPOT_NUMERIQUE:ADMINISTRATEUR_LOCAL` | TPROX Tourcoing |
| `admin-regional-tprox-tourcoing.nora` | `DEPOT_NUMERIQUE:ADMINISTRATEUR_REGIONAL` | TPROX Tourcoing |
| `admin-local-arras.nadia` | `DEPOT_NUMERIQUE:ADMINISTRATEUR_LOCAL` | TJ Arras |
| `agent-arras.luc` | `DEPOT_NUMERIQUE:AGENT` | TJ Arras |
| `admin-local-douai.elise` | `DEPOT_NUMERIQUE:ADMINISTRATEUR_LOCAL` | TJ Douai |
| `agent-douai.hugo` | `DEPOT_NUMERIQUE:AGENT` | TJ Douai |
| `admin-local-cph-lille.sarah` | `DEPOT_NUMERIQUE:ADMINISTRATEUR_LOCAL` | CPH Lille |
| `admin-regional-amiens.julien` | `DEPOT_NUMERIQUE:ADMINISTRATEUR_REGIONAL` | CA Amiens |
| `admin-local-ca-amiens.camille` | `DEPOT_NUMERIQUE:ADMINISTRATEUR_LOCAL` | CA Amiens |
| `agent-ca-amiens.emma` | `DEPOT_NUMERIQUE:AGENT` | CA Amiens |
| `admin-local-amiens.manon` | `DEPOT_NUMERIQUE:ADMINISTRATEUR_LOCAL` | TJ Amiens |
| `agent-amiens.ines` | `DEPOT_NUMERIQUE:AGENT` | TJ Amiens |

## Attributs SAML

L'assertion SAML expose :

- `igcid`
- `nom`
- `prenom`
- `logonId`
- `mail`
- `roles`
- `bureauIGC`
- `affectationOp2`
- `affectationOp3`
- `affectationOp4`

Les attributs `nom`, `prenom` et `mail` proviennent respectivement des attributs LDAP standards `sn`,
`givenName` et `mail`. Les autres attributs sont déclarés dans le schéma OpenLDAP local.

## Interfaces

- Keycloak : `http://localhost:8080`
- Metadata SAML : `http://localhost:8080/realms/depot-numerique/protocol/saml/descriptor`
- OpenLDAP : `ldap://localhost:389`
- phpLDAPadmin : `http://localhost:8081`

Connexion phpLDAPadmin :

- Login DN : `cn=admin,dc=justice,dc=fr`
- Mot de passe : `admin`

## Note Sur Les Attributs Custom

Keycloak importe les utilisateurs depuis LDAP, mais certains attributs custom restent pilotés par les
mappers LDAP. Cela veut dire que la source de vérité reste OpenLDAP : si `bureauIGC` ou `roles`
changent dans l'annuaire, Keycloak les relit via sa federation LDAP et les expose ensuite dans SAML.

Cette note est surtout utile pour comprendre le comportement de l'interface d'administration Keycloak :
tous les attributs custom ne sont pas forcément visibles comme des attributs locaux modifiables sur la
fiche utilisateur Keycloak. Pour la simulation applicative, le point important est qu'ils existent dans
OpenLDAP et que les mappers SAML sont configurés pour les émettre.
