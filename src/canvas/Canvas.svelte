<script lang="ts">
  import { onMount } from 'svelte';
  import { editor } from '../model/editor.svelte';
  import { findLoops, type Loop } from '../model/loops';
  import { sim } from '../sim/session.svelte';
  import { THEMES } from '../theme';
  import { prefs } from '../ui/prefs.svelte';
  import { Camera } from './camera';
  import { docBounds, loopLabels, type LoopLabel, type Pt } from './geometry';
  import { Interaction } from './interaction';
  import { render } from './render';

  let { onzoom, onhint }: { onzoom?: (zoom: number) => void; onhint?: (message: string) => void } = $props();

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D | null = null;
  let width = 0;
  let height = 0;
  let dpr = 1;
  let frame = 0;
  let lastTime = 0;
  let lastZoom = 0;

  const camera = new Camera();

  // Les boucles ne changent qu'avec le document : on les recalcule une fois par révision.
  let loopCache: { rev: number; loops: Loop[]; labels: LoopLabel[] } = { rev: -1, loops: [], labels: [] };
  function loops() {
    if (loopCache.rev !== editor.rev) {
      const found = findLoops(editor.doc);
      loopCache = { rev: editor.rev, loops: found, labels: loopLabels(editor.doc, found) };
    }
    return loopCache;
  }

  /** Boucle mise en évidence : celle survolée, sinon celle sélectionnée. */
  function loopFocus(): Loop | null {
    const key =
      interaction.hover?.kind === 'loop' ? interaction.hover.id
      : editor.selection?.kind === 'loop' ? editor.selection.id
      : null;
    return key ? (loops().loops.find((l) => l.key === key) ?? null) : null;
  }

  const interaction = new Interaction({
    editor,
    camera,
    sim: () => sim.engine,
    loopLabels: () => (prefs.showLoops ? loops().labels : []),
    requestRender,
    setCursor: (cursor) => {
      if (canvas) canvas.style.cursor = cursor;
    },
    hint: (message) => onhint?.(message),
  });

  /** Rendu à la demande : au plus une image par rafraîchissement d'écran. */
  function requestRender() {
    if (!frame) frame = requestAnimationFrame(draw);
  }

  function draw(now: number) {
    frame = 0;
    const dt = lastTime ? (now - lastTime) / 1000 : 0;
    lastTime = now;
    if (!ctx) return;
    sim.tick(dt);
    render({ ctx, width, height, dpr, camera, theme: THEMES[prefs.theme] }, editor.doc, {
      selection: editor.selection,
      hover: interaction.hover,
      linkTarget: interaction.linkTarget,
      trail: interaction.trail,
      erasing: interaction.erasing,
      pulseHover: interaction.pulseHover,
      loopLabels: prefs.showLoops ? loops().labels : null,
      loopFocus: loopFocus(),
      sim: sim.engine,
    });
    if (camera.zoom !== lastZoom) {
      lastZoom = camera.zoom;
      onzoom?.(camera.zoom);
    }
    // En simulation, on anime en continu ; sinon on attend le prochain changement.
    if (editor.mode === 'sim') requestRender();
    else lastTime = 0;
  }

  export function fit() {
    const box = docBounds(editor.doc);
    // Place sous les galets pour les courbes d'historique de la simulation.
    if (box) box.maxY += 44;
    const side = Math.min(60, width * 0.06);
    camera.fit(box, width, height, {
      top: Math.min(90, height * 0.12),
      bottom: Math.min(120, height * 0.16),
      left: side,
      right: side,
    });
    requestRender();
  }

  export function zoomBy(factor: number) {
    camera.zoomAt({ x: width / 2, y: height / 2 }, factor);
    requestRender();
  }

  function local(e: { clientX: number; clientY: number }): Pt {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function onpointerdown(e: PointerEvent) {
    // Rend la main aux raccourcis clavier si un champ de l'inspecteur avait le focus.
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    // La « capture » garantit qu'on reçoit la suite du geste même si le doigt sort du canvas.
    canvas.setPointerCapture(e.pointerId);
    interaction.down(e, local(e));
  }

  const isTyping = (e: KeyboardEvent) =>
    e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement;

  function onkeydown(e: KeyboardEvent) {
    if (e.code === 'Space' && !isTyping(e)) {
      e.preventDefault();
      if (!interaction.spaceDown) {
        interaction.spaceDown = true;
        interaction.updateCursor();
      }
    }
  }

  function onkeyup(e: KeyboardEvent) {
    if (e.code === 'Space') {
      interaction.spaceDown = false;
      interaction.updateCursor();
    }
  }

  function onblur() {
    interaction.spaceDown = false;
    interaction.updateCursor();
  }

  onMount(() => {
    ctx = canvas.getContext('2d');
    let first = true;
    const observer = new ResizeObserver(() => {
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      if (first) {
        first = false;
        fit();
      }
      requestRender();
    });
    observer.observe(canvas);

    // La molette doit pouvoir appeler preventDefault (sinon la page zoome) : écouteur non passif.
    const onwheel = (e: WheelEvent) => {
      e.preventDefault();
      interaction.wheel(e, local(e));
    };
    canvas.addEventListener('wheel', onwheel, { passive: false });

    // Les étiquettes utilisent Nunito : on redessine une fois la police chargée.
    document.fonts?.ready.then(requestRender);

    return () => {
      observer.disconnect();
      canvas.removeEventListener('wheel', onwheel);
      cancelAnimationFrame(frame);
    };
  });

  $effect(() => {
    void editor.rev;
    void editor.selection;
    void editor.mode;
    void prefs.theme;
    void prefs.showLoops;
    requestRender();
  });

  // L'inspecteur occupe le bas de l'écran (téléphone) ou la droite (bureau) :
  // on décale la vue si l'élément sélectionné se retrouve caché dessous.
  $effect(() => {
    const sel = editor.selection;
    if (sel?.kind !== 'node' || interaction.busy) return;
    const node = editor.node(sel.id);
    if (!node) return;
    const c = camera.toScreen(node);
    const r = node.r * camera.zoom + 12;
    if (width <= 700) {
      const limit = height * 0.5;
      if (c.y + r > limit) camera.panBy(0, limit - c.y - r);
    } else {
      const limit = width - 330;
      if (c.x + r > limit) camera.panBy(limit - c.x - r, 0);
    }
    requestRender();
  });

  $effect(() => {
    void editor.tool;
    void editor.mode;
    interaction.updateCursor();
  });
</script>

<svelte:window {onkeydown} {onkeyup} {onblur} />

<canvas
  bind:this={canvas}
  {onpointerdown}
  onpointermove={(e) => interaction.move(e, local(e))}
  onpointerup={(e) => interaction.up(e, local(e))}
  onpointercancel={(e) => interaction.cancel(e)}
  onpointerleave={() => interaction.leave()}
  oncontextmenu={(e) => e.preventDefault()}
  aria-label="Canevas du diagramme"
></canvas>

<style>
  canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    display: block;
    /* Indispensable au tactile : le navigateur ne doit pas interpréter nos gestes
       (défilement, zoom de la page) — c'est nous qui gérons pincement et déplacement. */
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
    -webkit-tap-highlight-color: transparent;
  }
</style>
