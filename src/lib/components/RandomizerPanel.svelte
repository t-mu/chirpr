<script lang="ts">
	import type { SoundCategory } from '$lib/audio/randomizer';
	import PanelCard from '$lib/components/PanelCard.svelte';

	interface Props {
		onRandomize?: (category: SoundCategory) => void;
	}

	let { onRandomize }: Props = $props();
	const categories: SoundCategory[] = [
		'shoot',
		'jump',
		'explosion',
		'powerup',
		'coin',
		'hit',
		'blip'
	];

	function randomizeCategory(category: SoundCategory): void {
		onRandomize?.(category);
	}
</script>

<PanelCard title="RANDOMIZER">
	<div class="button-grid">
		{#each categories as category (category)}
			<button type="button" onclick={() => randomizeCategory(category)}>{category}</button>
		{/each}
	</div>
</PanelCard>

<style>
	.button-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.4rem;
	}

	button {
		font: inherit;
		font-size: 0.58rem;
		text-transform: uppercase;
		border: 2px solid var(--accent);
		background: transparent;
		color: inherit;
		padding: 0.45rem;
	}
</style>
