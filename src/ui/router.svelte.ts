import { i18n } from '../i18n/i18n.svelte';
import { editor } from '../model/editor.svelte';
import { buildExample, EXAMPLES, exampleText } from '../model/examples';
import { decodeDoc, draftKeys, encodeDoc, loadDraft, loadLocal, removeDraft, saveDraft, saveLocal } from '../model/persist';
import { emptyDoc, type Doc } from '../model/types';
import { sim } from '../sim/session.svelte';
import { toasts } from './notify.svelte';
import { docKey, formatRoute, HOME, parseRoute, sameDoc, type DocRef, type DocRoute, type Route } from './route';
import { presenter, storyUi } from './story.svelte';

/** La base du site : « / » en développement, « /aledloop/ » sur GitHub Pages (option --base du build). */
const BASE = import.meta.env.BASE_URL;

/** Ce que l'application range dans chaque entrée de l'historique du navigateur. Ça survit au rechargement. */
interface Entry {
  /** L'adresse d'où l'application a ouvert cette entrée : pour la refermer, on y revient par un « retour ». */
  back?: string;
  /** Sous la bibliothèque ou l'aide : la page de diagramme qu'elles recouvrent. */
  under?: string;
}

/** L'adresse courante, relative à la base (« exemples/albedo », « #m=… »). */
function currentHref(): string {
  const path = location.pathname.startsWith(BASE) ? location.pathname.slice(BASE.length) : '';
  return path + location.hash;
}

function currentEntry(): Entry {
  const state: unknown = history.state;
  return typeof state === 'object' && state !== null ? (state as Entry) : {};
}

const exampleById = (id: string) => EXAMPLES.find((ex) => ex.id === id);

/**
 * Routage côté navigateur (History API) : chaque page a son adresse, et les boutons précédent / suivant
 * naviguent dans l'application. Modifier un diagramme ne change pas l'adresse : ses modifications sont
 * enregistrées sous sa clé (un brouillon), et on les retrouve en y revenant.
 *
 * Sur GitHub Pages, une adresse comme /aledloop/exemples/albedo n'existe pas sur le serveur : il renvoie
 * sa page 404.html, qui est une copie de index.html (voir vite.config.ts). L'application démarre et lit l'adresse.
 */
class Router {
  /** La page affichée. */
  route = $state.raw<Route>(HOME);
  /** Un diagramme partagé est en cours de décompression. */
  loading = $state(false);

  /** La page de diagramme affichée, ou recouverte par la bibliothèque ou l'aide. */
  private view: DocRoute = HOME;
  /** Le diagramme dans l'éditeur (null avant le premier chargement). */
  private doc: DocRef | null = null;
  /** Ce diagramme tel qu'on l'a ouvert, en JSON (sauf mon diagramme) : pour savoir s'il a été modifié. */
  private original = '';
  /** Chaque chargement a son numéro : un chargement plus récent rend caduc celui, asynchrone, d'un partage. */
  private token = 0;
  private fit = () => {};

  get galleryOpen() {
    return this.route.page === 'gallery';
  }

  get helpOpen() {
    return this.route.page === 'help';
  }

  /** Section de l'aide à afficher (« 6.2 »), sinon le début. */
  get helpSection() {
    return this.route.page === 'help' ? this.route.section : null;
  }

  /** Au démarrage : charge ce que désigne l'adresse, puis suit les retours en arrière. */
  start(fit: () => void) {
    this.fit = fit;
    const route = parseRoute(currentHref());
    history.replaceState(currentEntry(), '', BASE + formatRoute(route)); // adresse sous sa forme canonique
    this.apply(route, currentEntry());
    window.addEventListener('popstate', () => this.apply(parseRoute(currentHref()), currentEntry()));
    // Onglet fermé juste après une modification : la sauvegarde regroupée n'aurait pas eu lieu.
    window.addEventListener('pagehide', () => this.save());
  }

  // --- Navigation ---------------------------------------------------------------

  showGallery() {
    this.navigate({ page: 'gallery' });
  }

  showHelp(section: string | null = null) {
    this.navigate({ page: 'help', section });
  }

  /** Ouvre un exemple, ou présente directement son récit. */
  openExample(id: string, story = false) {
    // L'exemple déjà ouvert : on referme simplement la bibliothèque, sans empiler une page de plus.
    if (!story && this.doc && sameDoc(this.doc, { kind: 'example', id })) this.close();
    else this.navigate({ page: 'doc', doc: { kind: 'example', id }, story });
  }

