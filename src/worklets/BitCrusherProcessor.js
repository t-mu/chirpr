/**
 * @param {number} sample
 * @param {number} bitDepth
 */
function quantizeSample(sample, bitDepth) {
	const safeBitDepth = Math.max(1, Math.min(16, bitDepth));
	const steps = 2 ** (safeBitDepth - 1);
	return Math.round(sample * steps) / steps;
}

class BitCrusherProcessor extends AudioWorkletProcessor {
	static get parameterDescriptors() {
		return [
			{ name: 'bitDepth', defaultValue: 16, minValue: 1, maxValue: 16 },
			{ name: 'sampleRateReduction', defaultValue: 1, minValue: 1, maxValue: 32 }
		];
	}

	constructor() {
		super();
		this._phase = 0;
		this._lastSample = 0;
	}

	/**
	 * @param {Float32Array[][]} inputs
	 * @param {Float32Array[][]} outputs
	 * @param {Record<string, Float32Array>} parameters
	 */
	process(inputs, outputs, parameters) {
		const input = inputs[0];
		const output = outputs[0];

		if (!input || input.length === 0 || !output || output.length === 0) {
			return true;
		}

		for (let channel = 0; channel < output.length; channel += 1) {
			const inputChannel = input[channel] ?? input[0];
			const outputChannel = output[channel];

			for (let i = 0; i < outputChannel.length; i += 1) {
				const bitDepth =
					parameters.bitDepth.length > 1 ? parameters.bitDepth[i] : parameters.bitDepth[0];
				const sampleRateReduction =
					parameters.sampleRateReduction.length > 1
						? parameters.sampleRateReduction[i]
						: parameters.sampleRateReduction[0];

				this._phase += 1;
				if (this._phase >= sampleRateReduction) {
					this._phase = 0;
					this._lastSample = quantizeSample(inputChannel[i], bitDepth);
				}

				outputChannel[i] = this._lastSample;
			}
		}

		return true;
	}
}

registerProcessor('bit-crusher', BitCrusherProcessor);
