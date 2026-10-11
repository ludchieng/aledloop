import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  // Chemins relatifs : le site marche aussi bien à la racine qu'en sous-dossier (GitHub Pages sert sous /aledloop/).
  base: './',
  plugins: [svelte()],
  test: {
    include: ['src/**/*.test.ts'],
  },
});
