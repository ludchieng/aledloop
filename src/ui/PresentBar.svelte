<script lang="ts">
  import { fly } from 'svelte/transition';
  import { editor } from '../model/editor.svelte';
  import { richText } from '../model/story';
  import { sim } from '../sim/session.svelte';
  import Icon from './Icon.svelte';
  import { presenter } from './story.svelte';

  // Le document ne change pas pendant une présentation : une lecture directe suffit.
  const steps = editor.doc.story.steps;
  const step = $derived(steps[presenter.index]);
  const last = $derived(presenter.index >= steps.length - 1);

  let fullscreen = $state(!!document.fullscreenElement);

  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else document.documentElement.requestFullscreen?.().catch(() => {});
  }
</script>

<svelte:document onfullscreenchange={() => (fullscreen = !!document.fullscreenElement)} />

<div class="present">
  {#key presenter.index}
    <article class="narration card" in:fly={{ y: 10, duration: 350 }}>
      <span class="count">Étape {presenter.index + 1} sur {steps.length}</span>
      {#if step?.text.trim()}
        <p>
          {#each richText(step.text) as seg, i (i)}{#if seg.bold}<b>{seg.text}</b>{:else}{seg.text}{/if}{/each}
        </p>
      {:else}
        <p class="empty">Pas de texte pour cette étape.</p>
      {/if}
    </article>
  {/key}

  <nav class="controls card" aria-label="Navigation du récit">
    <button class="btn" aria-label="Étape précédente" title="Précédente (←)" disabled={presenter.index === 0} onclick={() => presenter.prev()}>
      <Icon name="prev" />
    </button>
    <div class="dots">
      {#each steps as s, i (s.id)}
        <button
          class="dot"
          class:active={i === presenter.index}
          class:done={i < presenter.index}
          aria-label="Aller à l’étape {i + 1}"
          aria-current={i === presenter.index ? 'step' : undefined}
          onclick={() => presenter.go(i)}
        ></button>
      {/each}
    </div>
    {#if last}
      <button class="btn primary next" onclick={() => presenter.stop()}>Terminer</button>
    {:else}
      <button class="btn primary next" title="Suivante (→ ou Espace)" onclick={() => presenter.next()}>
        Suivant <Icon name="next" size={18} />
      </button>
    {/if}
    <span class="sep"></span>
    <button class="btn" aria-label="Remettre les niveaux de départ" title="Remettre les niveaux de départ" onclick={() => sim.reset()}>
      <Icon name="reset" size={20} />
    </button>
    <button
      class="btn"
      class:active={fullscreen}
      aria-label="Plein écran"
      title="Plein écran"
      onclick={toggleFullscreen}
    >
      <Icon name="maximize" size={20} />
    </button>
    <button class="btn" aria-label="Quitter la présentation" title="Quitter (Échap)" onclick={() => presenter.stop()}>
      <Icon name="close" size={20} />
    </button>
  </nav>
</div>

<style>
  .present {
    position: absolute;
    left: 50%;
    bottom: max(16px, env(safe-area-inset-bottom));
    transform: translateX(-50%);
    width: min(680px, calc(100vw - 24px));
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    z-index: 10;
  }

  .narration {
    width: 100%;
    padding: 16px 22px 18px;
  }

  .count {
    display: block;
    margin-bottom: 6px;
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--ink-soft);
  }

  p {
    margin: 0;
    font-family: var(--font-title);
    font-size: 19px;
    line-height: 1.45;
  }

  p b {
    font-weight: 700;
    color: var(--terracotta-stroke);
  }

  .empty {
    color: var(--ink-soft);
    font-style: italic;
  }

  .controls {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px;
    border-radius: 20px;
  }

  .dots {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 0 6px;
  }

  .dot {
    width: 22px;
    height: 32px;
    padding: 0;
    border: none;
    background: transparent;
    cursor: pointer;
    position: relative;
  }

  .dot::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    transform: translate(-50%, -50%);
    background: color-mix(in srgb, var(--ink) 18%, transparent);
    transition: all 0.2s;
  }

  .dot.done::after {
    background: color-mix(in srgb, var(--selection) 55%, transparent);
  }

  .dot.active::after {
    width: 14px;
    height: 14px;
    background: var(--selection);
    box-shadow: 0 1px 3px var(--shadow);
  }

  .next {
    min-height: 44px;
    padding: 0 14px 0 16px;
  }

  @media (max-width: 520px) {
    .narration {
      padding: 12px 16px 14px;
    }
    p {
      font-size: 16.5px;
    }
    .dots {
      display: none;
    }
  }
</style>
