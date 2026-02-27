import { describe, expect, it } from 'vitest';
import { randomBetween, randomize, type SoundCategory, __testRanges } from './randomizer';

const categories: SoundCategory[] = [
	'shoot',
	'jump',
	'explosion',
	'powerup',
	'coin',
	'hit',
	'blip'
];

describe('randomizer', () => {
	it('randomBetween stays within bounds', () => {
		for (let i = 0; i < 1000; i += 1) {
			const value = randomBetween(5, 10);
			expect(value).toBeGreaterThanOrEqual(5);
			expect(value).toBeLessThanOrEqual(10);
		}
	});

	it('category outputs frequency inside configured ranges', () => {
		for (const category of categories) {
			for (let i = 0; i < 100; i += 1) {
				const result = randomize(category);
				const range = __testRanges.CATEGORY_FREQUENCY_RANGE[category];
				expect(result.frequency).toBeGreaterThanOrEqual(range.min);
				expect(result.frequency).toBeLessThanOrEqual(range.max);
			}
		}
	});

	it('all categories produce finite values within global constraints', () => {
		for (const category of categories) {
			const result = randomize(category) as unknown as Record<string, unknown>;
			for (const [key, range] of Object.entries(__testRanges.GLOBAL_NUMERIC_RANGES)) {
				const value = result[key];
				expect(typeof value).toBe('number');
				expect(Number.isNaN(value)).toBe(false);
				expect(value as number).toBeGreaterThanOrEqual(range.min);
				expect(value as number).toBeLessThanOrEqual(range.max);
			}
		}
	});

	it('explosion always uses noise waveform', () => {
		for (let i = 0; i < 100; i += 1) {
			expect(randomize('explosion').waveform).toBe('noise');
		}
	});

	it('coin always uses upward arpeggio pattern', () => {
		for (let i = 0; i < 100; i += 1) {
			expect(randomize('coin').arpPattern).toBe('up');
		}
	});
});
