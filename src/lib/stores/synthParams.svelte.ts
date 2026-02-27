import { DEFAULT_PARAMS, type SynthParams } from '$lib/types/SynthParams';
import {
	assertParamMetaCoverage,
	clampParam,
	NUMERIC_PARAM_KEYS,
	PARAM_META,
	type NumericParamKey
} from '$lib/types/paramMeta';

assertParamMetaCoverage(DEFAULT_PARAMS);

function sanitizeParams(input: SynthParams): SynthParams {
	const next = structuredClone(input);
	const mutable = next as Record<keyof SynthParams, unknown>;
	for (const key of NUMERIC_PARAM_KEYS) {
		const current = mutable[key] as number;
		mutable[key] = clampParam(key, current);
	}
	return next;
}

export const params = $state<SynthParams>(sanitizeParams(DEFAULT_PARAMS));

export function updateParam<K extends keyof SynthParams>(key: K, value: SynthParams[K]): void {
	if ((key as NumericParamKey) in PARAM_META && typeof value === 'number') {
		params[key] = clampParam(key as NumericParamKey, value) as SynthParams[K];
		return;
	}
	params[key] = value;
}

export function setParams(nextParams: SynthParams): void {
	Object.assign(params, sanitizeParams(nextParams));
}

export function resetParams(): void {
	Object.assign(params, sanitizeParams(DEFAULT_PARAMS));
}
