import type { SynthParams } from '$lib/types/SynthParams';

type NumericSynthParamKey = {
	[K in keyof SynthParams]: SynthParams[K] extends number ? K : never;
}[keyof SynthParams];

export interface ParamMeta {
	min: number;
	max: number;
	step: number;
	unit?: string;
	section:
		| 'oscillator'
		| 'envelope'
		| 'dutyCycle'
		| 'effects'
		| 'filters'
		| 'bitCrusher'
		| 'retrigger'
		| 'playback';
}

export const PARAM_META = {
	frequency: { min: 20, max: 2000, step: 1, unit: 'Hz', section: 'oscillator' },
	detune: { min: -100, max: 100, step: 1, unit: 'c', section: 'oscillator' },
	attack: { min: 0.001, max: 2, step: 0.001, section: 'envelope' },
	decay: { min: 0.001, max: 2, step: 0.001, section: 'envelope' },
	sustain: { min: 0, max: 1, step: 0.01, section: 'envelope' },
	release: { min: 0.001, max: 5, step: 0.001, section: 'envelope' },
	dutyCycle: { min: 0, max: 1, step: 0.01, section: 'dutyCycle' },
	vibratoRate: { min: 0, max: 20, step: 0.1, unit: 'Hz', section: 'effects' },
	vibratoDepth: { min: 0, max: 1, step: 0.01, section: 'effects' },
	arpSpeed: { min: 0, max: 20, step: 0.1, unit: 'Hz', section: 'effects' },
	flangerRate: { min: 0, max: 20, step: 0.1, unit: 'Hz', section: 'effects' },
	flangerDepth: { min: 0, max: 1, step: 0.01, section: 'effects' },
	flangerFeedback: { min: 0, max: 0.95, step: 0.01, section: 'effects' },
	flangerWet: { min: 0, max: 1, step: 0.01, section: 'effects' },
	lpfCutoff: { min: 20, max: 20000, step: 1, unit: 'Hz', section: 'filters' },
	lpfResonance: { min: 0.1, max: 20, step: 0.1, section: 'filters' },
	hpfCutoff: { min: 20, max: 20000, step: 1, unit: 'Hz', section: 'filters' },
	hpfResonance: { min: 0.1, max: 20, step: 0.1, section: 'filters' },
	bitDepth: { min: 1, max: 16, step: 1, section: 'bitCrusher' },
	sampleRateReduction: { min: 1, max: 32, step: 1, section: 'bitCrusher' },
	retriggerRate: { min: 0, max: 20, step: 0.1, section: 'retrigger' },
	retriggerCount: { min: 0, max: 16, step: 1, section: 'retrigger' },
	duration: { min: 50, max: 2000, step: 10, unit: 'ms', section: 'playback' }
} satisfies Record<NumericSynthParamKey, ParamMeta>;

export type NumericParamKey = keyof typeof PARAM_META;

export const NUMERIC_PARAM_KEYS = Object.keys(PARAM_META) as NumericParamKey[];

export function clampParam<K extends NumericParamKey>(key: K, value: number): number {
	const { min, max } = PARAM_META[key];
	return Math.max(min, Math.min(max, value));
}

export function assertParamMetaCoverage(defaultParams: SynthParams): void {
	const numericKeys = Object.entries(defaultParams)
		.filter(([, value]) => typeof value === 'number')
		.map(([key]) => key as keyof SynthParams);
	for (const key of numericKeys) {
		if (!(key in PARAM_META)) {
			throw new Error(`Missing param metadata for numeric key: ${key}`);
		}
	}
}
