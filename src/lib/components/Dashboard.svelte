<script lang="ts">
	import { onMount } from 'svelte';
	import { initAudio } from '$lib/audio/engine';
	import { randomize, type SoundCategory } from '$lib/audio/randomizer';
	import { createSynthesizer, type SynthesizerAPI } from '$lib/audio/synthesizer';
	import Oscilloscope from '$lib/components/Oscilloscope.svelte';
	import ParamSlider from '$lib/components/ParamSlider.svelte';
	import PixelToggle from '$lib/components/PixelToggle.svelte';
	import ResponsiveSection from '$lib/components/ResponsiveSection.svelte';
	import PresetPanel from '$lib/components/PresetPanel.svelte';
	import RandomizerPanel from '$lib/components/RandomizerPanel.svelte';
	import ExportPanel from '$lib/components/ExportPanel.svelte';
	import {
		DUTY_CYCLE_DISABLED_NOTE,
		DUTY_CYCLE_SLIDERS,
		EFFECTS_SLIDERS,
		ENVELOPE_SLIDERS,
		OSCILLATOR_SLIDERS,
		PLAYBACK_SLIDERS
	} from '$lib/components/dashboardConfig';
	import { createDashboardKeydownHandler } from '$lib/components/dashboardShortcuts';
	import {
		createDashboardPreviewController,
		isSequencedMode,
		requiresRetriggerOnChange
	} from '$lib/components/dashboardPreviewController';
	import { params, resetParams, setParams, updateParam } from '$lib/stores/synthParams.svelte';
	import {
		DEFAULT_PARAMS,
		type SynthParams,
		type Waveform as WaveformType
	} from '$lib/types/SynthParams';
	import type { NumericParamKey } from '$lib/types/paramMeta';

	let synthesizer = $state<SynthesizerAPI | null>(null);
	let isPlaying = $state(false);
	let audioReady = $state(false);
	let audioInitAttempted = $state(false);
	let lastRandomCategory = $state<SoundCategory>('shoot');
	let playTimeout = $state<number | null>(null);

	const waveformSource = {
		getValue: () => synthesizer?.getWaveformData() ?? new Float32Array(1024)
	};

	const waveformOptions = [
		{ value: 'square', label: 'Square' },
		{ value: 'sawtooth', label: 'Saw' },
		{ value: 'sine', label: 'Sine' },
		{ value: 'noise', label: 'Noise' }
	] satisfies Array<{ value: WaveformType; label: string }>;
	function onSliderValueChange(paramKey: NumericParamKey, value: number): void {
		void applyParam(paramKey, value as SynthParams[typeof paramKey]);
	}

	function isSequencedPreviewMode(): boolean {
		return isSequencedMode(params);
	}

	async function applyParam<K extends keyof SynthParams>(
		key: K,
		value: SynthParams[K]
	): Promise<void> {
		updateParam(key, value);
		synthesizer?.updateParams({ [key]: params[key] });
		await previewController.syncMode();
		if (isPlaying && synthesizer && requiresRetriggerOnChange(key)) {
			restartPlayback(synthesizer);
			return;
		}
		if (isPlaying) return;
		previewController.scheduleIdlePreview();
	}

	async function ensureSynth(): Promise<SynthesizerAPI> {
		if (synthesizer) return synthesizer;
		synthesizer = await createSynthesizer(params);
		return synthesizer;
	}

	function clearPlayTimeout(): void {
		if (playTimeout !== null) {
			clearTimeout(playTimeout);
			playTimeout = null;
		}
	}

	async function togglePlay(): Promise<void> {
		await initAudio();
		const synth = await ensureSynth();
		await previewController.stopAll();
		if (isPlaying) {
			synth.stop();
			isPlaying = false;
			clearPlayTimeout();
			return;
		}
		startPlayback(synth);
	}

	function startPlayback(synth: SynthesizerAPI): void {
		clearPlayTimeout();
		synth.play();
		isPlaying = true;
		playTimeout = window.setTimeout(() => {
			isPlaying = false;
			playTimeout = null;
		}, params.duration);
	}

	function restartPlayback(synth: SynthesizerAPI): void {
		synth.stop();
		startPlayback(synth);
	}

	function previewSound(synth: SynthesizerAPI): void {
		if (isPlaying) return;
		synth.play();
	}

	const previewController = createDashboardPreviewController({
		ensureSynth,
		initAudio,
		isPlaying: () => isPlaying,
		isSequencedPreviewMode,
		previewOneShot: previewSound
	});

	function onSliderDragStart(): void {
		void previewController.onDragStart();
	}

	function onSliderDragEnd(): void {
		previewController.onDragEnd();
	}

	async function applyRandomCategory(category: SoundCategory): Promise<void> {
		lastRandomCategory = category;
		const next = randomize(category);
		setParams(next);
		// initAudio() is called inside a gesture handler (button click), so it is safe here.
		// Without it, the AudioContext stays suspended and previewSound produces no output.
		await initAudio();
		const synth = await ensureSynth();
		await previewController.stopAll();
		synth.updateParams(next);
		previewSound(synth);
	}

	function focusPresetInput(): void {
		const input = document.querySelector<HTMLInputElement>('input[aria-label="Preset name"]');
		input?.focus();
		input?.select();
	}

	function resetAllParams(): void {
		resetParams();
		synthesizer?.updateParams(DEFAULT_PARAMS);
	}

	const onKeydown = createDashboardKeydownHandler({
		togglePlay: () => void togglePlay(),
		applyRandomCategory: (category) => void applyRandomCategory(category),
		getLastRandomCategory: () => lastRandomCategory,
		focusPresetInput,
		resetAllParams
	});

	onMount(() => {
		window.addEventListener('keydown', onKeydown);
		void initAudio()
			.then(() => {
				audioReady = true;
			})
			.catch(() => {
				// Browsers can reject startup without user interaction.
			})
			.finally(() => {
				audioInitAttempted = true;
			});
		return () => {
			window.removeEventListener('keydown', onKeydown);
			clearPlayTimeout();
			void previewController.stopAll();
			synthesizer?.dispose();
		};
	});
