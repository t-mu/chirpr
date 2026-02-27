import { describe, expect, it, vi } from 'vitest';

const paramInstances = vi.hoisted(() => [] as Array<{ setParam: ReturnType<typeof vi.fn> }>);

vi.mock('tone', () => ({
	ToneAudioNode: class {
		constructor(options: unknown) {
			void options;
		}
		dispose() {
			return this;
		}
	},
	Param: class {
		public readonly setParam = vi.fn();
		public readonly dispose = vi.fn();
		public value: number;

		constructor(options: { value: number }) {
			this.value = options.value;
			paramInstances.push(this);
		}
	}
}));

import { BitCrusherNode } from './BitCrusherNode';

describe('BitCrusherNode.create', () => {
	it('creates worklet node via Tone context API', async () => {
		const bitDepthParam = {} as AudioParam;
		const sampleRateReductionParam = {} as AudioParam;
		const workletNode = {
			parameters: new Map<string, AudioParam>([
				['bitDepth', bitDepthParam],
				['sampleRateReduction', sampleRateReductionParam]
			]),
			disconnect: vi.fn()
		} as unknown as AudioWorkletNode;
		const addModule = vi.fn(async () => {});
		const createAudioWorkletNode = vi.fn(() => workletNode);
		const context = {
			rawContext: {
				audioWorklet: { addModule },
				createGain: () => ({ gain: {} as AudioParam })
			},
			createAudioWorkletNode
		};

		await BitCrusherNode.create(context as never);

		expect(addModule).toHaveBeenCalledOnce();
		expect(createAudioWorkletNode).toHaveBeenCalledWith('bit-crusher');
		expect(paramInstances.at(-2)?.setParam).toHaveBeenCalledWith(bitDepthParam);
		expect(paramInstances.at(-1)?.setParam).toHaveBeenCalledWith(sampleRateReductionParam);
	});
});
