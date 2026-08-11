# Comprendre et raccorder le SSO SAML

Ce document sert de support pour comprendre le raccordement SAML de Dépôt Numérique.
Il distingue le contrat ministériel, la simulation locale Keycloak et l'état réellement implémenté.

::: warning État du raccordement
Le flux local signé et chiffré fonctionne de bout en bout. L'`AuthnRequest` utilise désormais le
binding HTTP-POST exigé par le formulaire ministériel.
:::

## Les acteurs

| Terme       | Signification                                                    | Dans le projet                                   |
| ----------- | ---------------------------------------------------------------- | ------------------------------------------------ |
| Utilisateur | Personne qui ouvre l'application                                 | Agent du ministère                               |
| SP          | Service Provider, l'application qui demande l'authentification   | API Better Auth                                  |
| IdP         | Identity Provider, le système qui authentifie la personne        | Keycloak en local, SSO ministériel en production |
| Frontend    | Interface et URL publique                                        | Angular                                          |
| ACS         | Assertion Consumer Service, endpoint qui reçoit la réponse SAML  | `/api/auth/sso/saml2/sp/acs/justice-saml`        |
| SLO         | Single Logout Service, endpoint des messages de déconnexion SAML | `/api/auth/sso/saml2/sp/slo/justice-saml`        |

Le frontend ne traite jamais lui-même l'assertion SAML. Le navigateur la transporte jusqu'à l'ACS,
puis l'API la vérifie, la déchiffre et crée la session applicative.

## Les paramètres

### Provider ID

`SSO_PROVIDER_ID` est l'identifiant interne choisi par l'application pour retrouver sa configuration
Better Auth. La valeur locale est `justice-saml`. Ce n'est ni une URL ni un identifiant fourni par
l'annuaire.

Il apparaît dans les URLs ACS et SLO. Le modifier impose donc de mettre à jour les URLs déclarées
auprès de l'IdP.

### Domain

`SSO_DOMAIN` est le domaine associé au fournisseur dans Better Auth. Il sert notamment à la sélection
d'un fournisseur SSO à partir d'un domaine de messagerie. Il ne remplace ni l'URL de l'IdP ni son
`entityID`.

Le parcours de Dépôt Numérique utilise l'unique fournisseur SSO par défaut, car l'utilisateur est
redirigé automatiquement et ne saisit pas son email avant l'authentification. Angular n'a donc pas à
connaître cet identifiant. La valeur doit malgré tout rester un domaine valide et cohérent avec
l'organisation.

### Entity ID

Un `entityID` est le nom technique unique d'un acteur SAML :

- l'IdP possède son propre `entityID`, publié dans ses métadonnées ;
- le SP possède `SSO_SP_ENTITY_ID`, actuellement `depot-numerique` en local.

Un `entityID` peut ressembler à une URL sans être une page à ouvrir. Sa valeur de production doit
être convenue avec l'équipe SSO et rester stable.

### URL des métadonnées

Les métadonnées sont un document XML de confiance qui décrit une entité SAML : identifiant,
endpoints, bindings et certificats publics.

- `SSO_IDP_METADATA_URL` permet à l'API de récupérer les métadonnées et certificats publics de l'IdP ;
- les métadonnées du SP sont exposées par l'API à
  `/api/auth/sso/saml2/sp/metadata?providerId=justice-saml&format=xml` ;
- aucune clé privée n'est présente dans les métadonnées.

Changer seulement une URL d'IdP est possible si le contrat SAML reste identique. Un changement
d'`entityID`, de claims, de certificats ou de bindings demande aussi une mise à jour de configuration.

### ACS

L'ACS reçoit par POST le champ `SAMLResponse` envoyé par le navigateur après l'authentification. Il
vérifie la réponse avant de créer une session. Ce n'est pas l'URL de la page Angular affichée après
connexion.

Dans la stack complète locale :

```text
https://depot-numerique.localhost/api/auth/sso/saml2/sp/acs/justice-saml
```

Traefik transmet `/api/**` à l'API sur son port Docker `3000`. Lors d'une exécution directe, le proxy
Angular fournit l'origine `http://localhost:4200`, mais le realm versionné autorise l'ACS HTTPS
ci-dessus : le flux navigateur complet de la simulation doit donc être testé avec `pnpm stack:dev`.

### SLO

