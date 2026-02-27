<script lang="ts">
	import type { Snippet } from 'svelte';
	import SectionCard from '$lib/components/SectionCard.svelte';

	interface Props {
		title: string;
		open?: boolean;
		children: Snippet;
	}

	let { title, open = false, children }: Props = $props();
</script>

<div class="desktop-card">
	<SectionCard {title}>
		{@render children?.()}
	</SectionCard>
</div>

<details class="mobile-accordion" {open}>
	<summary>{title}</summary>
	<div class="mobile-accordion__body">
		{@render children?.()}
	</div>
</details>

<style>
	.mobile-accordion {
		display: none;
		border: 2px solid var(--accent);
		background: var(--surface);
		box-shadow: 4px 4px 0 #000;
	}

	.mobile-accordion summary {
		cursor: pointer;
		list-style: none;
		padding: 0.75rem;
		font-size: 0.68rem;
		user-select: none;
	}

	.mobile-accordion summary::-webkit-details-marker {
		display: none;
	}

	.mobile-accordion__body {
		display: grid;
		gap: 0.7rem;
		padding: 0 0.75rem 0.75rem;
	}

	@media (max-width: 900px) {
		.desktop-card {
			display: none;
		}

		.mobile-accordion {
			display: block;
		}
	}
</style>
