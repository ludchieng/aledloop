<script lang="ts">
  import { untrack } from 'svelte';
  import { i18n } from '../i18n/i18n.svelte';
  import { editor, type Tool } from '../model/editor.svelte';
  import { findLoops } from '../model/loops';
  import { sim } from '../sim/session.svelte';
  import Icon, { type IconName } from './Icon.svelte';
  import { toasts } from './notify.svelte';
  import { prefs } from './prefs.svelte';
  import Rich from './Rich.svelte';
  import { router } from './router.svelte';
  import { storyUi } from './story.svelte';

  const t = $derived(i18n.t);

  // Raccourcis à la Figma : V sélection, P crayon (la plume de Figma), E gomme (comme Photoshop et Excalidraw).
  const TOOLS: { id: Tool; icon: IconName; key: string }[] = [
    { id: 'select', icon: 'pointer', key: 'V' },
    { id: 'pen', icon: 'pen', key: 'P' },
    { id: 'eraser', icon: 'eraser', key: 'E' },
  ];

  function startSim() {
    if (editor.doc.nodes.length === 0) {
      toasts.show(t.toolbar.drawFirst);
      return;
    }
    sim.start();
    const instant = findLoops(editor.doc).find((l) => l.instant);
    if (instant) {
      toasts.show(
        t.toolbar.instantLoop,
        { label: t.toolbar.see, run: () => (editor.selection = { kind: 'loop', id: instant.key }) },
        8000,
      );
    }
  }

  // Le document ne change presque pas pendant la simulation : lecture par révision.
  const unit = $derived.by(() => {
    void editor.rev;
    return editor.doc.timeUnit;
  });
  const storySteps = $derived.by(() => {
    void editor.rev;
    return editor.doc.story.steps.length;
  });
  const horizon = $derived.by(() => {
    void editor.rev;
    return editor.doc.horizon;
  });

  // Avec « arrêt à la fin », on prévient clairement : une simulation qui se fige semble avoir planté.
  // (untrack : afficher un toast écrit dans la liste des toasts, qui ne doit pas relancer l'effet.)
  $effect(() => {
    if (!sim.ended) return;
    untrack(() => toasts.show(t.toolbar.endedToast(i18n.duration(horizon, unit)), undefined, 6000));
  });

  /** Vitesse suivante (dir = 1) ou précédente (dir = −1), en boucle. */
  // Le message d'attente peut être caché par les courbes sur petit écran : un toast le double.
  $effect(() => {
    if (!sim.waiting) return;
    untrack(() => toasts.show(t.toolbar.waitingToast, undefined, 6000));
  });

</script>

