import { fireEvent, render } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PixelToggle from './PixelToggle.svelte';

afterEach(() => {
	document.body.innerHTML = '';
});

describe('PixelToggle', () => {
	const options = [
		{ value: 'square', label: 'Square' },
		{ value: 'sine', label: 'Sine' }
	];

	it('emits change with clicked value', async () => {
		const onChange = vi.fn();
		const { getByRole } = render(PixelToggle, {
			props: { options, selected: 'square', onChange }
		});

		await fireEvent.click(getByRole('button', { name: 'Sine' }));
		expect(onChange).toHaveBeenCalledWith('sine');
	});

	it('applies active class to selected option', () => {
		const { getByRole } = render(PixelToggle, {
			props: { options, selected: 'sine' }
		});

		expect(getByRole('button', { name: 'Sine' }).classList.contains('active')).toBe(true);
		expect(getByRole('button', { name: 'Square' }).classList.contains('active')).toBe(false);
	});
});
