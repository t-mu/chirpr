import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => {
	const synthInstances: Array<{
		dispose: ReturnType<typeof vi.fn>;
		widthSetCalls: number;
		frequency: { value: number };
		triggerAttack: ReturnType<typeof vi.fn>;
		triggerAttackRelease: ReturnType<typeof vi.fn>;
	}> = [];
	const noiseSynthInstances: Array<{ dispose: ReturnType<typeof vi.fn> }> = [];
	const patternInstances: Array<{ stop: ReturnType<typeof vi.fn> }> = [];
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
		synthInstances,
		noiseSynthInstances,
		patternInstances,
		transport,
		bitCrusher
	};
});

vi.mock('tone', () => {
	class TrackingSynth {
		public oscillator: { type: string; width: { value: number } };
		public frequency = { value: 440 };
		public detune = { value: 0 };
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
	}

	class MockVibrato {
		public frequency = { value: 0 };
		public depth = { value: 0 };
		public connect = vi.fn();
		public dispose = vi.fn();
	}

	class MockChorus {
		public frequency = { value: 0 };
		public depth = 0;
		public feedback = { value: 0 };
		public wet = { value: 0 };
		public connect = vi.fn();
		public dispose = vi.fn();
	}

	class MockFilter {
		public frequency = { value: 0 };
		public Q = { value: 0 };
		public connect = vi.fn();
		public dispose = vi.fn();
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
		state.patternInstances.length = 0;
		state.transport.start.mockClear();
		state.transport.stop.mockClear();
		state.transport.cancel.mockClear();
		state.transport.scheduleOnce.mockClear();
		state.bitCrusher.connect.mockClear();
		state.bitCrusher.dispose.mockClear();
	});

	it('switches to NoiseSynth and disposes existing Synth', async () => {
		const synth = await createSynthesizer();
		const firstSynth = state.synthInstances[0];

		synth.updateParams({ waveform: 'noise' });

		expect(firstSynth.dispose).toHaveBeenCalledOnce();
		expect(state.noiseSynthInstances.length).toBe(1);
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
});
