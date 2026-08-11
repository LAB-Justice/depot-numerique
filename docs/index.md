---
layout: home

hero:
  name: "Dépôt Numérique"
  text: "Documentation technique"
  tagline: "Application de dépôt automatisé de documents métier : analyse de conformité, correction, mise en queue et dépôt automatisé."
  actions:
    - theme: brand
      text: Démarrer en local
      link: /getting-started/development

features:
  - title: Monorepo maîtrisé
    details: Socle pnpm et Turbo avec API NestJS, frontend Angular, worker BullMQ, package Prisma et documentation VitePress.
  - title: Services techniques locaux
    details: PostgreSQL, Redis, MinIO et le simulateur SSO SAML Keycloak/OpenLDAP sont lancés avec Docker Compose ; Traefik expose la stack applicative en HTTPS.
  - title: Qualité de code
    details: Biome, Knip et Lefthook structurent le formatage, le lint, les hooks Git et la détection de code mort.
---

## Vue d'ensemble

Dépôt Numérique vise à remplacer un dépôt manuel de documents métier par un parcours automatisé, traçable et fiable.

Le cycle cible est le suivant : un agent dépose un document depuis l'interface web, l'API stocke le fichier, le système analyse sa conformité, corrige le document si nécessaire, puis déclenche un dépôt automatisé sur une plateforme interne via Playwright.

L'état actuel correspond au socle : authentification SSO SAML, profils et structures, modèle
documentaire Prisma, contrôles techniques, conteneurs API/web et worker BullMQ de démonstration. Les
écrans métier, les routes de dépôt, la correction et l'automatisation Playwright restent à réaliser.

## Stack actuelle et cible

- Monorepo : `Turbo`
- Gestionnaire de paquets : `pnpm`
- Backend : `NestJS`
- Frontend : `Angular`
- Documentation projet : `VitePress`
- Base de données : `PostgreSQL`
- ORM : `Prisma`
- Authentification et sessions : `Better Auth`
- Queue et cache : `BullMQ`, `Redis`
- Stockage fichiers : `MinIO`
- SSO local : `Keycloak`, `OpenLDAP`, `phpLDAPadmin`
- Automatisation web cible : `Playwright` — non intégrée à ce stade
- Documentation API : `Swagger / OpenAPI`
- Conteneurisation : `Docker`, `Docker Compose`
- Qualité de code : `Biome`, `Knip`, `Lefthook`, `Commitlint`
- CI/CD : `GitHub Actions`
- Déploiement documentation : `GitHub Pages`
- Secrets cible : `Vault` — non intégré à ce stade
- Supervision cible : `Prometheus`, `Grafana` — non intégrés à ce stade

## Documentation disponible

- [Architecture et état d'implémentation](/architecture/overview)
- [Développement local](/getting-started/development)
- [Infrastructure Docker et HTTPS](/infrastructure/local-stack)
- [API NestJS](/applications/api)
- [Frontend Angular](/applications/frontend)
- [Workers BullMQ](/applications/worker)
- [Base de données et migrations](/data/database)
- [SSO SAML local](/authentication/local-sso)
- [Comprendre et raccorder le SSO SAML](/authentication/saml)
- [Sécurité](/operations/security)
- [Exploitation](/operations/runbook)
- [Rétention et purge](/operations/retention)
- [Automatisation Playwright cible](/processing/playwright)
