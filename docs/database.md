# Base de données

Le workspace `@depot-numerique/database`, situé dans `packages/database`, centralise le schéma
Prisma, le client généré, les migrations et les données de développement partagées par l'API et
les futurs workers.

## Structure

```text
packages/database/
  prisma/
    schema.prisma       # Modèle de données
    migrations/         # Historique SQL versionné
    seed.ts             # Données de développement et de test
  src/
    client.ts           # Fabrique de clients Prisma typés
  generated/prisma/     # Client généré, non versionné
  prisma.config.ts      # Configuration de la CLI Prisma
```

Le package expose une fabrique afin que chaque processus crée et maîtrise le cycle de vie de son
propre client. Dans l'API NestJS, `apps/api/src/core/database/database.service.ts` conserve une seule
instance par processus et la déconnecte lors de l'arrêt de l'application. Le client généré et le
dossier `dist` ne sont pas commités. Ils sont reconstruits avec `pnpm database:generate` et
`pnpm database:build`.

## Configuration locale

Créer le fichier d'environnement du workspace :

```bash
cp packages/database/.env.example packages/database/.env
```

La variable requise est :

```dotenv
DATABASE_URL=postgresql://root:password@localhost:5432/depot_numerique?schema=public
```

Le fichier `packages/database/.env` est réservé au développement local et ne doit jamais être
commité. En recette et en production, `DATABASE_URL` est injectée par l'orchestrateur ou Vault.

## Modèle de données

Le schéma contient :

- `Structure` : structure judiciaire connue du SSO, hiérarchisée et activée dans l'application ;
- `User` : utilisateur SSO pseudonymisé, avec son état actif, son rôle, sa structure de travail,
  son éventuel périmètre d'administration et son éventuel service ;
- `Service` : service créé dans l'application et rattaché à une structure ;
- `Document` : dépôt métier, type `LS` ou `LR`, statut et utilisateur créateur ;
- `DocumentFile` : référence d'un fichier MinIO avec bucket, clé objet, taille et checksum SHA-256.

Une structure possède un niveau hiérarchique :

- `REGIONAL` pour une cour d'appel ;
- `JURISDICTION` pour une structure directement rattachée à une cour ;
- `SUB_JURISDICTION` pour une structure rattachée à une juridiction.

La relation auto-référencée `Structure.parent` représente cette hiérarchie. Un service référence une
structure et est identifié en son sein par son `slug`, tandis que `displayName` porte son libellé
affiché. Il ne possède pas de code SSO, car il est créé et administré dans l'application.

Un utilisateur possède deux rattachements distincts :

- `workStructureId` : structure opérationnelle de l'utilisateur, utilisée pour son service et ses
  dépôts ;
- `adminStructureId` : périmètre administré, utilisé par les écrans d'administration.

Ces deux valeurs peuvent être différentes. Par exemple, un administrateur régional travaillant au
tribunal judiciaire de Lille peut avoir `workStructureId` sur le TJ de Lille et `adminStructureId`
sur la cour d'appel de Douai. Les administrateurs généraux n'ont pas besoin de périmètre
`adminStructureId`, car leur rôle donne un accès global. Les agents et les administrateurs qui
déposent des documents utilisent leur `workStructureId` et leur `serviceId`.

Un utilisateur peut être affecté à un service de sa structure de travail. La cohérence entre
`User.workStructureId` et la structure de `User.serviceId` est contrôlée par la logique applicative
lors de l'affectation.

Le périmètre d'administration est déduit du rôle et du niveau de `adminStructureId`, sans champ de
scope dédié :

- `ADMINISTRATEUR_GENERAL` : accès global, sans `adminStructureId` obligatoire ;
- `ADMINISTRATEUR_REGIONAL` : `adminStructureId` doit viser une structure `REGIONAL` et donne accès
  à cette cour d'appel et à tous ses descendants ;
- `ADMINISTRATEUR_LOCAL` avec une structure `REGIONAL` : accès limité à cette cour d'appel et à ses
  services, sans accès aux juridictions rattachées ;
- `ADMINISTRATEUR_LOCAL` avec une structure `JURISDICTION` : accès à cette juridiction et à ses
  sous-juridictions ;
- `ADMINISTRATEUR_LOCAL` avec une structure `SUB_JURISDICTION` : accès limité à cette
  sous-juridiction.

Cette règle permet de gérer un administrateur local de cour d'appel chargé uniquement des services de
la cour, sans lui donner le périmètre complet d'un administrateur régional.

