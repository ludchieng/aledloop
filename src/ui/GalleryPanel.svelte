<script lang="ts">
  import { drawThumbnail } from '../canvas/thumbnail';
  import { i18n } from '../i18n/i18n.svelte';
  import { EXAMPLES, exampleText, type Level, type Topic } from '../model/examples';
  import type { Doc } from '../model/types';
  import { THEMES } from '../theme';
  import Icon from './Icon.svelte';
  import { prefs } from './prefs.svelte';
  import { router } from './router.svelte';

  const t = $derived(i18n.t);

  // Construits une fois : les miniatures et le nombre d'étapes des récits en ont besoin.
  const items = EXAMPLES.map((ex) => {
    const doc = ex.build();
    return { ex, doc, steps: doc.story.steps.length };
  });

  let topic = $state<Topic | 'all'>('all');
  const topics = [...new Set(EXAMPLES.map((ex) => ex.topic))];

  const sections = $derived(
    ([1, 2, 3] as Level[])
      .map((level) => ({ level, items: items.filter((it) => it.ex.level === level && (topic === 'all' || it.ex.topic === topic)) }))
      .filter((s) => s.items.length > 0),
  );

  // Les exemples qu'on a modifiés : on les retrouve tels quels en les rouvrant. Relu à chaque ouverture.
  const edited = $derived(router.galleryOpen ? router.editedExamples() : new Set<string>());

  let closeButton: HTMLButtonElement | undefined = $state();
  $effect(() => {
    if (router.galleryOpen) closeButton?.focus({ preventScroll: true });
  });

  /** Dessine la miniature, et la redessine si le thème ou la langue (des retards) change : lectures réactives. */
  function thumbnail(doc: Doc) {
    return (canvas: HTMLCanvasElement) => {
      drawThumbnail(canvas, doc, THEMES[prefs.theme], i18n.lang);
    };
  }
</script>

