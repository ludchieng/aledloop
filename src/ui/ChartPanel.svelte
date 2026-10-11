<script lang="ts">
  import uPlot from 'uplot';
  import 'uplot/dist/uPlot.min.css';
  import { onMount, untrack } from 'svelte';
  import { editor } from '../model/editor.svelte';
  import { formatNumber, unitName } from '../model/time';
  import { sim } from '../sim/session.svelte';
  import { THEMES, type ColorKey } from '../theme';
  import Duration from './Duration.svelte';
  import Icon from './Icon.svelte';
  import { prefs } from './prefs.svelte';

  const FONT = '600 11px "Nunito Variable", Nunito, system-ui, sans-serif';
  /** Rafraîchissement des courbes : 10 fois par seconde suffit à l'œil, et ménage la batterie. */
  const REFRESH_MS = 100;

  // Le document ne change presque pas pendant la simulation (durée, unité) : lecture par révision, et copie.
  const model = $derived.by(() => {
    void editor.rev;
    const doc = editor.doc;
    return {
      unit: doc.timeUnit,
      horizon: doc.horizon,
      series: doc.nodes.map((n, i) => ({
        id: n.id,
        label: n.label.trim() || 'sans nom',
        color: n.color,
        // Deux éléments de même couleur : le second en pointillés, pour les distinguer.
        dashed: doc.nodes.slice(0, i).some((m) => m.color === n.color),
      })),
    };
  });

  let hidden = $state<string[]>([]);
  /** Valeurs des pastilles, en % : sous le curseur, sinon les niveaux actuels. */
  let readout = $state<number[]>([]);
  /** Temps sous le curseur (null : pas de survol). */
  let cursorTime = $state<number | null>(null);

  let host: HTMLDivElement;
  let plot: uPlot | null = null;
  let cursorIdx: number | null = null;
  let lastKey = '';

  function data(): uPlot.AlignedData {
    const engine = sim.engine;
    if (!engine || editor.doc.nodes.length === 0) return [[]];
    const series = editor.doc.nodes.map((n) => (engine.history.get(n.id) ?? []).map((v) => v * 100));
    const xs = (series[0] ?? []).map((_, i) => engine.historyStart + i * engine.historyDt);
    return [xs, ...series];
  }

  function updateReadout() {
    const engine = sim.engine;
    if (!engine) return;
    const nodes = editor.doc.nodes;
    if (cursorIdx === null) {
      readout = nodes.map((n) => engine.level(n.id) * 100);
      cursorTime = null;
    } else {
      const i = cursorIdx;
      readout = nodes.map((n) => (engine.history.get(n.id)?.[i] ?? 0) * 100);
      cursorTime = engine.historyStart + i * engine.historyDt;
    }
  }

  function build() {
    plot?.destroy();
    plot = null;
    if (!host) return;
    const theme = THEMES[prefs.theme];
    const axis = {
      stroke: theme.inkSoft,
      font: FONT,
      grid: { stroke: theme.grid, width: 1 },
      ticks: { show: false },
      gap: 4,
    };
    const opts: uPlot.Options = {
      width: host.clientWidth,
      height: host.clientHeight,
      legend: { show: false },
      cursor: { y: false, drag: { x: false, y: false }, points: { size: 7 } },
      focus: { alpha: 0.25 },
      scales: {
        // L'axe du temps couvre toute la durée de simulation, ou plus si on la prolonge.
        x: { time: false, range: () => windowRange() },
        y: { range: [0, 100] },
      },
      axes: [
        { ...axis, size: 24, values: (_u, splits) => splits.map((v) => formatNumber(v, 1)) },
        { ...axis, size: 40, splits: () => [0, 25, 50, 75, 100], values: (_u, splits) => splits.map((v) => `${v} %`) },
      ],
      series: [
        {},
        ...model.series.map((s) => ({
          label: s.label,
          stroke: theme.swatches[s.color].stroke,
          width: 2.25,
          dash: s.dashed ? [6, 4] : undefined,
          show: !hidden.includes(s.id),
          points: { show: false },
        })),
      ],
      hooks: {
        setCursor: [
          (u) => {
            cursorIdx = u.cursor.idx ?? null;
            updateReadout();
          },
        ],
      },
    };
    plot = new uPlot(opts, data(), host);
    lastKey = '';
  }

  /**
   * L'axe du temps couvre la durée de simulation : de 0 à la durée au début, puis il glisse
   * (les courbes défilent) une fois la durée dépassée.
   */
  function windowRange(): [number, number] {
    const horizon = editor.doc.horizon;
    const time = sim.engine?.time ?? 0;
    return time <= horizon ? [0, horizon] : [time - horizon, time];
  }

  /** Redessine seulement si la simulation a avancé (ou a été remise à zéro). */
  function refresh() {
    const engine = sim.engine;
    if (!plot || !engine) return;
    const key = `${engine.time}|${engine.historyStart}|${editor.doc.horizon}`;
    if (key !== lastKey) {
      lastKey = key;
      plot.setData(data());
    }
    if (cursorIdx === null) updateReadout();
  }

  // Nouvelle série, autre unité ou autre thème : on reconstruit le graphique.
  $effect(() => {
    void model.series;
    void prefs.theme;
    untrack(build);
  });

  onMount(() => {
    const timer = setInterval(refresh, REFRESH_MS);
    const observer = new ResizeObserver(() => plot?.setSize({ width: host.clientWidth, height: host.clientHeight }));
    observer.observe(host);
    return () => {
      clearInterval(timer);
      observer.disconnect();
      plot?.destroy();
      plot = null;
    };
  });

  function toggle(i: number, id: string) {
    hidden = hidden.includes(id) ? hidden.filter((h) => h !== id) : [...hidden, id];
    plot?.setSeries(i + 1, { show: !hidden.includes(id) });
  }

  const swatch = (color: ColorKey) => `var(--${color}-stroke)`;
