# Extraction PDF

Le package [`@depot-numerique/pdf-extraction`](https://github.com/LAB-Justice/depot-numerique/tree/main/packages/pdf-extraction) fournit une **V1 d'extraction PDF textuelle déterministe**. Il s'appuie sur `pdfjs-dist` pour lire le texte et les positions, puis retourne un JSON structuré validé par Zod.

Le package est conçu pour les documents métier du Dépôt Numérique (courriers BAJ notamment) et expose des champs principaux, des confiances par champ, une provenance, et une validation métier. Il peut également fournir un contexte enrichi (texte brut, textes par page, blocs layout) destiné à un futur *reviewer* IA local.

## Périmètre

La V1 est **textuelle et déterministe**. Elle permet de :

- extraire le texte et les positions via `pdfjs-dist` ;
- retourner un JSON structuré validé avec Zod ;
- extraire les champs principaux des documents BAJ (juridiction, service, numéro de demande, destinataire, expéditeur, dates) ;
- fournir une confiance par champ (`confidence`) ;
- fournir une provenance par champ (`sourceText`, `sourcePage`, `method`) ;
- fournir une validation métier (`status`, `score`, `issues`, `errors`, `warnings`) ;
- exposer optionnellement un contexte enrichi pour le debug ou une future IA reviewer (`rawText`, `pageTexts`, `layoutBlocks`).

La V1 ne fait **pas** :

- d'OCR (reconnaissance optique de caractères) ;
- de LLM ;
- de correction automatique ;
- d'intégration BullMQ ;
- de stockage Prisma ;
- de dépôt IMPRIMFIP.

Un PDF sans couche texte exploitable renvoie un statut `TEXT_EXTRACTION_FAILED` et aucun champ n'est extrait.

## Installation

Le package est privé et consommé au sein du monorepo. Il s'importe depuis l'entry point du workspace :

```ts
import {
  extractPdfDocument,
  pdfExtractionResultSchema,
  type PdfExtractionResult,
} from '@depot-numerique/pdf-extraction';
```

Dépendances clés du package : `pdfjs-dist` et `zod`.

## Utilisation

L'API se résume à une fonction asynchrone `extractPdfDocument`, qui accepte un `Buffer` ou un `Uint8Array` et des options.

### Résultat standard

Par défaut, le résultat reste léger : aucun texte brut ni bloc layout n'est inclus.

```ts
const buffer: Buffer = fichierEntrant;
const result = await extractPdfDocument(buffer);

console.log(result.documentType); // 'REQUEST_MISSING_PARTS'
console.log(result.requestNumber?.value); // 'C-00000-0000-000001'
console.log(result.validation.status); // 'OK' | 'PARTIAL' | 'TEXT_EXTRACTION_FAILED'
```

### Résultat enrichi

Pour préparer un *reviewer* IA local ou pour le debug, on demande explicitement le contexte enrichi. Les champs correspondants ne sont présents **que** si l'option est activée.

```ts
const result = await extractPdfDocument(buffer, {
  includeRawText: true,
  includePageTexts: true,
  includeLayout: true,
});

result.rawText; // texte concaténé du document
result.pageTexts; // texte par page (pageNumber, text, characterCount, wordCount)
result.layoutBlocks; // blocs layout normalisés (pageNumber, text, x, y, width, height)
```

## Options

Toutes les options sont facultatives (`ExtractionOptions`).

| Option                  | Type      | Défaut | Description                                                          |
| ----------------------- | --------- | ------ | -------------------------------------------------------------------- |
| `minPageOneCharacters`  | `number`  | `100`  | Nombre minimal de caractères sur la première page.                   |
| `minPageOneWords`       | `number`  | `20`   | Nombre minimal de mots sur la première page.                         |
| `includeRawText`        | `boolean` | `false`| Inclut `rawText` (texte concaténé) dans le résultat.                 |
| `includePageTexts`      | `boolean` | `false`| Inclut `pageTexts` (texte par page) dans le résultat.                |
| `includeLayout`         | `boolean` | `false`| Inclut `layoutBlocks` (positions normalisées) dans le résultat.       |

Sous le seuil `minPageOneCharacters` / `minPageOneWords`, l'extraction renvoie `documentType: 'UNKNOWN'`, `validation.status: 'TEXT_EXTRACTION_FAILED'` et aucun champ métier.

## Résultat

Le type de retour est `PdfExtractionResult`.

### Champs requis

| Champ                    | Type                  | Description                                            |
| ------------------------ | --------------------- | ------------------------------------------------------ |
| `documentType`           | `DocumentType`        | Type de document classifié.                            |
| `documentTypeConfidence` | `number`              | Confiance de la classification (0..1).                 |
| `dates`                  | `ExtractedDates`      | Dates du courrier, de la demande et de la décision.    |
| `confidence`             | `ExtractionConfidence`| Scores globaux et par section (0..1).                  |
| `completeness`           | `ExtractionCompleteness` | Scores de complétude par section (0..1).            |
| `validation`             | `ExtractionValidation`| Statut, score, issues, errors, warnings.               |
| `pages`                  | `PageMetrics[]`       | Métriques par page (caractères, mots, page vide).      |

### Champs d'extraction optionnels

Présents uniquement si l'extraction a réussi pour le champ concerné :

| Champ           | Type                    | Description                                  |
| --------------- | ----------------------- | -------------------------------------------- |
| `jurisdiction`  | `ExtractedField<string>`| Juridiction (ex. Tribunal judiciaire).       |
| `service`       | `ExtractedField<string>`| Service émetteur (ex. Bureau d'aide juridictionnelle). |
| `requestNumber` | `ExtractedField<string>`| Numéro de demande (`C-00000-0000-000001`).  |
| `recipient`     | `ExtractedRecipient`    | Destinataire (civilité, nom, adresse, et `addressBlockName` quand le bloc postal porte un nom distinct).       |
| `sender`        | `ExtractedSender`       | Expéditeur (juridiction, service, adresse, téléphone). |

### Champs enrichis optionnels

Présents uniquement si l'option correspondante est activée :

| Champ          | Condition         | Description                                                                |
| -------------- | ----------------- | -------------------------------------------------------------------------- |
| `rawText`      | `includeRawText`  | Texte concaténé de toutes les pages.                                       |
| `pageTexts`    | `includePageTexts`| Une entrée par page (`pageNumber`, `text`, `characterCount`, `wordCount`). |
| `layoutBlocks` | `includeLayout`   | Un bloc par item texte PDF normalisé (`pageNumber`, `text`, `x`, `y`, `width`, `height`). |

> `layoutBlocks` peut être volumineux et contenir du texte sensible : il n'est jamais inclus par défaut et ne doit pas être journalisé.

## Confiance et provenance

Chaque champ extrait est enveloppé dans un `ExtractedField<T>` qui porte sa propre confiance et sa provenance :

```ts
interface ExtractedField<T> {
  value: T;
  confidence: number;       // 0..1
  sourcePage: number;       // page d'origine (1-indexée)
  sourceText: string;       // extrait texte source
  method: ExtractionMethod; // 'REGEX' | 'LAYOUT' | 'HEURISTIC'
}
```

La confiance globale est portée par `ExtractionConfidence` :

```ts
interface ExtractionConfidence {
  overall: number;   // 0..1, requis
  recipient?: number; // moyenne des sous-champs du destinataire
  sender?: number;    // moyenne des sous-champs de l'expéditeur
  dates?: number;     // moyenne des sous-champs de dates
}
```

Le calcul V1 de `overall` reste volontairement simple : moyenne des sections présentes, divisée par deux si `documentType === 'UNKNOWN'`, pénalisée par les erreurs (`-0,15`) et les avertissements (`-0,05`). L'objectif n'est pas une confiance parfaite, mais un signal exploitable pour décider d'engager un *reviewer* IA.

### Complétude (`completeness`)

`ExtractionCompleteness` mesure la proportion de blocs attendus réellement présents, indépendamment de la confiance d'extraction :

```ts
interface ExtractionCompleteness {
  recipient: number; // 0..1
}
```

`completeness.recipient` est la fraction des quatre blocs destinataire présents :

| Bloc                          | Compté si                                              |
| ----------------------------- | ------------------------------------------------------ |
| Nom / organisme               | `recipient.fullName` **ou** `recipient.organization`.  |
| Adresse                       | `recipient.addressLines` non vide.                     |
| Code postal                   | `recipient.postalCode`.                                |
| Ville                         | `recipient.city`.                                      |

Interprétation : `1` = destinataire complet, `0,5` = partiel, `0` = absent. Ce score complète `validation.status` (qui signale les blocs manquants) en donnant une mesure continue.

## Validation

`ExtractionValidation` résume la qualité de l'extraction :

```ts
interface ExtractionValidation {
  status: ValidationStatus; // 'OK' | 'PARTIAL' | 'TEXT_EXTRACTION_FAILED'
  score: number;            // 0..1
  issues: ValidationIssue[];
  errors: ValidationIssue[];   // dérivé de issues (severity 'error')
  warnings: ValidationIssue[]; // dérivé de issues (severity 'warning')
}
```

`errors` et `warnings` sont toujours dérivés de `issues`.

### Codes de validation

`ValidationIssueCode` est une union typée :

| Code                                | Sévérité  | Sens                                                     |
| ----------------------------------- | --------- | -------------------------------------------------------- |
| `TEXT_EXTRACTION_FAILED`            | `error`   | Première page sans texte suffisant.                      |
| `UNKNOWN_DOCUMENT_TYPE`             | `warning` | Type de document non reconnu.                            |
| `MISSING_JURISDICTION`              | `warning` | Juridiction non extraite.                                |
| `MISSING_SERVICE`                   | `warning` | Service non extrait.                                     |
| `MISSING_REQUEST_NUMBER`            | `warning` | Numéro de demande non extrait (types BAJ reconnus seulement). |
| `MISSING_RECIPIENT`                 | `warning` | Destinataire totalement absent.                          |
| `MISSING_RECIPIENT_NAME`            | `warning` | Destinataire présent mais sans nom ni organisme.         |
| `MISSING_RECIPIENT_ADDRESS`         | `warning` | Destinataire présent mais sans adresse.                  |
| `MISSING_RECIPIENT_POSTAL_CODE`     | `warning` | Destinataire présent mais sans code postal.              |
| `MISSING_RECIPIENT_CITY`            | `warning` | Destinataire présent mais sans ville.                    |
| `RECIPIENT_ADDRESS_BLOCK_NAME_MISMATCH` | `warning` | Le nom du bloc postal diffère du nom principal (personne concernée ≠ destinataire postal ?). |

> `MISSING_REQUEST_NUMBER` n'est émis que pour les types de documents explicitement reconnus (`REQUEST_MISSING_PARTS`, `DECISION_NOTIFICATION`, `AID_DECISION`). Les documents `UNKNOWN` (notamment BOG / PORTALIS) peuvent utiliser d'autres identifiants métier, l'absence d'un numéro `C-...` n'y est donc pas signalée. Une gestion générique des références (`primaryReference` / `primaryReferenceType`) est prévue dans une tâche ultérieure.
>
> Toutes les issues de destinataire incomplet sont des `warning` : un destinataire partiel fait basculer `validation.status` à `PARTIAL` (jamais `OK`).

## Types de documents

`DocumentType` peut prendre quatre valeurs :

| Valeur                   | Description                                              |
| ------------------------ | -------------------------------------------------------- |
| `REQUEST_MISSING_PARTS`  | Demande de pièces ou informations complémentaires.       |
| `DECISION_NOTIFICATION`  | Notification d'une décision.                             |
| `AID_DECISION`           | Décision d'aide juridictionnelle.                        |
| `UNKNOWN`                | Type non reconnu (extraction textuelle toutefois possible). |

## Evaluation locale de corpus

Une commande locale permet de tester l'extracteur sur un dossier de PDF réels sans produire un énorme JSON unique :

```bash
pnpm pdf-extraction:evaluate ./chemin/vers/dossier-pdf
```

Sans argument, le dossier lu est `packages/pdf-extraction/.local-fixtures/`. Le script parcourt récursivement tous les fichiers `.pdf`, calcule un hash SHA-256 par fichier, lance `extractPdfDocument` sans `includeRawText`, sans `includePageTexts` et sans `includeLayout`, puis écrit les rapports sous :

```txt
packages/pdf-extraction/.evaluation/
├─ latest/
│  ├─ summary.md
│  ├─ documents.csv
│  ├─ issues.csv
│  ├─ failures.csv
│  ├─ by-document-type.csv
│  ├─ by-source-folder.csv
│  ├─ samples-to-review.csv
│  └─ raw-results.jsonl
└─ runs/
   └─ YYYY-MM-DD-HHMMSS/
      └─ mêmes fichiers
```

`latest/` est une copie du dernier run, pas un symlink. Le dossier `.evaluation/` est ignoré par Git.

### Rapports générés

- `summary.md` : synthèse humaine (volumétrie, statuts, types, top issues, complétude destinataire, performances, fichiers à revoir).
- `documents.csv` : une ligne par PDF avec chemins, taille, hash, statuts, scores, booléens de présence, issues et temps de traitement.
- `issues.csv` : agrégat par issue code (`issueCode`, `severity`, `count`, `percent`).
- `failures.csv` : erreurs techniques (`fileName`, `relativePath`, `sourceFolder`, `errorMessage`, `processingTimeMs`).
- `by-document-type.csv` : statistiques par `documentType`.
- `by-source-folder.csv` : statistiques par premier sous-dossier source.
- `samples-to-review.csv` : liste priorisée, limitée à 50 lignes par défaut, avec `fileHash` pour retrouver le document sans exposer de référence numérique.
- `raw-results.jsonl` : une ligne JSON par PDF avec le résultat complet local.

### Confidentialité

Par défaut, les CSV et `summary.md` n'incluent pas les valeurs extraites : pas de noms, adresses, numéros de dossier, texte brut, `rawText`, `pageTexts` ou `layoutBlocks`. Ils utilisent des booléens, scores, statuts, issues, chemins expurgés et hashes. Les séquences numériques longues présentes dans `fileName`, `relativePath` ou `sourceFolder` sont masquées.

`raw-results.jsonl` contient le résultat complet de `extractPdfDocument`, donc les valeurs structurées et `sourceText` des champs extraits. Il doit rester local sous `.evaluation/`.

Une option de diagnostic local existe :

```bash
pnpm pdf-extraction:evaluate ./chemin/vers/dossier-pdf --include-values
```

`--include-values` ajoute des colonnes sensibles à `documents.csv` (`recipientName`, `organization`, `streetLine`, `postalCode`, `city`, `requestNumber`, `jurisdiction`, `service`) et conserve les identifiants locaux non expurgés dans les rapports. Elle est désactivée par défaut et ne doit pas être utilisée pour des rapports partageables.

## Limites actuelles

La V1 est déterministe et textuelle. Elle ne couvre pas :

- l'OCR : un PDF scanné sans couche texte renvoie `TEXT_EXTRACTION_FAILED` ;
- le LLM et la correction automatique ;
- l'intégration BullMQ ;
- le stockage Prisma (les champs enrichis ne sont pas persistés) ;
- le dépôt IMPRIMFIP.

### Personne concernée vs destinataire postal

Sur les notifications de décision, la première ligne du bloc postal peut porter un nom différent du destinataire principal (par exemple un représentant / mandataire) :

```txt
Monsieur Jean Martin            ← destinataire principal (recipient.fullName)
représenté(e) par,
Madame Marie Durand             ← adresse postale réelle
CABINET EXEMPLE
00000 EXEMPLEVILLE CEDEX
```

La V1 expose ce second nom via le champ non cassant `recipient.addressBlockName?: ExtractedField<string>` et émet une issue `RECIPIENT_ADDRESS_BLOCK_NAME_MISMATCH` lorsque ce nom diffère de `recipient.fullName`. Le package ne cherche pas à trancher lequel est le « bon » destinataire postal : ce signal est destiné à une revue humaine ou future IA.

### Prudence autour de `caseReference`

Une référence d'enregistrement au greffe générique (`caseReference`, distincte du numéro de demande BAJ) n'est **pas** extraite à ce jour. Aucun champ `caseReference` n'existe dans le schéma actuel, et aucune extraction de référence métier autre que `requestNumber` n'est effectuée. La gestion d'une référence générique (formats `25/08325`, `2025-00069169`, `M20/0035`, etc.) devra faire l'objet d'une tâche séparée, idéalement via un champ typé `primaryReference` / `primaryReferenceType` distinguant BAJ, PORTALIS et BOG.

### Vers un *reviewer* IA local

Le package prépare le terrain pour une future brique IA locale. Celle-ci pourra recevoir :

- le JSON extrait ;
- `rawText` et `pageTexts` pour le contexte ;
- `layoutBlocks` pour les positions ;
- `validation.issues` ;
- les confiances et provenances par champ.

Un trigger de revue pourra s'appuyer sur `confidence.overall` (seuil bas), `validation.status === 'PARTIAL'` ou `documentType === 'UNKNOWN'`.

## Schéma Zod

Le package exporte `pdfExtractionResultSchema`, qui décrit exactement `PdfExtractionResult` (contraintes numériques 0..1 sur les confiances/scores, entiers positifs pour les numéros de page). Il peut être réutilisé pour valider le résultat côté consommateur :

```ts
import { pdfExtractionResultSchema } from '@depot-numerique/pdf-extraction';

const parsed = pdfExtractionResultSchema.parse(result);
```

Le résultat de `extractPdfDocument` est de toute façon validé par ce schéma avant d'être retourné.
