<script lang="ts">
	import { onDestroy } from 'svelte';
	import { params } from '$lib/stores/synthParams.svelte';
	import {
		downloadBlob,
		exportMP3,
		exportOGG,
		exportWAV,
		renderToBuffer
	} from '$lib/audio/exporter';

	type ExportFormat = 'wav' | 'mp3' | 'ogg';
	type Exporter = (buffer: AudioBuffer) => Blob | Promise<Blob>;

	let format = $state<ExportFormat>('wav');
	let isExporting = $state(false);
	let flashMessage = $state('');
	let flashTimeout: number | undefined;

	const exporters: Record<ExportFormat, Exporter> = {
		wav: exportWAV,
		mp3: exportMP3,
		ogg: exportOGG
	};

	function showFlash(message: string): void {
		flashMessage = message;
		if (flashTimeout !== undefined) {
			clearTimeout(flashTimeout);
		}
		flashTimeout = window.setTimeout(() => {
			flashMessage = '';
		}, 1000);
	}

	onDestroy(() => {
		if (flashTimeout !== undefined) {
			clearTimeout(flashTimeout);
		}
	});

	async function handleExport(): Promise<void> {
		isExporting = true;
		flashMessage = '';
		try {
			const exportDurationSeconds = params.duration / 1000;
			const buffer = await renderToBuffer(params, exportDurationSeconds);
			const blob = await exporters[format](buffer);
			downloadBlob(blob, `sfx.${format}`);
			showFlash('DOWNLOADED!');
		} catch {
			showFlash('EXPORT FAILED');
		} finally {
			isExporting = false;
		}
	}
</script>

<section class="panel">
	<h3>EXPORT</h3>
	<div class="controls">
		<label>
			Format
			<select bind:value={format}>
				<option value="wav">WAV</option>
				<option value="mp3">MP3</option>
				<option value="ogg">OGG</option>
			</select>
		</label>
	</div>
	<button
		type="button"
		class="export-button"
		onclick={() => void handleExport()}
		disabled={isExporting}
	>
		{isExporting ? 'EXPORTING...' : 'EXPORT'}
	</button>
	{#if flashMessage}
		<p>{flashMessage}</p>
	{/if}
</section>

<style>
	.panel {
		border: 2px solid var(--accent);
		background: var(--surface);
		padding: 0.75rem;
		display: grid;
		gap: 0.6rem;
	}

	h3 {
		margin: 0;
		font-size: 0.7rem;
	}

	.controls {
		display: grid;
		grid-template-columns: 1fr;
		gap: 0.4rem;
	}

	label {
		display: grid;
		gap: 0.25rem;
		font-size: 0.55rem;
	}

	select,
	button {
		font: inherit;
		font-size: 0.58rem;
		padding: 0.45rem;
		border: 2px solid var(--accent);
		background: #0d0d22;
		color: inherit;
	}

	.export-button {
		background: transparent;
	}

	p {
		margin: 0;
		font-size: 0.6rem;
		color: var(--yellow);
	}
</style>
