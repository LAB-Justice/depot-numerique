---
layout: home

hero:
  name: "Dépôt Numérique"
  text: "Documentation technique"
  tagline: "Application de dépôt automatisé de documents métier : analyse de conformité, correction, mise en queue et dépôt automatisé."
  actions:
    - theme: brand
      text: Démarrer en local
      link: /development

features:
  - title: Monorepo maîtrisé
    details: Socle pnpm et Turbo avec applications NestJS, Angular et documentation VitePress.
  - title: Services techniques locaux
    details: PostgreSQL, Redis et MinIO sont lancés avec Docker Compose pour le développement.
  - title: Qualité de code
    details: Biome, Knip et Lefthook structurent le formatage, le lint, les hooks Git et la détection de code mort.
---

## Vue D'ensemble

Dépôt Numérique vise à remplacer un dépôt manuel de documents métier par un parcours automatisé, traçable et fiable.

Le cycle cible est le suivant : un agent dépose un document depuis l'interface web, l'API stocke le fichier, le système analyse sa conformité, corrige le document si nécessaire, puis déclenche un dépôt automatisé sur une plateforme interne via Playwright.

## Stack

- Monorepo : `Turbo`
- Gestionnaire de paquets : `pnpm`
- Backend : `NestJS`
- Frontend : `Angular`
- Documentation projet : `VitePress`
- Base de données : `PostgreSQL`
- ORM : `Prisma`
- Queue et cache : `BullMQ`, `Redis`
- Stockage fichiers : `MinIO`
- Automatisation web : `Playwright`
- Documentation API : `Swagger / OpenAPI`
- Conteneurisation : `Docker`, `Docker Compose`
- Qualité de code : `Biome`, `Knip`, `Lefthook`
- CI/CD : `GitHub Actions`
- Déploiement documentation : `GitHub Pages`
- Secrets : `Vault`
- Supervision : `Prometheus`, `Grafana`

## Documentation disponible

- [Développement local](/development)
