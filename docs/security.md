# Sécurité

Cette page décrit l'analyse de sécurité configurée pour le projet : SAST (code source), SCA (dépendances) et DAST (application en cours d'exécution).

## SAST

Le projet utilise `Semgrep` comme outil SAST. Le scan est exécuté par GitHub Actions dans le workflow `.github/workflows/SAST.yml` sur chaque pull request et sur les pushs vers `main`.

Semgrep analyse le dépôt complet, dont les applications TypeScript `api` et `web`.

## Packs de règles

Le workflow combine plusieurs packs Semgrep :

- `p/security-audit` : règles généralistes de sécurité applicative ;
- `p/owasp-top-ten` : règles liées aux catégories OWASP Top 10 ;
- `p/secrets` : détection de secrets accidentellement versionnés.

Ces packs couvrent les principales classes de vulnérabilités attendues pour une application TypeScript web/API : injection, mauvaise validation des entrées, exposition de secrets, usages cryptographiques faibles, chemins ou accès non sûrs, et patterns applicatifs risqués.

## Alertes visibles

Le workflow génère un rapport SARIF `semgrep-results.sarif` et l'upload avec `github/codeql-action/upload-sarif`.

Les résultats sont donc visibles dans l'onglet Security de GitHub, section Code scanning, en plus de l'artifact CI `semgrep-results`.

## Seuil bloquant

Le scan Semgrep produit un unique rapport SARIF (pas de double exécution), qui sert à la fois à GitHub Code Scanning et au contrôle bloquant.

Le blocage de PR est fait dans une étape séparée qui lit `semgrep-results.sarif` et échoue si un finding est :

- de sévérité Semgrep `ERROR` ;
- **ou** issu du pack `p/secrets` (règle dont l'identifiant contient `secret`), quel que soit son niveau. Un secret leaké ne doit jamais passer la PR, même signalé en `WARNING`.

> Note : la sévérité `ERROR` est l'échelle interne de Semgrep (`INFO` / `WARNING` / `ERROR`), pas une criticité CVSS. Les findings de sécurité marqués `WARNING` (hors secrets) restent visibles dans GitHub Code Scanning mais ne bloquent pas la PR.

Conséquences :

- les findings non critiques restent visibles dans GitHub Code Scanning ;
- les vulnérabilités critiques et les secrets bloquent la PR ;
- le rapport SARIF reste disponible en artifact pour diagnostic.

## Workflow

Le workflow SAST suit cette séquence :

1. checkout du code ;
2. scan Semgrep SARIF unique ;
3. upload SARIF vers GitHub Code Scanning ;
4. contrôle bloquant sur les findings `ERROR` et les secrets ;
5. upload du rapport SARIF en artifact.

## SCA

Le projet utilise `Trivy` comme outil SCA (Software Composition Analysis) pour détecter les vulnérabilités connues (CVE) dans les dépendances. Le scan est exécuté par GitHub Actions dans le workflow `.github/workflows/SCA.yml` sur chaque pull request et sur les pushs vers `main`.

Trivy scanne le système de fichiers du dépôt (`scan-type: fs`), ce qui couvre le `pnpm-lock.yaml` à la racine ainsi que tous les lockfiles des workspaces (`apps/api`, `apps/web`, `docs`).

## Alertes SCA visibles

Le workflow génère un rapport SARIF `trivy-results.sarif` et l'upload avec `github/codeql-action/upload-sarif` (catégorie `trivy-sca`).

Les résultats sont donc visibles dans l'onglet Security de GitHub, section Code scanning, en plus de l'artifact CI `sca-results`.

## Seuil bloquant SCA

Trivy est configuré avec :

- `severity: HIGH,CRITICAL` : seules les vulnérabilités de sévérité haute et critique sont retenues ;
- `exit-code: '1'` : le job échoue si au moins une vulnérabilité `HIGH` ou `CRITICAL` est détectée ;
- `ignore-unfixed: false` : les vulnérabilités sans correctif connu sont incluses, afin de ne pas masquer une criticité présente.

Conséquences :

- les vulnérabilités `LOW` et `MEDIUM` ne bloquent pas la PR ;
- les vulnérabilités `HIGH` et `CRITICAL` bloquent la PR ;
- le rapport SARIF reste uploadé dans GitHub Code Scanning et disponible en artifact pour diagnostic, même en cas d'échec.

> Note : les sévérités `LOW` / `MEDIUM` / `HIGH` / `CRITICAL` correspondent à l'échelle CVSS utilisée par Trivy.

## Évolution future : images Docker

Aujourd'hui le monorepo ne construit pas d'image Docker (seul un `docker-compose.yml` de services de développement existe). Le scan `fs` couvre donc l'intégralité des dépendances applicatives.

Quand des images Docker seront ajoutées pour l'API, le frontend ou les workers, un second job Trivy `scan-type: image` sera ajouté au workflow pour scanner ces images contre la même base de vulnérabilités.

## DAST

Le projet utilise aussi un scan DAST dans le workflow `.github/workflows/DAST.yml`.

Le workflow combine deux outils :

- `ZAP Baseline Scan` : scan dynamique passif orienté application web, utile pour détecter des headers de sécurité manquants, des cookies mal configurés et des erreurs de configuration HTTP courantes. ZAP est lancé via `docker run --network host` afin de pouvoir joindre le frontend et l'API écoutés sur `127.0.0.1` par le runner GitHub Actions ;
- `Nuclei` : scan par templates, utilisé comme contrôle bloquant sur les vulnérabilités `high` et `critical`.

Sur pull request et push vers `main`, le workflow démarre deux cibles en CI :

- le build frontend Angular servi sur `http://127.0.0.1:4200` par un petit serveur statique Node avec fallback SPA (les routes inconnues renvoient `index.html`, pour éviter les faux positifs 404 en cascade lors du scan) ;
- l'API NestJS en mode production (`node apps/api/dist/main.js`) sur `http://127.0.0.1:3000`.

Le workflow peut aussi être lancé manuellement avec des URLs cible via `workflow_dispatch`. Cela permet de scanner un environnement de recette ou de préproduction sans changer le fichier CI.

## Alertes DAST visibles

ZAP génère, pour le frontend et l'API, un rapport HTML et un rapport JSON conservés dans l'artifact `dast-results` (dossier `.zap/out/`) :

- `zap-dast-frontend-report.html` / `zap-dast-frontend-report.json` ;
- `zap-dast-api-report.html` / `zap-dast-api-report.json`.

Nuclei génère deux rapports :

- des rapports SARIF frontend et API, uploadés dans GitHub Code Scanning ;
- des rapports JSONL frontend et API, conservés en artifact pour diagnostic.

## Seuil bloquant DAST

ZAP est configuré en mode rapport afin de rendre les alertes visibles sans bloquer la PR sur des findings passifs ou de durcissement HTTP.

Nuclei est configuré avec :

```bash
-severity high,critical -exit-code
```

Conséquences :

- les findings ZAP sont visibles et traitables comme durcissement de sécurité ;
- les findings Nuclei `high` et `critical` bloquent la PR sur le frontend ou l'API ;
- les résultats Nuclei sont visibles dans GitHub Code Scanning.
