<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	interface Props {
		label: string;
		min: number;
		max: number;
		step: number;
		value: number;
		unit?: string;
		onChange?: (value: number) => void;
	}

	let { label, min, max, step, value, unit = '', onChange }: Props = $props();
	const dispatch = createEventDispatcher<{ change: number }>();

	function handleInput(event: Event): void {
		const target = event.currentTarget as HTMLInputElement;
		const nextValue = Number(target.value);
		onChange?.(nextValue);
		dispatch('change', nextValue);
	}
</script>

<label class="pixel-slider">
	<span class="pixel-slider__label">{label}</span>
	<input type="range" {min} {max} {step} {value} oninput={handleInput} />
	<span class="pixel-slider__value">{value}{unit}</span>
</label>

<style>
	.pixel-slider {
		display: grid;
		gap: 0.65rem;
	}

	.pixel-slider__label,
	.pixel-slider__value {
		font-size: 0.65rem;
		letter-spacing: 0.05em;
	}

	input[type='range'] {
		appearance: none;
		height: 8px;
		background: var(--surface, #111128);
		box-shadow: 0 0 0 2px var(--accent, #00e5ff);
	}

	input[type='range']::-webkit-slider-thumb {
		appearance: none;
		width: 14px;
		height: 14px;
		background: var(--accent, #00e5ff);
		box-shadow: 2px 2px 0 0 #000;
	}

	input[type='range']::-moz-range-thumb {
		width: 14px;
		height: 14px;
		background: var(--accent, #00e5ff);
		border: 0;
		box-shadow: 2px 2px 0 0 #000;
	}
</style>
