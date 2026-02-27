import { fireEvent, render, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Dashboard from './Dashboard.svelte';
import { DEFAULT_PARAMS } from '$lib/types/SynthParams';
import { params, resetParams, updateParam } from '$lib/stores/synthParams.svelte';

const { mockPlay, mockStop, mockUpdateParams, mockDispose, mockRandomize, mockInitAudio } =
	vi.hoisted(() => ({
		mockPlay: vi.fn(),
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
		expect(mockUpdateParams).toHaveBeenCalledWith(expect.objectContaining({ frequency: 777 }));
		await waitFor(() => {
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

	it('shows retrigger count slider', async () => {
		const { findByRole, getByText } = render(Dashboard);
		await findByRole('button', { name: '▶ PLAY' });
		expect(getByText('Retrigger Count')).toBeTruthy();
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
});
