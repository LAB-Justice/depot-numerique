import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'Dépôt Numérique',
  description: 'Documentation technique du projet de dépôt automatisé de documents métier.',
  base: '/depot-numerique/',
  themeConfig: {
    nav: [
      { text: 'Accueil', link: '/' },
      { text: 'Développement', link: '/development' },
      { text: 'Base de données', link: '/database' },
    ],

    sidebar: [
      {
        text: 'Projet',
        items: [
          { text: 'Développement', link: '/development' },
          { text: 'Base de données', link: '/database' },
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
