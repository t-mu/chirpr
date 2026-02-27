import { fireEvent, render } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PresetPanel from './PresetPanel.svelte';
import { __resetPresetsForTests, savePreset } from '$lib/stores/presets.svelte';
import { DEFAULT_PARAMS } from '$lib/types/SynthParams';
import { params, resetParams } from '$lib/stores/synthParams.svelte';
import type { SynthesizerAPI } from '$lib/audio/synthesizer';

beforeEach(() => {
	localStorage.setItem('sfx_initialized', '1');
	__resetPresetsForTests();
	resetParams();
});

afterEach(() => {
	document.body.innerHTML = '';
	__resetPresetsForTests();
	resetParams();
});

describe('PresetPanel', () => {
	it('saving a preset adds it to rendered list', async () => {
		const { getByLabelText, getByRole, getByText } = render(PresetPanel);
		const input = getByLabelText('Preset name') as HTMLInputElement;
		input.value = 'MY PRESET';
		await fireEvent.input(input);

		await fireEvent.click(getByRole('button', { name: 'Save' }));

		expect(getByText('MY PRESET')).toBeTruthy();
	});

	it('deleting a preset removes it from rendered list', async () => {
		savePreset('DELETE ME', DEFAULT_PARAMS);
		const { getByLabelText, getByRole, queryByText } = render(PresetPanel);

		await fireEvent.click(getByLabelText('Delete DELETE ME'));
		await fireEvent.click(getByRole('button', { name: 'Yes, delete' }));

		expect(queryByText('DELETE ME')).toBeNull();
	});

	it('loading a preset updates synth params and calls synthesizer update', async () => {
		savePreset('LOAD ME', { ...DEFAULT_PARAMS, frequency: 1337 });
		const synthMock = {
			play: vi.fn(),
			stop: vi.fn(),
			updateParams: vi.fn()
		} as Pick<SynthesizerAPI, 'play' | 'stop' | 'updateParams'>;
		const { getByLabelText } = render(PresetPanel, {
			props: { synthesizer: synthMock as SynthesizerAPI }
		});

		await fireEvent.click(getByLabelText('Load LOAD ME'));

		expect(params.frequency).toBe(1337);
		expect(synthMock.updateParams).toHaveBeenCalledWith(
			expect.objectContaining({ frequency: 1337 })
		);
	});
});
