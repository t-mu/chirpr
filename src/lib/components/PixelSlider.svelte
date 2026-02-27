<script lang="ts">
	interface Props {
		label: string;
		min: number;
		max: number;
		step: number;
		value: number;
		unit?: string;
		disabled?: boolean;
		onChange?: (value: number) => void;
	}

	let { label, min, max, step, value, unit = '', disabled = false, onChange }: Props = $props();
	let flash = $state(false);
	let flashTimeout: number | undefined;

	$effect(() => {
		return () => {
			if (flashTimeout !== undefined) clearTimeout(flashTimeout);
		};
	});

	function triggerFlash(): void {
		flash = true;
		if (flashTimeout !== undefined) {
			clearTimeout(flashTimeout);
		}
		flashTimeout = window.setTimeout(() => {
			flash = false;
		}, 200);
	}

	function handleInput(event: Event): void {
		if (disabled) return;
		const target = event.currentTarget as HTMLInputElement;
		const nextValue = Number(target.value);
		triggerFlash();
		onChange?.(nextValue);
	}
</script>

<label class="pixel-slider">
	<span class="pixel-slider__label">{label}</span>
	<input type="range" {min} {max} {step} {value} {disabled} oninput={handleInput} />
	<span class="pixel-slider__value" class:flash>{value}{unit}</span>
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

	.pixel-slider__value {
		transition: color 120ms steps(2, end);
	}

	.pixel-slider__value.flash {
		color: var(--yellow, #ffe600);
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
