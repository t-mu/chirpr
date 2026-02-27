import { fireEvent, render } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Dashboard from './Dashboard.svelte';

const mockPlay = vi.fn();
const mockStop = vi.fn();
const mockUpdateParams = vi.fn();
const mockDispose = vi.fn();

vi.mock('tone', () => ({
	start: vi.fn(async () => {}),
	Waveform: class {
		public getValue() {
			return new Float32Array(1024);
		}
	}
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

afterEach(() => {
	document.body.innerHTML = '';
	mockPlay.mockClear();
	mockStop.mockClear();
	mockUpdateParams.mockClear();
	mockDispose.mockClear();
});

describe('Dashboard', () => {
	it('renders play button', () => {
		const { getByRole } = render(Dashboard);
		expect(getByRole('button', { name: '▶ PLAY' })).toBeTruthy();
	});

	it('clicking play does not throw', async () => {
		const { getByRole } = render(Dashboard);
		const playButton = getByRole('button', { name: '▶ PLAY' });

		await expect(async () => {
			await fireEvent.click(playButton);
		}).not.toThrow();
	});
});