  /** Ouvre un fichier : comme un lien partagé, le diagramme voyage dans l'adresse (#m=…). */
  async openFile(doc: Doc) {
    const ref: DocRef = { kind: 'shared', data: await encodeDoc(doc) };
    // On veut le fichier tel qu'il est, pas les modifications d'une ouverture précédente.
    removeDraft(docKey(ref));
    if (this.doc && sameDoc(this.doc, ref)) this.revert();
    else this.navigate({ page: 'doc', doc: ref, story: false });
  }

  /** Nouveau diagramme : une page blanche à la place de mon diagramme (annulable). */
  newDoc() {
    if (this.route.page !== 'doc' || this.doc?.kind !== 'local') this.navigate(HOME);
    if (editor.doc.nodes.length === 0) return;
    this.backToEdit();
    editor.load(emptyDoc());
    this.fit();
    toasts.show(i18n.t.router.newDoc, { label: i18n.t.router.undo, run: () => this.undoLoad() });
  }

  /** Présente le récit à partir de l'étape `at`. Renvoie false s'il n'y a pas d'étape. */
  present(at = 0): boolean {
    if (!presenter.start(at)) return false;
    this.navigate({ ...this.view, story: true });
    return true;
  }

  /** Ferme la bibliothèque, l'aide ou la présentation : retour à la page du diagramme. */
  close() {
    const target: DocRoute = this.route.page === 'doc' ? { ...this.view, story: false } : this.view;
    const href = formatRoute(target);
    if (href === currentHref()) return;
    if (currentEntry().back === href) {
      // On revient d'où l'on vient : un « retour », pour ne pas empiler la page qu'on quitte
      // (sinon le bouton précédent la rouvrirait). L'interface suit tout de suite, sans attendre popstate.
      this.apply(target, {});
      history.back();
    } else {
      this.navigate(target, 'replace');
    }
  }

  /** L'adresse à partager : courte pour un exemple intact, sinon tout le diagramme dans l'adresse. */
  async shareUrl(): Promise<string> {
    const root = location.origin + BASE;
    if (this.doc?.kind === 'example' && !this.modified()) return root + formatRoute({ page: 'doc', doc: this.doc, story: false });
    return root + formatRoute({ page: 'doc', doc: { kind: 'shared', data: await encodeDoc(editor.doc) }, story: false });
  }

  /** Les exemples que l'on a modifiés (pour les signaler dans la bibliothèque). */
  editedExamples(): Set<string> {
    return new Set(draftKeys().flatMap((k) => (k.startsWith('ex:') ? [k.slice(3)] : [])));
  }

  /**
   * La langue a changé : un exemple intact la suit (étiquettes, récit), traduit sur place pour qu'une
   * simulation ou une présentation en cours continue. Un diagramme modifié, lui, reste tel qu'on l'a écrit.
   */
  relocalize() {
    this.updateTitle();
    const ref = this.doc;
    const example = ref?.kind === 'example' ? exampleById(ref.id) : undefined;
    if (!example || this.modified()) return;
    const fresh = buildExample(example, i18n.lang);
    const labels = new Map(fresh.nodes.map((n) => [n.id, n.label]));
    for (const n of editor.doc.nodes) n.label = labels.get(n.id) ?? n.label;
    editor.doc.story.steps.forEach((step, i) => (step.text = fresh.story.steps[i]?.text ?? step.text));
    this.original = JSON.stringify(editor.doc);
    editor.changed();
  }

  /** Enregistre le diagramme affiché : mon diagramme tel quel ; un exemple ou un partage, seulement s'il a été modifié. */
  save() {
    const ref = this.doc;
    if (!ref) return;
    if (ref.kind === 'local') saveLocal(editor.doc);
    else if (this.modified()) saveDraft(docKey(ref), editor.doc);
    else removeDraft(docKey(ref));
  }

  private modified(): boolean {
    return this.doc?.kind !== 'local' && JSON.stringify(editor.doc) !== this.original;
  }

  /** Va à une page : nouvelle entrée de l'historique (push) ou remplacement de l'entrée courante. */
  private navigate(route: Route, mode: 'push' | 'replace' = 'push') {
    this.save();
    const href = formatRoute(route);
    if (href === currentHref()) mode = 'replace';
    const entry: Entry = { back: mode === 'push' ? currentHref() : currentEntry().back };
    if (route.page !== 'doc') entry.under = formatRoute(this.view);
    if (mode === 'push') history.pushState(entry, '', BASE + href);
    else history.replaceState(entry, '', BASE + href);
    this.apply(route, entry);
  }

  // --- Application d'une adresse ----------------------------------------------------

