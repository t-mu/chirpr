import { vi } from 'vitest';

class MockBaseNode {
	public connect = vi.fn();
	public disconnect = vi.fn();
	public dispose = vi.fn();
}

export class Synth extends MockBaseNode {
	public oscillator = {
		type: 'sine',
		width: { value: 0.5 }
	};
	public frequency = { value: 440 };
	public detune = { value: 0 };
	public envelope = { attack: 0.01, decay: 0.1, sustain: 0.5, release: 0.3 };
	public triggerAttack = vi.fn();
	public triggerAttackRelease = vi.fn();
	public triggerRelease = vi.fn();
}

export class NoiseSynth extends MockBaseNode {
	public envelope = { attack: 0.01, decay: 0.1, sustain: 0.5, release: 0.3 };
	public triggerAttack = vi.fn();
	public triggerAttackRelease = vi.fn();
	public triggerRelease = vi.fn();
}

export class Vibrato extends MockBaseNode {
	public frequency = { value: 0 };
	public depth = { value: 0 };
}

export class Chorus extends MockBaseNode {
	public frequency = { value: 0 };
	public depth = 0;
	public feedback = { value: 0 };
	public wet = { value: 0 };
}

export class Filter extends MockBaseNode {
	public frequency = { value: 0 };
	public Q = { value: 0 };
}

export class Waveform extends MockBaseNode {
	public getValue = vi.fn(() => new Float32Array(1024));
}

export class Pattern {
	public interval: string | number = 0;
	public start = vi.fn();
	public stop = vi.fn();
	public dispose = vi.fn();

	constructor(
		_callback: (time: number, note: string) => void,
		public readonly values: number[]
	) {}
}

export class Loop {
	public interval: string | number = 0;
	public start = vi.fn();
	public stop = vi.fn();
	public dispose = vi.fn();

	constructor(_callback: (time: number) => void, interval = '4n') {
		this.interval = interval;
	}
}

const transport = {
	start: vi.fn(),
	stop: vi.fn()
};

export function getContext() {
	return { rawContext: {} };
}

export function getDestination() {
	return {};
}

export function getTransport() {
	return transport;
}

export function Frequency(note: string) {
	return {
		transpose: (step: number) => ({
			toNote: () => `${note}-${step}`
		})
	};
}

export async function start(): Promise<void> {}
