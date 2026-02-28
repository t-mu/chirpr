import type { SynthParams } from './SynthParams';

/**
 * A point in the bezier curve's 2D parameter space.
 * x is normalized time [0, 1], y is the parameter value in native units.
 */
export interface BezierPoint {
	x: number;
	y: number;
}

/**
 * A cubic bezier curve defined by 4 control points.
 * p0.x is anchored at 0 and p3.x at 1.
 * p1.x must remain <= p2.x to avoid backwards time traversal.
 */
export interface BezierCurve {
	p0: BezierPoint;
	p1: BezierPoint;
	p2: BezierPoint;
	p3: BezierPoint;
}

/**
 * Synth params that support bezier automation.
 */
export type CurveableParam = 'frequency' | 'lpfCutoff' | 'hpfCutoff';

// If this line errors, update CurveableParam to match SynthParams keys.
type _CurveableParamCheck = CurveableParam extends keyof SynthParams ? true : never;
const curveableParamCheck: _CurveableParamCheck = true;
void curveableParamCheck;
