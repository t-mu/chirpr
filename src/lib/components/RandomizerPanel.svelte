<script lang="ts">
	import type { SynthesizerAPI } from '$lib/audio/synthesizer';
	import { randomize, type SoundCategory } from '$lib/audio/randomizer';
	import { setParams } from '$lib/stores/synthParams.svelte';

	interface Props {
		synthesizer?: SynthesizerAPI | null;
	}

	let { synthesizer = null }: Props = $props();
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
		const next = randomize(category);
		setParams(next);
		synthesizer?.updateParams(next);
		synthesizer?.play('C4');
		setTimeout(() => synthesizer?.stop(), 220);
	}
</script>

<section class="panel">
	<h3>RANDOMIZER</h3>
	<div class="button-grid">
		{#each categories as category (category)}
			<button type="button" onclick={() => randomizeCategory(category)}>{category}</button>
		{/each}
	</div>
</section>

<style>
	.panel {
		border: 2px solid var(--accent);
		background: var(--surface);
		padding: 0.75rem;
		display: grid;
		gap: 0.6rem;
	}

	h3 {
		margin: 0;
		font-size: 0.7rem;
	}

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
