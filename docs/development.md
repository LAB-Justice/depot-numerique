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
- Lefthook pour les hooks Git locaux.

Commandes principales :

```bash
pnpm lint
pnpm format
pnpm format:check
pnpm check
pnpm check:fix
pnpm knip
pnpm prepare
```

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
base: "/depot-numerique/"
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
