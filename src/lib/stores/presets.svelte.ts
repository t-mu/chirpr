import { DEFAULT_PARAMS, type SynthParams } from '$lib/types/SynthParams';

export interface Preset {
	id: string;
	name: string;
	params: SynthParams;
	createdAt: number;
}

const STORAGE_KEY = 'sfx_presets';
const INITIALIZED_KEY = 'sfx_initialized';

const FACTORY_PRESETS: Array<{ name: string; params: SynthParams }> = [
	{
		name: '8BIT LASER',
		params: {
			...DEFAULT_PARAMS,
			waveform: 'square',
			frequency: 1200,
			attack: 0.001,
			decay: 0.08,
			sustain: 0,
			release: 0.04,
			bitDepth: 6
		}
	},
	{
		name: 'JUMP',
		params: {
			...DEFAULT_PARAMS,
			waveform: 'sawtooth',
			frequency: 820,
			detune: 72,
			attack: 0.002,
			decay: 0.16,
			release: 0.12
		}
	},
	{
		name: 'COIN',
		params: {
			...DEFAULT_PARAMS,
			waveform: 'sine',
			frequency: 1500,
			attack: 0.001,
			decay: 0.08,
			sustain: 0,
			release: 0.05,
			arpSpeed: 12,
			arpPattern: 'up'
		}
	},
	{
		name: 'EXPLODE',
		params: {
			...DEFAULT_PARAMS,
			waveform: 'noise',
			frequency: 160,
			attack: 0.02,
			decay: 0.75,
			sustain: 0.1,
			release: 0.5,
			lpfCutoff: 900,
			bitDepth: 4
		}
	},
	{
		name: 'POWER UP',
		params: {
			...DEFAULT_PARAMS,
			waveform: 'square',
			frequency: 960,
			attack: 0.005,
			decay: 0.2,
			release: 0.18,
			arpSpeed: 10,
			arpPattern: 'up'
		}
	},
	{
		name: 'HIT',
		params: {
			...DEFAULT_PARAMS,
			waveform: 'noise',
			attack: 0.001,
			decay: 0.12,
			sustain: 0,
			release: 0.06,
			hpfCutoff: 400,
			bitDepth: 5
		}
	}
];

function safeParsePresets(value: string | null): Preset[] {
	if (!value) return [];
	try {
		const parsed = JSON.parse(value);
		if (!Array.isArray(parsed)) return [];
		const migrated: Preset[] = [];
		for (const item of parsed) {
			if (!item || typeof item !== 'object') continue;
			const entry = item as {
				id?: unknown;
				name?: unknown;
				params?: unknown;
				createdAt?: unknown;
			};
			if (typeof entry.id !== 'string' || typeof entry.name !== 'string') continue;
			migrated.push({
				id: entry.id,
				name: entry.name,
				params: migrateParams(entry.params),
				createdAt: typeof entry.createdAt === 'number' ? entry.createdAt : 0
			});
		}
		return migrated;
	} catch {
		return [];
	}
}

function canUseStorage(): boolean {
	return typeof localStorage !== 'undefined';
}

function cloneParams(params: SynthParams): SynthParams {
	return JSON.parse(JSON.stringify(params)) as SynthParams;
}

export function migrateParams(raw: unknown): SynthParams {
	const merged = {
		...DEFAULT_PARAMS,
		...(typeof raw === 'object' && raw !== null ? (raw as Partial<SynthParams>) : {})
	} as SynthParams;
	// Task 24 added `curves`. Guard against presets saved before this field existed.
	if (!merged.curves || typeof merged.curves !== 'object' || Array.isArray(merged.curves)) {
		merged.curves = {};
	}
	const validCurveKeys = ['frequency', 'lpfCutoff', 'hpfCutoff'] as const;
	for (const key of Object.keys(merged.curves)) {
		if (!validCurveKeys.includes(key as (typeof validCurveKeys)[number])) {
			delete (merged.curves as Record<string, unknown>)[key];
		}
	}
	return merged;
}

function loadInitialPresets(): Preset[] {
	if (!canUseStorage()) return [];
	return safeParsePresets(localStorage.getItem(STORAGE_KEY));
}

function persistPresets(next: Preset[]): void {
	if (!canUseStorage()) return;
	localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export const presets = $state<Preset[]>(loadInitialPresets());

function initializeFactoryPresets(): void {
	if (!canUseStorage()) return;
	if (localStorage.getItem(INITIALIZED_KEY)) return;
	for (const preset of FACTORY_PRESETS) {
		savePreset(preset.name, preset.params);
	}
	localStorage.setItem(INITIALIZED_KEY, '1');
}

initializeFactoryPresets();

export function savePreset(name: string, params: SynthParams): Preset {
	const created: Preset = {
		id: crypto.randomUUID(),
		name,
		params: cloneParams(params),
		createdAt: Date.now()
	};
	presets.push(created);
	persistPresets(presets);
	return created;
}

export function loadPreset(id: string): SynthParams {
	const found = presets.find((preset) => preset.id === id);
	if (!found) {
		throw new Error(`Preset not found: ${id}`);
	}
	return cloneParams(found.params);
}

export function deletePreset(id: string): void {
	const index = presets.findIndex((preset) => preset.id === id);
	if (index === -1) return;
	presets.splice(index, 1);
	persistPresets(presets);
}

export function renamePreset(id: string, name: string): void {
	const found = presets.find((preset) => preset.id === id);
	if (!found) return;
	found.name = name;
	persistPresets(presets);
}

export function __resetPresetsForTests(): void {
	presets.splice(0, presets.length);
	if (canUseStorage()) {
		localStorage.setItem(STORAGE_KEY, '[]');
	}
}
