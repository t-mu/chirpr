<script lang="ts">
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

	$effect(() => {
		return () => {
			if (flashTimeout !== undefined) clearTimeout(flashTimeout);
		};
	});

	function showFlash(message: string): void {
		flashMessage = message;
		if (flashTimeout !== undefined) clearTimeout(flashTimeout);
		flashTimeout = window.setTimeout(() => {
			flashMessage = '';
		}, 1000);
	}

	async function handleExport(): Promise<void> {
		if (isExporting) return;
		isExporting = true;
		flashMessage = '';
		try {
			const buffer = await renderToBuffer(params, params.duration / 1000);
			const blob = await exporters[format](buffer);
			downloadBlob(blob, `sfx.${format}`);
			showFlash('SAVED!');
		} catch {
			showFlash('EXPORT FAILED');
		} finally {
			isExporting = false;
		}
	}
</script>

<label class="format-label">
	Format
	<select bind:value={format}>
		<option value="wav">WAV</option>
		<option value="mp3">MP3</option>
		<option value="ogg">OGG</option>
	</select>
</label>
<button
	type="button"
	class="save-button"
	onclick={() => void handleExport()}
	disabled={isExporting}
>
	{isExporting ? 'SAVING...' : 'SAVE'}
</button>
{#if flashMessage}
	<p class="flash">{flashMessage}</p>
{/if}

<style>
	.format-label {
		display: grid;
		gap: 0.25rem;
		font-size: 0.55rem;
	}

	select,
	.save-button {
		font: inherit;
		font-size: 0.58rem;
		padding: 0.45rem;
		border: 2px solid var(--accent);
		background: #0d0d22;
		color: inherit;
	}

	.save-button {
		background: transparent;
	}

	.flash {
		margin: 0;
		font-size: 0.6rem;
		color: var(--yellow);
	}
</style>
