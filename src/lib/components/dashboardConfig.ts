import type { NumericParamKey } from '$lib/types/paramMeta';
import type { SynthParams } from '$lib/types/SynthParams';

export interface DashboardSliderConfig {
	key: NumericParamKey;
	label: string;
	disabledWhen?: (params: SynthParams) => boolean;
}

export const OSCILLATOR_SLIDERS: DashboardSliderConfig[] = [
	{ key: 'frequency', label: 'Frequency' },
	{ key: 'detune', label: 'Detune' }
];

export const ENVELOPE_SLIDERS: DashboardSliderConfig[] = [
	{ key: 'attack', label: 'Attack' },
	{ key: 'decay', label: 'Decay' },
	{ key: 'sustain', label: 'Sustain' },
	{ key: 'release', label: 'Release' }
];

export const DUTY_CYCLE_SLIDERS: DashboardSliderConfig[] = [
	{
		key: 'dutyCycle',
		label: 'Width',
		disabledWhen: (params) => params.waveform !== 'square'
	}
];

export const EFFECTS_SLIDERS: DashboardSliderConfig[] = [
	{ key: 'vibratoRate', label: 'Vibrato Rate' },
	{ key: 'vibratoDepth', label: 'Vibrato Depth' },
	{ key: 'arpSpeed', label: 'Arp Speed' },
	{ key: 'flangerRate', label: 'Flanger Rate' },
	{ key: 'flangerDepth', label: 'Flanger Depth' },
	{ key: 'flangerFeedback', label: 'Flanger Feedback' },
	{ key: 'flangerWet', label: 'Flanger Mix' },
	{ key: 'lpfCutoff', label: 'LPF Cutoff' },
	{ key: 'hpfCutoff', label: 'HPF Cutoff' },
	{ key: 'bitDepth', label: 'Bit Depth' },
	{ key: 'retriggerRate', label: 'Retrigger' },
	{ key: 'retriggerCount', label: 'Retrigger Count' }
];

export const PLAYBACK_SLIDERS: DashboardSliderConfig[] = [{ key: 'duration', label: 'Duration' }];

export const DUTY_CYCLE_DISABLED_NOTE = 'DUTY CYCLE IS AVAILABLE ONLY FOR SQUARE WAVEFORM.';
