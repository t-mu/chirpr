import { fireEvent, render, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flatCurve } from '$lib/audio/bezier';
import Dashboard from './Dashboard.svelte';
import { DEFAULT_PARAMS } from '$lib/types/SynthParams';
import { params, resetParams, updateParam } from '$lib/stores/synthParams.svelte';
import { PARAM_META } from '$lib/types/paramMeta';

const {
	mockPlay,
	mockStartPreview,
	mockStopPreview,
	mockStop,
	mockUpdateParams,
	mockDispose,
	mockRandomize,
	mockInitAudio
} = vi.hoisted(() => ({
	mockPlay: vi.fn(),
	mockStartPreview: vi.fn(),
	mockStopPreview: vi.fn(),
	mockStop: vi.fn(),
	mockUpdateParams: vi.fn(),
	mockDispose: vi.fn(),
	mockRandomize: vi.fn(),
	mockInitAudio: vi.fn(async () => {})
}));

vi.mock('tone', () => ({
	Waveform: class {
		public getValue() {
			return new Float32Array(1024);
		}
	}
}));

vi.mock('$lib/audio/engine', () => ({
	initAudio: mockInitAudio
}));

vi.mock('$lib/audio/randomizer', () => ({
	randomize: mockRandomize
}));

vi.mock('$lib/audio/synthesizer', () => ({
	createSynthesizer: vi.fn(async () => ({
		play: mockPlay,
		startPreview: mockStartPreview,
		stopPreview: mockStopPreview,
		stop: mockStop,
		updateParams: mockUpdateParams,
		getWaveformData: () => new Float32Array(1024),
		dispose: mockDispose
	}))
}));

beforeEach(() => {
	resetParams();
	mockRandomize.mockImplementation(() => ({ ...DEFAULT_PARAMS, frequency: 777 }));
});

afterEach(() => {
	document.body.innerHTML = '';
	resetParams();
	mockPlay.mockClear();
	mockStartPreview.mockClear();
	mockStopPreview.mockClear();
	mockStop.mockClear();
	mockUpdateParams.mockClear();
	mockDispose.mockClear();
	mockRandomize.mockClear();
	mockInitAudio.mockClear();
});

