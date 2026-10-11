import { findLoops } from '../model/loops';
import type { Doc } from '../model/types';
import type { Lang } from '../i18n/lang';
import type { Theme } from '../theme';
import { Camera } from './camera';
import { docBounds, loopLabels } from './geometry';
import { render } from './render';

/**
 * Miniature d'un diagramme, pour la bibliothèque d'exemples : le vrai rendu, sans les étiquettes
 * (illisibles à cette taille), cadré dans le canvas.
 */
export function drawThumbnail(canvas: HTMLCanvasElement, doc: Doc, theme: Theme, lang: Lang) {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx || !width || !height) return;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  const bare: Doc = { ...doc, nodes: doc.nodes.map((n) => ({ ...n, label: '' })) };
  const camera = new Camera();
  camera.fit(docBounds(bare), width, height, { top: 12, right: 12, bottom: 12, left: 12 });
  render({ ctx, width, height, dpr, camera, theme, lang }, bare, {
    selection: null,
    hover: null,
    linkTarget: null,
    trail: null,
    ghost: null,
    erasing: new Set(),
    pulseHover: null,
    loopLabels: loopLabels(bare, findLoops(bare)),
    focus: null,
    focusLoop: null,
    hidden: null,
    fade: null,
    sim: null,
    phases: null,
    packets: null,
  });
}
