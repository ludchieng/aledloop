<script lang="ts">
  import { onMount } from 'svelte';
  import Canvas from './canvas/Canvas.svelte';
  import ChartPanel from './ui/ChartPanel.svelte';
  import GalleryPanel from './ui/GalleryPanel.svelte';
  import { gallery } from './ui/gallery.svelte';
  import HelpPanel from './ui/HelpPanel.svelte';
  import { help } from './ui/help.svelte';
  import { editor } from './model/editor.svelte';
  import { decodeDoc, loadLocal, saveLocal } from './model/persist';
  import { sim } from './sim/session.svelte';
  import { THEMES, themeCssVars } from './theme';
  import Inspector from './ui/Inspector.svelte';
  import PresentBar from './ui/PresentBar.svelte';
  import StoryPanel from './ui/StoryPanel.svelte';
  import { presenter, storyUi } from './ui/story.svelte';
  import { prefs } from './ui/prefs.svelte';
  import Toasts from './ui/Toasts.svelte';
  import { toasts } from './ui/notify.svelte';
  import Toolbar from './ui/Toolbar.svelte';
  import TopBar from './ui/TopBar.svelte';
  import ZoomControls from './ui/ZoomControls.svelte';

  // Le document sauvegardé est chargé avant le premier rendu, pour que le canvas le cadre d'emblée.
  const saved = loadLocal();
  if (saved) editor.load(saved, false);

  let canvas: Canvas;
  let zoom = $state(1);

  const empty = $derived.by(() => {
    void editor.rev;
    return editor.doc.nodes.length === 0;
  });

  // Thème : variables CSS sur :root + couleur de la barre du navigateur.
  $effect(() => {
    const root = document.documentElement;
    root.dataset.theme = prefs.theme;
    for (const [k, v] of Object.entries(themeCssVars(THEMES[prefs.theme]))) root.style.setProperty(k, v);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEMES[prefs.theme].paper);
  });

  // Sauvegarde automatique, regroupée (pas à chaque pixel d'un glisser).
  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  $effect(() => {
    void editor.rev;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => saveLocal(editor.doc), 400);
  });

  // Ouverture d'un lien partagé (#m=…) : annulable, pour retrouver son propre diagramme.
  onMount(() => {
    const match = location.hash.match(/^#m=([\w-]+)/);
    if (!match) return;
    history.replaceState(null, '', location.pathname + location.search);
    decodeDoc(match[1])
      .then((doc) => {
        editor.load(doc);
        canvas.fit();
        if (doc.story.steps.length > 0) {
          toasts.show('Diagramme partagé ouvert : il contient un récit.', { label: 'Le présenter', run: () => presenter.start() }, 10000);
        } else {
          toasts.show('Diagramme partagé ouvert.', { label: 'Revenir au mien', run: () => { editor.undo(); canvas.fit(); } }, 8000);
        }
      })
      .catch(() => toasts.show('Ce lien de partage est abîmé : impossible de l’ouvrir.'));
  });

  const isTyping = (e: KeyboardEvent) =>
    e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement;

  function onkeydown(e: KeyboardEvent) {
    // Une fenêtre ouverte (aide, bibliothèque) prend la main : Échap la ferme, les autres raccourcis attendent.
    if (help.open || gallery.open) {
      if (e.key === 'Escape') {
        help.close();
        gallery.close();
      }
      return;
    }
    if (isTyping(e)) return;
    const mod = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();

    if (editor.mode === 'present') {
      if (['ArrowRight', 'ArrowDown', 'PageDown', 'Enter', ' '].includes(e.key)) {
        e.preventDefault();
        presenter.next();
      } else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(e.key)) {
        e.preventDefault();
        presenter.prev();
      } else if (e.key === 'Home') {
        presenter.go(0);
      } else if (e.key === 'End') {
        presenter.go(presenter.count - 1);
      } else if (e.key === 'Escape') {
        // D'abord l'inspecteur d'une boucle ouverte pendant le récit, puis le récit lui-même.
        if (editor.selection) editor.selection = null;
        else presenter.stop();
      }
      return;
    }
    if (editor.mode === 'sim') {
      // Comme un lecteur vidéo : Espace lecture/pause, > et < (ou + et −) pour la vitesse.
      if (e.key === 'Escape') sim.stop();
      else if (e.key === ' ') {
        e.preventDefault();
        if (!e.repeat) sim.toggle();
      } else if (e.key === '>' || e.key === '+') sim.changeSpeed(1);
      else if (e.key === '<' || e.key === '-') sim.changeSpeed(-1);
      return;
    }
    if (mod && key === 'z') {
      e.preventDefault();
      if (e.shiftKey) editor.redo();
      else editor.undo();
    } else if (mod && key === 'y') {
      e.preventDefault();
      editor.redo();
    } else if (mod) {
      return;
    } else if (key === 'v' || key === 'm') {
      // Raccourcis à la Figma (V, P, E) ; les anciens (M, C, G) marchent toujours.
      editor.tool = 'select';
    } else if (key === 'p' || key === 'c') {
      editor.tool = 'pen';
    } else if (key === 'e' || key === 'g') {
      editor.tool = 'eraser';
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      editor.deleteSelection();
    } else if (e.key === 'Escape') {
      if (storyUi.picking) storyUi.picking = false;
      else editor.selection = null;
    }
  }
