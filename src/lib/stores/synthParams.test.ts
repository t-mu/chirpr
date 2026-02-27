import { describe, expect, it } from 'vitest';
import { DEFAULT_PARAMS } from '$lib/types/SynthParams';
import { params, resetParams, updateParam } from './synthParams.svelte';

describe('synthParams store', () => {
	it('clamps frequency to lower bound', () => {
		updateParam('frequency', -1);
		expect(params.frequency).toBe(20);
	});

	it('clamps frequency to upper bound', () => {
		updateParam('frequency', 99999);
		expect(params.frequency).toBe(2000);
	});

	it('resetParams restores defaults', () => {
		updateParam('frequency', 1000);
		updateParam('detune', 50);
		updateParam('bitDepth', 4);

		resetParams();

		expect(params).toEqual(DEFAULT_PARAMS);
	});
});