Le SLO transporte les messages de déconnexion entre le SP et l'IdP. Il ne remplace pas la suppression
de la session Better Auth. Better Auth est configuré pour accepter les messages SLO signés, mais le
frontend n'expose pas encore d'action de déconnexion. Le manuel ministériel précise aussi que la
déconnexion applicative reste à la charge de l'application.

### RelayState et InResponseTo

`RelayState` conserve le contexte applicatif pendant l'aller-retour, par exemple la page de retour.
Il ne contient pas l'identité de l'utilisateur.

`InResponseTo` relie cryptographiquement et temporellement une réponse à l'`AuthnRequest` créée par
l'application. Better Auth stocke temporairement l'identifiant de requête dans
`AuthVerification`, puis le consomme une seule fois. Cette vérification empêche d'accepter une réponse
IdP non sollicitée ou rejouée.

Une contrainte unique PostgreSQL partielle protège les réservations `saml-authn-request:*` et
`saml-used-assertion:*`. Elle exclut volontairement `saml-session:*`, car un utilisateur peut avoir
plusieurs sessions SAML légitimes.

## Le flux complet

1. L'utilisateur ouvre l'URL Angular.
2. Angular demande la session courante à Better Auth.
3. Sans session valide, Angular déclenche automatiquement `signIn.sso` ; l'API sélectionne son unique
   provider SAML par défaut.
4. Better Auth crée une `AuthnRequest`, mémorise son identifiant pendant cinq minutes et la signe avec
   la clé privée de signature du SP.
5. L'API conserve pendant cinq minutes le formulaire dans une réservation à usage unique, puis le
   navigateur envoie `SAMLRequest` et `RelayState` à l'IdP par un formulaire HTTP-POST automatique.
6. L'IdP authentifie l'utilisateur, localement avec Keycloak et OpenLDAP.
7. L'IdP construit une réponse SAML signée contenant une assertion chiffrée et les attributs
   autorisés.
8. Le navigateur poste `SAMLResponse` et `RelayState` vers l'ACS.
9. L'API contrôle la signature, le certificat, la destination, l'audience, les dates,
   `InResponseTo`, l'absence de rejeu et les algorithmes ; elle déchiffre ensuite l'assertion.
10. Better Auth crée ou retrouve `AuthIdentity` par l'identifiant SSO stable, crée `AuthAccount`, puis
    une `AuthSession`.
11. Le hook de provisioning rapproche exclusivement le profil métier `User` par `igcid`, provisionne
    les structures SRJ déduites de `bureauIGC`, calcule les périmètres de travail et d'administration,
    puis met à jour le profil dans une transaction. L'email n'est jamais utilisé pour retrouver le
    profil.
12. L'API pose un cookie de session `HttpOnly`, valable six heures conformément au contrat
    ministériel, puis redirige le navigateur vers Angular.

Le cookie contient un jeton de session opaque. Les données de session et leur date d'expiration de six
heures sont stockées dans PostgreSQL ; les claims SAML et les clés privées ne doivent jamais être placés
dans le cookie.

## Signature et chiffrement

La signature répond à la question « qui a produit ce message et a-t-il été modifié ? ». Le
chiffrement répond à la question « qui peut lire l'assertion ? ».

Le SP possède deux paires de clés séparées :

- une clé privée de signature et son certificat public ;
- une clé privée de déchiffrement et son certificat public.

L'IdP utilise le certificat de chiffrement public du SP. Seule l'API possède la clé privée capable de
relire l'assertion. Inversement, l'API utilise le certificat public publié par l'IdP pour vérifier ses
signatures.

Configuration locale testée :

| Usage                                     | Configuration                                      |
| ----------------------------------------- | -------------------------------------------------- |
| Signature de l'AuthnRequest               | RSA-SHA256                                         |
| Signature de la réponse et de l'assertion | RSA-SHA256                                         |
| Chiffrement du contenu                    | AES-256-GCM                                        |
| Transport de la clé AES                   | RSA-OAEP XML Encryption 1.0                        |
| Corrélation                               | `InResponseTo`, durée maximale 5 minutes           |
| Rejeu                                     | identifiant d'assertion consommable une seule fois |

Le profil RSA-OAEP XML Encryption 1.0 emploie SHA-1 dans OAEP pour rester compatible avec la
bibliothèque de déchiffrement utilisée par Better Auth 1.6.23. Cela ne signifie pas que les signatures
SAML utilisent SHA-1 : elles restent en SHA-256. Le standard XML Encryption 1.1 définit ce profil
RSA-OAEP comme obligatoire, mais l'algorithme exact accepté en production doit être confirmé.
Si RSA-OAEP 1.1 avec SHA-256 est imposé, la dépendance de déchiffrement devra être
remplacée ou corrigée avant certification.

