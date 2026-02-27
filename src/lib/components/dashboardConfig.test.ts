import { describe, expect, it } from 'vitest';
import {
	DUTY_CYCLE_SLIDERS,
	EFFECTS_SLIDERS,
	ENVELOPE_SLIDERS,
	OSCILLATOR_SLIDERS,
	PLAYBACK_SLIDERS
} from './dashboardConfig';
import { DEFAULT_PARAMS } from '$lib/types/SynthParams';

describe('dashboardConfig', () => {
	it('disables duty cycle slider when waveform is not square', () => {
		const duty = DUTY_CYCLE_SLIDERS[0];
		expect(duty.disabledWhen?.(DEFAULT_PARAMS)).toBe(false);
		expect(duty.disabledWhen?.({ ...DEFAULT_PARAMS, waveform: 'sine' })).toBe(true);
	});

	it('contains expected core slider groups', () => {
		expect(OSCILLATOR_SLIDERS.map((slider) => slider.key)).toEqual(['frequency', 'detune']);
		expect(ENVELOPE_SLIDERS.map((slider) => slider.key)).toEqual([
			'attack',
			'decay',
			'sustain',
			'release'
		]);
		expect(PLAYBACK_SLIDERS.map((slider) => slider.key)).toEqual(['duration']);
		expect(EFFECTS_SLIDERS.some((slider) => slider.key === 'flangerWet')).toBe(true);
	});
});
