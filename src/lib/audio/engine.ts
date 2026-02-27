import * as Tone from 'tone';

let initPromise: Promise<void> | null = null;

export async function initAudio(): Promise<void> {
	if (!initPromise) {
		initPromise = Tone.start();
	}
	try {
		await initPromise;
	} catch (error) {
		initPromise = null;
		throw error;
	}
}
