import { COLOR_KEYS, type ColorKey } from '../theme';
import {
  MAX_RADIUS,
  MIN_RADIUS,
  NODE_RADIUS,
  WEIGHTS,
  type CausalProps,
  type Doc,
  type SysEdge,
  emptyStory,
  type Story,
  type StoryStep,
  type SysNode,
  type Weight,
} from './types';

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const oneOf = <T>(v: unknown, allowed: readonly T[], fallback: T): T => (allowed.includes(v as T) ? (v as T) : fallback);

/** `legacyInit` : avant la phase 2, le niveau de départ était directement sur le nœud. */
function parseCausal(raw: unknown, legacyInit: unknown): CausalProps {
  const c = isObj(raw) ? raw : {};
  return {
    init: clamp(num(c.init, num(legacyInit, 0.5)), 0, 1),
    thresholdMode: oneOf(c.thresholdMode, ['none', 'tip', 'release'] as const, 'none'),
    threshold: clamp(num(c.threshold, 0.8), 0, 1),
    relax: oneOf(c.relax, [0, 1, 2] as const, 0),
    saturate: c.saturate === true,
  };
}

/**
 * Valide et nettoie un document venu de l'extérieur (fichier, URL, localStorage).
 * Lance une erreur si ce n'est pas un document aledloop ; sinon répare ce qui peut l'être
 * (valeurs manquantes, couleurs inconnues, liens orphelins ou en double).
 */
export function parseDoc(raw: unknown): Doc {
  if (!isObj(raw) || !Array.isArray(raw.nodes) || !Array.isArray(raw.edges)) {
    throw new Error('Ce fichier ne ressemble pas à un modèle aledloop.');
  }
  const nodes: SysNode[] = [];
  const ids = new Set<string>();
  for (const n of raw.nodes) {
    if (!isObj(n) || typeof n.id !== 'string' || ids.has(n.id)) continue;
    ids.add(n.id);
    nodes.push({
      id: n.id,
      x: num(n.x, 0),
      y: num(n.y, 0),
      r: clamp(num(n.r, NODE_RADIUS), MIN_RADIUS, MAX_RADIUS),
      label: typeof n.label === 'string' ? n.label.slice(0, 200) : '',
      color: COLOR_KEYS.includes(n.color as ColorKey) ? (n.color as ColorKey) : 'sand',
      causal: parseCausal(n.causal, n.init),
    });
  }
  const edges: SysEdge[] = [];
  const edgeIds = new Set<string>();
  const pairs = new Set<string>();
  for (const e of raw.edges) {
    if (!isObj(e) || typeof e.id !== 'string' || edgeIds.has(e.id)) continue;
    if (typeof e.from !== 'string' || typeof e.to !== 'string') continue;
    if (!ids.has(e.from) || !ids.has(e.to) || e.from === e.to) continue;
    const pair = e.from + '>' + e.to;
    if (pairs.has(pair)) continue;
    edgeIds.add(e.id);
    pairs.add(pair);
    edges.push({
      id: e.id,
      from: e.from,
      to: e.to,
      polarity: e.polarity === -1 ? -1 : 1,
      weight: oneOf<Weight>(e.weight, WEIGHTS, 1),
      delay: oneOf(e.delay, [0, 1, 2] as const, 0),
      bend: num(e.bend, 0),
    });
  }
  return { version: 1, nodes, edges, story: parseStory(raw.story, ids, edgeIds) };
}

/** Le récit ne garde que des références à des éléments qui existent. */
function parseStory(raw: unknown, nodeIds: Set<string>, edgeIds: Set<string>): Story {
  if (!isObj(raw) || !Array.isArray(raw.steps)) return emptyStory();
  const steps: StoryStep[] = [];
  const stepIds = new Set<string>();
  for (const st of raw.steps) {
    if (!isObj(st) || typeof st.id !== 'string' || stepIds.has(st.id)) continue;
    stepIds.add(st.id);
    const focus = Array.isArray(st.focus)
      ? [...new Set(st.focus.filter((id): id is string => typeof id === 'string' && (nodeIds.has(id) || edgeIds.has(id))))]
      : [];
    const pulse =
      isObj(st.pulse) && typeof st.pulse.node === 'string' && nodeIds.has(st.pulse.node)
        ? { node: st.pulse.node, delta: st.pulse.delta === -1 ? (-1 as const) : (1 as const) }
        : null;
    steps.push({ id: st.id, text: typeof st.text === 'string' ? st.text.slice(0, 2000) : '', focus, pulse });
  }
  return { steps, reveal: raw.reveal === true };
}

// --- localStorage --------------------------------------------------------

const STORAGE_KEY = 'aledloop:doc';

export function saveLocal(doc: Doc): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(doc));
  } catch {
    // Mode privé, quota plein… on ignore : la sauvegarde auto est un confort.
  }
}

export function loadLocal(): Doc | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? parseDoc(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

// --- Partage par URL : JSON → deflate-raw → base64url ---------------------

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function pipe(bytes: Uint8Array<ArrayBuffer>, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Blob([bytes]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

/** Arrondit les coordonnées pour raccourcir l'URL. */
function compactDoc(doc: Doc): Doc {
  const round = (v: number) => Math.round(v);
  const round2 = (v: number) => Math.round(v * 100) / 100;
  return {
    version: 1,
    nodes: doc.nodes.map((n) => ({
      ...n,
      x: round(n.x),
      y: round(n.y),
      r: round(n.r),
      causal: { ...n.causal, init: round2(n.causal.init), threshold: round2(n.causal.threshold) },
    })),
    edges: doc.edges.map((e) => ({ ...e, bend: round(e.bend) })),
    story: doc.story,
  };
}

export async function encodeDoc(doc: Doc): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(compactDoc(doc)));
  return toBase64Url(await pipe(json, new CompressionStream('deflate-raw')));
}

export async function decodeDoc(text: string): Promise<Doc> {
  const bytes = await pipe(fromBase64Url(text), new DecompressionStream('deflate-raw'));
  return parseDoc(JSON.parse(new TextDecoder().decode(bytes)));
}
