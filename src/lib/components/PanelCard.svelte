<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title?: string;
		header?: Snippet;
		children: Snippet;
	}

	let { title, header, children }: Props = $props();
</script>

<section class="panel-card">
	{#if header}
		<div class="panel-card__header">
			{@render header()}
		</div>
	{:else if title}
		<h3>{title}</h3>
	{/if}
	<div class="panel-card__body">
		{@render children?.()}
	</div>
</section>

<style>
	.panel-card {
		position: relative;
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

	.panel-card__body {
		display: grid;
		gap: 0.6rem;
	}
</style>
