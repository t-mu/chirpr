<script lang="ts">
	import { onMount } from 'svelte';
	import { flatCurve } from '$lib/audio/bezier';
	import { initAudio } from '$lib/audio/engine';
	import { randomize, type SoundCategory } from '$lib/audio/randomizer';
	import { createSynthesizer, type SynthesizerAPI } from '$lib/audio/synthesizer';
	import BezierEditor from '$lib/components/BezierEditor.svelte';
	import Oscilloscope from '$lib/components/Oscilloscope.svelte';
	import ParamSlider from '$lib/components/ParamSlider.svelte';
	import PixelToggle from '$lib/components/PixelToggle.svelte';
	import ResponsiveSection from '$lib/components/ResponsiveSection.svelte';
	import PresetPanel from '$lib/components/PresetPanel.svelte';
	import RandomizerPanel from '$lib/components/RandomizerPanel.svelte';
	import ExportPanel from '$lib/components/ExportPanel.svelte';
	import { APP_REPOSITORY_URL } from '$lib/config/app';
	import {
		BIT_CRUSHER_SLIDERS,
		DUTY_CYCLE_DISABLED_NOTE,
		ENVELOPE_SLIDERS,
		FLANGER_SLIDERS,
		MODULATION_SLIDERS,
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
	import type { BezierCurve, CurveableParam } from '$lib/types/BezierCurve';
	import { PARAM_META, type NumericParamKey } from '$lib/types/paramMeta';

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

	const CURVEABLE_SYNC_KEYS: CurveableParam[] = ['frequency', 'lpfCutoff', 'hpfCutoff'];
	const OSC_PANEL_HEIGHT = 'clamp(180px, 24vw, 260px)';
	const FILTER_CURVE_HEIGHT = 'clamp(140px, 18vw, 200px)';

	function alignCurveStart(curve: BezierCurve, startValue: number): BezierCurve {
		if (curve.p0.y === startValue) return curve;
		return {
			...curve,
			p0: { ...curve.p0, y: startValue }
		};
	}

	function getCurve(key: CurveableParam): BezierCurve {
		const curve = params.curves?.[key];
		if (!curve) return flatCurve(params[key] as number);
		return alignCurveStart(curve, params[key] as number);
	}

	function onSliderValueChange(paramKey: NumericParamKey, value: number): void {
		void applyParam(paramKey, value as SynthParams[typeof paramKey]);
	}

	function setCurve(key: CurveableParam, curve: BezierCurve): void {
		void applyParam('curves', { ...(params.curves ?? {}), [key]: curve });
	}

	function isSequencedPreviewMode(): boolean {
		return isSequencedMode(params);
	}

	async function applyParam<K extends keyof SynthParams>(
		key: K,
		value: SynthParams[K]
	): Promise<void> {
		updateParam(key, value);
		const patch: Partial<SynthParams> = { [key]: params[key] } as Partial<SynthParams>;
		if (CURVEABLE_SYNC_KEYS.includes(key as CurveableParam)) {
			const curveKey = key as CurveableParam;
			const currentCurve = params.curves?.[curveKey];
			if (currentCurve) {
				const nextCurve = alignCurveStart(currentCurve, params[curveKey] as number);
				if (nextCurve !== currentCurve) {
					updateParam('curves', { ...(params.curves ?? {}), [curveKey]: nextCurve });
					patch.curves = params.curves;
				}
			}
		}
		synthesizer?.updateParams(patch);
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

<main class="dashboard" aria-label="Chirpr sound designer">
	<header class="header-bar">
		<div>
			<h1>Chirpr</h1>
			<p>v0.1.0</p>
		</div>
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
		<a href={APP_REPOSITORY_URL} target="_blank" rel="noreferrer">GitHub</a>
	</header>

	<div class="layout">
		<div class="left-column">
			<ResponsiveSection title="OSCILLATOR" open={true}>
				<div class="osc-head">
					<div class="osc-preview">
						<p class="control-label">Oscilloscope</p>
						<div class="osc-preview__content">
							<div class="osc-preview__waveforms">
								<PixelToggle
									options={waveformOptions}
									selected={params.waveform}
									onChange={(value) => void applyParam('waveform', value as WaveformType)}
								/>
							</div>
							<Oscilloscope waveform={waveformSource} renderHeight={OSC_PANEL_HEIGHT} />
						</div>
					</div>
					<div class="osc-curve">
						<p class="control-label">Pitch Curve</p>
						<BezierEditor
							curve={getCurve('frequency')}
							paramMin={PARAM_META.frequency.min}
							paramMax={PARAM_META.frequency.max}
							canvasWidth={320}
							canvasHeight={220}
							renderHeight={OSC_PANEL_HEIGHT}
							onChange={(curve) => setCurve('frequency', curve)}
						/>
					</div>
				</div>
				<div class="param-grid">
					{#each OSCILLATOR_SLIDERS as slider (slider.key)}
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
						<p class="section-note param-grid__note">{DUTY_CYCLE_DISABLED_NOTE}</p>
					{/if}
				</div>
			</ResponsiveSection>

			<ResponsiveSection title="ENVELOPE">
				<div class="param-grid">
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
				</div>
			</ResponsiveSection>

			<ResponsiveSection title="FILTERS">
				<div class="filters-grid">
					<div class="filter-column">
						<div class="param-grid param-grid--stacked">
							<ParamSlider
								paramKey="lpfCutoff"
								label="LPF Cutoff"
								value={params.lpfCutoff}
								onChange={(value) => onSliderValueChange('lpfCutoff', value)}
								onDragStart={onSliderDragStart}
								onDragEnd={onSliderDragEnd}
							/>
							<ParamSlider
								paramKey="lpfResonance"
								label="LPF Resonance"
								value={params.lpfResonance}
								onChange={(value) => onSliderValueChange('lpfResonance', value)}
								onDragStart={onSliderDragStart}
								onDragEnd={onSliderDragEnd}
							/>
						</div>
						<div class="filter-curve">
							<p class="control-label">LPF Curve</p>
							<BezierEditor
								curve={getCurve('lpfCutoff')}
								paramMin={PARAM_META.lpfCutoff.min}
								paramMax={PARAM_META.lpfCutoff.max}
								canvasWidth={280}
								canvasHeight={180}
								renderHeight={FILTER_CURVE_HEIGHT}
								onChange={(curve) => setCurve('lpfCutoff', curve)}
							/>
						</div>
					</div>
					<div class="filter-column">
						<div class="param-grid param-grid--stacked">
							<ParamSlider
								paramKey="hpfCutoff"
								label="HPF Cutoff"
								value={params.hpfCutoff}
								onChange={(value) => onSliderValueChange('hpfCutoff', value)}
								onDragStart={onSliderDragStart}
								onDragEnd={onSliderDragEnd}
							/>
							<ParamSlider
								paramKey="hpfResonance"
								label="HPF Resonance"
								value={params.hpfResonance}
								onChange={(value) => onSliderValueChange('hpfResonance', value)}
								onDragStart={onSliderDragStart}
								onDragEnd={onSliderDragEnd}
							/>
						</div>
						<div class="filter-curve">
							<p class="control-label">HPF Curve</p>
							<BezierEditor
								curve={getCurve('hpfCutoff')}
								paramMin={PARAM_META.hpfCutoff.min}
								paramMax={PARAM_META.hpfCutoff.max}
								canvasWidth={280}
								canvasHeight={180}
								renderHeight={FILTER_CURVE_HEIGHT}
								onChange={(curve) => setCurve('hpfCutoff', curve)}
							/>
						</div>
					</div>
				</div>
			</ResponsiveSection>

			<ResponsiveSection title="MODULATION">
				<div class="param-grid">
					{#each MODULATION_SLIDERS as slider (slider.key)}
						<ParamSlider
							paramKey={slider.key}
							label={slider.label}
							value={params[slider.key]}
							onChange={(value) => onSliderValueChange(slider.key, value)}
							onDragStart={onSliderDragStart}
							onDragEnd={onSliderDragEnd}
						/>
					{/each}
				</div>
			</ResponsiveSection>

			<ResponsiveSection title="FLANGER">
				<div class="param-grid">
					{#each FLANGER_SLIDERS as slider (slider.key)}
						<ParamSlider
							paramKey={slider.key}
							label={slider.label}
							value={params[slider.key]}
							onChange={(value) => onSliderValueChange(slider.key, value)}
							onDragStart={onSliderDragStart}
							onDragEnd={onSliderDragEnd}
						/>
					{/each}
				</div>
			</ResponsiveSection>

			<ResponsiveSection title="BIT CRUSHER">
				<div class="param-grid">
					{#each BIT_CRUSHER_SLIDERS as slider (slider.key)}
						<ParamSlider
							paramKey={slider.key}
							label={slider.label}
							value={params[slider.key]}
							onChange={(value) => onSliderValueChange(slider.key, value)}
							onDragStart={onSliderDragStart}
							onDragEnd={onSliderDragEnd}
						/>
					{/each}
				</div>
			</ResponsiveSection>
		</div>

		<div class="right-column">
			<ResponsiveSection title="EXPORT" open={true}>
				<div class="param-grid">
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
				</div>
				<button class="play-button" type="button" onclick={() => void togglePlay()}>
					{isPlaying ? '■ STOP' : '▶ PLAY'}
				</button>
				{#if !audioReady && audioInitAttempted}
					<p class="audio-hint">AUDIO ENABLES ON FIRST INTERACTION</p>
				{/if}
				<ExportPanel />
			</ResponsiveSection>

			<PresetPanel {synthesizer} />
			<RandomizerPanel onRandomize={(category) => void applyRandomCategory(category)} />
		</div>
	</div>
</main>

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

	.param-grid {
		display: grid;
		gap: 0.6rem;
	}

	.param-grid__note {
		grid-column: 1 / -1;
	}

	.osc-preview {
		display: grid;
		gap: 0.5rem;
	}

	.control-label {
		margin: 0;
		font-size: 0.65rem;
		color: inherit;
		letter-spacing: 0.05em;
	}

	.osc-preview__content {
		display: grid;
		gap: 0.5rem;
	}

	.osc-preview__waveforms :global(.pixel-toggle) {
		display: grid;
		gap: 0.4rem;
	}

	.osc-preview__waveforms :global(.pixel-toggle button) {
		width: 100%;
		padding: 0.65rem 1rem;
	}

	.osc-head {
		display: grid;
		gap: 0.75rem;
	}

	.osc-curve {
		display: grid;
		gap: 0.5rem;
		align-content: start;
	}

	.audio-hint {
		margin: -0.3rem 0 0;
		font-size: 0.52rem;
		color: var(--yellow);
	}

	.filters-grid {
		display: grid;
		gap: 0.6rem;
	}

	.filter-column {
		display: grid;
		gap: 0.6rem;
		align-content: start;
	}

	.filter-curve {
		display: grid;
		gap: 0.4rem;
	}

	@media (max-width: 900px) {
		.layout {
			grid-template-columns: 1fr;
		}
	}

	@media (min-width: 700px) {
		.param-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}

		.param-grid--stacked {
			grid-template-columns: 1fr;
		}
	}

	@media (min-width: 1100px) {
		.osc-head {
			grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
			align-items: start;
		}

		.osc-preview__content {
			grid-template-columns: minmax(7.5rem, auto) minmax(0, 1fr);
			align-items: stretch;
		}

		.filters-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
</style>
