import * as Tone from 'tone';
import { BitCrusherNode } from './BitCrusherNode';
import { sampleCurve } from './bezier';
import {
	type ArpPattern,
	type SynthParams,
	DEFAULT_PARAMS,
	type Waveform
} from '$lib/types/SynthParams';
import { clampParam } from '$lib/types/paramMeta';

export interface SynthesizerAPI {
	play(note?: string | number): void;
	startPreview(note?: string | number): void;
	stopPreview(): void;
	stop(): void;
	updateParams(params: Partial<SynthParams>): void;
	getWaveformData(): Float32Array;
	dispose(): void;
}

const clampFrequency = (value: number): number => clampParam('frequency', value);

const isArpeggioEnabled = (params: SynthParams): boolean => params.arpSpeed > 0;

const isRetriggerEnabled = (params: SynthParams): boolean => params.retriggerRate > 0;

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
	private currentFrequency: number;
	private isPreviewing = false;

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
				const frequency = Tone.Frequency(this.currentFrequency, 'hz').transpose(step).toFrequency();
				this.voice.triggerAttackRelease(frequency, '16n', time);
			},
			orderArpSteps(this.params.arpSteps, this.params.arpPattern)
		);
		this.retriggerLoop = new Tone.Loop((time) => {
			if (this.voice instanceof Tone.NoiseSynth) {
				this.voice.triggerAttackRelease('16n', time);
				return;
			}
			this.voice.triggerAttackRelease(this.currentFrequency, '16n', time);
		}, '16n');

		this.voice = this.createVoice(this.params.waveform);
		this.currentFrequency = clampFrequency(this.params.frequency);
		this.rewireVoice();
		this.applyParams(this.params);
	}

	static async create(params: Partial<SynthParams> = {}): Promise<SynthesizerAPI> {
		const merged = { ...DEFAULT_PARAMS, ...params };
		const bitCrusherNode = await BitCrusherNode.create(Tone.getContext());
		return new Synthesizer(merged, bitCrusherNode);
	}

	play(note?: string | number): void {
		this.stopPreview();
		if (typeof note === 'number') {
			this.currentFrequency = clampFrequency(note);
		} else if (typeof note === 'string') {
			this.currentFrequency = Tone.Frequency(note).toFrequency();
		} else {
			this.currentFrequency = clampFrequency(this.params.frequency);
		}

		const sec = this.params.duration / 1000;
		if (isArpeggioEnabled(this.params)) {
			this.scheduleTransportOneShot(sec, () => {
				this.arpPattern.stop();
			});
			this.retriggerLoop.stop();
			this.arpPattern.start(0);
			return;
		}
		if (isRetriggerEnabled(this.params)) {
			this.scheduleTransportOneShot(sec, () => {
				this.retriggerLoop.stop();
			});
			this.arpPattern.stop();
			this.retriggerLoop.start(0);
			return;
		}

		if (this.voice instanceof Tone.NoiseSynth) {
			this.voice.triggerAttackRelease(sec);
		} else {
			this.voice.triggerAttackRelease(this.currentFrequency, sec);
		}
		this.applyCurves(sec);
	}

	startPreview(note?: string | number): void {
		this.stop();
		if (typeof note === 'number') {
			this.currentFrequency = clampFrequency(note);
		} else if (typeof note === 'string') {
			this.currentFrequency = Tone.Frequency(note).toFrequency();
		} else {
			this.currentFrequency = clampFrequency(this.params.frequency);
		}

		if (this.voice instanceof Tone.NoiseSynth) {
			this.voice.triggerAttack();
		} else {
			this.voice.triggerAttack(this.currentFrequency);
		}
		this.isPreviewing = true;
	}

	stopPreview(): void {
		if (!this.isPreviewing) return;
		this.voice.triggerRelease();
		this.isPreviewing = false;
	}

	stop(): void {
		this.cancelCurveAutomation();
		Tone.getTransport().cancel();
		this.stopPreview();
		this.voice.triggerRelease();
		this.arpPattern.stop();
		this.retriggerLoop.stop();
		Tone.getTransport().stop();
	}

	private scheduleTransportOneShot(durationSec: number, stopSequence: () => void): void {
		const transport = Tone.getTransport();
		transport.cancel();
		transport.start();
		transport.scheduleOnce(() => {
			stopSequence();
			transport.stop();
		}, `+${durationSec}`);
	}

	updateParams(next: Partial<SynthParams>): void {
		const merged = { ...this.params, ...next };
		merged.frequency = clampFrequency(merged.frequency);
		if (isArpeggioEnabled(merged)) {
			merged.retriggerRate = 0;
		}
		if (isRetriggerEnabled(merged)) {
			merged.arpSpeed = 0;
		}

		const waveformChanged = merged.waveform !== this.params.waveform;
		this.params = merged;
		if (next.frequency !== undefined) {
			this.currentFrequency = merged.frequency;
		}

		if (waveformChanged) {
			this.voice.disconnect();
			this.voice.dispose();
			this.voice = this.createVoice(merged.waveform);
			// Only reconnect voice to the first node — the rest of the chain is already wired.
			// Calling rewireVoice() here would duplicate every downstream connection.
			this.voice.connect(this.bitCrusherNode);
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
		this.chorus.start();
		this.lpf.connect(this.hpf);
		this.hpf.connect(this.waveform);
		this.hpf.connect(Tone.getDestination());
	}

	private applyParams(params: SynthParams): void {
		if (this.voice instanceof Tone.Synth) {
			if (params.waveform === 'square') {
				// 'pulse' is Tone.js's name for a variable-width square wave.
				this.voice.oscillator.type = 'pulse';
				if (this.voice.oscillator.width) {
					this.voice.oscillator.width.value = clampParam('dutyCycle', params.dutyCycle);
				}
			} else {
				// waveform is 'sawtooth' or 'sine' here; 'noise' uses NoiseSynth.
				this.voice.oscillator.type = params.waveform as OscillatorType;
			}
			this.voice.frequency.value = params.frequency;
			this.voice.detune.value = clampParam('detune', params.detune);
			this.voice.envelope.attack = clampParam('attack', params.attack);
			this.voice.envelope.decay = clampParam('decay', params.decay);
			this.voice.envelope.sustain = clampParam('sustain', params.sustain);
			this.voice.envelope.release = clampParam('release', params.release);
		} else if (this.voice instanceof Tone.NoiseSynth) {
			// NoiseSynth has no oscillator, but its envelope must still be kept in sync.
			this.voice.envelope.attack = clampParam('attack', params.attack);
			this.voice.envelope.decay = clampParam('decay', params.decay);
			this.voice.envelope.sustain = clampParam('sustain', params.sustain);
			this.voice.envelope.release = clampParam('release', params.release);
		}

		this.bitCrusherNode.bitDepth.value = clampParam('bitDepth', params.bitDepth);
		this.bitCrusherNode.sampleRateReduction.value = clampParam(
			'sampleRateReduction',
			params.sampleRateReduction
		);
		this.vibrato.frequency.value = clampParam('vibratoRate', params.vibratoRate);
		this.vibrato.depth.value = clampParam('vibratoDepth', params.vibratoDepth);
		this.chorus.frequency.value = clampParam('flangerRate', params.flangerRate);
		this.chorus.depth = clampParam('flangerDepth', params.flangerDepth);
		this.chorus.feedback.value = clampParam('flangerFeedback', params.flangerFeedback);
		this.chorus.wet.value = clampParam('flangerWet', params.flangerWet);
		this.lpf.frequency.value = clampParam('lpfCutoff', params.lpfCutoff);
		this.lpf.Q.value = clampParam('lpfResonance', params.lpfResonance);
		this.hpf.frequency.value = clampParam('hpfCutoff', params.hpfCutoff);
		this.hpf.Q.value = clampParam('hpfResonance', params.hpfResonance);

		this.arpPattern.values = orderArpSteps(params.arpSteps, params.arpPattern);
		this.arpPattern.interval = params.arpSpeed > 0 ? 1 / params.arpSpeed : 1;
		this.retriggerLoop.interval = params.retriggerRate > 0 ? 1 / params.retriggerRate : 1;

		if (isArpeggioEnabled(params)) {
			this.retriggerLoop.stop();
		}
		if (isRetriggerEnabled(params)) {
			this.arpPattern.stop();
		}
		this.restoreStaticParams(params);
	}

	private applyCurves(durationSec: number): void {
		const curves = this.params.curves ?? {};
		const now = Tone.now();
		const sampleCount = 128;
		const toCurveValues = (samples: Float32Array): number[] => Array.from(samples);

		if (curves.frequency && this.voice instanceof Tone.Synth) {
			const samples = toCurveValues(sampleCurve(curves.frequency, sampleCount));
			this.voice.frequency.cancelScheduledValues(now);
			this.voice.frequency.setValueCurveAtTime(samples, now, durationSec);
		}
		if (curves.lpfCutoff) {
			const samples = toCurveValues(sampleCurve(curves.lpfCutoff, sampleCount));
			this.lpf.frequency.cancelScheduledValues(now);
			this.lpf.frequency.setValueCurveAtTime(samples, now, durationSec);
		}
		if (curves.hpfCutoff) {
			const samples = toCurveValues(sampleCurve(curves.hpfCutoff, sampleCount));
			this.hpf.frequency.cancelScheduledValues(now);
			this.hpf.frequency.setValueCurveAtTime(samples, now, durationSec);
		}
	}

	private cancelCurveAutomation(): void {
		const now = Tone.now();
		if (this.voice instanceof Tone.Synth) {
			this.voice.frequency.cancelScheduledValues(now);
		}
		this.lpf.frequency.cancelScheduledValues(now);
		this.hpf.frequency.cancelScheduledValues(now);
	}

	private restoreStaticParams(params: SynthParams): void {
		const curves = params.curves ?? {};
		const now = Tone.now();
		if (!curves.frequency && this.voice instanceof Tone.Synth) {
			this.voice.frequency.cancelScheduledValues(now);
			this.voice.frequency.value = params.frequency;
		}
		if (!curves.lpfCutoff) {
			this.lpf.frequency.cancelScheduledValues(now);
			this.lpf.frequency.value = clampParam('lpfCutoff', params.lpfCutoff);
		}
		if (!curves.hpfCutoff) {
			this.hpf.frequency.cancelScheduledValues(now);
			this.hpf.frequency.value = clampParam('hpfCutoff', params.hpfCutoff);
		}
		this.vibrato.depth.value = clampParam('vibratoDepth', params.vibratoDepth);
		this.vibrato.frequency.value = clampParam('vibratoRate', params.vibratoRate);
	}
}

export async function createSynthesizer(
	params: Partial<SynthParams> = {}
): Promise<SynthesizerAPI> {
	return Synthesizer.create(params);
}
