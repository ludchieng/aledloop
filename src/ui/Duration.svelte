<script lang="ts">
  import { formatNumber, parseDuration, stepDuration, unitName } from '../model/time';
  import { TIME_UNITS, type TimeUnit } from '../model/types';

  let {
    value,
    unit,
    label,
    zero,
    onchange,
    onunit,
  }: {
    /** Durée, en unités de temps (0 : aucune). */
    value: number;
    unit: TimeUnit;
    label: string;
    /** Texte affiché pour 0 (« Aucun », « Jamais »…). */
    zero: string;
    onchange: (value: number) => void;
    /** L'unité est commune à tout le document. */
    onunit: (unit: TimeUnit) => void;
  } = $props();
</script>

<!-- Sur tablette, les boutons − et + évitent d'ouvrir le clavier ; la saisie reste possible. -->
<div class="duration" role="group" aria-label={label}>
  <button class="btn step" aria-label="Moins" disabled={value <= 0} onclick={() => onchange(stepDuration(value, -1))}>−</button>
  <input
    type="text"
    inputmode="decimal"
    aria-label={label}
    value={value > 0 ? formatNumber(value) : ''}
    placeholder={zero}
    onchange={(e) => onchange(parseDuration(e.currentTarget.value))}
    onkeydown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
  />
  <button class="btn step" aria-label="Plus" onclick={() => onchange(stepDuration(value, 1))}>+</button>
  <select aria-label="Unité de temps du diagramme" value={unit} onchange={(e) => onunit(e.currentTarget.value as TimeUnit)}>
    {#each TIME_UNITS as u (u)}
      <option value={u}>{unitName(u, value || 2)}</option>
    {/each}
  </select>
</div>

<style>
  .duration {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .step {
    min-width: 36px;
    min-height: 36px;
    padding: 0;
    font-size: 20px;
    font-weight: 800;
    border-radius: 11px;
    background: color-mix(in srgb, var(--paper-deep) 50%, transparent);
  }

  input,
  select {
    min-height: 36px;
    border: none;
    border-radius: 11px;
    background: var(--paper);
    box-shadow: inset 0 2px 4px var(--shadow);
    font-weight: 700;
    color: var(--ink);
    outline: none;
  }

  input {
    width: 0;
    flex: 1;
    min-width: 44px;
    padding: 0 8px;
    text-align: center;
    font-size: 16px; /* 16px évite le zoom automatique d'iOS au focus */
    font-variant-numeric: tabular-nums;
  }

  input::placeholder {
    color: var(--ink-soft);
    font-weight: 600;
    font-size: 14px;
  }

  select {
    flex: 1.3;
    min-width: 0;
    padding: 0 6px;
    font-size: 14px;
  }

  input:focus,
  select:focus-visible {
    box-shadow: inset 0 2px 4px var(--shadow), 0 0 0 2px var(--selection);
  }
</style>
