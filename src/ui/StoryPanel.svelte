<script lang="ts">
  import { tick } from 'svelte';
  import { editor } from '../model/editor.svelte';
  import { describeFocus } from '../model/story';
  import Icon from './Icon.svelte';
  import { layout } from './layout.svelte';
  import { toasts } from './notify.svelte';
  import { router } from './router.svelte';
  import { storyUi } from './story.svelte';

  // Comme ailleurs : on lit `rev` et on renvoie des copies, sinon rien ne se met à jour.
  const story = $derived.by(() => {
    void editor.rev;
    const doc = editor.doc;
    return {
      reveal: doc.story.reveal,
      steps: doc.story.steps.map((s) => ({
        ...s,
        summary: describeFocus(doc, s),
        pulseValue: s.pulse ? `${s.pulse.node}|${s.pulse.delta}` : '',
      })),
    };
  });

  const nodes = $derived.by(() => {
    void editor.rev;
    return editor.doc.nodes.map((n) => ({ id: n.id, label: n.label.trim() || 'sans nom' }));
  });

  // L'étape active peut disparaître (annuler, nouveau document…).
  $effect(() => {
    if (storyUi.active && !story.steps.some((s) => s.id === storyUi.active)) {
      storyUi.active = null;
      storyUi.picking = false;
    }
  });

  const activeIndex = $derived(story.steps.findIndex((s) => s.id === storyUi.active));

  let list: HTMLOListElement | undefined = $state();

  async function addStep() {
    const step = editor.addStep(storyUi.active ?? undefined);
    storyUi.active = step.id;
    storyUi.picking = false;
    await tick();
    list?.querySelector<HTMLTextAreaElement>(`[data-step="${step.id}"] textarea`)?.focus();
  }

  function activate(id: string) {
    if (storyUi.active !== id) storyUi.picking = false;
    storyUi.active = id;
  }

  function togglePicking(id: string) {
    if (storyUi.active === id && storyUi.picking) {
      storyUi.picking = false;
      return;
    }
    storyUi.active = id;
    storyUi.picking = true;
    editor.selection = null;
  }

  function setPulse(id: string, value: string) {
    if (!value) {
      editor.updateStep(id, { pulse: null });
      return;
    }
    const [node, delta] = value.split('|');
    editor.updateStep(id, { pulse: { node, delta: delta === '-1' ? -1 : 1 } });
  }

  function present() {
    if (!router.present(Math.max(0, activeIndex))) toasts.show('Ajoute d’abord une étape au récit.');
  }
</script>

