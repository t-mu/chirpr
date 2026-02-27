<script lang="ts">
	import { onMount } from 'svelte';
	import type { Waveform } from 'tone';
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
	import { params, resetParams, setParams, updateParam } from '$lib/stores/synthParams.svelte';
	import {
		DEFAULT_PARAMS,
		type SynthParams,
		type Waveform as WaveformType
	} from '$lib/types/SynthParams';

	let synthesizer = $state<SynthesizerAPI | null>(null);
	let isPlaying = $state(false);
	let isBooting = $state(true);
	let lastRandomCategory = $state<SoundCategory>('shoot');
	let randomStopTimeout = $state<number | null>(null);

	const waveformSource = {
		getValue: () => synthesizer?.getWaveformData() ?? new Float32Array(1024)
	} as Waveform;

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
	}

	async function ensureSynth(): Promise<SynthesizerAPI> {
		if (synthesizer) return synthesizer;
		synthesizer = await createSynthesizer(params);
		return synthesizer;
	}

	async function togglePlay(): Promise<void> {
		await initAudio();
		const synth = await ensureSynth();
		if (isPlaying) {
			synth.stop();
			isPlaying = false;
			return;
		}
		synth.play('C4');
		isPlaying = true;
	}

	function clearRandomStopTimeout(): void {
		if (randomStopTimeout !== null) {
			clearTimeout(randomStopTimeout);
			randomStopTimeout = null;
		}
	}

	function previewSound(synth: SynthesizerAPI): void {
		if (isPlaying) return;
		synth.play('C4');
		clearRandomStopTimeout();
		randomStopTimeout = window.setTimeout(() => {
			synth.stop();
			randomStopTimeout = null;
		}, 220);
	}

	async function applyRandomCategory(category: SoundCategory): Promise<void> {
		lastRandomCategory = category;
		const next = randomize(category);
		setParams(next);
		const synth = await ensureSynth();
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

	function isEditableTarget(target: EventTarget | null): boolean {
		if (!(target instanceof HTMLElement)) return false;
		return (
			target instanceof HTMLInputElement ||
			target instanceof HTMLTextAreaElement ||
			target.isContentEditable
		);
	}

	function onKeydown(event: KeyboardEvent): void {
		if (isEditableTarget(event.target)) return;

		const key = event.key.toLowerCase();
		const isSpace = event.code === 'Space' || event.key === ' ';

		if (isSpace) {
			event.preventDefault();
			void togglePlay();
			return;
		}

		if (event.code === 'KeyR' || key === 'r') {
			event.preventDefault();
			void applyRandomCategory(lastRandomCategory);
			return;
		}

		if (event.code === 'KeyS' || key === 's') {
			event.preventDefault();
			focusPresetInput();
			return;
		}

		if (event.code === 'Escape' || key === 'escape') {
			event.preventDefault();
			resetAllParams();
		}
	}

	onMount(() => {
		window.addEventListener('keydown', onKeydown);
		void (async () => {
			try {
				await initAudio();
			} catch {
				// Browsers can reject startup without user interaction.
			} finally {
				isBooting = false;
			}
		})();
		return () => {
			window.removeEventListener('keydown', onKeydown);
			clearRandomStopTimeout();
			synthesizer?.dispose();
		};
	});
</script>

<svelte:head>
	<title>SFX MAKER</title>
</svelte:head>

{#if isBooting}
	<div class="boot-screen">
		<p>LOADING AUDIO ENGINE...</p>
	</div>
{:else}
	<div class="dashboard">
		<header class="header-bar">
			<div>
				<h1>SFX MAKER</h1>
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
					/>
					<PixelSlider
						label="Detune"
						min={-100}
						max={100}
						step={1}
						value={params.detune}
						unit="c"
						onChange={(value) => void applyParam('detune', value)}
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
					/>
					<PixelSlider
						label="Decay"
						min={0.001}
						max={2}
						step={0.001}
						value={params.decay}
						onChange={(value) => void applyParam('decay', value)}
					/>
					<PixelSlider
						label="Sustain"
						min={0}
						max={1}
						step={0.01}
						value={params.sustain}
						onChange={(value) => void applyParam('sustain', value)}
					/>
					<PixelSlider
						label="Release"
						min={0.001}
						max={5}
						step={0.001}
						value={params.release}
						onChange={(value) => void applyParam('release', value)}
					/>
				</ResponsiveSection>

				{#if params.waveform === 'square'}
					<ResponsiveSection title="DUTY CYCLE">
						<PixelSlider
							label="Width"
							min={0}
							max={1}
							step={0.01}
							value={params.dutyCycle}
							onChange={(value) => void applyParam('dutyCycle', value)}
						/>
					</ResponsiveSection>
				{/if}

				<ResponsiveSection title="EFFECTS">
					<PixelSlider
						label="Vibrato Rate"
						min={0}
						max={20}
						step={0.1}
						value={params.vibratoRate}
						unit="Hz"
						onChange={(value) => void applyParam('vibratoRate', value)}
					/>
					<PixelSlider
						label="Vibrato Depth"
						min={0}
						max={1}
						step={0.01}
						value={params.vibratoDepth}
						onChange={(value) => void applyParam('vibratoDepth', value)}
					/>
					<PixelSlider
						label="Arp Speed"
						min={0}
						max={20}
						step={0.1}
						value={params.arpSpeed}
						unit="Hz"
						onChange={(value) => void applyParam('arpSpeed', value)}
					/>
					<PixelSlider
						label="Flanger Rate"
						min={0}
						max={20}
						step={0.1}
						value={params.flangerRate}
						unit="Hz"
						onChange={(value) => void applyParam('flangerRate', value)}
					/>
					<PixelSlider
						label="LPF Cutoff"
						min={20}
						max={20000}
						step={1}
						value={params.lpfCutoff}
						unit="Hz"
						onChange={(value) => void applyParam('lpfCutoff', value)}
					/>
					<PixelSlider
						label="HPF Cutoff"
						min={20}
						max={20000}
						step={1}
						value={params.hpfCutoff}
						unit="Hz"
						onChange={(value) => void applyParam('hpfCutoff', value)}
					/>
					<PixelSlider
						label="Bit Depth"
						min={1}
						max={16}
						step={1}
						value={params.bitDepth}
						onChange={(value) => void applyParam('bitDepth', value)}
					/>
					<PixelSlider
						label="Retrigger"
						min={0}
						max={20}
						step={0.1}
						value={params.retriggerRate}
						onChange={(value) => void applyParam('retriggerRate', value)}
					/>
				</ResponsiveSection>
			</div>

			<div class="right-column">
				<ResponsiveSection title="OSCILLOSCOPE" open={true}>
					<Oscilloscope waveform={waveformSource} />
				</ResponsiveSection>

				<button class="play-button" type="button" onclick={() => void togglePlay()}>
					{isPlaying ? '■ STOP' : '▶ PLAY'}
				</button>

				<PresetPanel {synthesizer} />
				<RandomizerPanel onRandomize={(category) => void applyRandomCategory(category)} />
				<ExportPanel />
			</div>
		</div>
	</div>
{/if}

<style>
	.boot-screen {
		min-height: 100vh;
		display: grid;
		place-items: center;
		padding: 1rem;
		text-align: center;
	}

	.boot-screen p {
		margin: 0;
		padding: 1rem;
		border: 2px solid var(--accent);
		background: var(--surface);
		box-shadow: 4px 4px 0 #000;
		font-size: clamp(0.6rem, 2vw, 0.8rem);
		color: var(--yellow);
	}

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

	@media (max-width: 900px) {
		.layout {
			grid-template-columns: 1fr;
		}
	}
</style>
