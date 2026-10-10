<script lang="ts">
  import { editor } from '../model/editor.svelte';
  import { describeLoop, findLoops } from '../model/loops';
  import { MAX_RADIUS, MIN_RADIUS, type ThresholdMode, type Weight } from '../model/types';
  import { COLOR_KEYS, COLOR_NAMES } from '../theme';
  import Icon from './Icon.svelte';
  import { toasts } from './notify.svelte';
  import { layout } from './layout.svelte';
  import Segmented from './Segmented.svelte';
  import { storyUi } from './story.svelte';

  // Le document n'est pas profondément réactif : on lit `rev` puis on renvoie une COPIE,
  // sinon $derived (qui compare par référence) ne verrait jamais de changement.
  const node = $derived.by(() => {
    void editor.rev;
    const sel = editor.selection;
    const n = sel?.kind === 'node' ? editor.node(sel.id) : undefined;
    return n ? { ...n, causal: { ...n.causal } } : null;
  });

  const nameOf = (id: string) => editor.node(id)?.label.trim() || 'cet élément';

  const edge = $derived.by(() => {
    void editor.rev;
    const sel = editor.selection;
    const e = sel?.kind === 'edge' ? editor.edge(sel.id) : undefined;
    return e ? { ...e, fromName: nameOf(e.from), toName: nameOf(e.to) } : null;
  });

  const loop = $derived.by(() => {
    void editor.rev;
    const sel = editor.selection;
    if (sel?.kind !== 'loop') return null;
    const l = findLoops(editor.doc).find((x) => x.key === sel.id);
    if (!l) return null;
    const steps = l.edges.map((id, i) => ({ name: nameOf(l.nodes[i]), polarity: editor.edge(id)?.polarity ?? 1 }));
    return { ...l, steps, negatives: steps.filter((s) => s.polarity === -1).length };
  });

  // Masqué pendant le choix des éléments d'une étape, et sur téléphone quand le récit occupe le bas de l'écran.
  const visible = $derived(
    !storyUi.picking &&
      !(storyUi.open && layout.narrow) &&
      (editor.mode === 'edit' ? !!(node || edge || loop) : editor.mode === 'sim' && !!loop),
  );

  let labelInput: HTMLInputElement | undefined = $state();

  // Un nœud vient d'être créé : on propose tout de suite de le nommer.
  // (Seulement à la création : sélectionner un nœud existant ne doit pas ouvrir le clavier sur tablette.)
  let focusHandled = editor.focusLabel;
  $effect(() => {
    const request = editor.focusLabel;
    if (request > focusHandled && labelInput) {
      focusHandled = request;
      labelInput.focus();
      labelInput.select();
    }
  });

  function reverse(id: string) {
    if (!editor.reverseEdge(id)) toasts.show('Il existe déjà un lien dans l’autre sens.');
  }

  const THRESHOLD_OPTIONS: { value: ThresholdMode; label: string }[] = [
    { value: 'none', label: 'Aucun' },
    { value: 'tip', label: 'Bascule' },
    { value: 'release', label: 'Largage' },
  ];
  const THRESHOLD_HELP: Record<ThresholdMode, string> = {
    none: 'Le niveau monte et descend librement.',
    tip: 'Point de bascule : une fois le seuil franchi, l’élément se bloque au maximum. Plus rien ne peut le faire redescendre.',
    release: 'Accumulation : l’élément retient les impulsions sans rien transmettre… puis relâche tout d’un coup au seuil.',
  };
  const RELAX_OPTIONS: { value: 0 | 1 | 2; label: string }[] = [
    { value: 0, label: 'Non' },
    { value: 1, label: 'Lent' },
    { value: 2, label: 'Rapide' },
  ];
  const WEIGHT_OPTIONS: { value: Weight; label: string }[] = [
    { value: 0.5, label: 'Faible' },
    { value: 1, label: 'Normale' },
    { value: 2, label: 'Forte' },
  ];
  const DELAY_OPTIONS: { value: 0 | 1 | 2; label: string }[] = [
    { value: 0, label: 'Aucun' },
    { value: 1, label: 'Lent' },
    { value: 2, label: 'Très lent' },
  ];
</script>