  /** Met l'interface en accord avec `route` : appelé au démarrage, à chaque navigation et à chaque retour arrière. */
  private apply(route: Route, entry: Entry) {
    const view = route.page === 'doc' ? route : this.underneath(entry);
    this.route = route;
    this.view = view;
    this.updateTitle();
    if (this.doc && sameDoc(this.doc, view.doc)) this.syncStory();
    else this.load(view.doc);
  }

  /** La page de diagramme sous la bibliothèque ou l'aide. */
  private underneath(entry: Entry): DocRoute {
    const under = entry.under !== undefined ? parseRoute(entry.under) : null;
    if (under?.page === 'doc') return under;
    return this.doc ? this.view : HOME;
  }

  /** Présente le récit si l'adresse le demande, et seulement dans ce cas. */
  private syncStory() {
    const presenting = editor.mode === 'present';
    if (!this.view.story) {
      if (presenting) presenter.stop();
    } else if (!presenting && !presenter.start(0)) {
      toasts.show(i18n.t.router.noStory);
      this.view = { ...this.view, story: false };
      if (this.route.page === 'doc') this.navigate(this.view, 'replace');
    }
  }

  private load(ref: DocRef) {
    this.save(); // le diagramme qu'on quitte garde ses dernières modifications
    const token = ++this.token;
    this.loading = ref.kind === 'shared';
    if (ref.kind === 'local') {
      this.show(ref, loadLocal() ?? emptyDoc());
    } else if (ref.kind === 'example') {
      const example = exampleById(ref.id);
      if (example) {
        this.show(ref, buildExample(example, i18n.lang));
      } else {
        toasts.show(i18n.t.router.unknownExample);
        this.view = HOME;
        this.navigate({ page: 'gallery' }, 'replace');
      }
    } else {
      decodeDoc(ref.data).then(
        (doc) => {
          if (token === this.token) this.show(ref, doc);
        },
        () => {
          if (token !== this.token) return;
          this.loading = false;
          toasts.show(i18n.t.router.brokenLink);
          this.navigate(HOME, 'replace');
        },
      );
    }
  }

  /** Met `original` dans l'éditeur, ou ses modifications si on en a gardé. */
  private show(ref: DocRef, original: Doc) {
    const landing = this.doc === null;
    const draft = ref.kind === 'local' ? null : loadDraft(docKey(ref));
    if (editor.mode === 'present') presenter.stop();
    else if (editor.simulating) sim.stop();
    storyUi.picking = false;
    storyUi.active = null;
    this.loading = false;
    this.doc = ref;
    this.original = ref.kind === 'local' ? '' : JSON.stringify(original);
    editor.open(draft ?? original);
    this.fit();
    this.syncStory();

    const t = i18n.t.router;
    if (draft) {
      toasts.show(t.draftRestored, { label: t.backToOriginal, run: () => this.revert() }, 8000);
    } else if (landing && ref.kind === 'shared' && !this.view.story) {
      // Arrivée par un lien partagé.
      if (editor.doc.story.steps.length > 0) {
        toasts.show(t.sharedWithStory, { label: t.presentIt, run: () => this.present() }, 10000);
      } else {
        toasts.show(t.sharedOpened, { label: t.backToMine, run: () => this.navigate(HOME) }, 8000);
      }
    }
  }

  /** Un exemple ou un partage modifié revient à l'original (annulable : Ctrl+Z rend les modifications). */
  private revert() {
    if (!this.original) return;
    this.backToEdit();
    editor.load(JSON.parse(this.original));
    this.fit();
    toasts.show(i18n.t.router.reverted, { label: i18n.t.router.undo, run: () => this.undoLoad() });
  }

  private undoLoad() {
    this.backToEdit();
    editor.undo();
    this.fit();
  }

  /** Avant de remplacer le document sous les yeux : on quitte la simulation, ou le récit (et son adresse). */
  private backToEdit() {
    if (editor.mode === 'present') this.close();
    else if (editor.simulating) sim.stop();
  }

  /** Le titre de l'onglet, que l'on voit aussi dans l'historique (appui long sur le bouton précédent). */
  private updateTitle() {
    const route = this.route;
    const t = i18n.t.router;
    let name: string | null;
    if (route.page === 'gallery') name = t.titleGallery;
    else if (route.page === 'help') name = t.titleHelp;
    else {
      const doc = route.doc;
      const example = doc.kind === 'example' ? exampleById(doc.id) : undefined;
      name = example ? exampleText(example, i18n.lang).title : doc.kind === 'shared' ? t.titleShared : null;
      if (route.story) name = `${t.titleStory}${name ? ' · ' + name : ''}`;
    }
    document.title = name ? `${name} · aledloop` : 'aledloop';
  }
}

export const router = new Router();
