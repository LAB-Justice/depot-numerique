# API

L'API est construite avec NestJS et documentée via Swagger / OpenAPI.

## Swagger

En local, la documentation interactive (Swagger UI) est disponible à l'adresse suivante :

```text
http://localhost:3000/api/docs
```

La spécification OpenAPI au format JSON est également exposée :

```text
http://localhost:3000/api/docs-json
```

Swagger n'est activé qu'en développement. Il est désactivé en production (`NODE_ENV=production`) : ni l'interface ni la spécification JSON ne sont servies.

## Configuration

Le comportement de Swagger dépend de la variable d'environnement `NODE_ENV`, définie dans `apps/api/.env`.

- `NODE_ENV=development` : Swagger accessible sur `/api/docs`.
- `NODE_ENV=production` : Swagger désactivé.

Démarrer l'API en local :

```bash
pnpm api:dev
```
