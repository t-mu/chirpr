import * as Tone from 'tone';
import { BitCrusherNode } from './BitCrusherNode';

export type Waveform = 'square' | 'sawtooth' | 'sine' | 'noise';
export type ArpPattern = 'up' | 'down' | 'random';

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
	retriggerCount: number;
}

export const DEFAULT_SYNTH_PARAMS: SynthParams = {
	waveform: 'square',
	frequency: 440,
	detune: 0,
	attack: 0.01,
	decay: 0.1,
	sustain: 0.5,
	release: 0.2,
	dutyCycle: 0.5,
	vibratoRate: 0,
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
	retriggerCount: 0
};

export interface SynthesizerAPI {
	play(note?: string): void;
	stop(): void;
	updateParams(params: Partial<SynthParams>): void;
	getWaveformData(): Float32Array;
	dispose(): void;
}

const clamp = (value: number, min: number, max: number): number =>
	Math.max(min, Math.min(max, value));

const clampFrequency = (value: number): number => clamp(value, 20, 2000);

const isArpeggioEnabled = (params: SynthParams): boolean => params.arpSpeed > 0;

const isRetriggerEnabled = (params: SynthParams): boolean =>
	params.retriggerRate > 0 && params.retriggerCount > 0;

export function orderArpSteps(steps: number[], pattern: ArpPattern): number[] {
	if (pattern === 'down') {
		return [...steps].sort((a, b) => b - a);
	}
	if (pattern === 'random') {
		return [...steps].sort(() => Math.random() - 0.5);
	}
	return [...steps].sort((a, b) => a - b);
}

type Voice = InstanceType<typeof Tone.Synth> | InstanceType<typeof Tone.NoiseSynth>;

class Synthesizer implements SynthesizerAPI {
	private params: SynthParams;
	private readonly bitCrusherNode: BitCrusherNode;
	private readonly vibrato: Tone.Vibrato;
	private readonly chorus: Tone.Chorus;
	private readonly lpf: Tone.Filter;
	private readonly hpf: Tone.Filter;
	private readonly waveform: Tone.Waveform;
	private readonly arpPattern: Tone.Pattern<number>;
	private readonly retriggerLoop: Tone.Loop;
	private voice: Voice;
	private currentNote = 'C4';

	private constructor(params: SynthParams, bitCrusherNode: BitCrusherNode) {
		this.params = { ...params };
		this.bitCrusherNode = bitCrusherNode;
		this.vibrato = new Tone.Vibrato();
		this.chorus = new Tone.Chorus();
		this.lpf = new Tone.Filter({ type: 'lowpass' });
		this.hpf = new Tone.Filter({ type: 'highpass' });
		this.waveform = new Tone.Waveform(1024);
		this.arpPattern = new Tone.Pattern<number>(
			(time, step) => {
				if (this.voice instanceof Tone.NoiseSynth) {
					this.voice.triggerAttackRelease('16n', time);
					return;
				}
				const note = Tone.Frequency(this.currentNote).transpose(step).toNote();
				this.voice.triggerAttackRelease(note, '16n', time);
			},
			orderArpSteps(this.params.arpSteps, this.params.arpPattern)
		);
		this.retriggerLoop = new Tone.Loop((time) => {
			if (this.voice instanceof Tone.NoiseSynth) {
				this.voice.triggerAttackRelease('16n', time);
				return;
			}
			this.voice.triggerAttackRelease(this.currentNote, '16n', time);
		}, '16n');

		this.voice = this.createVoice(this.params.waveform);
		this.rewireVoice();
		this.applyParams(this.params);
	}

	static async create(params: Partial<SynthParams> = {}): Promise<SynthesizerAPI> {
		const merged = { ...DEFAULT_SYNTH_PARAMS, ...params };
		const bitCrusherNode = await BitCrusherNode.create(Tone.getContext());
		return new Synthesizer(merged, bitCrusherNode);
	}

	play(note = 'C4'): void {
		this.currentNote = note;
		if (isArpeggioEnabled(this.params)) {
			this.retriggerLoop.stop();
			this.arpPattern.start(0);
			Tone.getTransport().start();
			return;
		}
		if (isRetriggerEnabled(this.params)) {
			this.arpPattern.stop();
			this.retriggerLoop.start(0);
			Tone.getTransport().start();
			return;
		}

		if (this.voice instanceof Tone.NoiseSynth) {
			this.voice.triggerAttack();
			return;
		}
		this.voice.triggerAttack(note);
	}

