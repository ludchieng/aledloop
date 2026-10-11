<script lang="ts">
  import { richText } from '../model/story';

  /** Un texte avec du `**gras**`, rendu sans HTML (donc sans risque d'injection). */
  let { text }: { text: string } = $props();
</script>

{#each richText(text) as seg, i (i)}{#if seg.bold}<b>{seg.text}</b>{:else}{seg.text}{/if}{/each}
