<script lang="ts">
  import { tick } from 'svelte';
  import { findSection } from './help';
  import Icon from './Icon.svelte';
  import { router } from './router.svelte';

  let html = $state<string | null>(null);
  let failed = $state(false);
  let body: HTMLDivElement | undefined = $state();
  let closeButton: HTMLButtonElement | undefined = $state();

  // Chargés à la première ouverture seulement : marked et la page.
  async function load() {
    const [{ renderMarkdown }, page] = await Promise.all([import('./doc'), import('../../docs/moteur.md?raw')]);
    html = renderMarkdown(page.default);
  }

  $effect(() => {
    if (router.helpOpen && html === null && !failed) load().catch(() => (failed = true));
  });

  // Une fois la page rendue, on va à la section demandée et on la fait briller un instant.
  $effect(() => {
    const section = router.helpSection;
    if (!router.helpOpen || !html || !body) return;
    const el = body;
    tick().then(() => {
      closeButton?.focus({ preventScroll: true });
      const target = section ? findSection(el.querySelectorAll('h2, h3'), section) : null;
      if (!target) {
        el.scrollTop = 0;
        return;
      }
      target.scrollIntoView({ block: 'start' });
      target.classList.remove('flash');
      void target.getBoundingClientRect(); // relance l'animation
      target.classList.add('flash');
    });
  });
</script>

{#if router.helpOpen}
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div class="backdrop" onclick={() => router.close()}></div>
  <div class="help card" role="dialog" aria-modal="true" aria-label="Comment ça marche">
    <button bind:this={closeButton} class="btn close" aria-label="Fermer" title="Fermer (Échap)" onclick={() => router.close()}>
      <Icon name="close" size={20} />
    </button>
    <div class="doc" bind:this={body}>
      {#if html}
        <!-- Contenu issu de docs/moteur.md (fichier du projet), pas de l'utilisateur. -->
        {@html html}
      {:else if failed}
        <p>Impossible de charger la documentation. Vérifie ta connexion et réessaie.</p>
      {:else}
        <p class="loading">Chargement…</p>
      {/if}
    </div>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 30;
    background: color-mix(in srgb, var(--ink) 22%, transparent);
    backdrop-filter: blur(2px);
    animation: appear 0.2s ease-out;
  }

  .help {
    position: fixed;
    top: max(20px, env(safe-area-inset-top));
    bottom: max(20px, env(safe-area-inset-bottom));
    left: 50%;
    width: min(780px, calc(100vw - 32px));
    transform: translateX(-50%);
    z-index: 31;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    animation: appear 0.25s ease-out;
  }

  .close {
    position: absolute;
    top: 12px;
    right: 12px;
    z-index: 1;
    min-width: 40px;
    min-height: 40px;
    color: var(--ink-soft);
    background: var(--card);
  }

  .doc {
    flex: 1;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 28px clamp(18px, 5vw, 52px) 48px;
    font-size: 16px;
    line-height: 1.6;
  }

  .loading {
    color: var(--ink-soft);
  }

  .doc :global(h1) {
    margin: 0 44px 14px 0;
    font-family: var(--font-title);
    font-weight: 600;
    font-size: 30px;
    line-height: 1.2;
  }

  .doc :global(h2) {
    margin: 34px 0 10px;
    font-family: var(--font-title);
    font-weight: 600;
    font-size: 23px;
    line-height: 1.25;
  }

  .doc :global(h3) {
    margin: 26px 0 8px;
    font-family: var(--font-title);
    font-weight: 600;
    font-size: 18.5px;
  }

  /* Une section atteinte par un lien s'arrête sous le bouton de fermeture, pas dessous. */
  .doc :global(h2),
  .doc :global(h3) {
    scroll-margin-top: 64px;
  }

  /* Section ouverte depuis un lien « Pourquoi ? » : un surlignage qui s'efface. */
  .doc :global(.flash) {
    border-radius: 8px;
    animation: help-flash 2s ease-out;
  }

  .doc :global(p),
  .doc :global(ul),
  .doc :global(ol) {
    margin: 0 0 12px;
  }

  .doc :global(li) {
    margin-bottom: 4px;
  }

  .doc :global(strong) {
    font-weight: 800;
  }

  .doc :global(hr) {
    margin: 30px 0;
    border: none;
    border-top: 1.5px dashed color-mix(in srgb, var(--ink) 18%, transparent);
  }

  .doc :global(table) {
    width: 100%;
    margin: 6px 0 18px;
    border-collapse: separate;
    border-spacing: 0;
    border-radius: 12px;
    overflow: hidden;
    background: color-mix(in srgb, var(--paper-deep) 35%, transparent);
    font-size: 14.5px;
  }

  .doc :global(th),
  .doc :global(td) {
    padding: 8px 12px;
    text-align: left;
    border-bottom: 1px solid color-mix(in srgb, var(--ink) 10%, transparent);
  }

  .doc :global(th) {
    font-size: 13px;
    font-weight: 800;
    color: var(--ink-soft);
  }

  .doc :global(tr:last-child td) {
    border-bottom: none;
  }

  /* Encadrés « pour aller plus loin » : une carte creusée dans la page. */
  .doc :global(blockquote) {
    margin: 18px 0;
    padding: 14px 18px;
    border-radius: 14px;
    background: color-mix(in srgb, var(--paper-deep) 45%, transparent);
    box-shadow: inset 0 1px 3px var(--shadow);
    font-size: 15px;
  }

  .doc :global(blockquote p:last-child) {
    margin-bottom: 0;
  }

  .doc :global(code) {
    padding: 1px 5px;
    border-radius: 6px;
    background: color-mix(in srgb, var(--paper-deep) 55%, transparent);
    font-family: ui-monospace, 'Cascadia Code', Consolas, monospace;
    font-size: 0.86em;
  }

  .doc :global(a) {
    color: var(--slate-stroke);
  }

  @keyframes appear {
    from {
      opacity: 0;
    }
  }

  @keyframes -global-help-flash {
    from {
      background: color-mix(in srgb, var(--selection) 40%, transparent);
    }
  }

  @media (max-width: 700px) {
    .help {
      top: 8px;
      bottom: 8px;
      width: calc(100vw - 16px);
    }
    .doc {
      font-size: 15.5px;
    }
    .doc :global(h1) {
      font-size: 25px;
    }
    .doc :global(h2) {
      font-size: 20px;
    }
    .doc :global(table) {
      display: block;
      overflow-x: auto;
    }
  }
</style>
