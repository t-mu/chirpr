import { render } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import BezierEditor from './BezierEditor.svelte';
import { flatCurve } from '$lib/audio/bezier';
import type { BezierCurve } from '$lib/types/BezierCurve';

function mockCanvasRect(canvas: HTMLCanvasElement): void {
	vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
		x: 0,
		y: 0,
		width: 240,
		height: 100,
		top: 0,
		left: 0,
		right: 240,
		bottom: 100,
		toJSON: () => ({})
	} as DOMRect);
}

afterEach(() => {
	document.body.innerHTML = '';
});

describe('BezierEditor', () => {
	it('mounts and renders a canvas', () => {
		const { getByLabelText } = render(BezierEditor, {
			props: {
				curve: flatCurve(440),
				paramMin: 20,
				paramMax: 2000,
				onChange: () => {}
			}
		});

		expect(getByLabelText('Bezier curve editor')).toBeTruthy();
	});

	it('calls onChange while dragging an anchor point', () => {
		let received: BezierCurve | null = null;
		const { getByLabelText } = render(BezierEditor, {
			props: {
				curve: flatCurve(440),
				paramMin: 20,
				paramMax: 2000,
				onChange: (curve) => {
					received = curve;
				}
			}
		});

		const canvas = getByLabelText('Bezier curve editor') as HTMLCanvasElement;
		mockCanvasRect(canvas);

		canvas.dispatchEvent(
			new PointerEvent('pointerdown', {
				clientX: 0,
				clientY: 79,
				pointerId: 1,
				bubbles: true
			})
		);
		canvas.dispatchEvent(
			new PointerEvent('pointermove', {
				clientX: 0,
				clientY: 0,
				pointerId: 1,
				bubbles: true
			})
		);
		canvas.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, bubbles: true }));

		expect(received).toBeTruthy();
		if (!received) {
			throw new Error('Expected BezierEditor to emit an updated curve while dragging');
		}
		const updated = received as BezierCurve;
		expect(updated.p0.y).toBeGreaterThan(1800);
		expect(updated.p0.x).toBe(0);
	});
});
