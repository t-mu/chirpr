import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import Oscilloscope from './Oscilloscope.svelte';
import type { Waveform } from 'tone';

describe('Oscilloscope', () => {
	it('mounts without error using zeroed waveform data', () => {
		const waveform = {
			getValue: () => new Float32Array(128)
		} as Waveform;

		expect(() => render(Oscilloscope, { props: { waveform } })).not.toThrow();
	});
});
