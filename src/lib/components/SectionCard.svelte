<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		children: Snippet;
	}

	let { title, children }: Props = $props();
</script>

<section class="section-card">
	<header>{title}</header>
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
		font-size: 0.68rem;
		margin-bottom: 0.7rem;
	}

	.section-card__body {
		display: grid;
		gap: 0.7rem;
	}
</style>
