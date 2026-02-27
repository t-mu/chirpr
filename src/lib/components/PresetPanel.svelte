<script lang="ts">
	import type { SynthesizerAPI } from '$lib/audio/synthesizer';
	import {
		deletePreset,
		loadPreset,
		presets,
		renamePreset,
		savePreset,
		type Preset
	} from '$lib/stores/presets.svelte';
	import { params, setParams } from '$lib/stores/synthParams.svelte';

	interface Props {
		synthesizer?: SynthesizerAPI | null;
	}

	let { synthesizer = null }: Props = $props();
	let presetName = $state('');
	let editingId = $state<string | null>(null);
	let renameValue = $state('');
	let deleteTargetId = $state<string | null>(null);

	const deleteTarget = $derived(
		deleteTargetId ? (presets.find((preset) => preset.id === deleteTargetId) ?? null) : null
	);

	function handleSave(): void {
		const cleanName = presetName.trim();
		if (!cleanName) return;
		savePreset(cleanName, params);
		presetName = '';
	}

	function handleLoad(id: string): void {
		const loaded = loadPreset(id);
		setParams(loaded);
		synthesizer?.updateParams(loaded);
	}

	function startRename(preset: Preset): void {
		editingId = preset.id;
		renameValue = preset.name;
	}

	function commitRename(id: string): void {
		const cleanName = renameValue.trim();
		if (cleanName) {
			renamePreset(id, cleanName);
		}
		editingId = null;
		renameValue = '';
	}

	function cancelRename(): void {
		editingId = null;
		renameValue = '';
	}

	function requestDelete(id: string): void {
		deleteTargetId = id;
	}

	function confirmDelete(): void {
		if (!deleteTargetId) return;
		deletePreset(deleteTargetId);
		deleteTargetId = null;
	}

	function cancelDelete(): void {
		deleteTargetId = null;
	}
</script>

<section class="panel">
	<div class="panel__header">
		<h3>PRESETS</h3>
		<div class="panel__save-row">
			<input
				placeholder="Preset name"
				aria-label="Preset name"
				bind:value={presetName}
				onkeydown={(event) => {
					if (event.key === 'Enter') handleSave();
				}}
			/>
			<button type="button" onclick={handleSave}>Save</button>
		</div>
	</div>

	{#if presets.length === 0}
		<p class="empty">NO PRESETS SAVED</p>
	{:else}
		<ul>
			{#each presets as preset (preset.id)}
				<li>
					{#if editingId === preset.id}
						<input
							class="rename-input"
							bind:value={renameValue}
							onkeydown={(event) => {
								if (event.key === 'Enter') commitRename(preset.id);
								if (event.key === 'Escape') cancelRename();
							}}
							onblur={() => commitRename(preset.id)}
						/>
					{:else}
						<button type="button" class="name-button" ondblclick={() => startRename(preset)}>
							{preset.name}
						</button>
					{/if}
					<div class="row-actions">
						<button
							type="button"
							aria-label={`Load ${preset.name}`}
							onclick={() => handleLoad(preset.id)}
						>
							Load
						</button>
						<button
							type="button"
							class="danger"
							aria-label={`Delete ${preset.name}`}
							onclick={() => requestDelete(preset.id)}
						>
							Delete
						</button>
					</div>
				</li>
			{/each}
		</ul>
	{/if}

	{#if deleteTarget}
		<div class="confirm-modal" role="dialog" aria-modal="true">
			<p>DELETE <strong>{deleteTarget.name}</strong>?</p>
			<div class="confirm-actions">
				<button type="button" class="danger" onclick={confirmDelete}>Yes, delete</button>
				<button type="button" onclick={cancelDelete}>Cancel</button>
			</div>
		</div>
	{/if}
</section>

<style>
	.panel {
		position: relative;
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

	.panel__save-row {
		display: grid;
		gap: 0.4rem;
		grid-template-columns: 1fr auto;
		margin-top: 0.5rem;
	}

	input,
	button {
		font: inherit;
		font-size: 0.58rem;
	}

	input {
		border: 2px solid var(--accent);
		background: #0d0d22;
		color: inherit;
		padding: 0.45rem;
	}

	button {
		border: 2px solid var(--accent);
		background: transparent;
		color: inherit;
		padding: 0.45rem 0.6rem;
	}

	.name-button {
		text-align: left;
		padding-inline: 0;
		border: none;
		background: none;
	}

	.rename-input {
		width: 100%;
	}

	ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 0.35rem;
		max-height: 220px;
		overflow: auto;
	}

	li {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 0.5rem;
		align-items: center;
		padding: 0.35rem;
		border: 1px solid #21405d;
	}

	.row-actions {
		display: flex;
		gap: 0.35rem;
	}

	.danger {
		border-color: var(--red);
		color: var(--red);
	}

	.empty {
		margin: 0;
		font-size: 0.58rem;
		opacity: 0.7;
	}

	.confirm-modal {
		position: absolute;
		inset: 0.5rem;
		background: #090913;
		border: 2px solid var(--red);
		padding: 0.8rem;
		display: grid;
		gap: 0.7rem;
		align-content: center;
	}

	.confirm-modal p {
		margin: 0;
		font-size: 0.58rem;
	}

	.confirm-actions {
		display: flex;
		gap: 0.4rem;
	}
</style>
