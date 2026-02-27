import { describe, expect, it, vi } from 'vitest';
import { createDashboardKeydownHandler } from './dashboardShortcuts';

function keyboardEvent(
	overrides: Partial<KeyboardEvent> & {
		key?: string;
		code?: string;
		target?: EventTarget | null;
	} = {}
): KeyboardEvent {
	return {
		key: '',
		code: '',
		target: null,
		preventDefault: vi.fn(),
		...overrides
	} as unknown as KeyboardEvent;
}

describe('createDashboardKeydownHandler', () => {
	it('handles Space and triggers play toggle', () => {
		const togglePlay = vi.fn();
		const handler = createDashboardKeydownHandler({
			togglePlay,
			applyRandomCategory: vi.fn(),
			getLastRandomCategory: () => 'shoot',
			focusPresetInput: vi.fn(),
			resetAllParams: vi.fn()
		});
		const event = keyboardEvent({ key: ' ', code: 'Space' });

		handler(event);

		expect(event.preventDefault).toHaveBeenCalledOnce();
		expect(togglePlay).toHaveBeenCalledOnce();
	});

	it('handles R and applies the current random category', () => {
		const applyRandomCategory = vi.fn();
		let category: 'shoot' | 'explosion' = 'shoot';
		const handler = createDashboardKeydownHandler({
			togglePlay: vi.fn(),
			applyRandomCategory,
			getLastRandomCategory: () => category,
			focusPresetInput: vi.fn(),
			resetAllParams: vi.fn()
		});

		handler(keyboardEvent({ key: 'r', code: 'KeyR' }));
		category = 'explosion';
		handler(keyboardEvent({ key: 'r', code: 'KeyR' }));

		expect(applyRandomCategory).toHaveBeenNthCalledWith(1, 'shoot');
		expect(applyRandomCategory).toHaveBeenNthCalledWith(2, 'explosion');
	});

	it('handles S and Escape shortcuts', () => {
		const focusPresetInput = vi.fn();
		const resetAllParams = vi.fn();
		const handler = createDashboardKeydownHandler({
			togglePlay: vi.fn(),
			applyRandomCategory: vi.fn(),
			getLastRandomCategory: () => 'shoot',
			focusPresetInput,
			resetAllParams
		});

		handler(keyboardEvent({ key: 's', code: 'KeyS' }));
		handler(keyboardEvent({ key: 'Escape', code: 'Escape' }));

		expect(focusPresetInput).toHaveBeenCalledOnce();
		expect(resetAllParams).toHaveBeenCalledOnce();
	});

	it('ignores shortcuts while typing in editable fields', () => {
		const togglePlay = vi.fn();
		const handler = createDashboardKeydownHandler({
			togglePlay,
			applyRandomCategory: vi.fn(),
			getLastRandomCategory: () => 'shoot',
			focusPresetInput: vi.fn(),
			resetAllParams: vi.fn()
		});
		const input = document.createElement('input');
		const event = keyboardEvent({ key: ' ', code: 'Space', target: input });

		handler(event);

		expect(event.preventDefault).not.toHaveBeenCalled();
		expect(togglePlay).not.toHaveBeenCalled();
	});
});
