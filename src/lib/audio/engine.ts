import * as Tone from 'tone';

export async function initAudio(): Promise<void> {
	await Tone.start();
}
