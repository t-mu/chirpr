<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		children: Snippet;
	}

	let { title, children }: Props = $props();
</script>

<section class="section-card">
	<header><h2>{title}</h2></header>
	<div class="section-card__body">
		{@render children?.()}
	</div>
</section>

<style>
	.section-card {
		border: 2px solid var(--accent, #00e5ff);
		background: var(--surface, #111128);
		padding: 0.8rem;
		box-shadow: 4px 4px 0 rgba(0, 0, 0, 0.4);
	}

	header {
		margin-bottom: 0.7rem;
	}

	h2 {
		margin: 0;
		font: inherit;
		font-size: 1.2rem;
	}

	.section-card__body {
		display: grid;
		gap: 0.7rem;
	}
</style>
