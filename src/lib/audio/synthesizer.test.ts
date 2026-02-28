import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => {
	const createSignal = (value = 0) => ({
		value,
		cancelScheduledValues: vi.fn(),
		setValueCurveAtTime: vi.fn(),
		setValueAtTime: vi.fn(),
		linearRampToValueAtTime: vi.fn()
	});
	const synthInstances: Array<{
		dispose: ReturnType<typeof vi.fn>;
		widthSetCalls: number;
		frequency: ReturnType<typeof createSignal>;
		triggerAttack: ReturnType<typeof vi.fn>;
		triggerAttackRelease: ReturnType<typeof vi.fn>;
		triggerRelease: ReturnType<typeof vi.fn>;
	}> = [];
	const noiseSynthInstances: Array<{ dispose: ReturnType<typeof vi.fn> }> = [];
	const vibratoInstances: Array<{
		frequency: ReturnType<typeof createSignal>;
		depth: ReturnType<typeof createSignal>;
	}> = [];
	const filterInstances: Array<{
		frequency: ReturnType<typeof createSignal>;
		type: 'lowpass' | 'highpass';
	}> = [];
	const patternInstances: Array<{ stop: ReturnType<typeof vi.fn> }> = [];
	const loopInstances: Array<{ tick: (time?: number) => void }> = [];
	const chorusInstances: Array<{ start: ReturnType<typeof vi.fn> }> = [];
	const transport = {
		start: vi.fn(),
		stop: vi.fn(),
		cancel: vi.fn(),
		scheduleOnce: vi.fn()
	};
	const bitCrusher = {
		bitDepth: { value: 16 },
		sampleRateReduction: { value: 1 },
		connect: vi.fn(),
		dispose: vi.fn()
	};

	return {
		createSignal,
		synthInstances,
		noiseSynthInstances,
		vibratoInstances,
		filterInstances,
		patternInstances,
		loopInstances,
		chorusInstances,
		transport,
		bitCrusher
	};
});

vi.mock('tone', () => {
	class TrackingSynth {
		public oscillator: { type: string; width: { value: number } };
		public frequency = state.createSignal(440);
		public detune = state.createSignal(0);
		public envelope = { attack: 0, decay: 0, sustain: 0, release: 0 };
		public triggerAttack = vi.fn();
		public triggerAttackRelease = vi.fn();
		public triggerRelease = vi.fn();
		public connect = vi.fn();
		public disconnect = vi.fn();
		public dispose = vi.fn();
		public widthSetCalls = 0;

		constructor() {
			const width = {
				_value: 0.5,
				get value() {
					return this._value;
				},
				set value(next: number) {
					this._value = next;
				}
			};
			Object.defineProperty(width, 'value', {
				get() {
					return this._value;
				},
				set: (next: number) => {
					this.widthSetCalls += 1;
					width._value = next;
				}
			});
			this.oscillator = { type: 'square', width };
			state.synthInstances.push(this);
		}
	}

	class TrackingNoiseSynth {
		public envelope = { attack: 0.001, decay: 0.1, sustain: 0.5, release: 0.2 };
		public triggerAttack = vi.fn();
		public triggerAttackRelease = vi.fn();
		public triggerRelease = vi.fn();
		public connect = vi.fn();
		public disconnect = vi.fn();
		public dispose = vi.fn();

		constructor() {
			state.noiseSynthInstances.push(this);
		}
	}

	class TrackingPattern {
		public values: number[];
		public interval = 0;
		public start = vi.fn();
		public stop = vi.fn();
		public dispose = vi.fn();

		constructor(_cb: unknown, values: number[]) {
			this.values = values;
			state.patternInstances.push(this);
		}
	}

	class MockLoop {
		public interval = 0;
		public start = vi.fn();
		public stop = vi.fn();
		public dispose = vi.fn();

		constructor(callback: (time?: number) => void) {
			state.loopInstances.push({ tick: callback });
		}
	}

	class MockVibrato {
		public frequency = state.createSignal(0);
		public depth = state.createSignal(0);
		public connect = vi.fn();
		public dispose = vi.fn();

		constructor() {
			state.vibratoInstances.push(this);
		}
	}

	class MockChorus {
		public frequency = { value: 0 };
		public depth = 0;
		public feedback = { value: 0 };
		public wet = { value: 0 };
		public start = vi.fn();
		public connect = vi.fn();
		public dispose = vi.fn();

		constructor() {
			state.chorusInstances.push(this);
		}
	}

	class MockFilter {
		public type: 'lowpass' | 'highpass' = 'lowpass';
		public frequency = state.createSignal(0);
		public Q = { value: 0 };
		public connect = vi.fn();
		public dispose = vi.fn();

		constructor(options: { type: 'lowpass' | 'highpass' }) {
			this.type = options.type;
			state.filterInstances.push({ frequency: this.frequency, type: this.type });
		}
	}

	class MockWaveform {
		public connect = vi.fn();
		public dispose = vi.fn();
		public getValue = vi.fn(() => new Float32Array(8));
	}

	return {
		Synth: TrackingSynth,
		NoiseSynth: TrackingNoiseSynth,
		Pattern: TrackingPattern,
		Loop: MockLoop,
		Vibrato: MockVibrato,
		Chorus: MockChorus,
		Filter: MockFilter,
		Waveform: MockWaveform,
		Frequency: (note: string | number) => ({
			toFrequency: () => (typeof note === 'number' ? note : 261.63),
			transpose: (step: number) => ({
				toNote: () => `${note}-${step}`,
				toFrequency: () => (typeof note === 'number' ? note : 261.63) * Math.pow(2, step / 12)
			})
		}),
		getContext: () => ({ rawContext: {} }),
		getDestination: () => ({}),
		now: () => 0,
		getTransport: () => state.transport
	};
});

