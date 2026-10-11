<script lang="ts">
  import { editor } from '../model/editor.svelte';
  import { analyzeLoop, describeLoop, findLoops } from '../model/loops';
  import { richText } from '../model/story';
  import { formatDuration, formatEstimate, unitName } from '../model/time';
  import { MAX_RADIUS, MAX_WEIGHT, MIN_RADIUS, MIN_WEIGHT, type NodeKind, type ThresholdMode } from '../model/types';
  import { COLOR_KEYS, COLOR_NAMES } from '../theme';
  import Duration from './Duration.svelte';
  import { loopSection, SECTIONS } from './help';
  import { router } from './router.svelte';
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
    return e ? { ...e, fromName: nameOf(e.from), toName: nameOf(e.to), toStock: editor.node(e.to)?.causal.kind === 'stock' } : null;
  });

  const loop = $derived.by(() => {
    void editor.rev;
    const sel = editor.selection;
    if (sel?.kind !== 'loop') return null;
    const l = findLoops(editor.doc).find((x) => x.key === sel.id);
    if (!l) return null;
    const steps = l.edges.map((id, i) => ({ name: nameOf(l.nodes[i]), polarity: editor.edge(id)?.polarity ?? 1 }));
    return { ...l, steps, negatives: steps.filter((s) => s.polarity === -1).length, analysis: analyzeLoop(editor.doc, l) };
  });

  const unit = $derived.by(() => {
    void editor.rev;
    return editor.doc.timeUnit;
  });

  // Masqué pendant le choix des éléments d'une étape, et sur téléphone quand le récit occupe le bas de l'écran.
  // En simulation et en présentation, seule une boucle touchée l'ouvre (un récit peut inviter à le faire).
  const visible = $derived(
    !storyUi.picking &&
      !(storyUi.open && layout.narrow) &&
      (editor.mode === 'edit' ? !!(node || edge || loop) : !!loop),
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

  /** Une variable ne peut pas « larguer » : elle n'accumule rien. */
  function setKind(id: string, kind: NodeKind, mode: ThresholdMode) {
    editor.updateCausal(id, kind === 'variable' && mode === 'release' ? { kind, thresholdMode: 'none' } : { kind });
  }

  // Curseur de force logarithmique : de 0,01 à 3, chaque ordre de grandeur a la même place (comme un bouton de volume).
  const WEIGHT_STEPS = 1000;
  const WEIGHT_SPAN = Math.log(MAX_WEIGHT / MIN_WEIGHT);
  const weightToSlider = (w: number) => Math.round((WEIGHT_STEPS * Math.log(w / MIN_WEIGHT)) / WEIGHT_SPAN);
  const sliderToWeight = (v: number) => Number((MIN_WEIGHT * Math.exp((v / WEIGHT_STEPS) * WEIGHT_SPAN)).toPrecision(2));

  const KIND_OPTIONS: { value: NodeKind; label: string }[] = [
    { value: 'variable', label: 'Variable' },
    { value: 'stock', label: 'Accumulation' },
  ];
  const KIND_HELP: Record<NodeKind, string> = {
    variable: 'Suit ses causes **immédiatement**. Ex. : naissances, chauffage, peur, prix.',
    stock: 'Se **remplit ou se vide au fil du temps**, au rythme de ce qui arrive par ses liens. C’est elle qui donne son rythme à une boucle. Ex. : population, température, argent, CO₂ dans l’air.',
  };
  const THRESHOLD_HELP: Record<ThresholdMode, string> = {
    none: 'Le niveau monte et descend librement.',
    tip: 'Point de bascule : une fois le seuil franchi, l’élément se bloque au maximum. Plus rien ne peut le faire redescendre.',
    release: 'Largage : l’accumulation se remplit sans rien transmettre… puis se vide d’un coup au seuil, et transmet tout ce qu’elle avait retenu.',
  };
  const thresholdOptions = (kind: NodeKind): { value: ThresholdMode; label: string }[] => [
    { value: 'none', label: 'Aucun' },
    { value: 'tip', label: 'Bascule' },
    ...(kind === 'stock' ? [{ value: 'release' as const, label: 'Largage' }] : []),
  ];
</script>

{#if visible}
  <aside class="inspector card" class:present={editor.mode === 'present'} aria-label="Inspecteur">
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

      <div class="field">
        <span>Nature</span>
        <Segmented label="Nature de l’élément" options={KIND_OPTIONS} value={c.kind} onchange={(v) => setKind(id, v, c.thresholdMode)} />
        <p class="help">
          {#each richText(KIND_HELP[c.kind]) as seg, i (i)}{#if seg.bold}<b>{seg.text}</b>{:else}{seg.text}{/if}{/each}
          <button class="why" onclick={() => router.showHelp(SECTIONS.nature)}>En savoir plus</button>
        </p>
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
        <label class="field" title="Niveau d’équilibre : sans intervention, l’élément y reste.">
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

      <details class="more" open={c.thresholdMode !== 'none' || c.relax > 0 || c.saturate}>
        <summary>Comportement <Icon name="chevron" size={16} /></summary>

        <div class="field">
          <span>Seuil</span>
          <Segmented
            label="Seuil"
            options={thresholdOptions(c.kind)}
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
          <Duration
            label="Retour à l’équilibre"
            value={c.relax}
            {unit}
            zero="Jamais"
            onchange={(v) => editor.updateCausal(id, { relax: v })}
            onunit={(u) => editor.setTimeUnit(u)}
          />
          <p class="help">
            {#if c.relax > 0}
              {c.kind === 'stock'
                ? `Revient d’elle-même vers son niveau de départ, les deux tiers du chemin en ${formatDuration(c.relax, unit)} : une petite boucle équilibrante cachée (une fuite).`
                : `Un appui sur ▲ ▼ s’estompe : les deux tiers en ${formatDuration(c.relax, unit)}.`}
            {:else}
              {c.kind === 'stock' ? 'Sans cause qui la pousse, l’accumulation garde son niveau.' : 'Un appui sur ▲ ▼ dure tant qu’on ne le compense pas.'}
            {/if}
          </p>
        </div>

        <label class="check">
          <input type="checkbox" checked={c.saturate} onchange={(e) => editor.updateCausal(id, { saturate: e.currentTarget.checked })} />
          <span><b>Saturation</b> : plus l’élément est plein (ou vide), moins il réagit et moins il transmet. Une boucle renforçante dessine alors une courbe en S.</span>
        </label>
      </details>

      <div class="actions">
        <button class="btn danger" onclick={() => editor.remove([id])}>
          <Icon name="trash" size={18} /> Supprimer
        </button>
      </div>
    {:else if edge}
      {@const id = edge.id}
      {@const points = formatEstimate(10 * edge.weight)}
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

      <label class="field">
        <span>Force <em>×{formatEstimate(edge.weight)}</em></span>
        <input
          type="range"
          min="0"
          max={WEIGHT_STEPS}
          value={weightToSlider(edge.weight)}
          oninput={(e) => editor.updateEdge(id, { weight: sliderToWeight(+e.currentTarget.value) }, 'weight:' + id)}
        />
      </label>
      <p class="help">
        Si <b>{edge.fromName}</b> est 10 points au-dessus de son départ,
        {#if edge.toStock}
          <b>{edge.toName}</b> {edge.polarity === 1 ? 'monte' : 'baisse'} de {points} points par {unitName(unit, 1)}{edge.delay > 0 ? ' (une fois le retard passé)' : ''}.
        {:else}
          <b>{edge.toName}</b> est {points} points {edge.polarity === 1 ? 'au-dessus' : 'en dessous'} du sien{edge.delay > 0 ? ', une fois le retard passé' : ''}.
        {/if}
      </p>

      <div class="field">
        <span>Retard</span>
        <Duration
          label="Retard du lien"
          value={edge.delay}
          {unit}
          zero="Aucun"
          onchange={(v) => editor.updateEdge(id, { delay: v })}
          onunit={(u) => editor.setTimeUnit(u)}
        />
        <p class="help">
          {edge.delay > 0
            ? `L’effet arrive progressivement, en moyenne au bout de ${formatDuration(edge.delay, unit)}.`
            : 'L’effet est immédiat.'}
          Dans une boucle équilibrante, un retard long par rapport à son temps de réaction la fait osciller : touche l’étiquette de la boucle pour savoir à partir de quand.
          <button class="why" onclick={() => router.showHelp(SECTIONS.delay)}>Comment marche un retard ?</button>
        </p>
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
      {@const a = loop.analysis}
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

      <section class="analysis" class:warn={a.verdict === 'instant' || a.verdict === 'unstable'}>
        <h3>Son rythme</h3>
        <p>{#each richText(a.text) as seg, i (i)}{#if seg.bold}<b>{seg.text}</b>{:else}{seg.text}{/if}{/each}</p>
        <dl class="facts">
          <div><dt>Accumulations</dt><dd>{a.stocks}</dd></div>
          <div><dt>Retard total</dt><dd>{a.delay > 0 ? formatDuration(a.delay, unit) : 'aucun'}</dd></div>
          <div><dt>Forces</dt><dd>×{formatEstimate(a.gain)}</dd></div>
        </dl>
        <p class="help">
          Estimation pour la boucle seule : saturations, seuils et autres boucles peuvent changer la donne.
          <button class="why" onclick={() => router.showHelp(loopSection(a))}>Pourquoi ?</button>
        </p>
      </section>
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

  /* Présentation : pas de barre du haut, et le bas de l'écran appartient à la carte du récit. */
  .inspector.present {
    top: 16px;
    max-height: calc(100% - 320px);
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

  .help b {
    color: var(--ink);
  }

  /* Lien vers la documentation, au fil du texte. */
  .why {
    display: inline;
    padding: 0;
    border: none;
    background: none;
    font: inherit;
    font-weight: 800;
    color: var(--slate-stroke);
    text-decoration: underline;
    text-decoration-thickness: 1.5px;
    text-underline-offset: 2px;
    cursor: pointer;
  }

  .why::after {
    content: ' →';
  }

  /* Analyse de la boucle : une petite carte creusée dans la carte. */
  .analysis {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px 14px;
    border-radius: 14px;
    background: color-mix(in srgb, var(--paper-deep) 45%, transparent);
    box-shadow: inset 0 1px 3px var(--shadow);
  }

  .analysis.warn {
    background: color-mix(in srgb, var(--negative) 14%, var(--card));
  }

  .analysis h3 {
    margin: 0;
    font-family: var(--font-title);
    font-weight: 600;
    font-size: 15px;
  }

  .analysis p {
    margin: 0;
    font-size: 14px;
    line-height: 1.45;
  }

  .analysis p.help {
    font-size: 12px;
  }

  .facts {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 14px;
    margin: 0;
    font-size: 12.5px;
  }

  .facts div {
    display: flex;
    gap: 4px;
  }

  .facts dt {
    color: var(--ink-soft);
    font-weight: 600;
  }

  .facts dt::after {
    content: ' :';
  }

  .facts dd {
    margin: 0;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
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
    .inspector.present {
      top: max(12px, env(safe-area-inset-top));
      bottom: auto;
      max-height: 45vh;
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
