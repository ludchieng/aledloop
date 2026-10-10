<script lang="ts">
  import { editor } from '../model/editor.svelte';
  import { EXAMPLES } from '../model/examples';
  import { encodeDoc, parseDoc } from '../model/persist';
  import { emptyDoc, type Doc } from '../model/types';
  import { sim } from '../sim/session.svelte';
  import Icon from './Icon.svelte';
  import { prefs } from './prefs.svelte';
  import { toasts } from './notify.svelte';

  let { onloaded }: { onloaded: () => void } = $props();

  let fileInput: HTMLInputElement;
  let examplesOpen = $state(false);

  /** Remplace le document en restant annulable, avec un toast « Annuler ». */
  function replaceDoc(doc: Doc, message: string) {
    if (editor.mode === 'sim') sim.stop();
    editor.load(doc);
    onloaded();
    toasts.show(message, { label: 'Annuler', run: () => { editor.undo(); onloaded(); } });
  }

  function newDoc() {
    if (editor.doc.nodes.length === 0) return;
    replaceDoc(emptyDoc(), 'Nouveau diagramme.');
  }

  function save() {
    const blob = new Blob([JSON.stringify(editor.doc, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aledloop-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function open(e: Event & { currentTarget: HTMLInputElement }) {
    const file = e.currentTarget.files?.[0];
    e.currentTarget.value = '';
    if (!file) return;
    try {
      replaceDoc(parseDoc(JSON.parse(await file.text())), `« ${file.name} » ouvert.`);
    } catch (err) {
      toasts.show(err instanceof SyntaxError ? 'Ce fichier n’est pas du JSON valide.' : (err as Error).message);
    }
  }

  async function share() {
    const url = `${location.origin}${location.pathname}#m=${await encodeDoc(editor.doc)}`;
    try {
      await navigator.clipboard.writeText(url);
      toasts.show('Lien copié : il contient tout le diagramme.');
    } catch {
      window.prompt('Copie ce lien pour partager ton diagramme :', url);
    }
  }

  function loadExample(id: string) {
    const ex = EXAMPLES.find((x) => x.id === id);
    examplesOpen = false;
    if (ex) replaceDoc(ex.build(), `Exemple « ${ex.title} » chargé.`);
  }
</script>

<svelte:window onpointerdown={(e) => examplesOpen && !(e.target as Element).closest?.('.examples') && (examplesOpen = false)} />

<header class="topbar">
  <div class="brand card">
    <svg class="logo" viewBox="0 0 64 64" width="30" height="30" aria-hidden="true">
      <circle cx="22" cy="36" r="13" fill="var(--terracotta)" stroke="var(--terracotta-stroke)" stroke-width="3.5" />
      <circle cx="44" cy="26" r="11" fill="var(--sage)" stroke="var(--sage-stroke)" stroke-width="3.5" />
      <path d="M28 21 Q34 11 40 14" fill="none" stroke="var(--ink-soft)" stroke-width="3.5" stroke-linecap="round" />
      <path d="M38 41 Q32 52 25 50" fill="none" stroke="var(--ink-soft)" stroke-width="3.5" stroke-linecap="round" />
    </svg>
    <h1>aledloop</h1>
  </div>

  <nav class="actions card" aria-label="Fichier">
    <div class="examples">
      <button class="btn" aria-expanded={examplesOpen} onclick={() => (examplesOpen = !examplesOpen)} title="Diagrammes d’exemple">
        <Icon name="book" size={19} /><span class="label">Exemples</span>
      </button>
      {#if examplesOpen}
        <ul class="menu card">
          {#each EXAMPLES as ex (ex.id)}
            <li>
              <button onclick={() => loadExample(ex.id)}>
                <strong>{ex.title}</strong>
                <span>{ex.description}</span>
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
    <span class="sep"></span>
    <button class="btn" onclick={newDoc} title="Nouveau diagramme"><Icon name="file" size={19} /><span class="label">Nouveau</span></button>
    <button class="btn" onclick={() => fileInput.click()} title="Ouvrir un fichier .json"><Icon name="folder" size={19} /><span class="label">Ouvrir</span></button>
    <button class="btn" onclick={save} title="Enregistrer en .json"><Icon name="save" size={19} /><span class="label">Enregistrer</span></button>
    <button class="btn" onclick={share} title="Copier un lien de partage"><Icon name="link" size={19} /><span class="label">Partager</span></button>
    <span class="sep"></span>
    <button
      class="btn"
      onclick={() => prefs.toggleTheme()}
      title={prefs.theme === 'papier' ? 'Thème veillée (sombre)' : 'Thème papier (clair)'}
      aria-label="Changer de thème"
    >
      <Icon name={prefs.theme === 'papier' ? 'moon' : 'sun'} size={19} />
    </button>
  </nav>
  <input bind:this={fileInput} type="file" accept=".json,application/json" hidden onchange={open} />
</header>

<style>
  .topbar {
    position: absolute;
    top: max(12px, env(safe-area-inset-top));
    left: 12px;
    right: 12px;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 8px;
    z-index: 11;
    pointer-events: none;
  }

  .topbar > * {
    pointer-events: auto;
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 16px 6px 10px;
    border-radius: 16px;
  }

  h1 {
    margin: 0;
    font-family: var(--font-title);
    font-weight: 600;
    font-size: 22px;
    letter-spacing: -0.01em;
  }

  .actions {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 4px;
    border-radius: 16px;
  }

  .examples {
    position: relative;
  }

  .menu {
    position: absolute;
    top: calc(100% + 10px);
    left: 0;
    width: min(320px, calc(100vw - 24px));
    margin: 0;
    padding: 6px;
    list-style: none;
  }

  .menu button {
    display: flex;
    flex-direction: column;
    gap: 2px;
    width: 100%;
    padding: 10px 12px;
    border: none;
    border-radius: 12px;
    background: transparent;
    text-align: left;
    cursor: pointer;
  }

  .menu button:hover {
    background: color-mix(in srgb, var(--paper-deep) 55%, transparent);
  }

  .menu span {
    font-size: 13px;
    color: var(--ink-soft);
    line-height: 1.35;
  }

  @media (max-width: 860px) {
    .label {
      display: none;
    }
  }

  @media (max-width: 520px) {
    h1 {
      display: none;
    }
    .brand {
      padding: 6px;
    }
    .menu {
      position: fixed;
      top: calc(max(12px, env(safe-area-inset-top)) + 58px);
      left: 12px;
      right: 12px;
      width: auto;
    }
  }
</style>