vi.mock('./BitCrusherNode', () => ({
	BitCrusherNode: {
		create: vi.fn(async () => state.bitCrusher)
	}
}));

import { createSynthesizer, orderArpSteps } from './synthesizer';

describe('synthesizer', () => {
	beforeEach(() => {
		state.synthInstances.length = 0;
		state.noiseSynthInstances.length = 0;
		state.vibratoInstances.length = 0;
		state.filterInstances.length = 0;
		state.patternInstances.length = 0;
		state.loopInstances.length = 0;
		state.chorusInstances.length = 0;
		state.transport.start.mockClear();
		state.transport.stop.mockClear();
		state.transport.cancel.mockClear();
		state.transport.scheduleOnce.mockClear();
		state.bitCrusher.connect.mockClear();
		state.bitCrusher.dispose.mockClear();
		state.synthInstances.forEach((instance) => {
			instance.frequency.cancelScheduledValues.mockClear();
			instance.frequency.setValueCurveAtTime.mockClear();
		});
	});

	it('switches to NoiseSynth and disposes existing Synth', async () => {
		const synth = await createSynthesizer();
		const firstSynth = state.synthInstances[0];

		synth.updateParams({ waveform: 'noise' });

		expect(firstSynth.dispose).toHaveBeenCalledOnce();
		expect(state.noiseSynthInstances.length).toBe(1);
	});

	it('starts chorus LFO once during synthesizer setup', async () => {
		await createSynthesizer();
		expect(state.chorusInstances[0].start).toHaveBeenCalledTimes(1);
	});

	it('switches back to Synth and disposes existing NoiseSynth', async () => {
		const synth = await createSynthesizer();
		synth.updateParams({ waveform: 'noise' });
		const firstNoise = state.noiseSynthInstances[0];

		synth.updateParams({ waveform: 'sine' });

		expect(firstNoise.dispose).toHaveBeenCalledOnce();
		expect(state.synthInstances.length).toBe(2);
	});

	it('does not write oscillator.width when waveform is not square', async () => {
		const synth = await createSynthesizer();
		const firstSynth = state.synthInstances[0];

		expect(() => synth.updateParams({ waveform: 'sine', dutyCycle: 0.3 })).not.toThrow();
		expect(firstSynth.widthSetCalls).toBe(1);
	});

	it('orders arpeggio steps ascending for up', () => {
		expect(orderArpSteps([7, 0, 4], 'up')).toEqual([0, 4, 7]);
	});

	it('orders arpeggio steps descending for down', () => {
		expect(orderArpSteps([0, 7, 4], 'down')).toEqual([7, 4, 0]);
	});

	it('stop before play does not throw and stops transport/pattern', async () => {
		const synth = await createSynthesizer();
		const pattern = state.patternInstances[0];

		expect(() => synth.stop()).not.toThrow();
		expect(state.transport.cancel).toHaveBeenCalledOnce();
		expect(state.transport.stop).toHaveBeenCalledOnce();
		expect(pattern.stop).toHaveBeenCalled();
	});

	it('play uses triggerAttackRelease for synth voices', async () => {
		const synth = await createSynthesizer();
		const firstSynth = state.synthInstances[0];

		synth.play('C4');

		expect(firstSynth.triggerAttackRelease).toHaveBeenCalledWith(261.63, 0.3);
		expect(firstSynth.triggerAttack).not.toHaveBeenCalled();
	});

	it('play without note uses current frequency param', async () => {
		const synth = await createSynthesizer({ frequency: 1234 });
		const firstSynth = state.synthInstances[0];

		synth.play();

		expect(firstSynth.triggerAttackRelease).toHaveBeenCalledWith(1234, 0.3);
	});

	it('starts and stops held preview on synth voices', async () => {
		const synth = await createSynthesizer({ frequency: 777 });
		const firstSynth = state.synthInstances[0];

		synth.startPreview();
		expect(firstSynth.triggerAttack).toHaveBeenCalledWith(777);

		synth.stopPreview();
		expect(firstSynth.triggerRelease).toHaveBeenCalled();
	});

	it('stop cancels transport before stop', async () => {
		const synth = await createSynthesizer();

		synth.stop();

		expect(state.transport.cancel).toHaveBeenCalledOnce();
		expect(state.transport.stop).toHaveBeenCalledOnce();
		expect(state.transport.cancel.mock.invocationCallOrder[0]).toBeLessThan(
			state.transport.stop.mock.invocationCallOrder[0]
		);
	});

	it('clamps out-of-range frequency before applying to Tone', async () => {
		const synth = await createSynthesizer();
		const firstSynth = state.synthInstances[0];

		synth.updateParams({ frequency: -1 });
		expect(firstSynth.frequency.value).toBe(20);

		synth.updateParams({ frequency: 99_999 });
		expect(firstSynth.frequency.value).toBe(2000);
	});

	it('schedules frequency curve on play when present', async () => {
		const synth = await createSynthesizer({
			frequency: 440,
			duration: 500,
			curves: {
				frequency: {
					p0: { x: 0, y: 440 },
					p1: { x: 0.3, y: 300 },
					p2: { x: 0.7, y: 200 },
					p3: { x: 1, y: 120 }
				}
			}
		});
		const firstSynth = state.synthInstances[0];

		synth.play();

		expect(firstSynth.frequency.cancelScheduledValues).toHaveBeenCalled();
		expect(firstSynth.frequency.setValueCurveAtTime).toHaveBeenCalledWith(
			expect.any(Array),
			expect.any(Number),
			0.5
		);
		const firstCancel = firstSynth.frequency.cancelScheduledValues.mock.invocationCallOrder[0];
		const firstCurve = firstSynth.frequency.setValueCurveAtTime.mock.invocationCallOrder[0];
		expect(firstCancel).toBeLessThan(firstCurve);
		const samples = firstSynth.frequency.setValueCurveAtTime.mock.calls[0][0] as number[];
		expect(samples).toHaveLength(128);
	});

	it('does not schedule any curves when curves object is empty', async () => {
		const synth = await createSynthesizer({ curves: {} });
		const firstSynth = state.synthInstances[0];

		synth.play();

		expect(firstSynth.frequency.setValueCurveAtTime).not.toHaveBeenCalled();
	});

	it('does not schedule frequency curve for noise voices', async () => {
		const synth = await createSynthesizer({
			waveform: 'noise',
			curves: {
				frequency: {
					p0: { x: 0, y: 800 },
					p1: { x: 0.3, y: 600 },
					p2: { x: 0.7, y: 400 },
					p3: { x: 1, y: 200 }
				}
			}
		});

		synth.play();

		expect(state.synthInstances).toHaveLength(0);
		expect(state.noiseSynthInstances).toHaveLength(1);
	});

	it('skips curve scheduling in arp mode', async () => {
		const synth = await createSynthesizer({
			arpSpeed: 8,
			curves: {
				frequency: {
					p0: { x: 0, y: 1000 },
					p1: { x: 0.4, y: 700 },
					p2: { x: 0.8, y: 500 },
					p3: { x: 1, y: 300 }
				}
			}
		});
		const firstSynth = state.synthInstances[0];

		synth.play();

		expect(firstSynth.frequency.setValueCurveAtTime).not.toHaveBeenCalled();
	});

	it('stop cancels scheduled automation on all curveable signals', async () => {
		const synth = await createSynthesizer();
		const firstSynth = state.synthInstances[0];
		const vibrato = state.vibratoInstances[0];
		const lpf = state.filterInstances.find((f) => f.type === 'lowpass');
		const hpf = state.filterInstances.find((f) => f.type === 'highpass');

		synth.stop();

		expect(firstSynth.frequency.cancelScheduledValues).toHaveBeenCalled();
		expect(vibrato.depth.cancelScheduledValues).toHaveBeenCalled();
		expect(vibrato.frequency.cancelScheduledValues).toHaveBeenCalled();
		expect(lpf?.frequency.cancelScheduledValues).toHaveBeenCalled();
		expect(hpf?.frequency.cancelScheduledValues).toHaveBeenCalled();
	});

	it('restores static values when curve is removed', async () => {
		const synth = await createSynthesizer({
			frequency: 900,
			lpfCutoff: 3200,
			curves: {
				frequency: {
					p0: { x: 0, y: 900 },
					p1: { x: 0.3, y: 700 },
					p2: { x: 0.7, y: 300 },
					p3: { x: 1, y: 200 }
				}
			}
		});
		const firstSynth = state.synthInstances[0];

		synth.updateParams({ curves: {} });

		expect(firstSynth.frequency.cancelScheduledValues).toHaveBeenCalled();
		expect(firstSynth.frequency.value).toBe(900);
	});

	it('applies updated frequency to retrigger loop without replaying', async () => {
		const synth = await createSynthesizer({
			frequency: 440,
			retriggerRate: 8,
			retriggerCount: 2
		});
		const firstSynth = state.synthInstances[0];
		const retriggerLoop = state.loopInstances[0];

		synth.play();
		retriggerLoop.tick(0);
		expect(firstSynth.triggerAttackRelease).toHaveBeenLastCalledWith(440, '16n', 0);

		synth.updateParams({ frequency: 880 });
		retriggerLoop.tick(1);
		expect(firstSynth.triggerAttackRelease).toHaveBeenLastCalledWith(880, '16n', 1);
	});

	it('play clears active held preview before triggering one-shot note', async () => {
		const synth = await createSynthesizer({ frequency: 660 });
		const firstSynth = state.synthInstances[0];

		synth.startPreview();
		expect(firstSynth.triggerAttack).toHaveBeenCalledWith(660);
		const releaseCallsBeforePlay = firstSynth.triggerRelease.mock.calls.length;

		synth.play();
		expect(firstSynth.triggerRelease).toHaveBeenCalledTimes(releaseCallsBeforePlay + 1);
		expect(firstSynth.triggerAttackRelease).toHaveBeenCalledWith(660, 0.3);
	});

	it('keeps play behavior valid after waveform change during preview', async () => {
		const synth = await createSynthesizer({ frequency: 440 });
		const firstSynth = state.synthInstances[0];

		synth.startPreview();
		expect(firstSynth.triggerAttack).toHaveBeenCalledWith(440);

		expect(() => synth.updateParams({ waveform: 'noise' })).not.toThrow();
		expect(() => synth.play()).not.toThrow();
		expect(state.noiseSynthInstances).toHaveLength(1);
		expect(state.noiseSynthInstances[0].dispose).not.toHaveBeenCalled();
	});
});
