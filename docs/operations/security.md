# Sécurité

Cette page décrit les contrôles présents et les travaux requis avant production. La stack locale
utilise des secrets publics et un IdP de simulation : elle ne doit contenir aucune donnée réelle.

## Contrôles déjà présents

### Authentification

- Better Auth utilise exclusivement le fournisseur SAML ; l'email/mot de passe est désactivé.
- Les sessions sont persistées dans PostgreSQL, expirent après six heures et ne sont pas rafraîchies.
- Le garde Better Auth protège les contrôleurs par défaut.
- Seules les routes de santé sont explicitement anonymes.
- Les routes d'administration dynamique des fournisseurs SSO sont désactivées.

### SAML

- `AuthnRequest` signée en RSA-SHA256 avec binding HTTP-POST ;
- assertion signée exigée ; la simulation Keycloak signe aussi la réponse ;
- assertion chiffrée ;
- validation de `InResponseTo`, timestamps, audience, destination et anti-rejeu ;
- IdP-initiated SSO refusé ;
- algorithmes dépréciés refusés ;
- métadonnées IdP limitées à 100 Kio, sans redirection et avec timeout ;
- réponses SAML limitées à 256 Kio ;
- clés RSA d'au moins 2048 bits et paires clé/certificat validées au démarrage.

Le profil RSA-OAEP exact et le correctif Better Auth doivent être audités avant certification. Voir
[Comprendre et raccorder le SSO SAML](../authentication/saml.md).

### HTTP

- Helmet sur l'API ;
- CORS avec liste explicite d'origines et credentials ;
- validation globale des DTO, propriétés inconnues refusées ;
- limitation globale de débit ;
- HTTPS local, redirection HTTP vers HTTPS et TLS 1.2 minimum dans Traefik ;
- CSP, HSTS, anti-framing, `nosniff`, `Referrer-Policy` et `Permissions-Policy` sur le frontend.

### Logs

- logs HTTP structurés avec Pino ;
- `X-Request-Id` validé ou remplacé par un UUID ;
- headers `Authorization`, `Cookie` et `Set-Cookie` masqués ;
- niveaux `info`, `warn` et `error` selon le statut HTTP.

Les assertions, tokens, cookies, clés privées, mots de passe, documents et `igcid` complets ne doivent
jamais être journalisés. Les futures traces métier doivent préférer `requestId`, `documentId` et
`jobId`.

## Secrets locaux

`.env` et `.secrets/` sont ignorés par Git. La stack utilise trois ensembles distincts :

- le secret Better Auth, d'au moins 32 caractères ;
- la clé et le certificat HTTPS de Traefik ;
- deux paires SAML du SP, l'une pour la signature et l'autre pour le déchiffrement.

Les clés privées sont montées en lecture seule dans le conteneur API. Les scripts locaux créent les
clés avec des permissions restrictives et refusent un ensemble partiel.

Les mots de passe de `.env.example`, du LDIF et de Keycloak sont publics et réservés au
développement. Ils ne doivent être réutilisés dans aucun environnement partagé.

## Provisioning et habilitations

Le profil métier est retrouvé par `igcid`, pas par email. Le provisioning exige exactement un rôle
Dépôt Numérique connu, bloque un utilisateur désactivé et refuse les liaisons d'identité
contradictoires.

Les rôles internes sont :

- administrateur national : périmètre global ;
- administrateur régional : cour d'appel et descendants ;
- administrateur local : structure attribuée selon les règles métier ;
- agent : dépôt et consultation de ses documents.

Le modèle encode ces rôles et périmètres, mais les routes métier d'autorisation ne sont pas encore
implémentées. Chaque future requête devra filtrer côté serveur les structures, services et documents,
sans se fier au rôle ou aux identifiants envoyés par Angular.

## Documents et données personnelles

Avant d'accepter un fichier, l'API devra :

- imposer une taille maximale et une liste de types MIME ;
- vérifier le contenu réel, pas uniquement l'extension ;
- normaliser le nom d'affichage sans l'utiliser comme clé objet ;
- calculer une empreinte SHA-256 ;
- analyser le fichier avec l'antivirus disponible ;
- stocker l'objet sous une clé sans nom, adresse ni numéro de dossier ;
- limiter les accès MinIO par service applicatif ;
- journaliser l'action sans copier le contenu ou les données personnelles.

Les artefacts Playwright suivent les mêmes règles de minimisation, de contrôle d'accès et de
rétention que les documents.

## Exigences de production non implémentées

- Vault, rotation et révocation automatisées des secrets ;
- certificats émis par la PKI retenue et procédure de rotation sans interruption ;
- chiffrement des flux internes et des données au repos selon l'infrastructure ;
- comptes PostgreSQL, Redis et MinIO au moindre privilège ;
- politique CSP de production ajustée aux domaines définitifs ;
- centralisation des logs avec contrôle d'accès et rétention ;
- audit append-only des actions sensibles ;
- scan des dépendances, SBOM et scan des images ;
- sauvegardes chiffrées et restaurations testées ;
- analyse de risques, PSSI et niveau d'homologation à confirmer avec les responsables compétents.

## Revue avant mise en service

1. valider le contrat SSO, les certificats et les rôles avec l'équipe IdP ;
2. réaliser une revue du patch Better Auth et des contrôles SAML ;
3. définir la matrice d'habilitation et ajouter des tests d'accès croisés ;
4. valider types, tailles, antivirus et traitement des fichiers hostiles ;
5. établir les durées de conservation et les procédures d'effacement ;
6. tester sauvegarde, restauration, rotation de secrets et reprise après incident ;
7. effectuer les audits de dépendances, conteneurs et configuration réseau ;
8. documenter les risques résiduels et obtenir les validations requises.
