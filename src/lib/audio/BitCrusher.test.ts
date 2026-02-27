import { describe, expect, it } from 'vitest';
import { quantize } from './bitCrusherMath';

describe('quantize', () => {
	it('uses signed 16-bit step count for quantization', () => {
		const result = quantize(0.7, 16, 0, 1);
		const expected = Math.round(0.7 * 32768) / 32768;

		expect(result.outputSample).toBe(expected);
	});

	it('uses 8-bit step count for quantization', () => {
		const result = quantize(0.5, 8, 0, 1);
		expect(result.outputSample).toBe(0.5);
	});

	it('holds the same output for reduction frames and resamples on the fourth frame', () => {
		let phase = 0;
		let heldSample = 0;
		const outputs: number[] = [];

		for (let frame = 0; frame < 4; frame += 1) {
			const result = quantize(0.8, 16, phase, 4, heldSample);
			outputs.push(result.outputSample);
			phase = result.nextPhase;
			heldSample = result.nextHeldSample;
		}

		expect(outputs[0]).toBe(0);
		expect(outputs[1]).toBe(0);
		expect(outputs[2]).toBe(0);
		expect(outputs[3]).toBe(Math.round(0.8 * 32768) / 32768);
	});

	it('resamples every frame when sampleRateReduction is 1', () => {
		const first = quantize(0.3, 16, 0, 1);
		const second = quantize(0.6, 16, first.nextPhase, 1, first.nextHeldSample);

		expect(first.resampled).toBe(true);
		expect(second.resampled).toBe(true);
		expect(first.outputSample).not.toBe(second.outputSample);
	});

	it('handles 1-bit quantization using mid-tread rounding behavior', () => {
		const low = quantize(0.3, 1, 0, 1);
		const high = quantize(0.7, 1, 0, 1);

		expect(low.outputSample).toBe(0);
		expect(high.outputSample).toBe(1);
	});
});
