import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_PARAMS } from '$lib/types/SynthParams';

beforeEach(() => {
	localStorage.clear();
	localStorage.setItem('sfx_initialized', '1');
	vi.resetModules();
	vi.stubGlobal('crypto', {
		randomUUID: () => 'preset-id'
	});
	vi.spyOn(Date, 'now').mockReturnValue(1234567890);
});

afterEach(() => {
	vi.restoreAllMocks();
});

async function importStore() {
	return import('./presets.svelte');
}

describe('presets store', () => {
	it('save -> load returns deep-equal params', async () => {
		const store = await importStore();
		const saved = store.savePreset('test', DEFAULT_PARAMS);
		const loaded = store.loadPreset(saved.id);

		expect(loaded).toEqual(saved.params);
	});

	it('deletePreset removes item and persists deletion', async () => {
		const store = await importStore();
		const saved = store.savePreset('delete-me', DEFAULT_PARAMS);

		store.deletePreset(saved.id);

		expect(store.presets.length).toBe(0);
		expect(localStorage.getItem('sfx_presets')).toBe('[]');
	});

	it('allows duplicate preset names', async () => {
		const store = await importStore();
		store.savePreset('DUPLICATE', DEFAULT_PARAMS);
		store.savePreset('DUPLICATE', DEFAULT_PARAMS);

		expect(store.presets.length).toBe(2);
		expect(store.presets[0].name).toBe('DUPLICATE');
		expect(store.presets[1].name).toBe('DUPLICATE');
	});

	it('handles corrupt localStorage by returning empty list', async () => {
		localStorage.setItem('sfx_presets', '{not valid json');
		const store = await importStore();

		expect(store.presets).toEqual([]);
	});

	it('seeds factory presets once when initialization key is missing', async () => {
		localStorage.clear();
		vi.resetModules();
		const store = await importStore();

		expect(store.presets.length).toBeGreaterThanOrEqual(5);
		expect(localStorage.getItem('sfx_initialized')).toBe('1');
	});
});
