import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	downloadBlob,
	exportMP3,
	exportOGG,
	exportWAV,
	renderToBuffer,
	toWavArrayBuffer
} from './exporter';
import { DEFAULT_PARAMS } from '$lib/types/SynthParams';

vi.mock('lamejs', () => {
	const encodeBuffer = vi.fn(() => new Int8Array([1, 2, 3]));
	const flush = vi.fn(() => new Int8Array([4, 5]));
	const Mp3Encoder = vi.fn(function MockMp3Encoder() {
		return { encodeBuffer, flush };
	});
	return { Mp3Encoder, __mocks: { encodeBuffer, flush } };
});

vi.mock('wasm-media-encoders', () => {
	const configure = vi.fn();
	const encode = vi.fn(() => new Uint8Array([9, 8, 7]));
	const finalize = vi.fn(() => new Uint8Array([6, 5]));
	return {
		createOggEncoder: vi.fn(async () => ({
			configure,
			encode,
			finalize
		})),
		__mocks: { configure, encode, finalize }
	};
});

class MockOfflineAudioContext {
	public readonly sampleRate: number;
	public readonly length: number;
	public readonly destination = {} as AudioDestinationNode;
	public readonly audioWorklet = {
		addModule: vi.fn(async () => {})
	};

	constructor(_channels: number, length: number, sampleRate: number) {
		this.length = length;
		this.sampleRate = sampleRate;
	}

	createGain() {
		return {
			gain: {
				setValueAtTime: vi.fn(),
				linearRampToValueAtTime: vi.fn()
			},
			connect: vi.fn()
		};
	}

	createBiquadFilter() {
		return {
			type: 'lowpass',
			frequency: { value: 0 },
			Q: { value: 0 },
			connect: vi.fn()
		};
	}

	createBufferSource() {
		return {
			buffer: null,
			loop: false,
			connect: vi.fn(),
			start: vi.fn(),
			stop: vi.fn()
		};
	}

	createOscillator() {
		return {
			type: 'sine',
			frequency: { setValueAtTime: vi.fn() },
			detune: { setValueAtTime: vi.fn() },
			connect: vi.fn(),
			start: vi.fn(),
			stop: vi.fn()
		};
	}

	createBuffer(_channels: number, length: number, sampleRate: number) {
		return {
			sampleRate,
			length,
			getChannelData: () => new Float32Array(length)
		} as unknown as AudioBuffer;
	}

	startRendering() {
		return Promise.resolve(this.createBuffer(1, this.length, this.sampleRate));
	}
}

class MockAudioWorkletNode {
	public readonly parameters = new Map<string, AudioParam>();
	public readonly connect = vi.fn();

	constructor() {
		this.parameters.set('bitDepth', { setValueAtTime: vi.fn() } as unknown as AudioParam);
		this.parameters.set('sampleRateReduction', {
			setValueAtTime: vi.fn()
		} as unknown as AudioParam);
	}
}

beforeEach(() => {
	vi.stubGlobal('OfflineAudioContext', MockOfflineAudioContext);
	vi.stubGlobal('AudioWorkletNode', MockAudioWorkletNode as unknown as typeof AudioWorkletNode);
});

describe('exporter', () => {
	it('wav array buffer starts with RIFF and has sample rate in header', () => {
		const buffer = new MockOfflineAudioContext(1, 44100, 44100).createBuffer(1, 44100, 44100);
		const wavArrayBuffer = toWavArrayBuffer(buffer);
		const view = new DataView(wavArrayBuffer);

		expect(view.getUint32(0, false)).toBe(0x52494646);
		expect(view.getUint32(24, true)).toBe(44100);
	});

	it('renderToBuffer returns expected frame count for duration', async () => {
		const rendered = await renderToBuffer(DEFAULT_PARAMS, 1);
		expect(rendered.length).toBe(44100);
	});

	it('downloadBlob creates anchor and triggers click', () => {
		const click = vi.fn();
		const createElement = vi.spyOn(document, 'createElement').mockReturnValue({
			href: '',
			download: '',
			click
		} as unknown as HTMLAnchorElement);
		const objectUrlSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
		const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

		downloadBlob(new Blob(['x']), 'x.wav');

		expect(createElement).toHaveBeenCalledWith('a');
		expect(objectUrlSpy).toHaveBeenCalled();
		expect(click).toHaveBeenCalled();
		expect(revokeSpy).toHaveBeenCalledWith('blob:test');
	});

	it('exportMP3 passes Int16 data into encoder', async () => {
		const sampleBuffer = new MockOfflineAudioContext(1, 8, 44100).createBuffer(1, 8, 44100);
		const float = sampleBuffer.getChannelData(0);
		float.set([0, 0.5, -0.5, 1, -1, 0.25, -0.25, 0]);
		const lame = await import('lamejs');

		await exportMP3(sampleBuffer);
		const firstArg = (lame as unknown as { __mocks: { encodeBuffer: ReturnType<typeof vi.fn> } })
			.__mocks.encodeBuffer.mock.calls[0][0];
		expect(firstArg).toBeInstanceOf(Int16Array);
	});

	it('exportWAV returns a wav blob', () => {
		const buffer = new MockOfflineAudioContext(1, 10, 44100).createBuffer(1, 10, 44100);
		const wav = exportWAV(buffer);
		expect(wav.type).toBe('audio/wav');
	});

	it('exportOGG configures and finalizes encoder output', async () => {
		const buffer = new MockOfflineAudioContext(1, 10, 44100).createBuffer(1, 10, 44100);
		const oggModule = (await import('wasm-media-encoders')) as unknown as {
			__mocks: {
				configure: ReturnType<typeof vi.fn>;
				encode: ReturnType<typeof vi.fn>;
				finalize: ReturnType<typeof vi.fn>;
			};
		};

		const ogg = await exportOGG(buffer);

		expect(oggModule.__mocks.configure).toHaveBeenCalledWith({
			channels: 1,
			sampleRate: 44100,
			vbrQuality: 3
		});
		expect(oggModule.__mocks.encode).toHaveBeenCalled();
		expect(oggModule.__mocks.finalize).toHaveBeenCalled();
		expect(ogg.type).toBe('audio/ogg');
	});
});
