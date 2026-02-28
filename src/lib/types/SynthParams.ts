export type Waveform = 'square' | 'sawtooth' | 'sine' | 'noise';
export type ArpPattern = 'up' | 'down' | 'random';
import type { BezierCurve, CurveableParam } from './BezierCurve';

export interface SynthParams {
	waveform: Waveform;
	frequency: number;
	detune: number;
	attack: number;
	decay: number;
	sustain: number;
	release: number;
	dutyCycle: number;
	vibratoRate: number;
	vibratoDepth: number;
	arpSpeed: number;
	arpSteps: number[];
	arpPattern: ArpPattern;
	flangerRate: number;
	flangerDepth: number;
	flangerFeedback: number;
	flangerWet: number;
	lpfCutoff: number;
	lpfResonance: number;
	hpfCutoff: number;
	hpfResonance: number;
	bitDepth: number;
	sampleRateReduction: number;
	retriggerRate: number;
	duration: number;
	/** Active automation curves keyed by automatable parameter. */
	curves: Partial<Record<CurveableParam, BezierCurve>>;
}

export const DEFAULT_PARAMS: SynthParams = {
	waveform: 'square',
	frequency: 440,
	detune: 0,
	attack: 0.01,
	decay: 0.1,
	sustain: 0.5,
	release: 0.2,
	dutyCycle: 0.5,
	vibratoRate: 4,
	vibratoDepth: 0,
	arpSpeed: 0,
	arpSteps: [0, 4, 7],
	arpPattern: 'up',
	flangerRate: 0,
	flangerDepth: 0,
	flangerFeedback: 0,
	flangerWet: 0,
	lpfCutoff: 20000,
	lpfResonance: 1,
	hpfCutoff: 20,
	hpfResonance: 1,
	bitDepth: 16,
	sampleRateReduction: 1,
	retriggerRate: 0,
	duration: 300,
	curves: {}
};
