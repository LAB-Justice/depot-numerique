import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'Dépôt Numérique',
  description: 'Documentation technique du projet de dépôt automatisé de documents métier.',
  base: '/depot-numerique/',
  themeConfig: {
    nav: [
      { text: 'Accueil', link: '/' },
      { text: 'Architecture', link: '/architecture/overview' },
      { text: 'Développement', link: '/getting-started/development' },
      { text: 'Infrastructure', link: '/infrastructure/local-stack' },
      { text: 'SSO', link: '/authentication/local-sso' },
      { text: 'Sécurité', link: '/operations/security' },
    ],

    sidebar: [
      {
        text: 'Démarrage',
        items: [
          { text: 'Développement local', link: '/getting-started/development' },
          { text: 'Stack Docker locale', link: '/infrastructure/local-stack' },
        ],
      },
      {
        text: 'Architecture et composants',
        items: [
          { text: 'Vue d’ensemble', link: '/architecture/overview' },
          { text: 'API NestJS', link: '/applications/api' },
          { text: 'Frontend Angular', link: '/applications/frontend' },
          { text: 'Workers BullMQ', link: '/applications/worker' },
          { text: 'Base de données', link: '/data/database' },
        ],
      },
      {
        text: 'Authentification',
        items: [
          { text: 'Simulateur SSO local', link: '/authentication/local-sso' },
          { text: 'Contrat SSO SAML', link: '/authentication/saml' },
        ],
      },
      {
        text: 'Traitement des dépôts',
        items: [{ text: 'Automatisation Playwright', link: '/processing/playwright' }],
      },
      {
        text: 'Exploitation',
        items: [
          { text: 'Sécurité', link: '/operations/security' },
          { text: 'Runbook', link: '/operations/runbook' },
          { text: 'Rétention et purge', link: '/operations/retention' },
        ],
      },
    ],

    socialLinks: [
      {
        icon: 'github',
        link: 'https://github.com/LAB-Justice/depot-numerique',
      },
    ],
  },
});
