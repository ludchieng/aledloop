<script lang="ts">
  import { editor } from '../model/editor.svelte';
  import { MAX_RADIUS, MIN_RADIUS } from '../model/types';
  import { COLOR_KEYS, COLOR_NAMES } from '../theme';
  import Icon from './Icon.svelte';
  import { toasts } from './notify.svelte';

  // Le document n'est pas profondément réactif : on lit `rev` puis on renvoie une COPIE,
  // sinon $derived (qui compare par référence) ne verrait jamais de changement.
  const node = $derived.by(() => {
    void editor.rev;
    const sel = editor.selection;
    const n = sel?.kind === 'node' ? editor.node(sel.id) : undefined;
    return n ? { ...n } : null;
  });

  const edge = $derived.by(() => {
    void editor.rev;
    const sel = editor.selection;
    const e = sel?.kind === 'edge' ? editor.edge(sel.id) : undefined;
    if (!e) return null;
    const name = (id: string) => editor.node(id)?.label.trim() || 'cet élément';
    return { ...e, fromName: name(e.from), toName: name(e.to) };
  });

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
</script>

{#if editor.mode === 'edit' && (node || edge)}
  <aside class="inspector card" aria-label="Inspecteur">
    <button class="btn close" aria-label="Fermer" title="Fermer (Échap)" onclick={() => (editor.selection = null)}>
      <Icon name="close" size={18} />
    </button>

    {#if node}
      {@const id = node.id}
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
          {#each COLOR_KEYS as c (c)}
            <button
              class="swatch"
              class:active={node.color === c}
              style:--fill="var(--{c})"
              style:--stroke="var(--{c}-stroke)"
              title={COLOR_NAMES[c]}
              aria-label={COLOR_NAMES[c]}
              aria-pressed={node.color === c}
              onclick={() => editor.updateNode(id, { color: c })}
            ></button>
          {/each}
        </div>
      </div>

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
        <span>Niveau de départ <em>{Math.round(node.init * 100)} %</em></span>
        <input
          type="range"
          min="0"
          max="100"
          value={Math.round(node.init * 100)}
          oninput={(e) => editor.updateNode(id, { init: +e.currentTarget.value / 100 }, 'init:' + id)}
        />
      </label>

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
      <div class="segmented" role="radiogroup" aria-label="Effet du lien">
        <button
          class="btn"
          class:active={edge.polarity === 1}
          role="radio"
          aria-checked={edge.polarity === 1}
          onclick={() => edge.polarity !== 1 && editor.togglePolarity(id)}
        >
          <span class="sign plus">+</span> augmente
        </button>
        <button
          class="btn"
          class:active={edge.polarity === -1}
          role="radio"
          aria-checked={edge.polarity === -1}
          onclick={() => edge.polarity !== -1 && editor.togglePolarity(id)}
        >
          <span class="sign minus">−</span> diminue
        </button>
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
    {/if}
  </aside>
{/if}

<style>
  .inspector {
    position: absolute;
    top: 76px;
    right: 16px;
    width: 280px;
    padding: 16px 18px 14px;
    z-index: 9;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  h2 {
    margin: 0;
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

  .sentence {
    margin: 0;
    font-size: 15px;
    line-height: 1.4;
  }

  .segmented {
    display: flex;
    gap: 4px;
    padding: 4px;
    border-radius: 14px;
    background: color-mix(in srgb, var(--paper-deep) 50%, transparent);
  }

  .segmented .btn {
    flex: 1;
  }

  .sign {
    font-size: 18px;
    font-weight: 900;
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

  /* Sur téléphone : panneau en bas, au-dessus de la barre d'outils. */
  @media (max-width: 700px) {
    .inspector {
      top: auto;
      right: 12px;
      left: 12px;
      width: auto;
      bottom: calc(max(16px, env(safe-area-inset-bottom)) + 76px);
      max-height: 40vh;
      overflow-y: auto;
      padding: 12px 14px 10px;
      /* Compact : les deux curseurs côte à côte, le reste sur toute la largeur. */
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px 14px;
    }
    .inspector > :not(.field:has(input[type='range'])) {
      grid-column: 1 / -1;
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
