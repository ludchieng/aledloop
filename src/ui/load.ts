import { editor } from '../model/editor.svelte';
import type { Doc } from '../model/types';
import { sim } from '../sim/session.svelte';
import { toasts } from './notify.svelte';

/** Remplace le document en restant annulable : on quitte la simulation, on recadre, et un toast propose « Annuler ». */
export function replaceDoc(doc: Doc, message: string | null, fit: () => void) {
  if (editor.simulating) sim.stop();
  editor.load(doc);
  fit();
  if (message) toasts.show(message, { label: 'Annuler', run: () => { editor.undo(); fit(); } });
}