describe('Dashboard', () => {
	it('renders play button immediately', () => {
		const { getByRole } = render(Dashboard);
		expect(getByRole('button', { name: '▶ PLAY' })).toBeTruthy();
	});

	it('uses shared metadata for slider bounds', async () => {
		const { findByRole, getByText } = render(Dashboard);
		await findByRole('button', { name: '▶ PLAY' });

		const frequency = getByText('Frequency').closest('label')?.querySelector('input');
		const duration = getByText('Duration').closest('label')?.querySelector('input');
		expect(frequency).toBeTruthy();
		expect(duration).toBeTruthy();

		expect((frequency as HTMLInputElement).min).toBe(String(PARAM_META.frequency.min));
		expect((frequency as HTMLInputElement).max).toBe(String(PARAM_META.frequency.max));
		expect((frequency as HTMLInputElement).step).toBe(String(PARAM_META.frequency.step));
		expect((duration as HTMLInputElement).min).toBe(String(PARAM_META.duration.min));
		expect((duration as HTMLInputElement).max).toBe(String(PARAM_META.duration.max));
		expect((duration as HTMLInputElement).step).toBe(String(PARAM_META.duration.step));
	});

	it('space toggles play and ignores input-focused shortcuts', async () => {
		const { findByRole, getByLabelText } = render(Dashboard);
		await findByRole('button', { name: '▶ PLAY' });

		window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true }));
		await waitFor(() => {
			expect(mockPlay).toHaveBeenCalled();
		});
		expect(mockPlay).toHaveBeenLastCalledWith();
		const playCalls = mockPlay.mock.calls.length;

		const presetInput = getByLabelText('Preset name');
		await fireEvent.keyDown(presetInput, { key: ' ', code: 'Space' });
		expect(mockPlay).toHaveBeenCalledTimes(playCalls);
		expect(await findByRole('button', { name: '■ STOP' })).toBeTruthy();
	});

	it('R rerolls last random category and previews sound', async () => {
		const { findByRole } = render(Dashboard);
		await findByRole('button', { name: '▶ PLAY' });
		await fireEvent.keyDown(window, { code: 'KeyR' });

		expect(mockRandomize).toHaveBeenCalledWith('shoot');
		await waitFor(() => {
			expect(mockUpdateParams).toHaveBeenCalledWith(expect.objectContaining({ frequency: 777 }));
			expect(mockPlay).toHaveBeenCalled();
		});
		expect(mockPlay).toHaveBeenLastCalledWith();
	});

	it('S focuses preset name input', async () => {
		const { findByRole, getByLabelText } = render(Dashboard);
		await findByRole('button', { name: '▶ PLAY' });
		const presetInput = getByLabelText('Preset name') as HTMLInputElement;

		await fireEvent.keyDown(window, { code: 'KeyS' });

		expect(document.activeElement).toBe(presetInput);
	});

	it('Escape resets params and syncs defaults to synthesizer', async () => {
		const { findByRole } = render(Dashboard);
		await findByRole('button', { name: '▶ PLAY' });
		updateParam('frequency', 1500);
		expect(params.frequency).toBe(1500);

		await fireEvent.keyDown(window, { code: 'Escape' });

		expect(params.frequency).toBe(DEFAULT_PARAMS.frequency);
		expect(mockUpdateParams).toHaveBeenCalledWith(DEFAULT_PARAMS);
	});

	it('shows duty-cycle disabled note when waveform is not square', async () => {
		const { findByRole, queryByText, queryAllByText } = render(Dashboard);
		await findByRole('button', { name: '▶ PLAY' });
		const sawButton = await findByRole('button', { name: 'Saw' });

		expect(queryByText('DUTY CYCLE IS AVAILABLE ONLY FOR SQUARE WAVEFORM.')).toBeNull();
		await fireEvent.click(sawButton);
		expect(queryAllByText('DUTY CYCLE IS AVAILABLE ONLY FOR SQUARE WAVEFORM.').length).toBe(1);
	});

	it('shows retrigger slider', async () => {
		const { findByRole, getByText } = render(Dashboard);
		await findByRole('button', { name: '▶ PLAY' });
		expect(getByText('Retrigger')).toBeTruthy();
	});

	it('shows flanger depth, feedback and mix sliders', async () => {
		const { findByRole, getByText } = render(Dashboard);
		await findByRole('button', { name: '▶ PLAY' });

		expect(getByText('Flanger Depth')).toBeTruthy();
		expect(getByText('Flanger Feedback')).toBeTruthy();
		expect(getByText('Flanger Mix')).toBeTruthy();
		expect(getByText('Bit Depth')).toBeTruthy();
		expect(getByText('Sample Rate Reduction')).toBeTruthy();
	});

	it('updates flanger depth parameter when slider changes', async () => {
		const { findByRole, getByText } = render(Dashboard);
		await findByRole('button', { name: '▶ PLAY' });
		await fireEvent.click(await findByRole('button', { name: '▶ PLAY' }));
		await waitFor(() => {
			expect(mockPlay).toHaveBeenCalledTimes(1);
		});

		const input = getByText('Flanger Depth').closest('label')?.querySelector('input');
		expect(input).toBeTruthy();

		await fireEvent.input(input as HTMLInputElement, { target: { value: '0.42' } });

		expect(mockUpdateParams).toHaveBeenCalledWith({ flangerDepth: 0.42 });
	});

	it('updates sample rate reduction when slider changes', async () => {
		const { findByRole, getByText } = render(Dashboard);
		await findByRole('button', { name: '▶ PLAY' });
		await fireEvent.click(await findByRole('button', { name: '▶ PLAY' }));
		await waitFor(() => {
			expect(mockPlay).toHaveBeenCalledTimes(1);
		});

		const input = getByText('Sample Rate Reduction').closest('label')?.querySelector('input');
		expect(input).toBeTruthy();

		await fireEvent.input(input as HTMLInputElement, { target: { value: '12' } });

		expect(mockUpdateParams).toHaveBeenCalledWith({ sampleRateReduction: 12 });
	});

	it('restarts playback when duration changes while playing', async () => {
		const { findByRole, getByText } = render(Dashboard);
		await findByRole('button', { name: '▶ PLAY' });

		await fireEvent.click(await findByRole('button', { name: '▶ PLAY' }));
		await waitFor(() => {
			expect(mockPlay).toHaveBeenCalledTimes(1);
		});

		const durationInput = getByText('Duration').closest('label')?.querySelector('input');
		expect(durationInput).toBeTruthy();
		await fireEvent.input(durationInput as HTMLInputElement, { target: { value: '500' } });

		await waitFor(() => {
			expect(mockStop).toHaveBeenCalledTimes(1);
			expect(mockPlay).toHaveBeenCalledTimes(2);
		});
	});

	it('restarts playback when arp speed changes while playing', async () => {
		const { findByRole, getByText } = render(Dashboard);
		await findByRole('button', { name: '▶ PLAY' });

		await fireEvent.click(await findByRole('button', { name: '▶ PLAY' }));
		await waitFor(() => {
			expect(mockPlay).toHaveBeenCalledTimes(1);
		});

		const arpInput = getByText('Arp Speed').closest('label')?.querySelector('input');
		expect(arpInput).toBeTruthy();
		await fireEvent.input(arpInput as HTMLInputElement, { target: { value: '6' } });

		await waitFor(() => {
			expect(mockStop).toHaveBeenCalledTimes(1);
			expect(mockPlay).toHaveBeenCalledTimes(2);
		});
	});

	it('uses held preview while dragging sliders when idle', async () => {
		const { findByRole, getByText } = render(Dashboard);
		await findByRole('button', { name: '▶ PLAY' });
		const slider = getByText('Frequency').closest('label')?.querySelector('input');
		expect(slider).toBeTruthy();

		await fireEvent.pointerDown(slider as HTMLInputElement);
		await waitFor(() => {
			expect(mockStartPreview).toHaveBeenCalledTimes(1);
		});
		expect(mockPlay).not.toHaveBeenCalled();

		await fireEvent.input(slider as HTMLInputElement, { target: { value: '900' } });
		expect(mockUpdateParams).toHaveBeenCalledWith({ frequency: 900 });

		await fireEvent.pointerUp(slider as HTMLInputElement);
		await waitFor(() => {
			expect(mockStopPreview).toHaveBeenCalledTimes(1);
		});
	});

	it('skips held preview and uses one-shot preview when arp mode is enabled', async () => {
		const { findByRole, getByText } = render(Dashboard);
		await findByRole('button', { name: '▶ PLAY' });

		const arpInput = getByText('Arp Speed').closest('label')?.querySelector('input');
		expect(arpInput).toBeTruthy();
		await fireEvent.input(arpInput as HTMLInputElement, { target: { value: '6' } });
		await waitFor(() => {
			expect(mockPlay).toHaveBeenCalledTimes(1);
		});
		mockPlay.mockClear();

		const frequencyInput = getByText('Frequency').closest('label')?.querySelector('input');
		expect(frequencyInput).toBeTruthy();
		await fireEvent.pointerDown(frequencyInput as HTMLInputElement);
		expect(mockStartPreview).not.toHaveBeenCalled();

		await fireEvent.input(frequencyInput as HTMLInputElement, { target: { value: '880' } });
		await waitFor(() => {
			expect(mockPlay).toHaveBeenCalledTimes(1);
		});
	});

	it('skips held preview and uses one-shot preview when retrigger mode is enabled', async () => {
		const { findByRole, getByText } = render(Dashboard);
		await findByRole('button', { name: '▶ PLAY' });

		const retriggerRateInput = getByText('Retrigger').closest('label')?.querySelector('input');
		expect(retriggerRateInput).toBeTruthy();
		await fireEvent.input(retriggerRateInput as HTMLInputElement, { target: { value: '8' } });
		await waitFor(() => {
			expect(mockPlay).toHaveBeenCalled();
		});
		mockPlay.mockClear();

		const frequencyInput = getByText('Frequency').closest('label')?.querySelector('input');
		expect(frequencyInput).toBeTruthy();
		await fireEvent.pointerDown(frequencyInput as HTMLInputElement);
		expect(mockStartPreview).not.toHaveBeenCalled();

		await fireEvent.input(frequencyInput as HTMLInputElement, { target: { value: '880' } });
		await waitFor(() => {
			expect(mockPlay).toHaveBeenCalledTimes(1);
		});
	});

	it('stops held preview when switching to sequenced mode mid-drag', async () => {
		const { findByRole, getByText } = render(Dashboard);
		await findByRole('button', { name: '▶ PLAY' });

		const frequencyInput = getByText('Frequency').closest('label')?.querySelector('input');
		expect(frequencyInput).toBeTruthy();
		await fireEvent.pointerDown(frequencyInput as HTMLInputElement);
		await waitFor(() => {
			expect(mockStartPreview).toHaveBeenCalledTimes(1);
		});

		const arpInput = getByText('Arp Speed').closest('label')?.querySelector('input');
		expect(arpInput).toBeTruthy();
		await fireEvent.input(arpInput as HTMLInputElement, { target: { value: '6' } });
		await waitFor(() => {
			expect(mockStopPreview).toHaveBeenCalledTimes(1);
		});

		await fireEvent.pointerUp(frequencyInput as HTMLInputElement);
		mockStartPreview.mockClear();

		await fireEvent.pointerDown(frequencyInput as HTMLInputElement);
		expect(mockStartPreview).not.toHaveBeenCalled();
	});

	it('enables frequency automation curve from toggle', async () => {
		const { findByRole } = render(Dashboard);
		await findByRole('button', { name: '▶ PLAY' });

		await fireEvent.click(await findByRole('button', { name: 'PITCH' }));

		expect(params.curves.frequency).toBeDefined();
	});

	it('disables active frequency automation curve from toggle', async () => {
		updateParam('curves', { frequency: flatCurve(440) });
		const { findByRole } = render(Dashboard);
		await findByRole('button', { name: '▶ PLAY' });

		await fireEvent.click(await findByRole('button', { name: 'PITCH' }));

		expect(params.curves.frequency).toBeUndefined();
	});

	it('shows editor canvas only while a curve is active', async () => {
		const { findByRole, queryByLabelText } = render(Dashboard);
		await findByRole('button', { name: '▶ PLAY' });

		expect(queryByLabelText('Bezier curve editor')).toBeNull();
		await fireEvent.click(await findByRole('button', { name: 'PITCH' }));
		expect(queryByLabelText('Bezier curve editor')).toBeTruthy();
		await fireEvent.click(await findByRole('button', { name: 'PITCH' }));
		expect(queryByLabelText('Bezier curve editor')).toBeNull();
	});
});
