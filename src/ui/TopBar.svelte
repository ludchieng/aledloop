<script lang="ts">
  import { i18n } from '../i18n/i18n.svelte';
  import { editor } from '../model/editor.svelte';
  import { parseDoc } from '../model/persist';
  import Icon from './Icon.svelte';
  import { prefs } from './prefs.svelte';
  import { toasts } from './notify.svelte';
  import { router } from './router.svelte';

  const t = $derived(i18n.t);

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
      toasts.show(t.topbar.opened(file.name));
    } catch (err) {
      toasts.show(err instanceof SyntaxError ? t.topbar.invalidJson : t.topbar.notAModel);
    }
  }

  async function share() {
    const url = await router.shareUrl();
    try {
      await navigator.clipboard.writeText(url);
      toasts.show(url.includes('#m=') ? t.topbar.linkCopied : t.topbar.exampleLinkCopied);
    } catch {
      window.prompt(t.topbar.copyPrompt, url);
    }
  }
</script>

<header class="topbar">
  <!-- À gauche, le logiciel et le projet : la bibliothèque d'exemples, puis le fichier en cours. -->
  <nav class="main card" aria-label={t.topbar.project}>
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
    <button class="btn" onclick={() => router.showGallery()} title={t.topbar.examplesTitle}>
      <Icon name="book" size={19} /><span class="label">{t.topbar.examples}</span>
    </button>
    <span class="sep"></span>
    <button class="btn" onclick={() => router.newDoc()} title={t.topbar.newTitle}><Icon name="file" size={19} /><span class="label">{t.topbar.new}</span></button>
    <button class="btn" onclick={() => fileInput.click()} title={t.topbar.openTitle}><Icon name="folder" size={19} /><span class="label">{t.topbar.open}</span></button>
    <button class="btn" onclick={save} title={t.topbar.saveTitle}><Icon name="save" size={19} /><span class="label">{t.topbar.save}</span></button>
    <button class="btn" onclick={share} title={t.topbar.shareTitle}><Icon name="link" size={19} /><span class="label">{t.topbar.share}</span></button>
  </nav>

  <!-- À droite, l'application : l'aide, la langue et le thème. -->
  <nav class="app card" aria-label={t.topbar.application}>
    <button class="btn" onclick={() => router.showHelp()} title={t.topbar.helpTitle}>
      <Icon name="help" size={19} /><span class="label">{t.topbar.help}</span>
    </button>
    <!-- Le bouton montre l'autre langue, écrite dans cette langue : « English » sur l'interface en français. -->
    <button class="btn lang" onclick={() => i18n.toggle()} title={t.topbar.otherLangTitle} lang={i18n.lang === 'fr' ? 'en' : 'fr'}>
      <Icon name="globe" size={19} /><span class="label">{t.topbar.otherLang}</span><span class="short">{t.topbar.otherLangShort}</span>
    </button>
    <button
      class="btn"
      onclick={() => prefs.toggleTheme()}
      title={prefs.theme === 'papier' ? t.topbar.darkTheme : t.topbar.lightTheme}
      aria-label={t.topbar.themeAria}
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

  /* Sur écran étroit, la langue garde un code court (« EN ») : une icône seule ne dirait pas laquelle. */
  .short {
    display: none;
    font-weight: 800;
    font-size: 13px;
  }

  @media (max-width: 960px) {
    .label {
      display: none;
    }
    .short {
      display: inline;
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
