# Worker Dépôt Numérique

Processus NestJS indépendant destiné aux traitements BullMQ. Le workspace ne contient pour l'instant
qu'une queue et un processor de démonstration ; la préparation des documents et le dépôt Playwright
restent à implémenter.

La documentation complète se trouve dans
[`docs/applications/worker.md`](../../docs/applications/worker.md).

## Préparation et démarrage

Depuis la racine du monorepo :

```bash
cp .env.example .env
cp apps/worker/.env.example apps/worker/.env
pnpm infra:dev
pnpm worker:dev
```

Le worker charge Redis depuis le `.env` racine, puis les valeurs spécifiques de
`apps/worker/.env`. Il crée actuellement un serveur NestJS sur le port `3001`, sans contrôleur HTTP.

## État actuel

- queue active : `test` ;
- payload : `{ message: string }` ;
- résultat : `{ message: string, processedAt: string }` ;
- test unitaire sans connexion Redis ;
- aucune image Docker ni service Compose pour le worker à ce stade.

Les constantes `preprocess` et `deposit` réservent les noms des futures queues mais n'enregistrent
encore aucun processor.

## Commandes

```bash
pnpm worker:dev
pnpm worker:build
pnpm worker:test
pnpm worker:typecheck
pnpm worker:lint
pnpm worker:format
pnpm worker:format:check
pnpm worker:check
pnpm worker:check:fix
```
