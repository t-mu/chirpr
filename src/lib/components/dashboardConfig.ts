import type { NumericParamKey } from '$lib/types/paramMeta';
import type { SynthParams } from '$lib/types/SynthParams';

export interface DashboardSliderConfig {
	key: NumericParamKey;
	label: string;
	disabledWhen?: (params: SynthParams) => boolean;
}

export const OSCILLATOR_SLIDERS: DashboardSliderConfig[] = [
	{ key: 'frequency', label: 'Frequency' },
	{ key: 'detune', label: 'Detune' },
	{
		key: 'dutyCycle',
		label: 'Width',
		disabledWhen: (params) => params.waveform !== 'square'
	}
];

export const ENVELOPE_SLIDERS: DashboardSliderConfig[] = [
	{ key: 'attack', label: 'Attack' },
	{ key: 'decay', label: 'Decay' },
	{ key: 'sustain', label: 'Sustain' },
	{ key: 'release', label: 'Release' }
];

export const FILTERS_SLIDERS: DashboardSliderConfig[] = [
	{ key: 'lpfCutoff', label: 'LPF Cutoff' },
	{ key: 'lpfResonance', label: 'LPF Resonance' },
	{ key: 'hpfCutoff', label: 'HPF Cutoff' },
	{ key: 'hpfResonance', label: 'HPF Resonance' }
];

export const MODULATION_SLIDERS: DashboardSliderConfig[] = [
	{ key: 'vibratoRate', label: 'Vibrato Rate' },
	{ key: 'vibratoDepth', label: 'Vibrato Depth' },
	{ key: 'arpSpeed', label: 'Arp Speed' },
	{ key: 'retriggerRate', label: 'Retrigger' }
];

export const FLANGER_SLIDERS: DashboardSliderConfig[] = [
	{ key: 'flangerRate', label: 'Rate' },
	{ key: 'flangerDepth', label: 'Depth' },
	{ key: 'flangerFeedback', label: 'Feedback' },
	{ key: 'flangerWet', label: 'Mix' }
];

export const BIT_CRUSHER_SLIDERS: DashboardSliderConfig[] = [
	{ key: 'bitDepth', label: 'Bit Depth' },
	{ key: 'sampleRateReduction', label: 'Sample Rate' }
];

export const PLAYBACK_SLIDERS: DashboardSliderConfig[] = [{ key: 'duration', label: 'Duration' }];

export const DUTY_CYCLE_DISABLED_NOTE = 'WIDTH IS AVAILABLE ONLY FOR SQUARE WAVEFORM.';
