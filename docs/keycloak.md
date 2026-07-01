# SSO local avec Keycloak

Keycloak simule en développement le fournisseur d'identité de l'intranet. Il permet de tester la
connexion, les rôles et les rattachements métier avant l'intégration au véritable SSO.

::: warning Développement uniquement
Cette instance utilise le mode `start-dev`, HTTP, une base H2 éphémère, des comptes statiques et des
mots de passe publics. Elle ne doit jamais être déployée en recette ou en production.
:::

## Périmètre

La configuration locale fournit :

- le realm `depot-numerique` ;
- le client public OIDC `depot-numerique` ;
- le flux Authorization Code avec PKCE S256 ;
- trois rôles applicatifs ;
- trois utilisateurs de démonstration ;
- les claims `roles`, `jurisdiction_code` et `service_code` ;
- une Account Console pour vérifier graphiquement la connexion.

Keycloak conserve ses utilisateurs dans son stockage interne local. Aucune table utilisateur n'est
créée dans la base PostgreSQL de l'application. À terme, l'application ne conservera qu'une référence
pseudonymisée calculée à partir du claim OIDC `sub`.

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

Le journal doit notamment contenir :

```text
Realm 'depot-numerique' imported
Import finished successfully
```

Keycloak importe un realm uniquement lorsqu'il n'existe pas encore. Après une modification de
`keycloak/realm.json`, recréer le conteneur pour repartir de sa base H2 éphémère :

```bash
docker compose up -d --force-recreate --wait keycloak
```

## Accès graphiques

- administration : `http://localhost:8080/admin/master/console/` ;
- compte utilisateur : `http://localhost:8080/realms/depot-numerique/account/`.

L'administration utilise les variables `KEYCLOAK_ADMIN_USERNAME` et
`KEYCLOAK_ADMIN_PASSWORD`. Utiliser de préférence une fenêtre privée pour passer du compte
administrateur à un compte métier sans réutiliser une session SSO existante.

## Comptes de démonstration

Tous les comptes utilisent le mot de passe public `password`.

Chaque compte possède également un UUID de test explicite dans `realm.json`. Keycloak l'utilise
comme claim OIDC `sub`, ce qui garantit un identifiant stable après la recréation du conteneur.

| Utilisateur | Rôle | Juridiction | Service |
| --- | --- | --- | --- |
| `agent.olivier` | `agent` | `TJ-LILLE` | `BAJ` |
| `chef-service.pierre` | `chef_service` | `TJ-LILLE` | `BAJ` |
| `directeur-greffe.herve` | `directeur_greffe` | `TJ-LILLE` | aucun |

Le directeur de greffe est rattaché à toute la juridiction et ne possède donc pas de
`service_code`. Les rôles du client système `account` autorisent seulement l'utilisation de
l'Account Console ; ils ne sont pas injectés dans le claim applicatif `roles`.

## Client OIDC et claims

Le client `depot-numerique` est public : aucun secret ne peut être protégé dans une application
Angular exécutée dans le navigateur. Le flux implicite et le Direct Access Grant sont désactivés. Les
redirections locales sont limitées à `http://localhost:4200/*` et PKCE S256 est obligatoire.

Les mappers produisent les informations suivantes dans les tokens du client :

| Claim | Source | Exemple |
| --- | --- | --- |
| `sub` | claim OIDC standard | identifiant Keycloak non prédictible |
| `aud` | mapper d'audience | `depot-numerique` |
| `roles` | rôles du client `depot-numerique` | `["agent"]` |
| `jurisdiction_code` | attribut utilisateur | `TJ-LILLE` |
| `service_code` | attribut utilisateur | `BAJ` |

Les codes de juridiction et de service correspondent aux champs `ssoCode` du schéma Prisma. Ils ne
sont pas des UUID PostgreSQL et ne créent aucune relation vers un utilisateur applicatif.

## Vérifier la configuration

Dans l'Admin Console, sélectionner le realm `depot-numerique`, puis vérifier :

1. `Clients` → `depot-numerique` pour la configuration OIDC et les protocol mappers ;
2. `Users` → un utilisateur → `Role mapping` pour son rôle métier ;
3. `Users` → un utilisateur → `Details` pour son affectation professionnelle ;
4. `Realm settings` → `User profile` pour le schéma des attributs.

Pour inspecter un token sans frontend :

1. ouvrir `Clients` → `depot-numerique` → `Client scopes` → `Evaluate` ;
2. sélectionner un utilisateur ;
3. afficher le token d'accès généré ;
4. contrôler `aud`, `roles`, `jurisdiction_code` et, selon le profil, `service_code`.

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

Si l'Admin Console réutilise la session d'un agent, se déconnecter puis ouvrir directement
`http://localhost:8080/admin/master/console/` dans une fenêtre privée.

Si un claim personnalisé est absent, vérifier successivement l'attribut de l'utilisateur, le mapper du
client et le token généré depuis l'écran `Evaluate`.