## Claims ministériels

| Claim                               | Utilisation applicative                                                  |
| ----------------------------------- | ------------------------------------------------------------------------ |
| `igcid`                             | Clé stable de rapprochement avec `User.igcId`                            |
| `nom`                               | Mise à jour du nom affiché                                               |
| `prenom`                            | Mise à jour du prénom affiché                                            |
| `logonId`                           | Identifiant de connexion informatif                                      |
| `mail`                              | Mise à jour de l'email, jamais clé de reconnexion                        |
| `roles`                             | Liste des profils `APPLICATION:PROFIL`                                   |
| `bureauIGC`                         | DN de l'affectation principale, utilisé pour provisionner les structures |
| `siteDescription`                   | Libellé du rattachement opérationnel final                               |
| `affectationOp2` à `affectationOp4` | Affectations secondaires optionnelles                                    |

`igcid` est conservé en clair et avec une contrainte d'unicité. Il n'est pas la clé primaire du
profil métier et ne doit pas être journalisé sans nécessité. Un changement de nom ou d'adresse email
ne crée donc pas un nouvel utilisateur.

`logonId` sert de nom d'utilisateur à Keycloak dans la simulation et reste informatif dans
l'assertion. Il n'est pas utilisé pour rapprocher ou persister le profil métier. Les affectations
secondaires sont mappées jusqu'à Better Auth mais ne sont pas encore exploitées par l'API.

Le DN `bureauIGC` est validé dans la branche `ou=sites,dc=justice,dc=fr`, puis ses identifiants `ou`
sont inversés pour obtenir un chemin racine-vers-feuille. Le troisième identifiant désigne la cour
d'appel (`REGIONAL`) et le dernier le rattachement de travail. Tant que les sous-juridictions ne sont
pas gérées par l'application, tout rattachement plus profond que la cour est provisionné comme
`JURISDICTION`, directement sous la cour.

Lorsque la cour n'est pas le rattachement final, son nom n'est pas disponible dans
`siteDescription`. Elle est créée avec `Libellé indisponible — SRJ <code>` sans écraser un libellé
déjà connu. Si elle devient ensuite le rattachement final d'un utilisateur, son libellé est remplacé
par le `siteDescription` reçu.

Pour tous les rôles sauf `ADMINISTRATEUR_NATIONAL`, l'API refuse la connexion si `bureauIGC` ou
`siteDescription` est absent, vide, multivalué ou trop long. L'administrateur national n'a pas besoin
de structure de travail ni de périmètre d'administration ; les éventuelles valeurs de rattachement
reçues sont donc ignorées.

Le provisioning actuel ne reproduit pas encore tous les niveaux du DN. La cour devient une structure
`REGIONAL` et le site final plus profond devient une `JURISDICTION` directement rattachée à cette
cour. Les tribunaux de proximité et autres sous-juridictions pourront nécessiter une évolution pour
conserver toute leur hiérarchie en base.

## Les quatre rôles de Dépôt Numérique

La simulation locale expose les quatre profils suivants :

- `DEPOT_NUMERIQUE:ADMINISTRATEUR_NATIONAL` ;
- `DEPOT_NUMERIQUE:ADMINISTRATEUR_REGIONAL` ;
- `DEPOT_NUMERIQUE:ADMINISTRATEUR_LOCAL` ;
- `DEPOT_NUMERIQUE:AGENT`.

La partie située avant `:` est le nom d'application qui devra être officiellement déclaré. La partie
après `:` est le profil. Le ministère a confirmé pour Dépôt Numérique que ces quatre profils sont
mutuellement exclusifs : une personne doit en posséder exactement un. Le claim `roles` reste une
liste, car il peut aussi contenir des profils d'autres applications. À la connexion, l'API ignore ces
autres applications puis refuse l'accès si elle trouve zéro, plusieurs ou un rôle
`DEPOT_NUMERIQUE:*` inconnu.

Le profil SSO externe `DEPOT_NUMERIQUE:ADMINISTRATEUR_NATIONAL` est enregistré sous le rôle interne
Prisma `ADMINISTRATEUR_NATIONAL` afin de conserver le même vocabulaire dans tout le système.

Le manuel général indique que le LDAP sait gérer des profils cumulables et que le cumul peut être
bloqué application par application. La règle exclusive ci-dessus est donc le contrat métier propre
à Dépôt Numérique, pas une contradiction avec le fonctionnement général de l'annuaire.