</script>

<svelte:window {onkeydown} />

<main>
  <Canvas bind:this={canvas} onzoom={(z) => (zoom = z)} onhint={(m) => toasts.show(m)} />

  {#if empty && editor.mode === 'edit'}
    <div class="welcome card">
      <h2>Une page blanche</h2>
      <p>Avec le <b>crayon</b>, dessine un <b>cercle</b> pour créer un élément, puis trace un <b>trait</b> d’un élément à un autre pour les relier.</p>
      <button class="btn primary" onclick={() => gallery.show()}>Voir les exemples</button>
    </div>
  {/if}

  <!-- L'inspecteur sert aussi en présentation : un récit peut inviter à toucher une étiquette de boucle. -->
  <Inspector />
  {#if editor.mode === 'present'}
    <PresentBar />
  {:else}
    <TopBar onloaded={() => canvas.fit()} />
    {#if storyUi.open && editor.mode === 'edit'}
      <StoryPanel />
    {/if}
    {#if editor.mode === 'sim' && prefs.showChart}
      <ChartPanel />
    {/if}
    <ZoomControls {zoom} onzoomby={(f) => canvas.zoomBy(f)} onfit={() => canvas.fit()} />
    <Toolbar />
  {/if}
  <GalleryPanel onloaded={() => canvas.fit()} />
  <HelpPanel />
  <Toasts />
</main>

<style>
  main {
    position: absolute;
    inset: 0;
    overflow: hidden;
  }

  /* Pendant qu'on dessine dessous, la carte s'efface : on voit son tracé. */
  :global(body.gesture) .welcome {
    opacity: 0.12;
  }

  .welcome {
    transition: opacity 0.15s;
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -60%);
    width: min(380px, calc(100vw - 32px));
    padding: 22px 24px;
    text-align: center;
    z-index: 5;
    animation: fade 0.4s ease-out;
    /* On doit pouvoir dessiner à travers la carte : seul le bouton capte les clics. */
    pointer-events: none;
  }

  .welcome .btn {
    pointer-events: auto;
  }

  .welcome h2 {
    margin: 0 0 8px;
    font-family: var(--font-title);
    font-weight: 600;
    font-size: 24px;
  }

  .welcome p {
    margin: 0 0 16px;
    line-height: 1.5;
    color: var(--ink-soft);
  }

  .welcome b {
    color: var(--ink);
  }

  @keyframes fade {
    from {
      opacity: 0;
    }
  }
</style>