</script>

<section class="chart card" aria-label="Courbes de la simulation">
  <header>
    <div class="top">
      <h2>Courbes</h2>
      <div class="horizon" title="Largeur de la fenêtre des courbes : la durée de simulation">
        <Duration
          label="Durée de simulation"
          value={model.horizon}
          unit={model.unit}
          zero="—"
          onchange={(v) => editor.setHorizon(v)}
          onunit={(u) => editor.setTimeUnit(u)}
        />
      </div>
      <button class="btn close" aria-label="Masquer les courbes" title="Masquer les courbes" onclick={() => prefs.toggleChart()}>
        <Icon name="close" size={18} />
      </button>
    </div>
    <div class="sub">
      <label class="stop" title="S’arrêter au bout de cette durée et garder toute l’histoire depuis le début, au lieu de faire défiler les courbes">
        <input type="checkbox" checked={prefs.stopAtEnd} onchange={(e) => prefs.setStopAtEnd(e.currentTarget.checked)} />
        Arrêt à la fin
      </label>
      <span class="when">
        {#if cursorTime !== null}
          à {formatNumber(cursorTime, 1)} {unitName(model.unit, cursorTime)}
        {:else if prefs.stopAtEnd}
          du début à la fin
        {:else}
          fenêtre glissante
        {/if}
      </span>
    </div>
  </header>

  <div class="plot" bind:this={host}></div>

  <div class="series" role="group" aria-label="Séries affichées">
    {#each model.series as s, i (s.id)}
      {@const off = hidden.includes(s.id)}
      <button
        class="serie"
        class:off
        aria-pressed={!off}
        title={off ? `Afficher « ${s.label} »` : `Masquer « ${s.label} »`}
        onclick={() => toggle(i, s.id)}
        onpointerenter={() => !off && plot?.setSeries(i + 1, { focus: true })}
        onpointerleave={() => plot?.setSeries(null, { focus: false })}
      >
        <span class="dot" class:dashed={s.dashed} style:--c={swatch(s.color)}></span>
        {s.label}
        <b>{readout[i] === undefined ? '' : `${Math.round(readout[i])} %`}</b>
      </button>
    {/each}
  </div>
</section>

<style>
  .chart {
    position: absolute;
    left: 16px;
    bottom: max(16px, env(safe-area-inset-bottom));
    width: min(560px, calc(50vw - 236px));
    height: 300px;
    padding: 10px 12px 10px;
    z-index: 8;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  header {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .top,
  .sub {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  /* La lecture du temps, à droite, sous la croix. */
  .sub .when {
    margin-left: auto;
  }

  h2 {
    margin: 0;
    font-family: var(--font-title);
    font-weight: 600;
    font-size: 17px;
  }

  .when {
    font-size: 13px;
    font-weight: 700;
    color: var(--ink-soft);
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }

  .stop {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12.5px;
    font-weight: 700;
    color: var(--ink-soft);
    white-space: nowrap;
    cursor: pointer;
  }

  .stop input {
    width: 18px;
    height: 18px;
    margin: 0;
    accent-color: var(--ochre-stroke);
  }

  .horizon {
    flex: 1;
    min-width: 0;
    max-width: 250px;
  }

  .close {
    margin-left: auto;
    min-width: 34px;
    min-height: 34px;
    color: var(--ink-soft);
  }

  .plot {
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  /* Curseur de lecture : un trait d'encre discret. */
  .plot :global(.u-cursor-x) {
    border-right: 1.5px dashed var(--ink-soft);
  }

  .series {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    max-height: 64px;
    overflow-y: auto;
  }

  .serie {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 30px;
    padding: 0 10px 0 8px;
    border: none;
    border-radius: 999px;
    background: color-mix(in srgb, var(--paper-deep) 45%, transparent);
    font-size: 12.5px;
    font-weight: 700;
    color: var(--ink);
    cursor: pointer;
    touch-action: manipulation;
  }

  .serie b {
    font-weight: 800;
    color: var(--ink-soft);
    font-variant-numeric: tabular-nums;
  }

  .serie.off {
    opacity: 0.45;
  }

  .serie.off .dot {
    background: transparent;
  }

  .dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    border: 2.5px solid var(--c);
    background: var(--c);
  }

  .dot.dashed {
    border-style: dashed;
    background: transparent;
  }

  /* Écran moyen ou téléphone : panneau pleine largeur, au-dessus de la barre d'outils. */
  @media (max-width: 1000px) {
    .chart {
      left: 12px;
      right: 12px;
      width: auto;
      bottom: calc(max(16px, env(safe-area-inset-bottom)) + 76px);
      height: 230px;
    }
  }
</style>
