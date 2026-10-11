import { defineConfig, type Plugin } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

/**
 * Routage côté navigateur sur GitHub Pages : une adresse comme /aledloop/exemples/albedo n'existe pas
 * sur le serveur, qui renvoie alors sa page 404.html. On en fait une copie de index.html : l'application
 * démarre quand même et lit l'adresse.
 */
function spaFallback(): Plugin {
  return {
    name: 'spa-fallback-404',
    apply: 'build',
    // Après Vite, qui a déjà produit index.html dans le paquet.
    enforce: 'post',
    generateBundle(_, bundle) {
      const index = bundle['index.html'];
      if (index?.type !== 'asset') this.error('index.html introuvable : impossible de créer 404.html');
      this.emitFile({ type: 'asset', fileName: '404.html', source: index.source });
    },
  };
}

export default defineConfig({
  // Chemins absolus : avec le routage, la page peut être servie à /aledloop/exemples/albedo, et des chemins
  // relatifs chercheraient les fichiers au mauvais endroit. Le déploiement passe --base=/aledloop/.
  base: '/',
  plugins: [svelte(), spaFallback()],
  test: {
    include: ['src/**/*.test.ts'],
  },
});
