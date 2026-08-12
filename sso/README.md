# Simulateur SSO local

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
- la fédération LDAP vers OpenLDAP ;
- les mappers LDAP vers le modèle utilisateur Keycloak ;
- les mappers SAML vers les attributs attendus par l'application.

Le client exige des requêtes signées et produit une réponse signée contenant une assertion chiffrée.
Il récupère les certificats publics du SP depuis les métadonnées de l'API. Les clés privées restent
exclusivement côté application.

Générer les certificats locaux avant de démarrer l'API :

```bash
pnpm sso:certificates:generate
```

Les fichiers sont créés dans `.secrets/saml` et ne doivent jamais être versionnés.

Pour le flux navigateur HTTPS, générer aussi le certificat Traefik :

```bash
mkcert -install
pnpm tls:certificates:generate
```

Le certificat Traefik et les clés SAML ont des fonctions différentes et ne sont pas
interchangeables.

`openldap/schema/depot-numerique.schema` déclare les attributs LDAP personnalisés utilisés pour la simulation
locale :

- `igcid`
- `logonId`
- `roles`
- `bureauIGC`
- `siteDescription`
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
`bureauIGC`, et son libellé lisible par `siteDescription`.

Exemple :

```text
uid=agent-lille.olivier,ou=people,dc=justice,dc=fr
bureauIGC=ou=00000004,ou=00000003,ou=00000002,ou=00000001,ou=sites,dc=justice,dc=fr
siteDescription=Tribunal judiciaire de Lille
```

Cela signifie que l'utilisateur est stocké dans la branche utilisateurs, mais rattaché au Tribunal
judiciaire de Lille.

`bureauIGC` donne à l'API les identifiants techniques de la hiérarchie. `siteDescription` donne le nom
du dernier site du DN. Il ne faut pas tenter de déduire ce libellé depuis `uid`, le DN utilisateur ou
le compte Keycloak.

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

- `DEPOT_NUMERIQUE:ADMINISTRATEUR_NATIONAL`
- `DEPOT_NUMERIQUE:ADMINISTRATEUR_REGIONAL`
- `DEPOT_NUMERIQUE:ADMINISTRATEUR_LOCAL`
- `DEPOT_NUMERIQUE:AGENT`

Les valeurs utilisent des identifiants techniques sans espace pour rester cohérentes avec le format
`APPLICATION:PROFIL`.

Ces quatre rôles sont mutuellement exclusifs pour Dépôt Numérique : un compte doit avoir exactement
une de ces valeurs. L'attribut LDAP reste multivalué parce qu'un utilisateur peut également porter
des profils appartenant à d'autres applications.

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

## Attributs SAML

L'assertion SAML expose :

- `igcid`
- `nom`
- `prenom`
- `logonId`
- `mail`
- `roles`
- `bureauIGC`
- `siteDescription`
- `affectationOp2`
- `affectationOp3`
- `affectationOp4`

Les attributs `nom`, `prenom` et `mail` proviennent respectivement des attributs LDAP standards `sn`,
`givenName` et `mail`. Les autres attributs sont déclarés dans le schéma OpenLDAP local.

| Attribut           | Usage actuel dans l'application                            | Obligatoire        |
| ------------------ | ---------------------------------------------------------- | ------------------ |
| `igcid`            | rapprochement unique avec `User.igcId`                     | oui                |
| `nom`, `prenom`    | synchronisation du profil                                  | oui                |
| `mail`             | synchronisation, jamais clé de reconnexion                 | oui                |
| `roles`            | sélection d'un unique rôle Dépôt Numérique                 | oui                |
| `bureauIGC`        | codes du rattachement et calcul des périmètres              | hors admin national |
| `siteDescription`  | libellé de la structure de travail finale                   | hors admin national |
| `logonId`          | identifiant de connexion Keycloak, non persisté dans `User` | transmis           |
| `affectationOp2-4` | transmis à Better Auth mais non exploité                    | non                |

Le schéma et les mappers acceptent les trois affectations secondaires, mais le LDIF actuel n'en
renseigne aucune. Elles n'apparaissent donc dans une assertion que si une valeur est ajoutée à un
utilisateur LDAP.

L'application conserve `igcid` en clair dans `User.igcId`. Cette valeur stable permet de retrouver le
même profil si le nom ou l'adresse électronique change ; l'email n'est donc pas une clé de
reconnexion. Bien que l'identifiant soit accessible dans l'intranet, il reste une donnée interne qui
ne doit pas être journalisée ou exposée sans nécessité métier.

Keycloak utilise `logonId` comme `usernameLDAPAttribute`. `uid` reste le RDN technique. Les deux
valeurs sont volontairement identiques dans le LDIF local, mais ce sont deux attributs distincts.

## Démarrage et interfaces

Démarrer la simulation complète :

```bash
pnpm sso:certificates:generate
pnpm tls:certificates:generate
pnpm stack:dev
```

Interfaces principales :

- Application via Traefik : `https://depot-numerique.localhost`
- Keycloak via Traefik : `https://idp.depot-numerique.localhost`
- Métadonnées SAML :
  `https://idp.depot-numerique.localhost/realms/depot-numerique/protocol/saml/descriptor`
- Métadonnées du SP :
  `https://depot-numerique.localhost/api/auth/sso/saml2/sp/metadata?providerId=justice-saml&format=xml`
- OpenLDAP : `ldap://localhost:389`
- phpLDAPadmin : `http://localhost:8081`

Sans le profil `app`, Keycloak reste accessible directement sur `http://localhost:8080`, mais l'API
et le frontend conteneurisés ne sont pas démarrés. Le client SAML du realm utilise les callbacks
HTTPS : le parcours de connexion complet se teste avec `pnpm stack:dev`.

Connexion phpLDAPadmin :

- Login DN : `cn=admin,dc=justice,dc=fr`
- Mot de passe : `admin`

## Note sur les attributs personnalisés

Keycloak importe les utilisateurs depuis LDAP, mais certains attributs personnalisés restent pilotés par les
mappers LDAP. Cela veut dire que la source de vérité reste OpenLDAP : si `bureauIGC` ou `roles`
changent dans l'annuaire, Keycloak les relit via sa fédération LDAP et les expose ensuite dans SAML.

Cette note est surtout utile pour comprendre le comportement de l'interface d'administration Keycloak :
tous les attributs personnalisés ne sont pas forcément visibles comme des attributs locaux modifiables sur la
fiche utilisateur Keycloak. Pour la simulation applicative, le point important est qu'ils existent dans
OpenLDAP et que les mappers SAML sont configurés pour les émettre.

## Réinitialisation

Keycloak utilise une base H2 dans son conteneur, sans volume nommé. Recréer le conteneur réimporte le
realm :

```bash
docker compose up -d --force-recreate --wait keycloak
```

OpenLDAP utilise deux volumes. Une modification du schéma ou du LDIF n'est appliquée qu'à
l'initialisation de volumes neufs. `docker compose down -v` rejoue tout au prochain démarrage, mais
supprime également les données locales PostgreSQL, Redis et MinIO ; vérifier que cette perte est
souhaitée avant de l'utiliser.

Pour le protocole, les contrôles de sécurité, les variables et le patch Better Auth, consulter
[`docs/authentication/saml.md`](../docs/authentication/saml.md).