</script>

<svelte:head>
	<title>Chirpr</title>
</svelte:head>

<div class="dashboard">
	<header class="header-bar">
		<div>
			<h1>Chirpr</h1>
			<p>v0.1.0</p>
		</div>
		<a href="https://github.com" target="_blank" rel="noreferrer">GitHub</a>
	</header>

	<div class="layout">
		<div class="left-column">
			<ResponsiveSection title="OSCILLATOR" open={true}>
				<PixelToggle
					options={waveformOptions}
					selected={params.waveform}
					onChange={(value) => void applyParam('waveform', value as WaveformType)}
				/>
				{#each OSCILLATOR_SLIDERS as slider (slider.key)}
					<ParamSlider
						paramKey={slider.key}
						label={slider.label}
						value={params[slider.key]}
						onChange={(value) => onSliderValueChange(slider.key, value)}
						onDragStart={onSliderDragStart}
						onDragEnd={onSliderDragEnd}
					/>
				{/each}
			</ResponsiveSection>

			<ResponsiveSection title="ENVELOPE">
				{#each ENVELOPE_SLIDERS as slider (slider.key)}
					<ParamSlider
						paramKey={slider.key}
						label={slider.label}
						value={params[slider.key]}
						onChange={(value) => onSliderValueChange(slider.key, value)}
						onDragStart={onSliderDragStart}
						onDragEnd={onSliderDragEnd}
					/>
				{/each}
			</ResponsiveSection>

			<ResponsiveSection title="DUTY CYCLE">
				{#each DUTY_CYCLE_SLIDERS as slider (slider.key)}
					<ParamSlider
						paramKey={slider.key}
						label={slider.label}
						value={params[slider.key]}
						disabled={slider.disabledWhen?.(params) ?? false}
						onChange={(value) => onSliderValueChange(slider.key, value)}
						onDragStart={onSliderDragStart}
						onDragEnd={onSliderDragEnd}
					/>
				{/each}
				{#if params.waveform !== 'square'}
					<p class="section-note">{DUTY_CYCLE_DISABLED_NOTE}</p>
				{/if}
			</ResponsiveSection>

			<ResponsiveSection title="EFFECTS">
				{#each EFFECTS_SLIDERS as slider (slider.key)}
					<ParamSlider
						paramKey={slider.key}
						label={slider.label}
						value={params[slider.key]}
						disabled={slider.disabledWhen?.(params) ?? false}
						onChange={(value) => onSliderValueChange(slider.key, value)}
						onDragStart={onSliderDragStart}
						onDragEnd={onSliderDragEnd}
					/>
				{/each}
			</ResponsiveSection>
		</div>

		<div class="right-column">
			<ResponsiveSection title="OSCILLOSCOPE" open={true}>
				<Oscilloscope waveform={waveformSource} />
			</ResponsiveSection>

			{#each PLAYBACK_SLIDERS as slider (slider.key)}
				<ParamSlider
					paramKey={slider.key}
					label={slider.label}
					value={params[slider.key]}
					onChange={(value) => onSliderValueChange(slider.key, value)}
					onDragStart={onSliderDragStart}
					onDragEnd={onSliderDragEnd}
				/>
			{/each}

			<button class="play-button" type="button" onclick={() => void togglePlay()}>
				{isPlaying ? '■ STOP' : '▶ PLAY'}
			</button>
			{#if !audioReady && audioInitAttempted}
				<p class="audio-hint">AUDIO ENABLES ON FIRST INTERACTION</p>
			{/if}

			<PresetPanel {synthesizer} />
			<RandomizerPanel onRandomize={(category) => void applyRandomCategory(category)} />
			<ExportPanel />
		</div>
	</div>
</div>

<style>
	.dashboard {
		display: grid;
		gap: 1rem;
		padding: 1rem;
	}

	.header-bar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		border: 2px solid var(--accent);
		background: var(--surface);
		padding: 0.8rem;
		box-shadow: 4px 4px 0 #000;
	}

	h1 {
		margin: 0;
		font-size: clamp(1rem, 3vw, 1.5rem);
	}

	.header-bar p {
		margin: 0.4rem 0 0;
		font-size: 0.55rem;
	}

	.header-bar a {
		color: var(--accent);
		font-size: 0.65rem;
	}

	.layout {
		display: grid;
		grid-template-columns: minmax(0, 2fr) minmax(300px, 1fr);
		gap: 1rem;
	}

	.left-column,
	.right-column {
		display: grid;
		gap: 0.8rem;
		align-content: start;
	}

	.play-button {
		border: 2px solid var(--yellow);
		background: var(--surface);
		color: var(--yellow);
		font: inherit;
		padding: 0.9rem;
		font-size: 0.75rem;
		box-shadow: 4px 4px 0 #000;
	}

	.section-note {
		margin: 0;
		font-size: 0.52rem;
		color: var(--yellow);
	}

	.audio-hint {
		margin: -0.3rem 0 0;
		font-size: 0.52rem;
		color: var(--yellow);
	}

	@media (max-width: 900px) {
		.layout {
			grid-template-columns: 1fr;
		}
	}
</style>
