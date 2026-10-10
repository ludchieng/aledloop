<script lang="ts">
  import { toasts } from './notify.svelte';
</script>

<div class="toasts" aria-live="polite">
  {#each toasts.list as t (t.id)}
    <div class="toast card">
      <span>{t.message}</span>
      {#if t.action}
        {@const action = t.action}
        <button
          class="btn"
          onclick={() => {
            action.run();
            toasts.dismiss(t.id);
          }}>{action.label}</button
        >
      {/if}
    </div>
  {/each}
</div>

<style>
  .toasts {
    position: absolute;
    top: calc(max(12px, env(safe-area-inset-top)) + 64px);
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    z-index: 20;
    pointer-events: none;
    width: max-content;
    max-width: calc(100vw - 24px);
  }

  .toast {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 8px 8px 16px;
    min-height: 44px;
    font-size: 14px;
    font-weight: 600;
    border-radius: 14px;
    pointer-events: auto;
    animation: pop 0.25s cubic-bezier(0.2, 1.4, 0.4, 1);
  }

  .toast:not(:has(button)) {
    padding-right: 16px;
  }

  .toast .btn {
    min-height: 32px;
    color: var(--selection);
  }

  @keyframes pop {
    from {
      opacity: 0;
      transform: translateY(-6px) scale(0.96);
    }
  }
</style>
