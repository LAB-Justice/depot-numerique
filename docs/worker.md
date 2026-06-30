# Workers

Le workspace `worker`, situé dans `apps/worker`, héberge les workers BullMQ chargés du traitement
asynchrone des documents de la pipeline de dépôt. Il s'agit d'un processus NestJS indépendant de
l'API afin d'isoler les traitements longs (Playwright, LLM, parsing) du cycle de requêtes HTTP.

## Structure

```text
apps/worker/
  src/
    main.ts                       # Bootstrap NestJS (port 3001)
    app.module.ts                 # BullModule.forRootAsync + modules de workers
    queues/
      queues.constants.ts         # Registre central des noms de queues
    workers/
      test/
        test.module.ts            # Enregistrement de la queue `test`
        test.processor.ts         # @Processor('test')
        test.processor.spec.ts    # Test unitaire du traitement de démonstration
        test.dto.ts               # Payload et résultat typés
```

## Configuration locale

Le worker lit la configuration Redis depuis le `.env` racine (variables partagées) et sa propre
configuration depuis `apps/worker/.env` (variables spécifiques).

Créer le fichier d'environnement du workspace :

```bash
cp apps/worker/.env.example apps/worker/.env
```

Les variables requises sont les suivantes. `REDIS_*` proviennent du `.env` racine :

```dotenv
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=password
```

`apps/worker/.env` ne contient que les variables spécifiques au worker :

```dotenv
NODE_ENV=development
WORKER_PORT=3001
```

Le `ConfigModule` charge d'abord le `.env` racine, puis le `.env` local. Ce dernier surcharge le
premier en cas de conflit. Aucun de ces fichiers ne doit être commité.

## Démarrage

Démarrer le worker en local :

```bash
pnpm worker:dev
```

Le worker écoute sur le port `3001` (distinct de l'API sur `3000`) et se connecte à Redis via
`BullModule.forRootAsync`. Le worker n'expose pas d'endpoints HTTP métier : le port sert uniquement
au bootstrap NestJS.

## Queues

Le registre central `queues.constants.ts` déclare les noms de queues. Le nommage suit la pipeline de
dépôt de documents :

- `test` : queue de démonstration, valider le setup BullMQ ;
- `preprocess` : pré-traitement et validation du document (vérification n° de dossier et trame
  IMPRIMFIP) ;
- `llm-correction` : reformatage automatique par LLM des pages non conformes ;
- `deposit` : dépôt IMPRIMFIP via Playwright ou API.

Seule la queue `test` est active dans ce workspace. Les autres noms sont réservés pour les
prochaines étapes.

## Worker de test

Le worker `test` valide le pipeline BullMQ de bout en bout. Il expose :

- `TestJobData` : payload du job, `{ message: string }` ;
- `TestJobResult` : résultat retourné, `{ message: string, processedAt: string }`.

Le `TestProcessor` consomme les jobs de la queue `test`, journalise le message reçu, simule un
traitement asynchrone puis retourne un résultat. Ce worker est un échafaudage destiné à valider le
setup ; il sert de modèle pour les futurs workers métier.

## Commandes

Toutes les commandes du workspace worker sont exposées depuis la racine du monorepo :

```bash
pnpm worker:build
pnpm worker:lint
pnpm worker:format
pnpm worker:format:check
pnpm worker:check
pnpm worker:check:fix
pnpm worker:typecheck
pnpm worker:test
```

`pnpm worker:test` vérifie que le processor de démonstration consomme le payload attendu et retourne
un message traité avec un horodatage valide. Il s'agit d'un test unitaire : Redis n'est pas requis.

## Règles de production

- Le worker est un processus distinct de l'API pour isoler les traitements longs.
- Une seule connexion Redis partagée par l'instance via `BullModule.forRoot`.
- Le mot de passe Redis provient d'un secret de l'orchestrateur ou de Vault.
- Chaque worker métier possède son propre `*.module.ts` et sa queue déclarée dans `queues.constants.ts`.
