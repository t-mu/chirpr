import type { SynthesizerAPI } from '$lib/audio/synthesizer';
import type { SynthParams } from '$lib/types/SynthParams';

export const PREVIEW_CONFIG = {
	heldPreviewReleaseMs: 120,
	previewDebounceMs: 100
} as const;

const RETRIGGER_REQUIRED_PARAMS = new Set<keyof SynthParams>([
	'duration',
	'arpSpeed',
	'retriggerRate',
	'waveform'
]);

export function isSequencedMode(params: SynthParams): boolean {
	return params.arpSpeed > 0 || params.retriggerRate > 0;
}

export function requiresRetriggerOnChange(paramKey: keyof SynthParams): boolean {
	return RETRIGGER_REQUIRED_PARAMS.has(paramKey);
}

interface PreviewControllerDeps {
	ensureSynth: () => Promise<SynthesizerAPI>;
	initAudio: () => Promise<void>;
	isPlaying: () => boolean;
	isSequencedPreviewMode: () => boolean;
	previewOneShot: (synth: SynthesizerAPI) => void;
}

export function createDashboardPreviewController(deps: PreviewControllerDeps) {
	let previewDebounce: number | null = null;
	let heldPreviewRelease: number | null = null;
	let activeDragCount = 0;
	let isHeldPreviewActive = false;

	function clearPreviewDebounce(): void {
		if (previewDebounce !== null) {
			clearTimeout(previewDebounce);
			previewDebounce = null;
		}
	}

	function clearHeldPreviewRelease(): void {
		if (heldPreviewRelease !== null) {
			clearTimeout(heldPreviewRelease);
			heldPreviewRelease = null;
		}
	}

	async function stopHeldPreview(): Promise<void> {
		clearHeldPreviewRelease();
		if (!isHeldPreviewActive) return;
		const synth = await deps.ensureSynth();
		synth.stopPreview();
		isHeldPreviewActive = false;
	}

	async function onDragStart(): Promise<void> {
		if (deps.isPlaying()) return;
		activeDragCount += 1;
		clearHeldPreviewRelease();
		clearPreviewDebounce();
		if (deps.isSequencedPreviewMode()) {
			// Sequenced playback retriggers itself; a held note would mask that behavior.
			await stopHeldPreview();
			return;
		}
		if (isHeldPreviewActive || activeDragCount !== 1) return;

		await deps.initAudio();
		if (deps.isPlaying()) return;
		const synth = await deps.ensureSynth();
		synth.startPreview();
		isHeldPreviewActive = true;
	}

	function onDragEnd(): void {
		if (activeDragCount > 0) {
			activeDragCount -= 1;
		}
		if (activeDragCount !== 0 || !isHeldPreviewActive) return;
		clearHeldPreviewRelease();
		heldPreviewRelease = window.setTimeout(() => {
			void stopHeldPreview();
		}, PREVIEW_CONFIG.heldPreviewReleaseMs);
	}

	function scheduleIdlePreview(): void {
		clearPreviewDebounce();
		previewDebounce = window.setTimeout(async () => {
			previewDebounce = null;
			if (deps.isPlaying() || isHeldPreviewActive) return;
			await deps.initAudio();
			if (deps.isPlaying() || isHeldPreviewActive) return;
			const synth = await deps.ensureSynth();
			deps.previewOneShot(synth);
		}, PREVIEW_CONFIG.previewDebounceMs);
	}

	async function stopAll(): Promise<void> {
		clearPreviewDebounce();
		clearHeldPreviewRelease();
		activeDragCount = 0;
		await stopHeldPreview();
	}

	async function syncMode(): Promise<void> {
		if (!deps.isSequencedPreviewMode()) return;
		clearPreviewDebounce();
		await stopHeldPreview();
	}

	return {
		onDragStart,
		onDragEnd,
		scheduleIdlePreview,
		syncMode,
		stopAll
	};
}
