import type { BaseContext } from 'tone';
import { Param, ToneAudioNode } from 'tone';
import workletUrl from '../../worklets/BitCrusherProcessor.js?url';

function getRequiredParam(node: AudioWorkletNode, name: string): AudioParam {
	const param = node.parameters.get(name);
	if (!param) {
		throw new Error(`Missing AudioWorklet parameter: ${name}`);
	}
	return param;
}

export class BitCrusherNode extends ToneAudioNode {
	readonly name = 'BitCrusherNode';
	readonly input: AudioWorkletNode;
	readonly output: AudioWorkletNode;

	readonly bitDepth: Param<'positive'>;
	readonly sampleRateReduction: Param<'positive'>;

	private readonly _node: AudioWorkletNode;

	private constructor(context: BaseContext, node: AudioWorkletNode) {
		super({ context });
		this._node = node;
		const dummyParam = context.rawContext.createGain().gain;
		this.input = node;
		this.output = node;
		this.bitDepth = new Param<'positive'>({
			context,
			value: 16,
			units: 'positive',
			minValue: 1,
			maxValue: 16,
			param: dummyParam,
			swappable: true
		});
		this.sampleRateReduction = new Param<'positive'>({
			context,
			value: 1,
			units: 'positive',
			minValue: 1,
			maxValue: 32,
			param: dummyParam,
			swappable: true
		});

		this.bitDepth.setParam(getRequiredParam(node, 'bitDepth'));
		this.sampleRateReduction.setParam(getRequiredParam(node, 'sampleRateReduction'));
	}

	static async create(context: BaseContext): Promise<BitCrusherNode> {
		const audioWorklet = context.rawContext.audioWorklet;
		if (!audioWorklet) {
			throw new Error('AudioWorklet is not available on this audio context.');
		}

		await audioWorklet.addModule(workletUrl);
		const node = new AudioWorkletNode(context.rawContext, 'bit-crusher');
		return new BitCrusherNode(context, node);
	}

	override dispose(): this {
		super.dispose();
		this._node.disconnect();
		this.bitDepth.dispose();
		this.sampleRateReduction.dispose();
		return this;
	}
}