## Variables par environnement

| Variable                    | Stack Docker locale                                      | Production                               |
| --------------------------- | -------------------------------------------------------- | ---------------------------------------- |
| `BETTER_AUTH_URL`           | `https://depot-numerique.localhost`                      | URL HTTPS publique du site               |
| `BETTER_AUTH_WEB_ORIGIN`    | `https://depot-numerique.localhost`                      | Origine HTTPS Angular autorisée          |
| `SSO_PROVIDER_ID`           | `justice-saml`                                           | Identifiant interne stable               |
| `SSO_DOMAIN`                | `justice.fr`                                             | Domaine validé avec l'organisation       |
| `SSO_SP_ENTITY_ID`          | `depot-numerique`                                        | Entity ID SP validé avec la DNUM         |
| `SSO_IDP_METADATA_URL`      | URL interne `http://keycloak:8080/.../descriptor`        | Métadonnées HTTPS de l'IdP cible         |
| `SSO_SP_*_PRIVATE_KEY_PATH` | fichiers montés sous `/run/secrets/saml`                 | secrets montés depuis le coffre-fort     |
| `SSO_SP_*_CERTIFICATE_PATH` | certificats montés sous `/run/secrets/saml`              | certificats du SP échangés avec la DNUM  |

Les URLs ne suffisent donc pas à elles seules : les secrets, certificats et identifiants d'entités
sont spécifiques à chaque environnement. L'objectif reste qu'aucune modification de code ne soit
nécessaire entre les environnements.

Les valeurs `http://localhost:4200` de `apps/api/.env.example` concernent l'exécution directe de
NestJS et Angular. Compose injecte les valeurs HTTPS du tableau sans utiliser ce fichier.

## Développement local

Générer les deux paires de clés locales :

```bash
pnpm sso:certificates:generate
```

Les clés sont créées dans `.secrets/saml`, ignoré par Git. Le script refuse un dossier partiellement
rempli afin d'éviter d'associer une mauvaise clé à un certificat.

Démarrer le parcours SSO complet :

```bash
mkcert -install
pnpm tls:certificates:generate
pnpm sso:certificates:generate
pnpm stack:dev
```

Keycloak récupère automatiquement les certificats publics dans les métadonnées du SP. Comme son
stockage H2 se trouve dans le conteneur, une recréation génère un nouveau certificat IdP : il faut
alors redémarrer l'API pour recharger les métadonnées.

## Contrôles avant certification

- obtenir les métadonnées et certificats de chaque environnement IdP ;
- faire valider `entityID`, ACS, SLO, audience et noms de profils ;
- faire valider sur chaque environnement l'endpoint SSO HTTP-POST publié dans les métadonnées IdP ;
- confirmer le profil exact de chiffrement RSA-OAEP avec la DNUM ;
- utiliser uniquement HTTPS et des certificats délivrés selon la politique ministérielle ;
- stocker les clés privées dans Vault ou un secret monté, avec rotation et droits minimaux ;
- refuser les claims manquants, rôles inconnus, réponses expirées, non corrélées ou rejouées ;
- ne jamais journaliser assertion SAML, cookie, session, clé privée ou `igcid` complet ;
- tester connexion, changement d'email, désactivation, expiration, rejeu et rotation de certificat ;
- faire auditer le correctif pnpm de Better Auth et le retirer dès qu'une version amont le corrige.

## Correctif Better Auth versionné

Better Auth SSO 1.6.23 cherchait `InResponseTo` au mauvais niveau dans le résultat Samlify et imposait
le binding HTTP-Redirect pour l'`AuthnRequest`. Le dépôt applique dans
`patches/@better-auth__sso.patch` un correctif versionné qui :

- conserve la validation stricte d'`InResponseTo` ;
- crée une `AuthnRequest` signée avec le binding HTTP-POST exigé par le formulaire ministériel ;
- utilise une page intermédiaire à jeton aléatoire, expirante et consommable une seule fois ;
- applique à cette page `no-store`, une CSP restrictive, un nonce de script et `no-referrer` ;
- permet au front d'utiliser l'unique provider SSO par défaut sans dupliquer son identifiant.

Ce correctif doit être audité comme du code applicatif et retiré lorsqu'une version amont couvre ces
besoins.
Désactiver `enableInResponseToValidation` n'est pas une solution acceptable. Le patch doit rester
couvert par le test de connexion SAML et être réévalué à chaque montée de version.
