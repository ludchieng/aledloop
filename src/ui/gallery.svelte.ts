/** Bibliothèque d'exemples : ouverte depuis la barre du haut ou la page blanche. */
class Gallery {
  open = $state(false);

  show() {
    this.open = true;
  }

  close() {
    this.open = false;
  }
}

export const gallery = new Gallery();
