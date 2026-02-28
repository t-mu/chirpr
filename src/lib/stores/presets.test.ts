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
	it('returns empty preset list when storage is empty', async () => {
		localStorage.removeItem('sfx_presets');
		vi.resetModules();
		const store = await importStore();

		expect(store.presets).toEqual([]);
	});

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

	it('migrateParams adds empty curves for legacy params without curves', async () => {
		const store = await importStore();
		const { curves: _legacyCurves, ...legacyWithoutCurves } = DEFAULT_PARAMS;
		const migrated = store.migrateParams(legacyWithoutCurves);
		void _legacyCurves;

		expect(migrated.curves).toEqual({});
	});

	it('migrateParams preserves existing curves', async () => {
		const store = await importStore();
		const migrated = store.migrateParams({
			...DEFAULT_PARAMS,
			curves: {
				frequency: {
					p0: { x: 0, y: 440 },
					p1: { x: 0.3, y: 330 },
					p2: { x: 0.7, y: 220 },
					p3: { x: 1, y: 110 }
				}
			}
		});

		expect(migrated.curves.frequency).toBeDefined();
	});

	it('loads legacy preset from storage and initializes missing curves', async () => {
		const { curves: _legacyCurves, ...legacyWithoutCurves } = DEFAULT_PARAMS;
		void _legacyCurves;
		localStorage.setItem(
			'sfx_presets',
			JSON.stringify([
				{
					id: 'legacy-1',
					name: 'legacy',
					params: legacyWithoutCurves,
					createdAt: 1
				}
			])
		);
		vi.resetModules();
		const store = await importStore();

		expect(store.presets[0].params.curves).toEqual({});
	});

	it('migrateParams strips stale vibrato curve keys', async () => {
		const store = await importStore();
		const migrated = store.migrateParams({
			...DEFAULT_PARAMS,
			curves: {
				frequency: {
					p0: { x: 0, y: 440 },
					p1: { x: 0.3, y: 330 },
					p2: { x: 0.7, y: 220 },
					p3: { x: 1, y: 110 }
				},
				vibratoDepth: {
					p0: { x: 0, y: 0.1 },
					p1: { x: 0.3, y: 0.25 },
					p2: { x: 0.7, y: 0.5 },
					p3: { x: 1, y: 0.8 }
				}
			}
		});

		expect(migrated.curves.frequency).toBeDefined();
		expect((migrated.curves as Record<string, unknown>).vibratoDepth).toBeUndefined();
	});
});
