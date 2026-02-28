<script lang="ts">
	import { onMount } from 'svelte';
	import type { Snippet } from 'svelte';

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

<details class="section-shell" open={!isMobile || open}>
	<summary><h2>{title}</h2></summary>
	<div class="section-shell__body">
		{@render children?.()}
	</div>
</details>

<style>
	.section-shell {
		border: 2px solid var(--accent);
		background: var(--surface);
		box-shadow: 4px 4px 0 #000;
		padding: 0.8rem;
	}

	.section-shell summary {
		cursor: pointer;
		list-style: none;
		user-select: none;
		margin-bottom: 0.7rem;
	}

	.section-shell summary h2 {
		margin: 0;
		font: inherit;
		font-size: 1.2rem;
		display: inline;
	}

	.section-shell summary::-webkit-details-marker {
		display: none;
	}

	.section-shell__body {
		display: grid;
		gap: 0.7rem;
	}

	@media (min-width: 901px) {
		.section-shell summary {
			cursor: default;
			pointer-events: none;
		}
	}
</style>
