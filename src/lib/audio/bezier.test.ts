import { describe, expect, it } from 'vitest';
import { evaluateBezier, flatCurve, logSweepCurve, sampleCurve, sweepCurve } from './bezier';

describe('evaluateBezier', () => {
	const p0 = { x: 0, y: 100 };
	const p1 = { x: 1 / 3, y: 100 };
	const p2 = { x: 2 / 3, y: 200 };
	const p3 = { x: 1, y: 200 };

	it('returns p0 at t=0', () => {
		const out = evaluateBezier(0, p0, p1, p2, p3);
		expect(out.x).toBeCloseTo(0);
		expect(out.y).toBeCloseTo(100);
	});

	it('returns p3 at t=1', () => {
		const out = evaluateBezier(1, p0, p1, p2, p3);
		expect(out.x).toBeCloseTo(1);
		expect(out.y).toBeCloseTo(200);
	});

	it('returns midpoint on straight-line curve at t=0.5', () => {
		const out = evaluateBezier(
			0.5,
			{ x: 0, y: 0 },
			{ x: 1 / 3, y: 1 / 3 },
			{ x: 2 / 3, y: 2 / 3 },
			{ x: 1, y: 1 }
		);
		expect(out.y).toBeCloseTo(0.5);
	});

	it('clamps t to [0, 1]', () => {
		expect(evaluateBezier(-2, p0, p1, p2, p3).y).toBeCloseTo(100);
		expect(evaluateBezier(2, p0, p1, p2, p3).y).toBeCloseTo(200);
	});
});

describe('sampleCurve', () => {
	it('samples a flat curve as constant', () => {
		const out = sampleCurve(flatCurve(440), 128);
		expect(out).toHaveLength(128);
		expect(Array.from(out).every((value) => Math.abs(value - 440) < 0.001)).toBe(true);
	});

	it('samples sweep from start to end monotonically increasing', () => {
		const out = sampleCurve(sweepCurve(100, 1000), 64);
		expect(out[0]).toBeCloseTo(100);
		expect(out[out.length - 1]).toBeCloseTo(1000);
		for (let i = 1; i < out.length; i += 1) {
			expect(out[i]).toBeGreaterThanOrEqual(out[i - 1]);
		}
	});

	it('enforces minimum sample count of 2', () => {
		const out = sampleCurve(flatCurve(220), 1);
		expect(out).toHaveLength(2);
		expect(out[0]).toBeCloseTo(220);
		expect(out[1]).toBeCloseTo(220);
	});
});

describe('logSweepCurve', () => {
	it('returns endpoints with safe positive clamp', () => {
		const curve = logSweepCurve(1200, 48, 0.2);
		expect(curve.p0.y).toBeCloseTo(1200);
		expect(curve.p3.y).toBeCloseTo(48);
	});

	it('downward sweep with non-mid shape avoids equal-handle plateau', () => {
		const curve = logSweepCurve(1200, 48, 0.2);
		expect(curve.p1.y).toBeGreaterThan(curve.p2.y);
		expect(curve.p1.y).toBeGreaterThan(400);
		expect(curve.p2.y).toBeLessThan(200);
	});

	it('upward sweep has increasing handle values', () => {
		const curve = logSweepCurve(500, 1500, 0.3);
		expect(curve.p1.y).toBeLessThan(curve.p2.y);
	});

	it('shape 0.5 keeps handles at geometric mean for compatibility', () => {
		const curve = logSweepCurve(1200, 48, 0.5);
		const geoMean = Math.sqrt(1200 * 48);
		expect(curve.p1.y).toBeCloseTo(geoMean, 0);
		expect(curve.p2.y).toBeCloseTo(geoMean, 0);
	});

	it('clamps invalid non-positive endpoints to 1Hz minimum', () => {
		const curve = logSweepCurve(0, -20, 0.3);
		expect(curve.p0.y).toBe(1);
		expect(curve.p3.y).toBe(1);
		expect(Number.isFinite(curve.p1.y)).toBe(true);
		expect(Number.isFinite(curve.p2.y)).toBe(true);
	});
});
