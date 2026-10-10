<script lang="ts" generics="T">
  import type { Snippet } from 'svelte';

  let {
    options,
    value,
    onchange,
    label,
    option,
  }: {
    options: { value: T; label: string }[];
    value: T;
    onchange: (value: T) => void;
    label: string;
    /** Rendu personnalisé d'une option (sinon, son libellé). */
    option?: Snippet<[{ value: T; label: string }]>;
  } = $props();
</script>

<div class="segmented" role="radiogroup" aria-label={label}>
  {#each options as o (o.value)}
    <button
      class="btn"
      class:active={o.value === value}
      role="radio"
      aria-checked={o.value === value}
      onclick={() => o.value !== value && onchange(o.value)}
    >
      {#if option}{@render option(o)}{:else}{o.label}{/if}
    </button>
  {/each}
</div>

<style>
  .segmented {
    display: flex;
    gap: 3px;
    padding: 3px;
    border-radius: 14px;
    background: color-mix(in srgb, var(--paper-deep) 50%, transparent);
  }

  .btn {
    flex: 1;
    min-height: 36px;
    padding: 0 6px;
    font-size: 13px;
    border-radius: 11px;
  }
</style>
