import { DEFAULT_PARAMS, type SynthParams, type Waveform } from '$lib/types/SynthParams';

export type SoundCategory = 'shoot' | 'jump' | 'explosion' | 'powerup' | 'coin' | 'hit' | 'blip';

interface Range {
	min: number;
	max: number;
}

const GLOBAL_NUMERIC_RANGES: Record<string, Range> = {
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
	hpfCutoff: { min: 20, max: 20000 },
	lpfResonance: { min: 0.1, max: 20 },
	hpfResonance: { min: 0.1, max: 20 },
	bitDepth: { min: 1, max: 16 },
	sampleRateReduction: { min: 1, max: 32 },
	retriggerRate: { min: 0, max: 20 },
	retriggerCount: { min: 0, max: 16 }
};

function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}

export function randomBetween(min: number, max: number): number {
	return Math.random() * (max - min) + min;
}

export function randomChoice<T>(arr: T[]): T {
	return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
	return Math.round(randomBetween(min, max));
}

const CATEGORY_FREQUENCY_RANGE: Record<SoundCategory, Range> = {
	shoot: { min: 800, max: 2000 },
	jump: { min: 500, max: 1200 },
	explosion: { min: 40, max: 260 },
	powerup: { min: 600, max: 1500 },
	coin: { min: 900, max: 2000 },
	hit: { min: 120, max: 700 },
	blip: { min: 1200, max: 2000 }
};

function withGlobalClamp(params: SynthParams): SynthParams {
	const next = structuredClone(params);
	const mutable = next as unknown as Record<string, unknown>;
	for (const [key, range] of Object.entries(GLOBAL_NUMERIC_RANGES)) {
		const current = mutable[key];
		if (typeof current !== 'number' || Number.isNaN(current)) {
			mutable[key] = range.min;
			continue;
		}
		mutable[key] = clamp(current, range.min, range.max);
	}
	return next;
}

function randomWaveform(options: Waveform[]): Waveform {
	return randomChoice(options);
}

export function randomize(category: SoundCategory): SynthParams {
	const output: SynthParams = structuredClone(DEFAULT_PARAMS);
	output.frequency = randomBetween(
		CATEGORY_FREQUENCY_RANGE[category].min,
		CATEGORY_FREQUENCY_RANGE[category].max
	);

	switch (category) {
		case 'shoot':
			output.waveform = randomWaveform(['square', 'sawtooth']);
			output.attack = 0.001;
			output.decay = randomBetween(0.05, 0.15);
			output.sustain = randomBetween(0, 0.2);
			output.release = randomBetween(0.01, 0.08);
			output.bitDepth = randomInt(4, 10);
			break;
		case 'jump':
			output.waveform = 'sawtooth';
			output.detune = randomChoice([-1, 1]) * randomBetween(50, 100);
			output.attack = randomBetween(0.01, 0.08);
			output.decay = randomBetween(0.1, 0.28);
			output.vibratoRate = randomBetween(2, 7);
			output.vibratoDepth = randomBetween(0.05, 0.25);
			break;
		case 'explosion':
			output.waveform = 'noise';
			output.attack = randomBetween(0.01, 0.05);
			output.decay = randomBetween(0.3, 1);
			output.sustain = randomBetween(0, 0.2);
			output.release = randomBetween(0.2, 0.9);
			output.hpfCutoff = randomBetween(20, 300);
			output.lpfCutoff = randomBetween(120, 1500);
			output.bitDepth = randomInt(1, 6);
			output.sampleRateReduction = randomInt(4, 20);
			break;
		case 'powerup':
			output.waveform = 'square';
			output.arpPattern = 'up';
			output.arpSpeed = randomBetween(6, 14);
			output.arpSteps = [0, 4, 7, 12];
			output.attack = randomBetween(0.005, 0.05);
			output.decay = randomBetween(0.08, 0.25);
			output.release = randomBetween(0.08, 0.24);
			break;
		case 'coin':
			output.waveform = randomWaveform(['sine', 'square']);
			output.arpPattern = 'up';
			output.arpSpeed = randomBetween(10, 18);
			output.attack = 0.001;
			output.decay = randomBetween(0.03, 0.1);
			output.sustain = 0;
			output.release = randomBetween(0.02, 0.1);
			break;
		case 'hit':
			output.waveform = 'noise';
			output.attack = 0.001;
			output.decay = randomBetween(0.03, 0.15);
			output.sustain = 0;
			output.release = randomBetween(0.01, 0.08);
			output.hpfCutoff = randomBetween(100, 1200);
			output.bitDepth = randomInt(3, 8);
			break;
		case 'blip':
			output.waveform = 'sine';
			output.attack = randomBetween(0.001, 0.02);
			output.decay = randomBetween(0.02, 0.09);
			output.sustain = randomBetween(0, 0.1);
			output.release = randomBetween(0.01, 0.06);
			output.detune = randomBetween(-20, 20);
			break;
	}

	return withGlobalClamp(output);
}

export const __testRanges = {
	CATEGORY_FREQUENCY_RANGE,
	GLOBAL_NUMERIC_RANGES
};
