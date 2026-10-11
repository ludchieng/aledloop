<script lang="ts">
  import { editor } from '../model/editor.svelte';
  import { parseDoc } from '../model/persist';
  import Icon from './Icon.svelte';
  import { prefs } from './prefs.svelte';
  import { toasts } from './notify.svelte';
  import { router } from './router.svelte';

  let fileInput: HTMLInputElement;

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
      await router.openFile(parseDoc(JSON.parse(await file.text())));
      toasts.show(`« ${file.name} » ouvert.`);
    } catch (err) {
      toasts.show(err instanceof SyntaxError ? 'Ce fichier n’est pas du JSON valide.' : (err as Error).message);
    }
  }

  async function share() {
    const url = await router.shareUrl();
    try {
      await navigator.clipboard.writeText(url);
      toasts.show(url.includes('#m=') ? 'Lien copié : il contient tout le diagramme.' : 'Lien vers cet exemple copié.');
    } catch {
      window.prompt('Copie ce lien pour partager ton diagramme :', url);
    }
  }
</script>

<header class="topbar">
  <!-- À gauche, le logiciel et le projet : la bibliothèque d'exemples, puis le fichier en cours. -->
  <nav class="main card" aria-label="Projet">
    <div class="brand">
      <svg class="logo" viewBox="0 0 64 64" width="30" height="30" aria-hidden="true">
        <circle cx="22" cy="36" r="13" fill="var(--terracotta)" stroke="var(--terracotta-stroke)" stroke-width="3.5" />
        <circle cx="44" cy="26" r="11" fill="var(--sage)" stroke="var(--sage-stroke)" stroke-width="3.5" />
        <path d="M28 21 Q34 11 40 14" fill="none" stroke="var(--ink-soft)" stroke-width="3.5" stroke-linecap="round" />
        <path d="M38 41 Q32 52 25 50" fill="none" stroke="var(--ink-soft)" stroke-width="3.5" stroke-linecap="round" />
      </svg>
      <h1>aledloop</h1>
    </div>
    <span class="sep"></span>
    <button class="btn" onclick={() => router.showGallery()} title="Bibliothèque d’exemples">
      <Icon name="book" size={19} /><span class="label">Exemples</span>
    </button>
    <span class="sep"></span>
    <button class="btn" onclick={() => router.newDoc()} title="Nouveau diagramme"><Icon name="file" size={19} /><span class="label">Nouveau</span></button>
    <button class="btn" onclick={() => fileInput.click()} title="Ouvrir un fichier .json"><Icon name="folder" size={19} /><span class="label">Ouvrir</span></button>
    <button class="btn" onclick={save} title="Enregistrer en .json"><Icon name="save" size={19} /><span class="label">Enregistrer</span></button>
    <button class="btn" onclick={share} title="Copier un lien de partage"><Icon name="link" size={19} /><span class="label">Partager</span></button>
  </nav>

  <!-- À droite, l'application : l'aide et le thème. -->
  <nav class="app card" aria-label="Application">
    <button class="btn" onclick={() => router.showHelp()} title="Comment ça marche : la simulation expliquée">
      <Icon name="help" size={19} /><span class="label">Aide</span>
    </button>
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

  .main,
  .app {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 4px;
    border-radius: 16px;
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 8px 0 6px;
  }

  h1 {
    margin: 0;
    font-family: var(--font-title);
    font-weight: 600;
    font-size: 22px;
    letter-spacing: -0.01em;
  }

  @media (max-width: 960px) {
    .label {
      display: none;
    }
  }

  @media (max-width: 620px) {
    h1 {
      display: none;
    }
    .brand {
      padding: 0 4px;
    }
  }

  /* Très petit écran : le logo laisse sa place aux boutons. */
  @media (max-width: 430px) {
    .brand,
    .brand + .sep {
      display: none;
    }
  }
</style>
