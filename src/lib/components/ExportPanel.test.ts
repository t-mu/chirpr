import { fireEvent, render } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ExportPanel from './ExportPanel.svelte';

const { renderToBuffer, exportWAV, exportMP3, exportOGG, downloadBlob } = vi.hoisted(() => ({
	renderToBuffer: vi.fn(async () => ({}) as AudioBuffer),
	exportWAV: vi.fn(() => new Blob(['wav'], { type: 'audio/wav' })),
	exportMP3: vi.fn(async () => new Blob(['mp3'], { type: 'audio/mpeg' })),
	exportOGG: vi.fn(async () => new Blob(['ogg'], { type: 'audio/ogg' })),
	downloadBlob: vi.fn()
}));

vi.mock('$lib/audio/exporter', () => ({
	renderToBuffer,
	exportWAV,
	exportMP3,
	exportOGG,
	downloadBlob
}));

afterEach(() => {
	document.body.innerHTML = '';
	renderToBuffer.mockReset();
	exportWAV.mockReset();
	exportMP3.mockReset();
	exportOGG.mockReset();
	downloadBlob.mockReset();
	vi.useRealTimers();
});

describe('ExportPanel', () => {
	it('exports selected format and triggers download', async () => {
		const { getByLabelText, getByRole, findByText } = render(ExportPanel);
		const durationSelect = getByLabelText('Duration') as HTMLSelectElement;
		const formatSelect = getByLabelText('Format') as HTMLSelectElement;

		await fireEvent.change(durationSelect, { target: { value: '2' } });
		await fireEvent.change(formatSelect, { target: { value: 'mp3' } });
		await fireEvent.click(getByRole('button', { name: 'EXPORT' }));

		expect(renderToBuffer).toHaveBeenCalledWith(expect.anything(), 2);
		expect(exportMP3).toHaveBeenCalledTimes(1);
		expect(downloadBlob).toHaveBeenCalledWith(expect.any(Blob), 'sfx.mp3');
		expect(await findByText('DOWNLOADED!')).toBeTruthy();
	});

	it('shows failure flash message when rendering fails', async () => {
		renderToBuffer.mockRejectedValueOnce(new Error('offline render failed'));
		const { getByRole, findByText } = render(ExportPanel);

		await fireEvent.click(getByRole('button', { name: 'EXPORT' }));

		expect(downloadBlob).not.toHaveBeenCalled();
		expect(await findByText('EXPORT FAILED')).toBeTruthy();
	});
});
