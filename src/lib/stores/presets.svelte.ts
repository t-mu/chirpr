import type { SynthParams } from '$lib/types/SynthParams';

export interface Preset {
	id: string;
	name: string;
	params: SynthParams;
	createdAt: number;
}

const STORAGE_KEY = 'sfx_presets';

function safeParsePresets(value: string | null): Preset[] {
	if (!value) return [];
	try {
		const parsed = JSON.parse(value);
		if (!Array.isArray(parsed)) return [];
		return parsed as Preset[];
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

function loadInitialPresets(): Preset[] {
	if (!canUseStorage()) return [];
	return safeParsePresets(localStorage.getItem(STORAGE_KEY));
}

function persistPresets(next: Preset[]): void {
	if (!canUseStorage()) return;
	localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export const presets = $state<Preset[]>(loadInitialPresets());

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
	persistPresets(presets);
}
