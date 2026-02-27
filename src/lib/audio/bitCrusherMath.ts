export interface QuantizeResult {
	outputSample: number;
	nextPhase: number;
	nextHeldSample: number;
	resampled: boolean;
}

function quantizeAmplitude(sample: number, bitDepth: number): number {
	const safeBitDepth = Math.max(1, Math.min(16, bitDepth));
	const steps = 2 ** (safeBitDepth - 1);
	return Math.round(sample * steps) / steps;
}

export function quantize(
	sample: number,
	bitDepth: number,
	phase: number,
	sampleRateReduction: number,
	heldSample = 0
): QuantizeResult {
	const safeReduction = Math.max(1, sampleRateReduction);
	const nextPhase = phase + 1;

	if (nextPhase >= safeReduction) {
		const outputSample = quantizeAmplitude(sample, bitDepth);
		return {
			outputSample,
			nextPhase: 0,
			nextHeldSample: outputSample,
			resampled: true
		};
	}

	return {
		outputSample: heldSample,
		nextPhase,
		nextHeldSample: heldSample,
		resampled: false
	};
}