	stop(): void {
		if (this.voice instanceof Tone.NoiseSynth) {
			this.voice.triggerRelease();
		} else {
			this.voice.triggerRelease();
		}
		this.arpPattern.stop();
		this.retriggerLoop.stop();
		Tone.getTransport().stop();
	}

	updateParams(next: Partial<SynthParams>): void {
		const merged = { ...this.params, ...next };
		merged.frequency = clampFrequency(merged.frequency);
		if (isArpeggioEnabled(merged)) {
			merged.retriggerRate = 0;
			merged.retriggerCount = 0;
		}
		if (isRetriggerEnabled(merged)) {
			merged.arpSpeed = 0;
		}

		const waveformChanged = merged.waveform !== this.params.waveform;
		this.params = merged;

		if (waveformChanged) {
			this.voice.disconnect();
			this.voice.dispose();
			this.voice = this.createVoice(merged.waveform);
			this.rewireVoice();
		}

		this.applyParams(merged);
	}

	getWaveformData(): Float32Array {
		return this.waveform.getValue();
	}

	dispose(): void {
		this.stop();
		this.voice.disconnect();
		this.voice.dispose();
		this.bitCrusherNode.dispose();
		this.vibrato.dispose();
		this.chorus.dispose();
		this.lpf.dispose();
		this.hpf.dispose();
		this.waveform.dispose();
		this.arpPattern.dispose();
		this.retriggerLoop.dispose();
	}

	private createVoice(waveform: Waveform): Voice {
		if (waveform === 'noise') {
			return new Tone.NoiseSynth();
		}
		return new Tone.Synth();
	}

	private rewireVoice(): void {
		this.voice.connect(this.bitCrusherNode);
		this.bitCrusherNode.connect(this.vibrato);
		this.vibrato.connect(this.chorus);
		this.chorus.connect(this.lpf);
		this.lpf.connect(this.hpf);
		this.hpf.connect(this.waveform);
		this.hpf.connect(Tone.getDestination());
	}

	private applyParams(params: SynthParams): void {
		if (this.voice instanceof Tone.Synth) {
			const oscillatorType =
				params.waveform === 'noise'
					? 'sine'
					: params.waveform === 'square'
						? 'square'
						: params.waveform;
			this.voice.oscillator.type = oscillatorType;
			if (params.waveform === 'square') {
				this.voice.oscillator.type = 'pulse';
				if (this.voice.oscillator.width) {
					this.voice.oscillator.width.value = clamp(params.dutyCycle, 0, 1);
				}
			}
			this.voice.frequency.value = params.frequency;
			this.voice.detune.value = clamp(params.detune, -100, 100);
			this.voice.envelope.attack = clamp(params.attack, 0.001, 2);
			this.voice.envelope.decay = clamp(params.decay, 0.001, 2);
			this.voice.envelope.sustain = clamp(params.sustain, 0, 1);
			this.voice.envelope.release = clamp(params.release, 0.001, 5);
		}

		this.bitCrusherNode.bitDepth.value = clamp(params.bitDepth, 1, 16);
		this.bitCrusherNode.sampleRateReduction.value = clamp(params.sampleRateReduction, 1, 32);
		this.vibrato.frequency.value = clamp(params.vibratoRate, 0, 20);
		this.vibrato.depth.value = clamp(params.vibratoDepth, 0, 1);
		this.chorus.frequency.value = clamp(params.flangerRate, 0, 20);
		this.chorus.depth = clamp(params.flangerDepth, 0, 1);
		this.chorus.feedback.value = clamp(params.flangerFeedback, 0, 0.95);
		this.chorus.wet.value = clamp(params.flangerWet, 0, 1);
		this.lpf.frequency.value = clamp(params.lpfCutoff, 20, 20000);
		this.lpf.Q.value = clamp(params.lpfResonance, 0.1, 20);
		this.hpf.frequency.value = clamp(params.hpfCutoff, 20, 20000);
		this.hpf.Q.value = clamp(params.hpfResonance, 0.1, 20);

		this.arpPattern.values = orderArpSteps(params.arpSteps, params.arpPattern);
		this.arpPattern.interval = params.arpSpeed > 0 ? 1 / params.arpSpeed : 1;
		this.retriggerLoop.interval = params.retriggerRate > 0 ? 1 / params.retriggerRate : 1;

		if (isArpeggioEnabled(params)) {
			this.retriggerLoop.stop();
		}
		if (isRetriggerEnabled(params)) {
			this.arpPattern.stop();
		}
	}
}

export async function createSynthesizer(
	params: Partial<SynthParams> = {}
): Promise<SynthesizerAPI> {
	return Synthesizer.create(params);
}
