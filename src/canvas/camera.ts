import type { Pt } from './geometry';

export const MIN_ZOOM = 0.2;
export const MAX_ZOOM = 4;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Caméra 2D : écran = monde × zoom + décalage. Coordonnées écran en pixels CSS. */
export class Camera {
  x = 0;
  y = 0;
  zoom = 1;

  toScreen(p: Pt): Pt {
    return { x: p.x * this.zoom + this.x, y: p.y * this.zoom + this.y };
  }

  toWorld(p: Pt): Pt {
    return { x: (p.x - this.x) / this.zoom, y: (p.y - this.y) / this.zoom };
  }

  panBy(dx: number, dy: number) {
    this.x += dx;
    this.y += dy;
  }

  /** Zoome d'un facteur en gardant le point écran `p` immobile sous le doigt ou la souris. */
  zoomAt(p: Pt, factor: number) {
    const world = this.toWorld(p);
    this.zoom = clamp(this.zoom * factor, MIN_ZOOM, MAX_ZOOM);
    this.x = p.x - world.x * this.zoom;
    this.y = p.y - world.y * this.zoom;
  }

  /** Cadre une boîte du monde dans une vue de taille w × h, avec une marge en pixels. */
  fit(box: { minX: number; minY: number; maxX: number; maxY: number } | null, w: number, h: number, maxMargin = 80) {
    const margin = Math.min(maxMargin, Math.min(w, h) * 0.1);
    if (!box) {
      this.zoom = 1;
      this.x = w / 2;
      this.y = h / 2;
      return;
    }
    const bw = Math.max(box.maxX - box.minX, 1);
    const bh = Math.max(box.maxY - box.minY, 1);
    this.zoom = clamp(Math.min((w - 2 * margin) / bw, (h - 2 * margin) / bh), MIN_ZOOM, 1.5);
    this.x = w / 2 - ((box.minX + box.maxX) / 2) * this.zoom;
    this.y = h / 2 - ((box.minY + box.maxY) / 2) * this.zoom;
  }
}