{#if router.galleryOpen}
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div class="backdrop" onclick={() => router.close()}></div>
  <div class="gallery card" role="dialog" aria-modal="true" aria-label={t.gallery.title}>
    <header>
      <div class="titles">
        <h2>{t.gallery.title}</h2>
        <p>{t.gallery.intro}</p>
      </div>
      <button bind:this={closeButton} class="btn close" aria-label={t.common.close} title={t.common.closeEsc} onclick={() => router.close()}>
        <Icon name="close" size={20} />
      </button>
    </header>

    <div class="topics" role="group" aria-label={t.gallery.topics}>
      <button class="chip" class:active={topic === 'all'} aria-pressed={topic === 'all'} onclick={() => (topic = 'all')}>{t.gallery.all}</button>
      {#each topics as name (name)}
        <button class="chip" class:active={topic === name} aria-pressed={topic === name} onclick={() => (topic = name)}>{t.gallery.topicNames[name]}</button>
      {/each}
    </div>

    <div class="scroll">
      {#each sections as section (section.level)}
        <section>
          <h3>
            <span class="level" aria-label={t.gallery.level(section.level)}>
              {#each [1, 2, 3] as i (i)}<span class="pip" class:on={i <= section.level}></span>{/each}
            </span>
            {t.gallery.levels[section.level].title}
          </h3>
          <p class="subtitle">{t.gallery.levels[section.level].subtitle}</p>
          <ul class="grid">
            {#each section.items as { ex, doc, steps } (ex.id)}
              {@const text = exampleText(ex, i18n.lang)}
              <li class="item">
                <button class="open" onclick={() => router.openExample(ex.id)} title={t.gallery.open(text.title)}>
                  <canvas class="thumb" {@attach thumbnail(doc)} aria-hidden="true"></canvas>
                  <span class="body">
                    <strong>{text.title}</strong>
                    <span class="desc">{text.description}</span>
                  </span>
                </button>
                <div class="foot">
                  <span class="tag">{t.gallery.topicNames[ex.topic]}</span>
                  <span class="tag shows">{text.shows}</span>
                  {#if edited.has(ex.id)}
                    <span class="tag edited" title={t.gallery.editedTitle}>{t.gallery.edited}</span>
                  {/if}
                  {#if steps > 0}
                    <button class="btn tell" onclick={() => router.openExample(ex.id, true)} title={t.gallery.tellTitle}>
                      <Icon name="present" size={16} /> {t.gallery.tell} · {steps}
                    </button>
                  {/if}
                </div>
              </li>
            {/each}
          </ul>
        </section>
      {/each}
    </div>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 30;
    background: color-mix(in srgb, var(--ink) 22%, transparent);
    backdrop-filter: blur(2px);
    animation: appear 0.2s ease-out;
  }

  .gallery {
    position: fixed;
    top: max(20px, env(safe-area-inset-top));
    bottom: max(20px, env(safe-area-inset-bottom));
    left: 50%;
    width: min(1120px, calc(100vw - 32px));
    transform: translateX(-50%);
    z-index: 31;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    animation: appear 0.25s ease-out;
  }

  header {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 22px 24px 8px;
  }

  .titles {
    flex: 1;
  }

  h2 {
    margin: 0;
    font-family: var(--font-title);
    font-weight: 600;
    font-size: 28px;
  }

  header p {
    margin: 4px 0 0;
    color: var(--ink-soft);
  }

  .close {
    min-width: 40px;
    min-height: 40px;
    color: var(--ink-soft);
  }

  .topics {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding: 6px 24px 14px;
    border-bottom: 1.5px dashed color-mix(in srgb, var(--ink) 14%, transparent);
  }

  .chip {
    min-height: 34px;
    padding: 0 14px;
    border: none;
    border-radius: 999px;
    background: color-mix(in srgb, var(--paper-deep) 45%, transparent);
    font-weight: 700;
    font-size: 13.5px;
    cursor: pointer;
    touch-action: manipulation;
    transition: background-color 0.15s, box-shadow 0.15s;
  }

  .chip:hover {
    background: color-mix(in srgb, var(--paper-deep) 80%, transparent);
  }

  /* Pastille enfoncée, comme les boutons d'outil actifs. */
  .chip.active {
    background: var(--paper-deep);
    box-shadow: inset 0 2px 5px var(--shadow), inset 0 -1px 0 var(--highlight);
  }

  .scroll {
    flex: 1;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 6px 24px 32px;
  }

  section {
    margin-top: 18px;
  }

  h3 {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 0;
    font-family: var(--font-title);
    font-weight: 600;
    font-size: 21px;
  }

  .level {
    display: inline-flex;
    gap: 3px;
  }

  .pip {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    border: 2px solid var(--ochre-stroke);
  }

  .pip.on {
    background: var(--ochre-stroke);
  }

  .subtitle {
    margin: 2px 0 12px;
    font-size: 14px;
    color: var(--ink-soft);
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 16px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  /* Chaque exemple est une petite carte de papier, qui se soulève sous le doigt. */
  .item {
    display: flex;
    flex-direction: column;
    border-radius: 16px;
    background: var(--card);
    box-shadow: 0 1px 0 var(--highlight) inset, 0 6px 16px -8px var(--shadow), 0 1px 4px -1px var(--shadow);
    overflow: hidden;
    transition: transform 0.15s, box-shadow 0.15s;
  }

  .item:hover {
    transform: translateY(-2px);
    box-shadow: 0 1px 0 var(--highlight) inset, 0 12px 24px -10px var(--shadow), 0 2px 6px -1px var(--shadow);
  }

  .open {
    display: flex;
    flex-direction: column;
    flex: 1;
    padding: 0;
    border: none;
    background: none;
    text-align: left;
    color: inherit;
    font: inherit;
    cursor: pointer;
  }

  .open:focus-visible {
    outline: 2px solid var(--selection);
    outline-offset: -2px;
    border-radius: 16px;
  }

  .thumb {
    display: block;
    width: 100%;
    aspect-ratio: 16 / 10;
    background: var(--paper);
    border-bottom: 1px solid color-mix(in srgb, var(--ink) 8%, transparent);
  }

  .body {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 12px 14px 6px;
  }

  .body strong {
    font-family: var(--font-title);
    font-weight: 600;
    font-size: 17px;
    line-height: 1.25;
  }

  .desc {
    font-size: 13.5px;
    line-height: 1.4;
    color: var(--ink-soft);
  }

  .foot {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    padding: 6px 12px 12px 14px;
  }

  .tag {
    padding: 2px 9px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--paper-deep) 50%, transparent);
    font-size: 12px;
    font-weight: 700;
    color: var(--ink-soft);
  }

  .tag.shows {
    background: color-mix(in srgb, var(--sage) 70%, transparent);
    color: var(--ink);
  }

  .tag.edited {
    background: color-mix(in srgb, var(--ochre) 75%, transparent);
    color: var(--ink);
  }

  .tell {
    margin-left: auto;
    min-height: 34px;
    padding: 0 10px;
    font-size: 13px;
    border-radius: 10px;
  }

  @keyframes appear {
    from {
      opacity: 0;
    }
  }

  @media (max-width: 700px) {
    .gallery {
      top: 8px;
      bottom: 8px;
      width: calc(100vw - 16px);
    }
    header {
      padding: 16px 16px 6px;
    }
    h2 {
      font-size: 23px;
    }
    .topics {
      padding: 4px 16px 12px;
    }
    .scroll {
      padding: 4px 16px 24px;
    }
  }
</style>
