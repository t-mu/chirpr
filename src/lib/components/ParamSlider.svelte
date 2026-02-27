<script lang="ts">
	import PixelSlider from '$lib/components/PixelSlider.svelte';
	import { PARAM_META, type NumericParamKey } from '$lib/types/paramMeta';

	interface Props {
		paramKey: NumericParamKey;
		label: string;
		value: number;
		disabled?: boolean;
		onChange: (value: number) => void;
		onDragStart?: () => void;
		onDragEnd?: () => void;
	}

	let {
		paramKey,
		label,
		value,
		disabled = false,
		onChange,
		onDragStart,
		onDragEnd
	}: Props = $props();

	const meta = $derived(PARAM_META[paramKey]);
</script>

<PixelSlider
	{label}
	min={meta.min}
	max={meta.max}
	step={meta.step}
	{value}
	unit={('unit' in meta ? meta.unit : undefined) ?? ''}
	{disabled}
	{onChange}
	{onDragStart}
	{onDragEnd}
/>