<div class="dock">
  {#if editor.mode === 'sim'}
    {#if sim.waiting}
      <p class="hint card waiting" class:under-chart={prefs.showChart}><Rich text={t.toolbar.waitingHint} /></p>
    {:else if sim.ended}
      <p class="hint card" class:under-chart={prefs.showChart}><Rich text={t.toolbar.endedHint(i18n.duration(horizon, unit))} /></p>
    {:else}
      <p class="hint card" class:under-chart={prefs.showChart}><Rich text={t.toolbar.runningHint} /></p>
    {/if}
  {/if}

  <div class="toolbar card" role="toolbar" aria-label={t.toolbar.aria}>
    {#if editor.mode === 'edit'}
      {#each TOOLS as tool (tool.id)}
        {@const text = t.toolbar.tools[tool.id]}
        <button
          class="btn tool"
          class:active={editor.tool === tool.id}
          aria-pressed={editor.tool === tool.id}
          aria-label="{text.label} ({tool.key})"
          aria-keyshortcuts={tool.key}
          onclick={() => (editor.tool = tool.id)}
        >
          <Icon name={tool.icon} />
          <span class="label">{text.label}</span>
          <!-- Infobulle au survol : le nom, la touche, ce que fait l'outil. -->
          <span class="tooltip card" role="tooltip">
            <span class="tip-head">{text.label} <kbd>{tool.key}</kbd></span>
            <span class="tip-text">{text.tip}</span>
          </span>
        </button>
      {/each}
      <span class="sep"></span>
      <button class="btn" title={t.toolbar.undoTitle} aria-label={t.toolbar.undo} disabled={!editor.canUndo} onclick={() => editor.undo()}>
        <Icon name="undo" />
      </button>
      <button class="btn" title={t.toolbar.redoTitle} aria-label={t.toolbar.redo} disabled={!editor.canRedo} onclick={() => editor.redo()}>
        <Icon name="redo" />
      </button>
      <span class="sep"></span>
      <!-- Le récit et sa présentation, côte à côte : on l'écrit, puis on le présente. -->
      <button
        class="btn"
        class:active={storyUi.open}
        aria-pressed={storyUi.open}
        title={t.toolbar.storyTitle}
        onclick={() => storyUi.toggle()}
      >
        <Icon name="story" size={20} />
        <span class="label">{t.toolbar.story}</span>
      </button>
      {#if storySteps > 0}
        <button class="btn present" title={t.toolbar.presentTitle} onclick={() => router.present()}>
          <Icon name="present" size={18} />
          <span class="label">{t.toolbar.present}</span>
        </button>
      {/if}
      <button class="btn primary" title={t.toolbar.simulateTitle} onclick={startSim}>
        <Icon name="play" size={18} />
        <span class="label">{t.toolbar.simulate}</span>
      </button>
    {:else}
      <button class="btn tool" title={t.toolbar.editTitle} onclick={() => sim.stop()}>
        <Icon name="edit" />
        <span class="label">{t.toolbar.edit}</span>
      </button>
      <span class="sep"></span>
      <button
        class="btn"
        class:active={!sim.playing}
        title={sim.playing ? t.toolbar.pauseTitle : t.toolbar.resumeTitle}
        aria-label={sim.playing ? t.toolbar.pause : t.toolbar.resume}
        onclick={() => sim.toggle()}
      >
        <Icon name={sim.playing ? 'pause' : 'play'} size={sim.playing ? 22 : 18} />
      </button>
      <button class="btn" title={t.toolbar.resetTitle} aria-label={t.toolbar.reset} onclick={() => sim.reset()}>
        <Icon name="reset" />
      </button>
      <button
        class="btn"
        title={prefs.stopAtEnd ? t.toolbar.runToEnd(i18n.duration(horizon, unit)) : t.toolbar.runFor(i18n.duration(horizon, unit))}
        aria-label={t.toolbar.runAhead}
        disabled={!sim.canRunAhead}
        onclick={() => sim.runAhead()}
      >
        <Icon name="skip" />
      </button>
      <!-- Maj + clic ralentit ; sans clavier, le clic droit (un appui long sur la plupart des tablettes) aussi. -->
      <button
        class="btn speed"
        title={t.toolbar.speedTitle(i18n.number(sim.speed), i18n.unit(unit, sim.speed))}
        onclick={(e) => sim.changeSpeed(e.shiftKey ? -1 : 1, true)}
        oncontextmenu={(e) => {
          e.preventDefault();
          sim.changeSpeed(-1, true);
        }}
      >
        ×{i18n.number(sim.speed)}
      </button>
      <span class="clock" title={t.toolbar.clockTitle}>
        {sim.time.toLocaleString(i18n.lang, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
        <small>{i18n.unit(unit, sim.time)}</small>
      </span>
      <span class="sep"></span>
      <button
        class="btn"
        class:active={prefs.showChart}
        aria-pressed={prefs.showChart}
        title={prefs.showChart ? t.toolbar.hideChart : t.toolbar.showChart}
        aria-label={t.toolbar.chart}
        onclick={() => prefs.toggleChart()}
      >
        <Icon name="chart" />
      </button>
      {#if storySteps > 0}
        <!-- Perdu dans la simulation ? Le récit explique le modèle, étape par étape. -->
        <button class="btn" title={t.toolbar.presentTitle} aria-label={t.toolbar.present} onclick={() => router.present()}>
          <Icon name="present" />
        </button>
      {/if}
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
    position: relative;
    flex-direction: column;
    gap: 1px;
    min-width: 62px;
    min-height: 52px;
    padding: 4px 8px;
    border-radius: 16px;
  }

  /* Infobulle des outils : au survol (souris) ou au focus clavier, pas au doigt. */
  .tooltip {
    position: absolute;
    bottom: calc(100% + 12px);
    left: 50%;
    transform: translate(-50%, 4px);
    display: flex;
    flex-direction: column;
    gap: 2px;
    width: max-content;
    max-width: 220px;
    padding: 8px 12px;
    border-radius: 12px;
    text-align: left;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.12s, transform 0.12s;
  }

  @media (hover: hover) {
    .tool:hover .tooltip {
      opacity: 1;
      transform: translate(-50%, 0);
      transition-delay: 0.25s;
    }
  }

  .tool:focus-visible .tooltip {
    opacity: 1;
    transform: translate(-50%, 0);
  }

  .tip-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    font-size: 13px;
    font-weight: 800;
  }

  kbd {
    min-width: 22px;
    padding: 1px 6px;
    border-radius: 6px;
    background: var(--paper-deep);
    box-shadow: inset 0 -2px 0 var(--shadow);
    font: 800 12px var(--font-ui);
    text-align: center;
  }

  .tip-text {
    font-size: 12px;
    font-weight: 600;
    line-height: 1.35;
    color: var(--ink-soft);
  }

  .tool .label {
    font-size: 12px;
  }

  .primary {
    min-height: 48px;
    padding: 0 16px;
    border-radius: 16px;
  }

  .present {
    min-height: 48px;
    padding: 0 12px;
    border-radius: 16px;
  }

  .speed {
    min-width: 52px;
    font-variant-numeric: tabular-nums;
  }

  /* Horloge du modèle : le temps qui passe, dans l'unité du diagramme. */
  .clock {
    display: flex;
    align-items: baseline;
    gap: 4px;
    min-width: 76px;
    padding: 0 10px 0 4px;
    font-weight: 800;
    font-size: 16px;
    font-variant-numeric: tabular-nums;
  }

  .clock small {
    font-size: 12px;
    font-weight: 700;
    color: var(--ink-soft);
  }

  .hint {
    margin: 0;
    padding: 8px 14px;
    font-size: 13px;
    border-radius: 14px;
    text-align: center;
    color: var(--ink-soft);
  }

  /* En attente du premier geste : le message se détache, c'est à toi de jouer. */
  .hint.waiting {
    color: var(--ink);
    box-shadow: var(--card-shadow), 0 0 0 2px var(--selection);
  }

  .hint :global(b) {
    color: var(--ink);
  }

  /* Écran moyen ou téléphone : le panneau des courbes occupe cette place. */
  @media (max-width: 1000px) {
    .hint.under-chart {
      display: none;
    }
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

  /* Très petit écran : les outils sans leur nom, pour que toute la barre tienne. */
  @media (max-width: 480px) {
    .toolbar {
      gap: 2px;
    }
    .toolbar .sep {
      margin: 6px 2px;
    }
    .btn {
      min-width: 38px;
      padding: 0 6px;
    }
    .tool {
      min-width: 42px;
      padding: 4px 6px;
    }
    .tool .label {
      display: none;
    }
    /* L'horloge sans son unité, la vitesse plus serrée : la barre de simulation tient sur un téléphone. */
    .clock {
      min-width: 0;
      padding: 0 4px;
      font-size: 14px;
    }
    .clock small {
      display: none;
    }
    .speed {
      min-width: 40px;
    }
  }
</style>
