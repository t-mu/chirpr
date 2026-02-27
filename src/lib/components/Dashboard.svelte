<script lang="ts">
	import { onMount } from 'svelte';
	import { initAudio } from '$lib/audio/engine';
	import { randomize, type SoundCategory } from '$lib/audio/randomizer';
	import { createSynthesizer, type SynthesizerAPI } from '$lib/audio/synthesizer';
	import Oscilloscope from '$lib/components/Oscilloscope.svelte';
	import PixelSlider from '$lib/components/PixelSlider.svelte';
	import PixelToggle from '$lib/components/PixelToggle.svelte';
	import ResponsiveSection from '$lib/components/ResponsiveSection.svelte';
	import PresetPanel from '$lib/components/PresetPanel.svelte';
	import RandomizerPanel from '$lib/components/RandomizerPanel.svelte';
	import ExportPanel from '$lib/components/ExportPanel.svelte';
	import { createDashboardKeydownHandler } from '$lib/components/dashboardShortcuts';
	import {
		createDashboardPreviewController,
		RETRIGGER_REQUIRED_PARAMS
	} from '$lib/components/dashboardPreviewController';
	import { params, resetParams, setParams, updateParam } from '$lib/stores/synthParams.svelte';
	import {
		DEFAULT_PARAMS,
		type SynthParams,
		type Waveform as WaveformType
	} from '$lib/types/SynthParams';

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

	async function applyParam<K extends keyof SynthParams>(
		key: K,
		value: SynthParams[K]
	): Promise<void> {
		updateParam(key, value);
		synthesizer?.updateParams({ [key]: params[key] });
		if (isPlaying && synthesizer && RETRIGGER_REQUIRED_PARAMS.has(key)) {
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
				<PixelSlider
					label="Frequency"
					min={20}
					max={2000}
					step={1}
					value={params.frequency}
					unit="Hz"
					onChange={(value) => void applyParam('frequency', value)}
					onDragStart={onSliderDragStart}
					onDragEnd={onSliderDragEnd}
				/>
				<PixelSlider
					label="Detune"
					min={-100}
					max={100}
					step={1}
					value={params.detune}
					unit="c"
					onChange={(value) => void applyParam('detune', value)}
					onDragStart={onSliderDragStart}
					onDragEnd={onSliderDragEnd}
				/>
			</ResponsiveSection>

			<ResponsiveSection title="ENVELOPE">
				<PixelSlider
					label="Attack"
					min={0.001}
					max={2}
					step={0.001}
					value={params.attack}
					onChange={(value) => void applyParam('attack', value)}
					onDragStart={onSliderDragStart}
					onDragEnd={onSliderDragEnd}
				/>
				<PixelSlider
					label="Decay"
					min={0.001}
					max={2}
					step={0.001}
					value={params.decay}
					onChange={(value) => void applyParam('decay', value)}
					onDragStart={onSliderDragStart}
					onDragEnd={onSliderDragEnd}
				/>
				<PixelSlider
					label="Sustain"
					min={0}
					max={1}
					step={0.01}
					value={params.sustain}
					onChange={(value) => void applyParam('sustain', value)}
					onDragStart={onSliderDragStart}
					onDragEnd={onSliderDragEnd}
				/>
				<PixelSlider
					label="Release"
					min={0.001}
					max={5}
					step={0.001}
					value={params.release}
					onChange={(value) => void applyParam('release', value)}
					onDragStart={onSliderDragStart}
					onDragEnd={onSliderDragEnd}
				/>
			</ResponsiveSection>

			<ResponsiveSection title="DUTY CYCLE">
				<PixelSlider
					label="Width"
					min={0}
					max={1}
					step={0.01}
					value={params.dutyCycle}
					disabled={params.waveform !== 'square'}
					onChange={(value) => void applyParam('dutyCycle', value)}
					onDragStart={onSliderDragStart}
					onDragEnd={onSliderDragEnd}
				/>
				{#if params.waveform !== 'square'}
					<p class="section-note">DUTY CYCLE IS AVAILABLE ONLY FOR SQUARE WAVEFORM.</p>
				{/if}
			</ResponsiveSection>

			<ResponsiveSection title="EFFECTS">
				<PixelSlider
					label="Vibrato Rate"
					min={0}
					max={20}
					step={0.1}
					value={params.vibratoRate}
					unit="Hz"
					onChange={(value) => void applyParam('vibratoRate', value)}
					onDragStart={onSliderDragStart}
					onDragEnd={onSliderDragEnd}
				/>
				<PixelSlider
					label="Vibrato Depth"
					min={0}
					max={1}
					step={0.01}
					value={params.vibratoDepth}
					onChange={(value) => void applyParam('vibratoDepth', value)}
					onDragStart={onSliderDragStart}
					onDragEnd={onSliderDragEnd}
				/>
				<PixelSlider
					label="Arp Speed"
					min={0}
					max={20}
					step={0.1}
					value={params.arpSpeed}
					unit="Hz"
					onChange={(value) => void applyParam('arpSpeed', value)}
					onDragStart={onSliderDragStart}
					onDragEnd={onSliderDragEnd}
				/>
				<PixelSlider
					label="Flanger Rate"
					min={0}
					max={20}
					step={0.1}
					value={params.flangerRate}
					unit="Hz"
					onChange={(value) => void applyParam('flangerRate', value)}
					onDragStart={onSliderDragStart}
					onDragEnd={onSliderDragEnd}
				/>
				<PixelSlider
					label="Flanger Depth"
					min={0}
					max={1}
					step={0.01}
					value={params.flangerDepth}
					onChange={(value) => void applyParam('flangerDepth', value)}
					onDragStart={onSliderDragStart}
					onDragEnd={onSliderDragEnd}
				/>
				<PixelSlider
					label="Flanger Feedback"
					min={0}
					max={0.95}
					step={0.01}
					value={params.flangerFeedback}
					onChange={(value) => void applyParam('flangerFeedback', value)}
					onDragStart={onSliderDragStart}
					onDragEnd={onSliderDragEnd}
				/>
				<PixelSlider
					label="Flanger Mix"
					min={0}
					max={1}
					step={0.01}
					value={params.flangerWet}
					onChange={(value) => void applyParam('flangerWet', value)}
					onDragStart={onSliderDragStart}
					onDragEnd={onSliderDragEnd}
				/>
				<PixelSlider
					label="LPF Cutoff"
					min={20}
					max={20000}
					step={1}
					value={params.lpfCutoff}
					unit="Hz"
					onChange={(value) => void applyParam('lpfCutoff', value)}
					onDragStart={onSliderDragStart}
					onDragEnd={onSliderDragEnd}
				/>
				<PixelSlider
					label="HPF Cutoff"
					min={20}
					max={20000}
					step={1}
					value={params.hpfCutoff}
					unit="Hz"
					onChange={(value) => void applyParam('hpfCutoff', value)}
					onDragStart={onSliderDragStart}
					onDragEnd={onSliderDragEnd}
				/>
				<PixelSlider
					label="Bit Depth"
					min={1}
					max={16}
					step={1}
					value={params.bitDepth}
					onChange={(value) => void applyParam('bitDepth', value)}
					onDragStart={onSliderDragStart}
					onDragEnd={onSliderDragEnd}
				/>
				<PixelSlider
					label="Retrigger"
					min={0}
					max={20}
					step={0.1}
					value={params.retriggerRate}
					onChange={(value) => void applyParam('retriggerRate', value)}
					onDragStart={onSliderDragStart}
					onDragEnd={onSliderDragEnd}
				/>
				<PixelSlider
					label="Retrigger Count"
					min={0}
					max={16}
					step={1}
					value={params.retriggerCount}
					onChange={(value) => void applyParam('retriggerCount', value)}
					onDragStart={onSliderDragStart}
					onDragEnd={onSliderDragEnd}
				/>
			</ResponsiveSection>
		</div>

		<div class="right-column">
			<ResponsiveSection title="OSCILLOSCOPE" open={true}>
				<Oscilloscope waveform={waveformSource} />
			</ResponsiveSection>

			<PixelSlider
				label="Duration"
				min={50}
				max={2000}
				step={10}
				value={params.duration}
				unit="ms"
				onChange={(value) => void applyParam('duration', value)}
				onDragStart={onSliderDragStart}
				onDragEnd={onSliderDragEnd}
			/>

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