{#if visible}
  <aside class="inspector card" aria-label="Inspecteur">
    <button class="btn close" aria-label="Fermer" title="Fermer (Échap)" onclick={() => (editor.selection = null)}>
      <Icon name="close" size={18} />
    </button>

    {#if node}
      {@const id = node.id}
      {@const c = node.causal}
      <h2>Élément</h2>
      <label class="field">
        <span>Nom</span>
        <input
          bind:this={labelInput}
          type="text"
          value={node.label}
          placeholder="Ex. : Lapins, Température…"
          maxlength="60"
          oninput={(e) => editor.updateNode(id, { label: e.currentTarget.value }, 'label:' + id)}
          onkeydown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        />
      </label>

      <div class="field">
        <span>Couleur</span>
        <div class="swatches">
          {#each COLOR_KEYS as k (k)}
            <button
              class="swatch"
              class:active={node.color === k}
              style:--fill="var(--{k})"
              style:--stroke="var(--{k}-stroke)"
              title={COLOR_NAMES[k]}
              aria-label={COLOR_NAMES[k]}
              aria-pressed={node.color === k}
              onclick={() => editor.updateNode(id, { color: k })}
            ></button>
          {/each}
        </div>
      </div>

      <div class="row">
        <label class="field">
          <span>Taille</span>
          <input
            type="range"
            min={MIN_RADIUS}
            max={MAX_RADIUS}
            value={node.r}
            oninput={(e) => editor.updateNode(id, { r: +e.currentTarget.value }, 'size:' + id)}
          />
        </label>
        <label class="field">
          <span>Départ <em>{Math.round(c.init * 100)} %</em></span>
          <input
            type="range"
            min="0"
            max="100"
            value={Math.round(c.init * 100)}
            oninput={(e) => editor.updateCausal(id, { init: +e.currentTarget.value / 100 }, 'init:' + id)}
          />
        </label>
      </div>

      <details class="more" open={c.thresholdMode !== 'none' || c.relax !== 0 || c.saturate}>
        <summary>Comportement <Icon name="chevron" size={16} /></summary>

        <div class="field">
          <span>Seuil</span>
          <Segmented
            label="Seuil"
            options={THRESHOLD_OPTIONS}
            value={c.thresholdMode}
            onchange={(v) => editor.updateCausal(id, { thresholdMode: v })}
          />
          <p class="help">{THRESHOLD_HELP[c.thresholdMode]}</p>
          {#if c.thresholdMode !== 'none'}
            <label class="field">
              <span>Niveau du seuil <em>{Math.round(c.threshold * 100)} %</em></span>
              <input
                type="range"
                min="10"
                max="100"
                value={Math.round(c.threshold * 100)}
                oninput={(e) => editor.updateCausal(id, { threshold: +e.currentTarget.value / 100 }, 'threshold:' + id)}
              />
            </label>
          {/if}
        </div>

        <div class="field">
          <span>Retour à l’équilibre</span>
          <Segmented label="Retour à l’équilibre" options={RELAX_OPTIONS} value={c.relax} onchange={(v) => editor.updateCausal(id, { relax: v })} />
          <p class="help">Sans impulsion, le niveau revient doucement vers son niveau de départ.</p>
        </div>

        <label class="check">
          <input type="checkbox" checked={c.saturate} onchange={(e) => editor.updateCausal(id, { saturate: e.currentTarget.checked })} />
          <span><b>Saturation</b> : plus l’élément est plein (ou vide), moins il réagit et moins il transmet.</span>
        </label>
      </details>

      <div class="actions">
        <button class="btn danger" onclick={() => editor.remove([id])}>
          <Icon name="trash" size={18} /> Supprimer
        </button>
      </div>
    {:else if edge}
      {@const id = edge.id}
      <h2>Lien</h2>
      <p class="sentence">
        Quand <b>{edge.fromName}</b> augmente, <b>{edge.toName}</b>
      </p>
      <Segmented
        label="Effet du lien"
        options={[
          { value: 1, label: 'augmente' },
          { value: -1, label: 'diminue' },
        ]}
        value={edge.polarity}
        onchange={() => editor.togglePolarity(id)}
      >
        {#snippet option(o)}
          <span class="sign" class:plus={o.value === 1} class:minus={o.value === -1}>{o.value === 1 ? '+' : '−'}</span>
          {o.label}
        {/snippet}
      </Segmented>

      <div class="field">
        <span>Force</span>
        <Segmented label="Force du lien" options={WEIGHT_OPTIONS} value={edge.weight} onchange={(v) => editor.updateEdge(id, { weight: v })} />
      </div>

      <div class="field">
        <span>Retard</span>
        <Segmented label="Retard du lien" options={DELAY_OPTIONS} value={edge.delay} onchange={(v) => editor.updateEdge(id, { delay: v })} />
        <p class="help">L’effet met plus de temps à arriver. Les retards font souvent osciller les boucles équilibrantes.</p>
      </div>

      <div class="actions">
        <button class="btn" onclick={() => reverse(id)}><Icon name="swap" size={18} /> Inverser le sens</button>
        <button class="btn" disabled={edge.bend === 0} onclick={() => editor.updateEdge(id, { bend: 0 })}>
          <Icon name="straight" size={18} /> Redresser
        </button>
        <button class="btn danger" onclick={() => editor.remove([], [id])}>
          <Icon name="trash" size={18} /> Supprimer
        </button>
      </div>
    {:else if loop}
      <h2 class="loop-title" class:r={loop.kind === 'R'}>
        <span class="loop-badge">{loop.kind}</span>
        Boucle {loop.kind === 'R' ? 'renforçante' : 'équilibrante'}
      </h2>
      <p class="sentence">{describeLoop(loop)}</p>
      <ol class="path">
        {#each loop.steps as step, i (i)}
          <li>
            <b>{step.name}</b>
            <span class="sign" class:plus={step.polarity === 1} class:minus={step.polarity === -1}>{step.polarity === 1 ? '+' : '−'}</span>
          </li>
        {/each}
        <li><b>{loop.steps[0].name}</b></li>
      </ol>
      <p class="help">
        {loop.negatives === 0 ? 'Aucun lien' : loop.negatives === 1 ? 'Un lien' : `${loop.negatives} liens`} « − » sur le chemin :
        un nombre {loop.negatives % 2 === 0 ? 'pair' : 'impair'}, donc
        {loop.kind === 'R' ? 'les effets s’additionnent.' : 'l’effet finit par se retourner contre lui-même.'}
      </p>
    {/if}
  </aside>
{/if}

<style>
  .inspector {
    position: absolute;
    top: 76px;
    right: 16px;
    width: 296px;
    max-height: calc(100% - 180px);
    overflow-y: auto;
    padding: 16px 18px 14px;
    z-index: 9;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  h2 {
    margin: 0;
    padding-right: 30px;
    font-family: var(--font-title);
    font-weight: 600;
    font-size: 20px;
  }

  .close {
    position: absolute;
    top: 8px;
    right: 8px;
    min-width: 34px;
    min-height: 34px;
    color: var(--ink-soft);
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 13px;
    font-weight: 700;
    color: var(--ink-soft);
  }

  .field em {
    font-style: normal;
    float: right;
    font-variant-numeric: tabular-nums;
  }

  .row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
  }

  input[type='text'] {
    padding: 10px 12px;
    border: none;
    border-radius: 12px;
    background: var(--paper);
    box-shadow: inset 0 2px 4px var(--shadow);
    font-size: 16px; /* 16px évite le zoom automatique d'iOS au focus */
    font-weight: 700;
    color: var(--ink);
    outline: none;
  }

  input[type='text']:focus {
    box-shadow: inset 0 2px 4px var(--shadow), 0 0 0 2px var(--selection);
  }

  .swatches {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .swatch {
    width: 34px;
    height: 34px;
    border-radius: 50%;
    border: 3px solid var(--stroke);
    background: var(--fill);
    cursor: pointer;
    box-shadow: 0 2px 5px -1px var(--shadow);
    transition: transform 0.1s;
  }

  .swatch.active {
    transform: scale(1.12);
    box-shadow: 0 0 0 3px var(--card), 0 0 0 5px var(--selection);
  }

  .more {
    display: flex;
    flex-direction: column;
    border-top: 1px solid color-mix(in srgb, var(--ink) 12%, transparent);
    padding-top: 10px;
  }

  .more[open] {
    gap: 14px;
  }

  .more > :not(summary) {
    margin-top: 12px;
  }

  summary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-family: var(--font-title);
    font-weight: 600;
    font-size: 16px;
    cursor: pointer;
    list-style: none;
    min-height: 32px;
  }

  summary::-webkit-details-marker {
    display: none;
  }

  .more[open] summary :global(svg) {
    transform: rotate(180deg);
  }

  .help {
    margin: 0;
    font-size: 12.5px;
    font-weight: 500;
    line-height: 1.4;
    color: var(--ink-soft);
  }

  .check {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    font-size: 13px;
    line-height: 1.4;
    color: var(--ink-soft);
    cursor: pointer;
  }

  .check b {
    color: var(--ink);
  }

  .check input {
    width: 20px;
    height: 20px;
    margin: 0;
    flex-shrink: 0;
    accent-color: var(--ochre-stroke);
  }

  .sentence {
    margin: 0;
    font-size: 15px;
    line-height: 1.45;
  }

  .sign {
    font-size: 18px;
    font-weight: 900;
    line-height: 1;
  }

  .plus {
    color: var(--positive);
  }

  .minus {
    color: var(--negative);
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin: 0 -6px;
  }

  .loop-title {
    display: flex;
    align-items: center;
    gap: 10px;
    --loop: var(--slate-stroke);
  }

  .loop-title.r {
    --loop: var(--terracotta-stroke);
  }

  .loop-badge {
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: 2.5px solid var(--loop);
    color: var(--loop);
    font-size: 16px;
    flex-shrink: 0;
  }

  .path {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 2px;
    margin: 0;
    padding: 10px 12px;
    list-style: none;
    border-radius: 12px;
    background: color-mix(in srgb, var(--paper-deep) 45%, transparent);
    font-size: 14px;
  }

  .path li {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .path li:not(:last-child)::after {
    content: '→';
    margin: 0 4px 0 2px;
    color: var(--ink-soft);
  }

  /* Sur téléphone : panneau en bas, au-dessus de la barre d'outils. */
  @media (max-width: 700px) {
    .inspector {
      top: auto;
      right: 12px;
      left: 12px;
      width: auto;
      bottom: calc(max(16px, env(safe-area-inset-bottom)) + 76px);
      max-height: 40vh;
      padding: 12px 14px 10px;
      gap: 10px;
    }
    h2 {
      font-size: 17px;
    }
    .swatch {
      width: 30px;
      height: 30px;
    }
  }
</style>
