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
	import { PARAM_META } from '$lib/types/paramMeta';

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
	const meta = PARAM_META;

	function isSequencedPreviewMode(): boolean {
		const isArp = params.arpSpeed > 0;
		const isRetrigger = params.retriggerRate > 0 && params.retriggerCount > 0;
		return isArp || isRetrigger;
	}

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
				<PixelSlider
					label="Frequency"
					min={meta.frequency.min}
					max={meta.frequency.max}
					step={meta.frequency.step}
					value={params.frequency}
					unit={meta.frequency.unit}
					onChange={(value) => void applyParam('frequency', value)}
					onDragStart={onSliderDragStart}
					onDragEnd={onSliderDragEnd}
				/>
				<PixelSlider
					label="Detune"
					min={meta.detune.min}
					max={meta.detune.max}
					step={meta.detune.step}
					value={params.detune}
					unit={meta.detune.unit}
					onChange={(value) => void applyParam('detune', value)}
					onDragStart={onSliderDragStart}
					onDragEnd={onSliderDragEnd}
				/>
			</ResponsiveSection>

			<ResponsiveSection title="ENVELOPE">
				<PixelSlider
					label="Attack"
					min={meta.attack.min}
					max={meta.attack.max}
					step={meta.attack.step}
					value={params.attack}
					onChange={(value) => void applyParam('attack', value)}
					onDragStart={onSliderDragStart}
					onDragEnd={onSliderDragEnd}
				/>
				<PixelSlider
					label="Decay"
					min={meta.decay.min}
					max={meta.decay.max}
					step={meta.decay.step}
					value={params.decay}
					onChange={(value) => void applyParam('decay', value)}
					onDragStart={onSliderDragStart}
					onDragEnd={onSliderDragEnd}
				/>
				<PixelSlider
					label="Sustain"
					min={meta.sustain.min}
					max={meta.sustain.max}
					step={meta.sustain.step}
					value={params.sustain}
					onChange={(value) => void applyParam('sustain', value)}
					onDragStart={onSliderDragStart}
					onDragEnd={onSliderDragEnd}
				/>
				<PixelSlider
					label="Release"
					min={meta.release.min}
					max={meta.release.max}
					step={meta.release.step}
					value={params.release}
					onChange={(value) => void applyParam('release', value)}
					onDragStart={onSliderDragStart}
					onDragEnd={onSliderDragEnd}
				/>
			</ResponsiveSection>

			<ResponsiveSection title="DUTY CYCLE">
				<PixelSlider
					label="Width"
					min={meta.dutyCycle.min}
					max={meta.dutyCycle.max}
					step={meta.dutyCycle.step}
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
					min={meta.vibratoRate.min}
					max={meta.vibratoRate.max}
					step={meta.vibratoRate.step}
					value={params.vibratoRate}
					unit={meta.vibratoRate.unit}
					onChange={(value) => void applyParam('vibratoRate', value)}
					onDragStart={onSliderDragStart}
					onDragEnd={onSliderDragEnd}
				/>
				<PixelSlider
					label="Vibrato Depth"
					min={meta.vibratoDepth.min}
					max={meta.vibratoDepth.max}
					step={meta.vibratoDepth.step}
					value={params.vibratoDepth}
					onChange={(value) => void applyParam('vibratoDepth', value)}
					onDragStart={onSliderDragStart}
					onDragEnd={onSliderDragEnd}
				/>
				<PixelSlider
					label="Arp Speed"
					min={meta.arpSpeed.min}
					max={meta.arpSpeed.max}
					step={meta.arpSpeed.step}
					value={params.arpSpeed}
					unit={meta.arpSpeed.unit}
					onChange={(value) => void applyParam('arpSpeed', value)}
					onDragStart={onSliderDragStart}
					onDragEnd={onSliderDragEnd}
				/>
				<PixelSlider
					label="Flanger Rate"
					min={meta.flangerRate.min}
					max={meta.flangerRate.max}
					step={meta.flangerRate.step}
					value={params.flangerRate}
					unit={meta.flangerRate.unit}
					onChange={(value) => void applyParam('flangerRate', value)}
					onDragStart={onSliderDragStart}
					onDragEnd={onSliderDragEnd}
				/>
				<PixelSlider
					label="Flanger Depth"
					min={meta.flangerDepth.min}
					max={meta.flangerDepth.max}
					step={meta.flangerDepth.step}
					value={params.flangerDepth}
					onChange={(value) => void applyParam('flangerDepth', value)}
					onDragStart={onSliderDragStart}
					onDragEnd={onSliderDragEnd}
				/>
				<PixelSlider
					label="Flanger Feedback"
					min={meta.flangerFeedback.min}
					max={meta.flangerFeedback.max}
					step={meta.flangerFeedback.step}
					value={params.flangerFeedback}
					onChange={(value) => void applyParam('flangerFeedback', value)}
					onDragStart={onSliderDragStart}
					onDragEnd={onSliderDragEnd}
				/>
				<PixelSlider
					label="Flanger Mix"
					min={meta.flangerWet.min}
					max={meta.flangerWet.max}
					step={meta.flangerWet.step}
					value={params.flangerWet}
					onChange={(value) => void applyParam('flangerWet', value)}
					onDragStart={onSliderDragStart}
					onDragEnd={onSliderDragEnd}
				/>
				<PixelSlider
					label="LPF Cutoff"
					min={meta.lpfCutoff.min}
					max={meta.lpfCutoff.max}
					step={meta.lpfCutoff.step}
					value={params.lpfCutoff}
					unit={meta.lpfCutoff.unit}
					onChange={(value) => void applyParam('lpfCutoff', value)}
					onDragStart={onSliderDragStart}
					onDragEnd={onSliderDragEnd}
				/>
				<PixelSlider
					label="HPF Cutoff"
					min={meta.hpfCutoff.min}
					max={meta.hpfCutoff.max}
					step={meta.hpfCutoff.step}
					value={params.hpfCutoff}
					unit={meta.hpfCutoff.unit}
					onChange={(value) => void applyParam('hpfCutoff', value)}
					onDragStart={onSliderDragStart}
					onDragEnd={onSliderDragEnd}
				/>
				<PixelSlider
					label="Bit Depth"
					min={meta.bitDepth.min}
					max={meta.bitDepth.max}
					step={meta.bitDepth.step}
					value={params.bitDepth}
					onChange={(value) => void applyParam('bitDepth', value)}
					onDragStart={onSliderDragStart}
					onDragEnd={onSliderDragEnd}
				/>
				<PixelSlider
					label="Retrigger"
					min={meta.retriggerRate.min}
					max={meta.retriggerRate.max}
					step={meta.retriggerRate.step}
					value={params.retriggerRate}
					onChange={(value) => void applyParam('retriggerRate', value)}
					onDragStart={onSliderDragStart}
					onDragEnd={onSliderDragEnd}
				/>
				<PixelSlider
					label="Retrigger Count"
					min={meta.retriggerCount.min}
					max={meta.retriggerCount.max}
					step={meta.retriggerCount.step}
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
				min={meta.duration.min}
				max={meta.duration.max}
				step={meta.duration.step}
				value={params.duration}
				unit={meta.duration.unit}
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
