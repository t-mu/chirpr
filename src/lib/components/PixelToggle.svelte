<script lang="ts">
	export interface ToggleOption<T extends string = string> {
		value: T;
		label: string;
	}

	interface Props<T extends string> {
		options: ToggleOption<T>[];
		selected: T;
		onChange?: (value: T) => void;
	}

	let { options, selected, onChange }: Props<string> = $props();
</script>

<div class="pixel-toggle" role="radiogroup">
	{#each options as option (option.value)}
		<button
			type="button"
			class:active={option.value === selected}
			onclick={() => onChange?.(option.value)}
		>
			{option.label}
		</button>
	{/each}
</div>

<style>
	.pixel-toggle {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	button {
		border: 2px solid var(--accent, #00e5ff);
		background: transparent;
		color: inherit;
		padding: 0.5rem 0.65rem;
		font: inherit;
		font-size: 0.6rem;
	}

	button.active {
		background: var(--accent, #00e5ff);
		color: #000;
	}
</style>
