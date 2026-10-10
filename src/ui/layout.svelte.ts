/** Mise en page « téléphone » : les panneaux passent en bas de l'écran (même seuil que le CSS). */
const query = typeof window !== 'undefined' ? window.matchMedia('(max-width: 700px)') : null;

class Layout {
  narrow = $state(query?.matches ?? false);

  constructor() {
    query?.addEventListener('change', (e) => (this.narrow = e.matches));
  }
}

export const layout = new Layout();
