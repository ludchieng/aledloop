<script lang="ts">
  import Icon from './Icon.svelte';

  let { zoom, onzoomby, onfit }: { zoom: number; onzoomby: (factor: number) => void; onfit: () => void } = $props();
</script>

<div class="zoom card">
  <button class="btn step" aria-label="Dézoomer" title="Dézoomer (Ctrl + molette)" onclick={() => onzoomby(1 / 1.25)}>
    <Icon name="minus" size={18} />
  </button>
  <span class="value">{Math.round(zoom * 100)} %</span>
  <button class="btn step" aria-label="Zoomer" title="Zoomer (Ctrl + molette)" onclick={() => onzoomby(1.25)}>
    <Icon name="plus" size={18} />
  </button>
  <span class="sep"></span>
  <button class="btn" aria-label="Recentrer" title="Recentrer sur le diagramme" onclick={onfit}>
    <Icon name="focus" size={19} />
  </button>
</div>

<style>
  .zoom {
    position: absolute;
    right: 16px;
    bottom: max(16px, env(safe-area-inset-bottom));
    display: flex;
    align-items: center;
    padding: 4px;
    border-radius: 16px;
    z-index: 8;
  }

  .value {
    min-width: 50px;
    text-align: center;
    font-size: 13px;
    font-weight: 700;
    color: var(--ink-soft);
    font-variant-numeric: tabular-nums;
  }

  /* Sur petit écran, la barre d'outils occupe le bas : on remonte et on garde l'essentiel
     (le pincement à deux doigts remplace les boutons + / −). */
  @media (max-width: 1000px) {
    .step,
    .value,
    .sep {
      display: none;
    }
  }

  @media (max-width: 700px) {
    .zoom {
      bottom: auto;
      top: calc(max(12px, env(safe-area-inset-top)) + 60px);
      right: 12px;
    }
  }
</style>
