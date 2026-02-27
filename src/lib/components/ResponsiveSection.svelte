<script lang="ts">
	import { onMount } from 'svelte';
	import type { Snippet } from 'svelte';
	import SectionCard from '$lib/components/SectionCard.svelte';

	interface Props {
		title: string;
		open?: boolean;
		children: Snippet;
	}

	let { title, open = false, children }: Props = $props();
	let isMobile = $state(false);

	onMount(() => {
		if (typeof window.matchMedia !== 'function') {
			isMobile = false;
			return;
		}

		const media = window.matchMedia('(max-width: 900px)');
		const legacyMedia = media as MediaQueryList & {
			addListener?: (callback: (event: MediaQueryListEvent) => void) => void;
			removeListener?: (callback: (event: MediaQueryListEvent) => void) => void;
		};
		const update = () => {
			isMobile = media.matches;
		};
		update();
		if (typeof media.addEventListener === 'function') {
			media.addEventListener('change', update);
			return () => media.removeEventListener('change', update);
		}
		legacyMedia.addListener?.(update);
		return () => legacyMedia.removeListener?.(update);
	});
</script>

{#if isMobile}
	<details class="mobile-accordion" {open}>
		<summary><h2>{title}</h2></summary>
		<div class="mobile-accordion__body">
			{@render children?.()}
		</div>
	</details>
{:else}
	<SectionCard {title}>
		{@render children?.()}
	</SectionCard>
{/if}

<style>
	.mobile-accordion {
		border: 2px solid var(--accent);
		background: var(--surface);
		box-shadow: 4px 4px 0 #000;
	}

	.mobile-accordion summary {
		cursor: pointer;
		list-style: none;
		padding: 0.75rem;
		user-select: none;
	}

	.mobile-accordion summary h2 {
		margin: 0;
		font: inherit;
		font-size: 1.2rem;
		display: inline;
	}

	.mobile-accordion summary::-webkit-details-marker {
		display: none;
	}

	.mobile-accordion__body {
		display: grid;
		gap: 0.7rem;
		padding: 0 0.75rem 0.75rem;
	}
</style>
