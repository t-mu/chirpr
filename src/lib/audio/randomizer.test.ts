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

	it('all categories generate duration within global bounds', () => {
		for (const category of categories) {
			for (let i = 0; i < 100; i += 1) {
				const result = randomize(category);
				expect(result.duration).toBeGreaterThanOrEqual(50);
				expect(result.duration).toBeLessThanOrEqual(2000);
			}
		}
	});

	it('shoot assigns a descending frequency curve', () => {
		const result = randomize('shoot');
		expect(result.curves.frequency).toBeDefined();
		expect(result.curves.frequency!.p3.y).toBeLessThan(result.curves.frequency!.p0.y);
	});

	it('jump assigns an ascending frequency curve', () => {
		const result = randomize('jump');
		expect(result.curves.frequency).toBeDefined();
		expect(result.curves.frequency!.p3.y).toBeGreaterThan(result.curves.frequency!.p0.y);
	});

	it('explosion assigns lpf curve but no frequency curve', () => {
		const result = randomize('explosion');
		expect(result.curves.lpfCutoff).toBeDefined();
		expect(result.curves.frequency).toBeUndefined();
	});

	it('blip frequency curve ends below 80% of start', () => {
		const result = randomize('blip');
		expect(result.curves.frequency).toBeDefined();
		expect(result.curves.frequency!.p3.y).toBeLessThan(result.curves.frequency!.p0.y * 0.8);
	});

	it('coin, powerup and hit keep curves empty', () => {
		expect(randomize('coin').curves).toEqual({});
		expect(randomize('powerup').curves).toEqual({});
		expect(randomize('hit').curves).toEqual({});
	});

	it('global clamping pass does not remove generated curves', () => {
		for (let i = 0; i < 10; i += 1) {
			const result = randomize('shoot');
			expect(result.curves.frequency).toBeDefined();
			expect(typeof result.curves.frequency!.p0.y).toBe('number');
		}
	});
});
