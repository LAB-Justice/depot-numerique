# Développement

Cette page décrit l'état actuel du projet et les commandes utiles pour travailler en local.

## Structure actuelle

Le dépôt est un monorepo `pnpm` piloté avec `Turbo`.

```text
apps/
  api/    # API NestJS
  web/    # Frontend Angular
docs/     # Documentation VitePress
packages/
```

Applications disponibles :

- `api` : backend NestJS ;
- `web` : frontend Angular ;
- `@depot-numerique/docs` : documentation VitePress.

## Prérequis

- Node.js, version définie dans `.nvmrc`.
- pnpm `11.8.0`.
- Docker et Docker Compose.

Activer la version Node attendue :

```bash
nvm use
```

Installer les dépendances :

```bash
pnpm install
```

Installer les hooks Git locaux si nécessaire :

```bash
pnpm prepare
```

## Lancement local

Les commandes de développement suivent la même convention que les autres tâches du monorepo :

- `pnpm dev` lance tous les serveurs de développement disponibles.
- `pnpm apps:dev` lance uniquement les applications métier, donc `api` et `web`.
- `pnpm <workspace>:dev` lance un seul workspace.

Les serveurs `dev` sont déclarés comme persistants dans Turbo : ils restent actifs tant que le terminal est ouvert et ne sont pas mis en cache.

Lancer l'API, le frontend et la documentation :

```bash
pnpm dev
```

Lancer seulement l'API et le frontend :

```bash
pnpm apps:dev
```

Lancer seulement l'API :

```bash
pnpm api:dev
```

Lancer seulement le frontend :

```bash
pnpm web:dev
```

Lancer seulement la documentation :

```bash
pnpm docs:dev
```

URLs locales :

- API : `http://localhost:3000`
- Frontend : `http://localhost:4200`
- Documentation : `http://localhost:5173/depot-numerique/`

## Services Docker

Les services techniques locaux sont lancés avec Docker Compose.

```bash
docker compose up -d
```

Services disponibles :

- PostgreSQL : `localhost:5432`
- Redis : `localhost:6379`
- MinIO API : `http://localhost:9000`
- MinIO Console : `http://localhost:9001`

Arrêter les services :

```bash
docker compose down
```

Supprimer aussi les volumes locaux :

```bash
docker compose down -v
```

Attention : `docker compose down -v` supprime les données locales PostgreSQL, Redis et MinIO.

## Qualité

Le projet utilise :

- Biome pour le formatage et le lint ;
- Knip pour détecter les dépendances et fichiers inutilisés ;
- Commitlint pour valider les messages de commit ;
- Lefthook pour les hooks Git locaux.

Les commandes suivent une nomenclature commune :

```text
pnpm <tâche>              # tous les workspaces concernés
pnpm <workspace>:<tâche>  # un workspace précis
```

Workspaces disponibles :

- `api` : API NestJS.
- `web` : frontend Angular.
- `docs` : documentation VitePress.

Tâches principales :

- `build` : compile le workspace.
- `test` : lance les tests.
- `typecheck` : vérifie les types TypeScript sans produire de build.
- `lint` : lance le lint Biome.
- `format` : formate le code avec Biome.
- `format:check` : vérifie le formatage sans modifier les fichiers.
- `check` : lance les vérifications Biome complètes.
- `check:fix` : applique les corrections Biome automatiques.

Les tâches monorepo passent par Turbo. Cela permet d'exécuter les workspaces en parallèle, d'utiliser le cache lorsque c'est possible et de cibler un workspace sans écrire `--filter` à la main.

Les hooks Git sont gérés par Lefthook :

- `pre-commit` lance Biome sur les fichiers staged et réajoute les fichiers corrigés.
- `commit-msg` valide le message de commit avec Commitlint.
- `pre-push` lance en parallèle `pnpm check`, `pnpm knip`, `pnpm typecheck` et `pnpm test`.

Commandes principales :

```bash
pnpm build
pnpm test
pnpm typecheck
pnpm lint
pnpm format
pnpm format:check
pnpm check
pnpm check:fix
pnpm knip
pnpm prepare
```

Commandes ciblées API :

```bash
pnpm api:dev
pnpm api:build
pnpm api:test
pnpm api:typecheck
pnpm api:lint
pnpm api:format
pnpm api:format:check
pnpm api:check
pnpm api:check:fix
```

Commandes ciblées frontend :

```bash
pnpm web:dev
pnpm web:build
pnpm web:test
pnpm web:typecheck
pnpm web:lint
pnpm web:format
pnpm web:format:check
pnpm web:check
pnpm web:check:fix
```

Commandes ciblées documentation :

```bash
pnpm docs:dev
pnpm docs:build
pnpm docs:preview
pnpm docs:lint
pnpm docs:format
pnpm docs:format:check
pnpm docs:check
pnpm docs:check:fix
```

La documentation n'a pas encore de commande `docs:test` ni `docs:typecheck`. Le build VitePress avec `pnpm docs:build` sert de vérification principale.

## Documentation

La documentation est construite avec VitePress.

```bash
pnpm docs:build
```

Prévisualiser le build localement :

```bash
pnpm docs:preview
```

La documentation est configurée pour GitHub Pages avec :

```ts
base: "/depot-numerique/";
```

Le workflow GitHub Actions `.github/workflows/deploy.yml` construit `docs/.vitepress/dist` et le publie sur GitHub Pages.

## Commandes utiles

Lister les workspaces :

```bash
pnpm -r list --depth -1
```

Construire tout le monorepo :

```bash
pnpm build
```

Lancer tous les tests :

```bash
pnpm test
```

Vérifier les types TypeScript :

```bash
pnpm typecheck
```
