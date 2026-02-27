import { describe, expect, it, vi } from 'vitest';
import { createDashboardPreviewController, PREVIEW_CONFIG } from './dashboardPreviewController';
import type { SynthesizerAPI } from '$lib/audio/synthesizer';
import type { SynthParams } from '$lib/types/SynthParams';

function createSynthMock(): SynthesizerAPI {
	return {
		play: vi.fn<(note?: string | number) => void>(),
		startPreview: vi.fn<(note?: string | number) => void>(),
		stopPreview: vi.fn<() => void>(),
		stop: vi.fn<() => void>(),
		updateParams: vi.fn<(params: Partial<SynthParams>) => void>(),
		getWaveformData: vi.fn(() => new Float32Array(32)),
		dispose: vi.fn<() => void>()
	};
}

describe('dashboardPreviewController', () => {
	it('starts held preview on drag in non-sequenced idle mode', async () => {
		const synth = createSynthMock();
		const controller = createDashboardPreviewController({
			ensureSynth: vi.fn(async () => synth),
			initAudio: vi.fn(async () => {}),
			isPlaying: () => false,
			isSequencedPreviewMode: () => false,
			previewOneShot: vi.fn()
		});

		await controller.onDragStart();

		expect(synth.startPreview).toHaveBeenCalledTimes(1);
	});

	it('skips held preview in sequenced mode', async () => {
		const synth = createSynthMock();
		const controller = createDashboardPreviewController({
			ensureSynth: vi.fn(async () => synth),
			initAudio: vi.fn(async () => {}),
			isPlaying: () => false,
			isSequencedPreviewMode: () => true,
			previewOneShot: vi.fn()
		});

		await controller.onDragStart();

		expect(synth.startPreview).not.toHaveBeenCalled();
	});

	it('stops held preview when mode switches to sequenced', async () => {
		let sequencedMode = false;
		const synth = createSynthMock();
		const controller = createDashboardPreviewController({
			ensureSynth: vi.fn(async () => synth),
			initAudio: vi.fn(async () => {}),
			isPlaying: () => false,
			isSequencedPreviewMode: () => sequencedMode,
			previewOneShot: vi.fn()
		});

		await controller.onDragStart();
		expect(synth.startPreview).toHaveBeenCalledTimes(1);
		expect(synth.stopPreview).not.toHaveBeenCalled();

		sequencedMode = true;
		await controller.syncMode();
		expect(synth.stopPreview).toHaveBeenCalledTimes(1);

		await controller.onDragStart();
		expect(synth.startPreview).toHaveBeenCalledTimes(1);
	});

	it('debounces idle one-shot preview', async () => {
		vi.useFakeTimers();
		try {
			const synth = createSynthMock();
			const previewOneShot = vi.fn();
			const controller = createDashboardPreviewController({
				ensureSynth: vi.fn(async () => synth),
				initAudio: vi.fn(async () => {}),
				isPlaying: () => false,
				isSequencedPreviewMode: () => false,
				previewOneShot
			});

			controller.scheduleIdlePreview();
			controller.scheduleIdlePreview();
			await vi.advanceTimersByTimeAsync(PREVIEW_CONFIG.previewDebounceMs - 1);
			expect(previewOneShot).not.toHaveBeenCalled();

			await vi.advanceTimersByTimeAsync(1);
			expect(previewOneShot).toHaveBeenCalledTimes(1);
		} finally {
			vi.useRealTimers();
		}
	});

	it('stopAll clears held preview and pending timers', async () => {
		vi.useFakeTimers();
		try {
			const synth = createSynthMock();
			const previewOneShot = vi.fn();
			const controller = createDashboardPreviewController({
				ensureSynth: vi.fn(async () => synth),
				initAudio: vi.fn(async () => {}),
				isPlaying: () => false,
				isSequencedPreviewMode: () => false,
				previewOneShot
			});

			await controller.onDragStart();
			controller.scheduleIdlePreview();
			await controller.stopAll();
			await vi.advanceTimersByTimeAsync(PREVIEW_CONFIG.previewDebounceMs + 10);

			expect(synth.stopPreview).toHaveBeenCalledTimes(1);
			expect(previewOneShot).not.toHaveBeenCalled();
		} finally {
			vi.useRealTimers();
		}
	});

	it('stops held preview after drag release delay', async () => {
		vi.useFakeTimers();
		try {
			const synth = createSynthMock();
			const controller = createDashboardPreviewController({
				ensureSynth: vi.fn(async () => synth),
				initAudio: vi.fn(async () => {}),
				isPlaying: () => false,
				isSequencedPreviewMode: () => false,
				previewOneShot: vi.fn()
			});

			await controller.onDragStart();
			controller.onDragEnd();
			expect(synth.stopPreview).not.toHaveBeenCalled();

			await vi.advanceTimersByTimeAsync(PREVIEW_CONFIG.heldPreviewReleaseMs);
			expect(synth.stopPreview).toHaveBeenCalledTimes(1);
		} finally {
			vi.useRealTimers();
		}
	});
});
