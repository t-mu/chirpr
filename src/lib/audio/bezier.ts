import type { BezierCurve, BezierPoint } from '$lib/types/BezierCurve';

export function evaluateBezier(
	t: number,
	p0: BezierPoint,
	p1: BezierPoint,
	p2: BezierPoint,
	p3: BezierPoint
): BezierPoint {
	const tc = Math.max(0, Math.min(1, t));
	const mt = 1 - tc;
	return {
		x: mt ** 3 * p0.x + 3 * mt ** 2 * tc * p1.x + 3 * mt * tc ** 2 * p2.x + tc ** 3 * p3.x,
		y: mt ** 3 * p0.y + 3 * mt ** 2 * tc * p1.y + 3 * mt * tc ** 2 * p2.y + tc ** 3 * p3.y
	};
}

export function sampleCurve(curve: BezierCurve, n = 128): Float32Array {
	const count = Math.max(2, n);
	const out = new Float32Array(count);
	const { p0, p1, p2, p3 } = curve;
	for (let i = 0; i < count; i += 1) {
		out[i] = evaluateBezier(i / (count - 1), p0, p1, p2, p3).y;
	}
	return out;
}

export function flatCurve(value: number): BezierCurve {
	return {
		p0: { x: 0, y: value },
		p1: { x: 1 / 3, y: value },
		p2: { x: 2 / 3, y: value },
		p3: { x: 1, y: value }
	};
}

export function sweepCurve(startValue: number, endValue: number, shape = 0.5): BezierCurve {
	const clampedShape = Math.max(0, Math.min(1, shape));
	return {
		p0: { x: 0, y: startValue },
		p1: { x: clampedShape, y: startValue },
		p2: { x: 1 - clampedShape, y: endValue },
		p3: { x: 1, y: endValue }
	};
}

export function logSweepCurve(startHz: number, endHz: number, shape = 0.5): BezierCurve {
	const safeStart = Math.max(1, startHz);
	const safeEnd = Math.max(1, endHz);
	const logStart = Math.log(safeStart);
	const logEnd = Math.log(safeEnd);
	const midValue = Math.exp((logStart + logEnd) / 2);
	const clampedShape = Math.max(0, Math.min(1, shape));

	return {
		p0: { x: 0, y: safeStart },
		p1: { x: clampedShape, y: midValue },
		p2: { x: 1 - clampedShape, y: midValue },
		p3: { x: 1, y: safeEnd }
	};
}
