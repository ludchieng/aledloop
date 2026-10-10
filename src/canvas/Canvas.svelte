<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { editor } from '../model/editor.svelte';
  import { findLoops, type Loop } from '../model/loops';
  import { framingNodes, hiddenAt, stepFocus } from '../model/story';
  import type { SysNode } from '../model/types';
  import { sim } from '../sim/session.svelte';
  import { THEMES } from '../theme';
  import { prefs } from '../ui/prefs.svelte';
  import { presenter, storyUi } from '../ui/story.svelte';
  import { Camera, type Margins } from './camera';
  import { docBounds, loopLabels, nodesBounds, type LoopLabel, type Pt } from './geometry';
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

  /** Ce que le récit impose à l'affichage : mise en avant de l'étape, éléments pas encore apparus. */
  function storyView(): { focus: Set<string> | null; hidden: Set<string> | null } {
    const doc = editor.doc;
    if (editor.mode === 'present') {
      const step = doc.story.steps[presenter.index];
      const focus = step ? stepFocus(doc, step) : null;
      return { focus: focus?.size ? focus : null, hidden: hiddenAt(doc, presenter.index) };
    }
    const step = editor.mode === 'edit' && storyUi.open && storyUi.active ? editor.step(storyUi.active) : undefined;
    if (step) {
      const focus = stepFocus(doc, step);
      // En train de choisir : même vide, on estompe tout, pour voir ce qui reste à toucher.
      return { focus: focus.size || storyUi.picking ? focus : null, hidden: null };
    }
    return { focus: null, hidden: null };
  }

  const interaction = new Interaction({
    editor,
    camera,
    sim: () => sim.engine,
    loopLabels: () => {
      if (!prefs.showLoops) return [];
      const hidden = storyView().hidden;
      return hidden ? loops().labels.filter((l) => !l.loop.edges.some((id) => hidden.has(id))) : loops().labels;
    },
    hidden: () => storyView().hidden,
    picking: () => (editor.mode === 'edit' && storyUi.open && storyUi.picking ? storyUi.active : null),
    requestRender,
    setCursor: (cursor) => {
      if (canvas) canvas.style.cursor = cursor;
    },
    hint: (message) => onhint?.(message),
  });

  // --- Apparition en fondu des éléments révélés par le récit ---------------------

  const FADE_MS = 600;
  const appearing = new Map<string, number>();
  let prevHidden: Set<string> | null = null;

  function fades(hidden: Set<string> | null, now: number): Map<string, number> | null {
    if (hidden) {
      // Au lancement de la présentation, tout ce qui est visible apparaît en fondu.
      const before = prevHidden ?? new Set([...editor.doc.nodes.map((n) => n.id), ...editor.doc.edges.map((e) => e.id)]);
      for (const id of before) if (!hidden.has(id)) appearing.set(id, now);
    }
    prevHidden = hidden;
    if (appearing.size === 0) return null;
    const out = new Map<string, number>();
    for (const [id, t] of appearing) {
      const k = (now - t) / FADE_MS;
      if (k >= 1) appearing.delete(id);
      else out.set(id, k * k * (3 - 2 * k));
    }
    return out.size ? out : null;
  }

  // --- Caméra animée (récit) ---------------------------------------------------------

  /** Une vue : point du monde au centre de l'écran, et zoom. Plus facile à interpoler que le décalage. */
  type CamView = { cx: number; cy: number; zoom: number };
  let anim: { from: CamView; to: CamView; t0: number; dur: number } | null = null;

  function currentView(): CamView {
    const c = camera.toWorld({ x: width / 2, y: height / 2 });
    return { cx: c.x, cy: c.y, zoom: camera.zoom };
  }

  function applyView(v: CamView) {
    camera.zoom = v.zoom;
    camera.x = width / 2 - v.cx * v.zoom;
    camera.y = height / 2 - v.cy * v.zoom;
  }

  /** Cadre des nœuds, en glissant doucement jusqu'à eux. */
  function frameNodes(nodes: SysNode[], m: Margins, duration = 900) {
    const box = nodesBounds(nodes);
    if (!box || !width) return;
    box.maxY += 44; // courbes d'historique
    const target = new Camera();
    target.fit(box, width, height, m);
    const to = { cx: (width / 2 - target.x) / target.zoom, cy: (height / 2 - target.y) / target.zoom, zoom: target.zoom };
    anim = { from: currentView(), to, t0: performance.now(), dur: duration };
    requestRender();
  }

  function stepAnimation(now: number) {
    if (!anim) return;
    const k = Math.min(1, Math.max(0, (now - anim.t0) / anim.dur));
    const e = k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2;
    const { from, to } = anim;
    applyView({
      cx: from.cx + (to.cx - from.cx) * e,
      cy: from.cy + (to.cy - from.cy) * e,
      // Interpolation du zoom en logarithme : le grossissement paraît régulier.
      zoom: Math.exp(Math.log(from.zoom) + (Math.log(to.zoom) - Math.log(from.zoom)) * e),
    });
    if (k >= 1) anim = null;
  }

  // --- Rendu -----------------------------------------------------------------------

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
    stepAnimation(now);
    const story = storyView();
    const loop = loopFocus();
    const fade = fades(story.hidden, now);
    render({ ctx, width, height, dpr, camera, theme: THEMES[prefs.theme] }, editor.doc, {
      selection: editor.selection,
      hover: interaction.hover,
      linkTarget: interaction.linkTarget,
      trail: interaction.trail,
      erasing: interaction.erasing,
      pulseHover: interaction.pulseHover,
      loopLabels: prefs.showLoops ? loops().labels : null,
      focus: loop ? new Set([...loop.nodes, ...loop.edges]) : story.focus,
      focusLoop: loop?.key ?? null,
      hidden: story.hidden,
      fade,
      sim: sim.engine,
    });
    if (camera.zoom !== lastZoom) {
      lastZoom = camera.zoom;
      onzoom?.(camera.zoom);
    }
    // En simulation ou pendant une animation, on dessine en continu ; sinon on attend le prochain changement.
    if (editor.simulating || anim || fade) requestRender();
    else lastTime = 0;
  }

  /** Marges de l'interface : barres du haut et du bas en édition, carte de narration en présentation. */
  function margins(): Margins {
    const side = Math.min(60, width * 0.06);
    if (editor.mode === 'present') {
      return { top: Math.min(60, height * 0.08), bottom: Math.min(270, height * 0.38), left: side, right: side };
    }
    const m = { top: Math.min(90, height * 0.12), bottom: Math.min(120, height * 0.16), left: side, right: side };
    // Le panneau du récit occupe la gauche (bureau) ou le bas (téléphone).
    if (editor.mode === 'edit' && storyUi.open) {
      if (width > 700) m.left = 370;
      else m.bottom = height * 0.48 + 90;
    }
    return m;
  }

  export function fit() {
    anim = null;
    const box = docBounds(editor.doc);
    // Place sous les galets pour les courbes d'historique de la simulation.
    if (box) box.maxY += 44;
    camera.fit(box, width, height, margins());
    requestRender();
  }

  export function zoomBy(factor: number) {
    anim = null;
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
    anim = null; // l'utilisateur reprend la main sur la vue
    interaction.down(e, local(e));
  }

  const isTyping = (e: KeyboardEvent) =>
    e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement;

  function onkeydown(e: KeyboardEvent) {
    // En présentation, Espace fait avancer le récit (géré par App).
    if (e.code === 'Space' && !isTyping(e) && editor.mode !== 'present') {
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
      anim = null;
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
    void storyUi.open;
    void storyUi.active;
    void storyUi.picking;
    requestRender();
  });

  // Ouvrir ou fermer le récit : on recadre selon la place disponible.
  $effect(() => {
    void storyUi.open;
    untrack(() => {
      if (editor.mode !== 'present' && width) fit();
    });
  });

  // En sortant d'une présentation, on retrouve une vue d'ensemble.
  let previousMode = editor.mode;
  $effect(() => {
    const mode = editor.mode;
    if (previousMode === 'present' && mode !== 'present') untrack(fit);
    previousMode = mode;
  });

  // Présentation : à chaque étape, la vue glisse vers les éléments concernés.
  $effect(() => {
    if (editor.mode !== 'present') {
      prevHidden = null;
      appearing.clear();
      return;
    }
    frameNodes(framingNodes(editor.doc, presenter.index), margins());
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
    void storyUi.picking;
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