{#if storyUi.picking && activeIndex >= 0}
  <div class="banner card" role="status">
    <Icon name="target" size={18} />
    <span>Touche les éléments à mettre en avant à l’<b>étape {activeIndex + 1}</b>.</span>
    <button class="btn primary" onclick={() => (storyUi.picking = false)}>Terminé</button>
  </div>
{/if}

<!-- Sur téléphone, pendant le choix, le panneau se replie pour laisser voir le diagramme. -->
<aside class="panel card" aria-label="Récit" hidden={layout.narrow && storyUi.picking}>
  <header>
    <h2>Récit</h2>
    <button class="btn close" aria-label="Fermer le récit" title="Fermer" onclick={() => storyUi.toggle()}>
      <Icon name="close" size={18} />
    </button>
  </header>
  <p class="intro">
    Raconte ton système étape par étape : à chaque étape, un texte, des éléments mis en avant, et si tu veux une action (augmenter ou diminuer un élément).
  </p>

  <label class="check">
    <input type="checkbox" checked={story.reveal} onchange={(e) => editor.setReveal(e.currentTarget.checked)} />
    <span><b>Construire le diagramme au fil du récit</b> : un élément n’apparaît qu’une fois mis en avant.</span>
  </label>

  <ol class="steps" bind:this={list}>
    {#each story.steps as step, i (step.id)}
      {@const active = storyUi.active === step.id}
      <li class="step" class:active data-step={step.id}>
        <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
        <div class="step-head" onclick={() => activate(step.id)}>
          <span class="num">{i + 1}</span>
          <span class="grow"></span>
          <button class="btn mini" aria-label="Monter" title="Monter" disabled={i === 0} onclick={() => editor.moveStep(step.id, -1)}>
            <Icon name="up" size={16} />
          </button>
          <button
            class="btn mini"
            aria-label="Descendre"
            title="Descendre"
            disabled={i === story.steps.length - 1}
            onclick={() => editor.moveStep(step.id, 1)}
          >
            <Icon name="chevron" size={16} />
          </button>
          <button class="btn mini danger" aria-label="Supprimer l’étape" title="Supprimer l’étape" onclick={() => editor.removeStep(step.id)}>
            <Icon name="trash" size={16} />
          </button>
        </div>

        <textarea
          rows="3"
          placeholder="Ce que tu racontes à cette étape… (**gras** pour insister)"
          value={step.text}
          onfocus={() => activate(step.id)}
          oninput={(e) => editor.updateStep(step.id, { text: e.currentTarget.value }, 'text:' + step.id)}
        ></textarea>

        <div class="focus">
          <span class="label">Mis en avant</span>
          <span class="summary">{step.summary}</span>
          <button class="btn pick" class:active={active && storyUi.picking} onclick={() => togglePicking(step.id)}>
            <Icon name="target" size={16} />
            {active && storyUi.picking ? 'Terminé' : 'Choisir'}
          </button>
        </div>

        <label class="action">
          <span class="label">Action</span>
          <select value={step.pulseValue} onchange={(e) => setPulse(step.id, e.currentTarget.value)} onfocus={() => activate(step.id)}>
            <option value="">Aucune</option>
            {#each nodes as n (n.id)}
              <option value="{n.id}|1">▲ Augmenter « {n.label} »</option>
              <option value="{n.id}|-1">▼ Diminuer « {n.label} »</option>
            {/each}
          </select>
        </label>
      </li>
    {/each}
  </ol>

  <footer>
    <button class="btn" onclick={addStep}><Icon name="plus" size={18} /> Ajouter une étape</button>
    <button class="btn primary" disabled={story.steps.length === 0} onclick={present}>
      <Icon name="present" size={18} /> Présenter
    </button>
  </footer>
</aside>

<style>
  .panel[hidden] {
    display: none;
  }

  .panel {
    position: absolute;
    top: 76px;
    left: 16px;
    width: 330px;
    max-height: calc(100% - 180px);
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 14px 16px 12px;
    z-index: 9;
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  h2 {
    margin: 0;
    font-family: var(--font-title);
    font-weight: 600;
    font-size: 20px;
  }

  .close {
    min-width: 34px;
    min-height: 34px;
    color: var(--ink-soft);
  }

  .intro {
    margin: 0;
    font-size: 13px;
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

  .steps {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin: 0 -4px;
    padding: 2px 4px;
    list-style: none;
    overflow-y: auto;
    min-height: 0;
  }

  .step {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 8px 10px 10px;
    border-radius: 14px;
    background: color-mix(in srgb, var(--paper-deep) 38%, transparent);
    border: 2px solid transparent;
    transition: border-color 0.15s;
  }

  .step.active {
    border-color: color-mix(in srgb, var(--selection) 70%, transparent);
    background: color-mix(in srgb, var(--paper-deep) 55%, transparent);
  }

  .step-head {
    display: flex;
    align-items: center;
    gap: 2px;
    cursor: pointer;
  }

  .num {
    display: grid;
    place-items: center;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    background: var(--card);
    font-family: var(--font-title);
    font-weight: 600;
    font-size: 14px;
    box-shadow: 0 1px 3px var(--shadow);
  }

  .grow {
    flex: 1;
  }

  .mini {
    min-width: 30px;
    min-height: 30px;
    padding: 0;
    color: var(--ink-soft);
  }

  .mini.danger {
    color: var(--negative);
  }

  textarea {
    resize: vertical;
    min-height: 64px;
    padding: 8px 10px;
    border: none;
    border-radius: 10px;
    background: var(--paper);
    box-shadow: inset 0 2px 4px var(--shadow);
    font: inherit;
    font-size: 16px; /* évite le zoom automatique d'iOS au focus */
    line-height: 1.4;
    color: var(--ink);
    outline: none;
  }

  textarea:focus {
    box-shadow: inset 0 2px 4px var(--shadow), 0 0 0 2px var(--selection);
  }

  .focus,
  .action {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
  }

  .label {
    flex-shrink: 0;
    width: 82px;
    font-weight: 700;
    color: var(--ink-soft);
  }

  .summary {
    flex: 1;
    min-width: 0;
    line-height: 1.3;
  }

  .pick {
    min-height: 32px;
    padding: 0 8px;
    font-size: 13px;
    background: var(--card);
    box-shadow: 0 1px 3px var(--shadow);
  }

  .pick.active {
    color: var(--ink);
    background: var(--selection);
    box-shadow: inset 0 2px 4px var(--shadow);
  }

  select {
    flex: 1;
    min-width: 0;
    min-height: 34px;
    padding: 0 8px;
    border: none;
    border-radius: 10px;
    background: var(--paper);
    box-shadow: inset 0 2px 4px var(--shadow);
    font-size: 14px;
  }

  footer {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    padding-top: 4px;
  }

  .banner {
    position: absolute;
    bottom: calc(max(16px, env(safe-area-inset-bottom)) + 82px);
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 6px 6px 14px;
    font-size: 14px;
    z-index: 12;
    width: max-content;
    max-width: calc(100vw - 24px);
  }

  .banner .btn {
    min-height: 34px;
  }

  /* Sur téléphone : panneau en bas, au-dessus de la barre d'outils. */
  @media (max-width: 700px) {
    .panel {
      top: auto;
      left: 12px;
      right: 12px;
      width: auto;
      bottom: calc(max(16px, env(safe-area-inset-bottom)) + 76px);
      max-height: 48vh;
    }
    .intro {
      display: none;
    }
  }
</style>
