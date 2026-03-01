<script lang="ts">
	import type { BezierCurve, BezierPoint } from '$lib/types/BezierCurve';

	interface Props {
		curve: BezierCurve;
		paramMin: number;
		paramMax: number;
		canvasWidth?: number;
		canvasHeight?: number;
		renderHeight?: number | string;
		onChange: (curve: BezierCurve) => void;
	}

	let {
		curve,
		paramMin,
		paramMax,
		canvasWidth = 240,
		canvasHeight = 100,
		renderHeight,
		onChange
	}: Props = $props();
	const HIT_RADIUS = 12;
	const PT = 4;

	let canvas = $state<HTMLCanvasElement | null>(null);
	let activePoint = $state<'p0' | 'p1' | 'p2' | 'p3' | null>(null);

	function resolveHeight(value: number | string | undefined): string | undefined {
		if (value === undefined) return undefined;
		return typeof value === 'number' ? `${value}px` : value;
	}

	function cx(normX: number): number {
		return normX * canvasWidth;
	}

	function cy(value: number): number {
		return (1 - (value - paramMin) / (paramMax - paramMin)) * canvasHeight;
	}

	function normX(canvasX: number): number {
		return Math.max(0, Math.min(1, canvasX / canvasWidth));
	}

	function paramValue(canvasY: number): number {
		return Math.max(
			paramMin,
			Math.min(paramMax, paramMin + (1 - canvasY / canvasHeight) * (paramMax - paramMin))
		);
	}

	function toCanvasCoords(e: PointerEvent): { x: number; y: number } {
		if (!canvas) return { x: 0, y: 0 };
		const rect = canvas.getBoundingClientRect();
		return {
			x: (e.clientX - rect.left) * (canvasWidth / rect.width),
			y: (e.clientY - rect.top) * (canvasHeight / rect.height)
		};
	}

	function drawPoint(
		ctx: CanvasRenderingContext2D,
		p: BezierPoint,
		filled: boolean,
		active: boolean
	): void {
		const x = cx(p.x);
		const y = cy(p.y);
		const color = active ? '#ffe600' : '#00e5ff';
		ctx.strokeStyle = color;
		ctx.lineWidth = 2;
		if (filled) {
			ctx.fillStyle = color;
			ctx.fillRect(x - PT, y - PT, PT * 2, PT * 2);
			return;
		}
		ctx.fillStyle = '#0a0a1a';
		ctx.fillRect(x - PT, y - PT, PT * 2, PT * 2);
		ctx.strokeRect(x - PT, y - PT, PT * 2, PT * 2);
	}

	function drawGrid(ctx: CanvasRenderingContext2D): void {
		ctx.strokeStyle = '#1a3350';
		ctx.lineWidth = 1;
		ctx.setLineDash([]);
		for (const t of [0.25, 0.5, 0.75]) {
			ctx.beginPath();
			ctx.moveTo(cx(t), 0);
			ctx.lineTo(cx(t), canvasHeight);
			ctx.stroke();
			const v = paramMin + t * (paramMax - paramMin);
			ctx.beginPath();
			ctx.moveTo(0, cy(v));
			ctx.lineTo(canvasWidth, cy(v));
			ctx.stroke();
		}
	}

	function drawCurve(ctx: CanvasRenderingContext2D): void {
		ctx.strokeStyle = '#00e5ff';
		ctx.lineWidth = 2;
		ctx.setLineDash([]);
		ctx.beginPath();
		ctx.moveTo(cx(curve.p0.x), cy(curve.p0.y));
		ctx.bezierCurveTo(
			cx(curve.p1.x),
			cy(curve.p1.y),
			cx(curve.p2.x),
			cy(curve.p2.y),
			cx(curve.p3.x),
			cy(curve.p3.y)
		);
		ctx.stroke();
	}

	function drawHandleArms(ctx: CanvasRenderingContext2D): void {
		ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
		ctx.lineWidth = 1;
		ctx.setLineDash([3, 3]);

		ctx.beginPath();
		ctx.moveTo(cx(curve.p0.x), cy(curve.p0.y));
		ctx.lineTo(cx(curve.p1.x), cy(curve.p1.y));
		ctx.stroke();

		ctx.beginPath();
		ctx.moveTo(cx(curve.p3.x), cy(curve.p3.y));
		ctx.lineTo(cx(curve.p2.x), cy(curve.p2.y));
		ctx.stroke();

		ctx.setLineDash([]);
	}

	function draw(): void {
		if (!canvas) return;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		ctx.fillStyle = '#0a0a1a';
		ctx.fillRect(0, 0, canvasWidth, canvasHeight);

		drawGrid(ctx);
		drawCurve(ctx);
		drawHandleArms(ctx);

		drawPoint(ctx, curve.p1, false, activePoint === 'p1');
		drawPoint(ctx, curve.p2, false, activePoint === 'p2');
		drawPoint(ctx, curve.p0, true, activePoint === 'p0');
		drawPoint(ctx, curve.p3, true, activePoint === 'p3');
	}

	$effect(() => {
		const tracked =
			curve.p0.x +
			curve.p0.y +
			curve.p1.x +
			curve.p1.y +
			curve.p2.x +
			curve.p2.y +
			curve.p3.x +
			curve.p3.y +
			paramMin +
			paramMax +
			canvasWidth +
			canvasHeight;
		void tracked;
		void canvas;
		draw();
	});

	function hitTest(canvasX: number, canvasY: number): 'p0' | 'p1' | 'p2' | 'p3' | null {
		const order: Array<{ key: 'p0' | 'p1' | 'p2' | 'p3'; p: BezierPoint }> = [
			{ key: 'p1', p: curve.p1 },
			{ key: 'p2', p: curve.p2 },
			{ key: 'p0', p: curve.p0 },
			{ key: 'p3', p: curve.p3 }
		];
		for (const { key, p } of order) {
			const dx = canvasX - cx(p.x);
			const dy = canvasY - cy(p.y);
			if (Math.sqrt(dx ** 2 + dy ** 2) <= HIT_RADIUS) {
				return key;
			}
		}
		return null;
	}

	function onPointerDown(e: PointerEvent): void {
		const { x, y } = toCanvasCoords(e);
		const hit = hitTest(x, y);
		if (!hit) return;
		e.preventDefault();
		activePoint = hit;
		(e.currentTarget as HTMLCanvasElement).setPointerCapture(e.pointerId);
	}

	function onPointerMove(e: PointerEvent): void {
		if (!activePoint) return;
		const { x, y } = toCanvasCoords(e);
		const newNX = normX(x);
		const newPV = paramValue(y);
		const next: BezierCurve = {
			p0: { ...curve.p0 },
			p1: { ...curve.p1 },
			p2: { ...curve.p2 },
			p3: { ...curve.p3 }
		};

		if (activePoint === 'p0') {
			next.p0 = { x: 0, y: newPV };
		} else if (activePoint === 'p3') {
			next.p3 = { x: 1, y: newPV };
		} else if (activePoint === 'p1') {
			next.p1 = { x: Math.min(newNX, next.p2.x), y: newPV };
		} else if (activePoint === 'p2') {
			next.p2 = { x: Math.max(newNX, next.p1.x), y: newPV };
		}

		onChange(next);
	}

	function onPointerUp(): void {
		activePoint = null;
	}
</script>

<canvas
	bind:this={canvas}
	width={canvasWidth}
	height={canvasHeight}
	aria-label="Bezier curve editor"
	style={resolveHeight(renderHeight)
		? `--bezier-height: ${resolveHeight(renderHeight)};`
		: undefined}
	onpointerdown={onPointerDown}
	onpointermove={onPointerMove}
	onpointerup={onPointerUp}
	onpointercancel={onPointerUp}
></canvas>

<style>
	canvas {
		width: 100%;
		height: var(--bezier-height, auto);
		display: block;
		border: 2px solid var(--accent, #00e5ff);
		box-shadow: 4px 4px 0 #000;
		image-rendering: pixelated;
		cursor: crosshair;
		touch-action: none;
	}
</style>
