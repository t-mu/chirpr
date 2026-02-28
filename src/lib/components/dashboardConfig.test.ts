import { describe, expect, it } from 'vitest';
import {
	BIT_CRUSHER_SLIDERS,
	ENVELOPE_SLIDERS,
	FILTERS_SLIDERS,
	FLANGER_SLIDERS,
	MODULATION_SLIDERS,
	OSCILLATOR_SLIDERS,
	PLAYBACK_SLIDERS
} from './dashboardConfig';
import { DEFAULT_PARAMS } from '$lib/types/SynthParams';

describe('dashboardConfig', () => {
	it('disables duty cycle slider when waveform is not square', () => {
		const duty = OSCILLATOR_SLIDERS.find((slider) => slider.key === 'dutyCycle');
		if (!duty) {
			throw new Error('Expected dutyCycle slider config');
		}
		expect(duty.disabledWhen?.(DEFAULT_PARAMS)).toBe(false);
		expect(duty.disabledWhen?.({ ...DEFAULT_PARAMS, waveform: 'sine' })).toBe(true);
	});

	it('contains expected core slider groups', () => {
		expect(OSCILLATOR_SLIDERS.map((slider) => slider.key)).toEqual([
			'frequency',
			'detune',
			'dutyCycle'
		]);
		expect(ENVELOPE_SLIDERS.map((slider) => slider.key)).toEqual([
			'attack',
			'decay',
			'sustain',
			'release'
		]);
		expect(FILTERS_SLIDERS.map((slider) => slider.key)).toEqual([
			'lpfCutoff',
			'lpfResonance',
			'hpfCutoff',
			'hpfResonance'
		]);
		expect(MODULATION_SLIDERS.map((slider) => slider.key)).toEqual([
			'vibratoRate',
			'vibratoDepth',
			'arpSpeed',
			'retriggerRate'
		]);
		expect(FLANGER_SLIDERS.map((slider) => slider.key)).toEqual([
			'flangerRate',
			'flangerDepth',
			'flangerFeedback',
			'flangerWet'
		]);
		expect(BIT_CRUSHER_SLIDERS.map((slider) => slider.key)).toEqual([
			'bitDepth',
			'sampleRateReduction'
		]);
		expect(PLAYBACK_SLIDERS.map((slider) => slider.key)).toEqual(['duration']);
	});
});
