import type { SynthesizerAPI } from '$lib/audio/synthesizer';
import type { SynthParams } from '$lib/types/SynthParams';

const HELD_PREVIEW_RELEASE_MS = 120;
export const PREVIEW_DEBOUNCE_MS = 100;

export const RETRIGGER_REQUIRED_PARAMS = new Set<keyof SynthParams>([
	'duration',
	'arpSpeed',
	'retriggerRate',
	'retriggerCount',
	'waveform'
]);

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
		if (deps.isSequencedPreviewMode()) return;
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
		}, HELD_PREVIEW_RELEASE_MS);
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
		}, PREVIEW_DEBOUNCE_MS);
	}

	async function stopAll(): Promise<void> {
		clearPreviewDebounce();
		clearHeldPreviewRelease();
		activeDragCount = 0;
		await stopHeldPreview();
	}

	return {
		onDragStart,
		onDragEnd,
		scheduleIdlePreview,
		stopAll,
		clearPreviewDebounce
	};
}
