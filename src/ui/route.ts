/**
 * Les adresses de l'application, écrites après la base du site (« /aledloop/ » sur GitHub Pages) :
 *
 *   (rien)              mon diagramme, celui qu'on dessine, enregistré dans le navigateur
 *   #m=…                un diagramme contenu dans l'adresse (lien partagé, fichier ouvert)
 *   exemples            la bibliothèque d'exemples
 *   exemples/albedo     un exemple
 *   …/recit             le récit de ce diagramme, présenté pas à pas : recit, exemples/albedo/recit, recit#m=…
 *   aide, aide#6.2      l'aide, éventuellement à une section (comme une ancre dans une page)
 *
 * Le diagramme partagé reste dans le hash (#) : le navigateur ne l'envoie jamais au serveur, donc pas de
 * limite de longueur côté GitHub (« 414 URI Too Long ») ; et les liens partagés avant le routage marchent toujours.
 */

/** Quel diagramme montrer. */
export type DocRef = { kind: 'local' } | { kind: 'example'; id: string } | { kind: 'shared'; data: string };

/** Une page qui montre un diagramme, en train d'en présenter le récit ou non. */
export interface DocRoute {
  page: 'doc';
  doc: DocRef;
  story: boolean;
}

export type Route = DocRoute | { page: 'gallery' } | { page: 'help'; section: string | null };

export const LOCAL: DocRef = { kind: 'local' };
export const HOME: DocRoute = { page: 'doc', doc: LOCAL, story: false };

const STORY = 'recit';

function decode(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/** Lit une adresse relative à la base (« exemples/albedo », « recit#m=… »). Une adresse inconnue mène à mon diagramme. */
export function parseRoute(href: string): Route {
  const hashAt = href.indexOf('#');
  const hash = hashAt < 0 ? '' : href.slice(hashAt);
  const path = (hashAt < 0 ? href : href.slice(0, hashAt)).split('?')[0];
  const parts = path.split('/').filter(Boolean).map(decode);
  const story = parts.at(-1) === STORY;
  if (story) parts.pop();
  const [first, second, ...rest] = parts;

  if (first === undefined) {
    const shared = hash.match(/^#m=([\w-]+)/);
    return { page: 'doc', doc: shared ? { kind: 'shared', data: shared[1] } : LOCAL, story };
  }
  if (first === 'exemples' && second !== undefined && rest.length === 0) {
    return { page: 'doc', doc: { kind: 'example', id: second }, story };
  }
  if (!story && first === 'exemples' && second === undefined) return { page: 'gallery' };
  if (!story && first === 'aide' && second === undefined) return { page: 'help', section: hash.slice(1) || null };
  return HOME;
}

/** L'inverse de `parseRoute`. */
export function formatRoute(route: Route): string {
  switch (route.page) {
    case 'gallery':
      return 'exemples';
    case 'help':
      return route.section ? `aide#${route.section}` : 'aide';
    case 'doc': {
      const { doc, story } = route;
      if (doc.kind === 'example') return `exemples/${encodeURIComponent(doc.id)}${story ? '/' + STORY : ''}`;
      return (story ? STORY : '') + (doc.kind === 'shared' ? `#m=${doc.data}` : '');
    }
  }
}

export function sameDoc(a: DocRef, b: DocRef): boolean {
  if (a.kind === 'example' && b.kind === 'example') return a.id === b.id;
  if (a.kind === 'shared' && b.kind === 'shared') return a.data === b.data;
  return a.kind === b.kind;
}

/** Une clé courte par diagramme, pour ranger ses modifications (« local », « ex:albedo », « m:k3x9… »). */
export function docKey(doc: DocRef): string {
  switch (doc.kind) {
    case 'local':
      return 'local';
    case 'example':
      return `ex:${doc.id}`;
    case 'shared':
      return `m:${hash(doc.data)}`;
  }
}

/** Empreinte sur 53 bits (cyrb53) : un diagramme partagé fait plusieurs kilo-octets, sa clé quelques caractères. */
function hash(text: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}
