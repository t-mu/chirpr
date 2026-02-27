<script lang="ts">
	import type { Waveform } from 'tone';

	interface Props {
		waveform: Waveform;
	}

	let { waveform }: Props = $props();
	let canvas = $state<HTMLCanvasElement | null>(null);

	function drawWave(): void {
		if (!canvas) return;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		const samples = waveform.getValue();
		ctx.fillStyle = '#0a0a1a';
		ctx.fillRect(0, 0, canvas.width, canvas.height);

		ctx.strokeStyle = '#1a3350';
		ctx.lineWidth = 1;
		for (let x = 0; x < canvas.width; x += 16) {
			ctx.beginPath();
			ctx.moveTo(x, 0);
			ctx.lineTo(x, canvas.height);
			ctx.stroke();
		}

		ctx.strokeStyle = '#00e5ff';
		ctx.lineWidth = 2;
		ctx.beginPath();
		for (let i = 0; i < samples.length; i += 1) {
			const x = (i / Math.max(1, samples.length - 1)) * canvas.width;
			const y = ((1 - samples[i]) / 2) * canvas.height;
			if (i === 0) ctx.moveTo(x, y);
			else ctx.lineTo(x, y);
		}
		ctx.stroke();
	}

	$effect(() => {
		let frameId = 0;
		const loop = () => {
			drawWave();
			frameId = requestAnimationFrame(loop);
		};
		frameId = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(frameId);
	});
</script>

<div class="oscilloscope-wrap">
	<canvas bind:this={canvas} width="640" height="220" class="oscilloscope"></canvas>
</div>

<style>
	.oscilloscope-wrap {
		position: relative;
	}

	.oscilloscope-wrap::after {
		content: '';
		position: absolute;
		inset: 0;
		pointer-events: none;
		background: repeating-linear-gradient(
			to bottom,
			rgba(255, 255, 255, 0.04) 0,
			rgba(255, 255, 255, 0.04) 1px,
			transparent 1px,
			transparent 4px
		);
	}

	.oscilloscope {
		width: 100%;
		height: auto;
		display: block;
		image-rendering: pixelated;
		border: 2px solid var(--accent, #00e5ff);
		box-shadow: 4px 4px 0 #000;
	}
</style>