Un document référence obligatoirement un service et l'utilisateur qui l'a créé. Sa structure est
donc obtenue par `Document -> Service -> Structure`. La suppression physique d'un utilisateur ayant
créé un document est interdite afin de préserver l'identité du déposant. `User.isActive` permet de
révoquer son accès sans supprimer son historique.

L'identifiant IGC n'est jamais enregistré en clair : seul son HMAC-SHA-256 est conservé dans
`User.igcidHash`. Le DN LDAP `bureauIGC` n'est pas stocké ; il sert uniquement à calculer
`workStructureId` et `adminStructureId` lors de la connexion. Le rôle, les rattachements calculés et
`lastLoginAt` sont synchronisés à chaque connexion. Un utilisateur désactivé doit rester bloqué tant
qu'une décision métier explicite ne l'a pas réactivé.

PostgreSQL ne contient pas les fichiers. `DocumentFile` conserve uniquement `bucket` et `objectKey`,
utilisés par l'API pour accéder à l'objet MinIO.

## Commandes

Toutes les commandes du workspace database sont exposées depuis la racine du monorepo :

```bash
pnpm database:build
pnpm database:lint
pnpm database:format
pnpm database:format:check
pnpm database:check
pnpm database:check:fix
pnpm database:typecheck
pnpm database:generate
pnpm database:validate
pnpm database:migrate:create --name description
pnpm database:migrate:dev --name description
pnpm database:migrate:deploy
pnpm database:migrate:status
pnpm database:seed
pnpm database:studio
```

Le script `pnpm database:studio` force Prisma Studio sur `http://localhost:5555`.

Le workspace database n'a pas encore de commande de test dédiée.

## Cycle des migrations

Une migration est un ensemble de fichiers SQL versionnés. Elle ne copie pas la base locale et ne
transporte aucune donnée de développement.

Après une modification de `schema.prisma`, générer une migration sans l'appliquer sur PostgreSQL
local :

```bash
pnpm database:migrate:create --name description
```

La commande :

1. compare le schéma Prisma à l'état de la base locale ;
2. crée un dossier dans `prisma/migrations` ;
3. écrit le SQL correspondant ;
4. s'arrête pour permettre la relecture du SQL sans modifier le schéma applicatif de la base.

Le dossier de migration doit être relu puis commité avec le changement de schéma. Il constitue la
procédure reproductible qui sera appliquée aux autres environnements.

Après relecture, `pnpm database:migrate:dev` applique localement les migrations en attente. Cette
commande ne doit jamais être utilisée en recette ou en production, où la CI/CD applique uniquement
les migrations déjà versionnées :

```bash
pnpm database:migrate:deploy
```

La base de production est différente de la base locale, mais elle reçoit les mêmes migrations dans
le même ordre. Prisma consulte `_prisma_migrations` et n'applique que les migrations absentes.

Les migrations de production doivent utiliser des credentials dédiés, être précédées d'une
sauvegarde adaptée au risque et être exécutées une seule fois par déploiement, avant le démarrage
des nouvelles instances applicatives.

## Seed de développement

Le seed crée cinq structures hiérarchisées avec des codes SSO uniques sur huit chiffres :

- `00000001`, cour d'appel de Douai de niveau `REGIONAL` ;
- `00000002`, `00000003` et `00000004`, tribunaux judiciaires de Lille, Arras et Douai de niveau
  `JURISDICTION` et rattachés à `00000001` ;
- `00000005`, tribunal de proximité de Tourcoing de niveau `SUB_JURISDICTION` et rattaché à
  `00000002`.

La cour d'appel et chaque structure de niveau `JURISDICTION` reçoivent les services `baj`, `bog`,
`jaf` et `jap`. Le slug sert d'identifiant stable dans la structure et `displayName` contient le
libellé complet.

Avec Prisma 7, le seed est explicite : il n'est pas exécuté automatiquement par `migrate dev` ou
`migrate reset`. Ces données sont prévues pour le développement et les tests ; elles ne doivent pas
être injectées automatiquement en production.

```bash
pnpm database:seed
```

## Règles de production

- Une seule instance de `PrismaClient` est utilisée par processus API ou worker.
- Chaque processus possède son propre pool PostgreSQL.
- La taille totale des pools doit tenir compte du nombre de replicas API et workers.
- Le compte applicatif applique le moindre privilège et ne doit pas être le compte de migration.
- Les connexions de production utilisent TLS selon la configuration de l'infrastructure.
- `DATABASE_URL` provient de Vault ou d'un mécanisme de secrets de l'orchestrateur.
- Les URLs de connexion, mots de passe et données documentaires ne sont jamais journalisés.
