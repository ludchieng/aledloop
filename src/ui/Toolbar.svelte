<script lang="ts">
  import { editor, type Tool } from '../model/editor.svelte';
  import { sim, SPEEDS } from '../sim/session.svelte';
  import Icon, { type IconName } from './Icon.svelte';
  import { toasts } from './notify.svelte';

  const TOOLS: { id: Tool; icon: IconName; label: string; key: string; tip: string }[] = [
    { id: 'pen', icon: 'pen', label: 'Crayon', key: 'C', tip: 'Dessine un cercle pour créer un élément, un trait pour les relier' },
    { id: 'hand', icon: 'hand', label: 'Main', key: 'M', tip: 'Déplace les éléments, courbe les liens, déplace la vue' },
    { id: 'eraser', icon: 'eraser', label: 'Gomme', key: 'G', tip: 'Passe sur les éléments pour les effacer' },
  ];

  function startSim() {
    if (editor.doc.nodes.length === 0) {
      toasts.show('Dessine d’abord quelques éléments à simuler.');
      return;
    }
    sim.start();
  }

  function cycleSpeed() {
    const i = SPEEDS.indexOf(sim.speed as (typeof SPEEDS)[number]);
    sim.speed = SPEEDS[(i + 1) % SPEEDS.length];
  }
</script>

<div class="dock">
  {#if editor.mode === 'sim'}
    <p class="hint card">Touche le <b>haut</b> d’un élément pour l’augmenter, le <b>bas</b> pour le diminuer.</p>
  {/if}

  <div class="toolbar card" role="toolbar" aria-label="Outils">
    {#if editor.mode === 'edit'}
      {#each TOOLS as t (t.id)}
        <button
          class="btn tool"
          class:active={editor.tool === t.id}
          aria-pressed={editor.tool === t.id}
          title="{t.tip} ({t.key})"
          onclick={() => (editor.tool = t.id)}
        >
          <Icon name={t.icon} />
          <span class="label">{t.label}</span>
        </button>
      {/each}
      <span class="sep"></span>
      <button class="btn" title="Annuler (Ctrl+Z)" aria-label="Annuler" disabled={!editor.canUndo} onclick={() => editor.undo()}>
        <Icon name="undo" />
      </button>
      <button class="btn" title="Rétablir (Ctrl+Maj+Z)" aria-label="Rétablir" disabled={!editor.canRedo} onclick={() => editor.redo()}>
        <Icon name="redo" />
      </button>
      <span class="sep"></span>
      <button class="btn primary" title="Lancer la simulation" onclick={startSim}>
        <Icon name="play" size={18} />
        <span class="label">Simuler</span>
      </button>
    {:else}
      <button class="btn tool" title="Revenir à l’édition" onclick={() => sim.stop()}>
        <Icon name="edit" />
        <span class="label">Éditer</span>
      </button>
      <span class="sep"></span>
      <button
        class="btn"
        class:active={!sim.playing}
        title={sim.playing ? 'Pause' : 'Reprendre'}
        aria-label={sim.playing ? 'Pause' : 'Reprendre'}
        onclick={() => (sim.playing = !sim.playing)}
      >
        <Icon name={sim.playing ? 'pause' : 'play'} size={sim.playing ? 22 : 18} />
      </button>
      <button class="btn" title="Remettre les niveaux de départ" aria-label="Réinitialiser" onclick={() => sim.reset()}>
        <Icon name="reset" />
      </button>
      <button class="btn speed" title="Vitesse de la simulation" onclick={cycleSpeed}>
        ×{sim.speed.toLocaleString('fr-FR')}
      </button>
    {/if}
  </div>
</div>

<style>
  .dock {
    position: absolute;
    left: 50%;
    bottom: max(16px, env(safe-area-inset-bottom));
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    z-index: 10;
    max-width: calc(100vw - 24px);
  }

  .toolbar {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px;
    border-radius: 22px;
  }

  .tool {
    flex-direction: column;
    gap: 1px;
    min-width: 62px;
    min-height: 52px;
    padding: 4px 8px;
    border-radius: 16px;
  }

  .tool .label {
    font-size: 12px;
  }

  .primary {
    min-height: 48px;
    padding: 0 16px;
    border-radius: 16px;
  }

  .speed {
    min-width: 52px;
    font-variant-numeric: tabular-nums;
  }

  .hint {
    margin: 0;
    padding: 8px 14px;
    font-size: 13px;
    border-radius: 14px;
    text-align: center;
    color: var(--ink-soft);
  }

  .hint b {
    color: var(--ink);
  }

  @media (max-width: 520px) {
    .tool {
      min-width: 48px;
    }
    .label {
      display: none;
    }
    .tool .label {
      display: inline;
      font-size: 11px;
    }
    .primary {
      padding: 0 12px;
    }
  }
</style>
