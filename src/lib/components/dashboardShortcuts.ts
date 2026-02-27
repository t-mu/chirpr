import type { SoundCategory } from '$lib/audio/randomizer';

interface ShortcutHandlers {
	togglePlay: () => void;
	applyRandomCategory: (category: SoundCategory) => void;
	getLastRandomCategory: () => SoundCategory;
	focusPresetInput: () => void;
	resetAllParams: () => void;
}

function isEditableTarget(target: EventTarget | null): boolean {
	if (!(target instanceof HTMLElement)) return false;
	return (
		target instanceof HTMLInputElement ||
		target instanceof HTMLTextAreaElement ||
		target.isContentEditable
	);
}

export function createDashboardKeydownHandler(handlers: ShortcutHandlers) {
	return (event: KeyboardEvent): void => {
		if (isEditableTarget(event.target)) return;

		const key = event.key.toLowerCase();
		const isSpace = event.code === 'Space' || event.key === ' ';

		if (isSpace) {
			event.preventDefault();
			handlers.togglePlay();
			return;
		}

		if (event.code === 'KeyR' || key === 'r') {
			event.preventDefault();
			handlers.applyRandomCategory(handlers.getLastRandomCategory());
			return;
		}

		if (event.code === 'KeyS' || key === 's') {
			event.preventDefault();
			handlers.focusPresetInput();
			return;
		}

		if (event.code === 'Escape' || key === 'escape') {
			event.preventDefault();
			handlers.resetAllParams();
		}
	};
}
