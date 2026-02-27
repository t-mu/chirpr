import { fireEvent, render } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PixelSlider from './PixelSlider.svelte';

afterEach(() => {
	document.body.innerHTML = '';
});

describe('PixelSlider', () => {
	it('renders input with min/max/value attributes', () => {
		const { getByRole } = render(PixelSlider, {
			props: { label: 'Frequency', min: 20, max: 2000, step: 1, value: 440 }
		});

		const slider = getByRole('slider') as HTMLInputElement;
		expect(slider.min).toBe('20');
		expect(slider.max).toBe('2000');
		expect(slider.value).toBe('440');
	});

	it('emits numeric change value on input', async () => {
		const onChange = vi.fn();
		const { component, getByRole } = render(PixelSlider, {
			props: { label: 'Frequency', min: 20, max: 2000, step: 1, value: 440, onChange }
		});

		const slider = getByRole('slider') as HTMLInputElement;
		slider.value = '880';
		await fireEvent.input(slider);

		expect(onChange).toHaveBeenCalledWith(880);
		expect(component).toBeTruthy();
	});
});
