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
    client.ts           # Instance Prisma partagée par processus
  generated/prisma/     # Client généré, non versionné
  prisma.config.ts      # Configuration de la CLI Prisma
```

Le client généré et le dossier `dist` ne sont pas commités. Ils sont reconstruits avec
`pnpm database:generate` et `pnpm database:build`.

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

## Modèle initial

Le schéma initial contient :

- `Jurisdiction` : juridiction connue du SSO et activée dans l'application ;
- `Service` : service rattaché à une juridiction ;
- `Document` : dépôt métier, type `LS` ou `LR`, statut et référence pseudonymisée du déposant ;
- `DocumentFile` : référence d'un fichier MinIO avec bucket, clé objet, taille et checksum SHA-256.

Un document référence un service. Sa juridiction est obtenue par la relation
`Document -> Service -> Jurisdiction`, sans dupliquer `jurisdictionId` dans `Document`.

PostgreSQL ne contient pas les fichiers. `DocumentFile` conserve uniquement `bucket` et
`objectKey`, utilisés par l'API pour accéder à l'objet MinIO.

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
pnpm database:migrate:dev --name description
pnpm database:migrate:deploy
pnpm database:migrate:status
pnpm database:seed
pnpm database:studio
```

Le workspace database n'a pas encore de commande de test dédiée.

## Cycle des migrations

Une migration est un ensemble de fichiers SQL versionnés. Elle ne copie pas la base locale et ne
transporte aucune donnée de développement.

Après une modification de `schema.prisma`, créer et appliquer une migration sur PostgreSQL local :

```bash
pnpm database:migrate:dev --name description
```

La commande :

1. compare le schéma Prisma à l'état de la base locale ;
2. crée un dossier dans `prisma/migrations` ;
3. écrit le SQL correspondant ;
4. applique ce SQL à la base locale ;
5. enregistre la migration dans la table `_prisma_migrations`.

Le dossier de migration doit être relu puis commité avec le changement de schéma. Il constitue la
procédure reproductible qui sera appliquée aux autres environnements.

En recette et en production, ne jamais utiliser `migrate dev`. La CI/CD applique uniquement les
migrations déjà versionnées :

```bash
pnpm database:migrate:deploy
```

La base de production est différente de la base locale, mais elle reçoit les mêmes migrations dans
le même ordre. Prisma consulte `_prisma_migrations` et n'applique que les migrations absentes.

Les migrations de production doivent utiliser des credentials dédiés, être précédées d'une
sauvegarde adaptée au risque et être exécutées une seule fois par déploiement, avant le démarrage
des nouvelles instances applicatives.

## Seed de développement

Le seed crée quatre juridictions :

- `TJ-LILLE` ;
- `TJ-ARRAS` ;
- `TJ-DOUAI` ;
- `TJ-CAMBRAI`.

Chaque juridiction reçoit les services `AUD`, `BAJ`, `BOG`, `JAF` et `JAP`.

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
