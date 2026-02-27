import { DEFAULT_PARAMS, type SynthParams } from '$lib/types/SynthParams';

const NUMERIC_RANGES: Partial<Record<keyof SynthParams, { min: number; max: number }>> = {
	frequency: { min: 20, max: 2000 },
	detune: { min: -100, max: 100 },
	attack: { min: 0.001, max: 2 },
	decay: { min: 0.001, max: 2 },
	sustain: { min: 0, max: 1 },
	release: { min: 0.001, max: 5 },
	dutyCycle: { min: 0, max: 1 },
	vibratoRate: { min: 0, max: 20 },
	vibratoDepth: { min: 0, max: 1 },
	arpSpeed: { min: 0, max: 20 },
	flangerRate: { min: 0, max: 20 },
	flangerDepth: { min: 0, max: 1 },
	flangerFeedback: { min: 0, max: 0.95 },
	flangerWet: { min: 0, max: 1 },
	lpfCutoff: { min: 20, max: 20000 },
	lpfResonance: { min: 0.1, max: 20 },
	hpfCutoff: { min: 20, max: 20000 },
	hpfResonance: { min: 0.1, max: 20 },
	bitDepth: { min: 1, max: 16 },
	sampleRateReduction: { min: 1, max: 32 },
	retriggerRate: { min: 0, max: 20 },
	retriggerCount: { min: 0, max: 16 }
};

const NUMERIC_KEYS = Object.keys(NUMERIC_RANGES) as Array<keyof SynthParams>;

const clamp = (value: number, min: number, max: number): number =>
	Math.max(min, Math.min(max, value));

function sanitizeParams(input: SynthParams): SynthParams {
	const next = structuredClone(input);
	const mutable = next as Record<keyof SynthParams, unknown>;
	for (const key of NUMERIC_KEYS) {
		const range = NUMERIC_RANGES[key];
		if (!range) continue;
		const current = mutable[key] as number;
		mutable[key] = clamp(current, range.min, range.max);
	}
	return next;
}

export const params = $state<SynthParams>(sanitizeParams(DEFAULT_PARAMS));

export function updateParam<K extends keyof SynthParams>(key: K, value: SynthParams[K]): void {
	const range = NUMERIC_RANGES[key];
	if (range && typeof value === 'number') {
		params[key] = clamp(value, range.min, range.max) as SynthParams[K];
		return;
	}
	params[key] = value;
}

export function setParams(nextParams: SynthParams): void {
	Object.assign(params, sanitizeParams(nextParams));
}

export function resetParams(): void {
	Object.assign(params, sanitizeParams(DEFAULT_PARAMS));
}
