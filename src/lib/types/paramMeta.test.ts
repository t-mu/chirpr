import { describe, expect, it } from 'vitest';
import { DEFAULT_PARAMS } from './SynthParams';
import { PARAM_META } from './paramMeta';

describe('PARAM_META', () => {
	it('covers all numeric keys in DEFAULT_PARAMS', () => {
		const numericKeys = Object.entries(DEFAULT_PARAMS)
			.filter(([, value]) => typeof value === 'number')
			.map(([key]) => key);

		for (const key of numericKeys) {
			expect(PARAM_META).toHaveProperty(key);
		}
	});
});
