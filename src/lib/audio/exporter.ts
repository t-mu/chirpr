import audioBufferToWav from 'audiobuffer-to-wav';
import { Mp3Encoder } from 'lamejs';
import bitCrusherUrl from '../../worklets/BitCrusherProcessor.js?url';
import { sampleCurve } from './bezier';
import type { SynthParams } from '$lib/types/SynthParams';

const DEFAULT_SAMPLE_RATE = 44100;

function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}

function toInt16(input: Float32Array): Int16Array {
	const output = new Int16Array(input.length);
	for (let i = 0; i < input.length; i += 1) {
		output[i] = Math.max(-32768, Math.min(32767, Math.round(input[i] * 32768)));
	}
	return output;
}

function toArrayBuffer(chunk: Uint8Array): ArrayBuffer {
	const copy = new Uint8Array(chunk.byteLength);
	copy.set(chunk);
	return copy.buffer;
}

function applyEnvelope(gain: GainNode, params: SynthParams, durationSeconds: number): void {
	const attackEnd = Math.min(params.attack, durationSeconds * 0.5);
	const decayEnd = Math.min(attackEnd + params.decay, durationSeconds * 0.8);
	const releaseStart = Math.max(decayEnd, durationSeconds * 0.8);

	gain.gain.setValueAtTime(0, 0);
	gain.gain.linearRampToValueAtTime(1, attackEnd);
	gain.gain.linearRampToValueAtTime(clamp(params.sustain, 0, 1), decayEnd);
	gain.gain.setValueAtTime(clamp(params.sustain, 0, 1), releaseStart);
	gain.gain.linearRampToValueAtTime(0, durationSeconds);
}

function createNoiseBuffer(context: OfflineAudioContext, durationSeconds: number): AudioBuffer {
	const length = Math.max(1, Math.floor(context.sampleRate * durationSeconds));
	const buffer = context.createBuffer(1, length, context.sampleRate);
	const channel = buffer.getChannelData(0);
	for (let i = 0; i < channel.length; i += 1) {
		channel[i] = Math.random() * 2 - 1;
	}
	return buffer;
}

export async function renderToBuffer(
	params: SynthParams,
	durationSeconds: number
): Promise<AudioBuffer> {
	const sampleRate = DEFAULT_SAMPLE_RATE;
	const frameCount = Math.max(1, Math.floor(sampleRate * durationSeconds));
	const offlineCtx = new OfflineAudioContext(1, frameCount, sampleRate);

	let source: AudioNode;
	let stopSource: () => void = () => {};

	const envelopeGain = offlineCtx.createGain();
	envelopeGain.connect(offlineCtx.destination);

	const lpf = offlineCtx.createBiquadFilter();
	lpf.type = 'lowpass';
	lpf.frequency.value = clamp(params.lpfCutoff, 20, 20000);
	lpf.Q.value = clamp(params.lpfResonance, 0.1, 20);

	const hpf = offlineCtx.createBiquadFilter();
	hpf.type = 'highpass';
	hpf.frequency.value = clamp(params.hpfCutoff, 20, 20000);
	hpf.Q.value = clamp(params.hpfResonance, 0.1, 20);

	// Match the live synthesizer chain order: LPF first, then HPF.
	lpf.connect(hpf);
	hpf.connect(envelopeGain);

	let workletNode: AudioWorkletNode | null = null;
	try {
		if (!offlineCtx.audioWorklet) {
			throw new Error('Offline audio worklets are not supported in this browser.');
		}
		await offlineCtx.audioWorklet.addModule(bitCrusherUrl);
		workletNode = new AudioWorkletNode(offlineCtx, 'bit-crusher');
		workletNode.parameters.get('bitDepth')?.setValueAtTime(clamp(params.bitDepth, 1, 16), 0);
		workletNode.parameters
			.get('sampleRateReduction')
			?.setValueAtTime(clamp(params.sampleRateReduction, 1, 32), 0);
	} catch (error) {
		throw new Error(
			`Offline rendering failed to initialize BitCrusher worklet: ${error instanceof Error ? error.message : String(error)}`
		);
	}

	if (params.waveform === 'noise') {
		const noiseSource = offlineCtx.createBufferSource();
		noiseSource.buffer = createNoiseBuffer(offlineCtx, durationSeconds);
		noiseSource.loop = false;
		source = noiseSource;
		stopSource = () => noiseSource.stop(durationSeconds * 0.8);
	} else {
		const oscillator = offlineCtx.createOscillator();
		oscillator.type = params.waveform;
		oscillator.frequency.setValueAtTime(clamp(params.frequency, 20, 2000), 0);
		oscillator.detune.setValueAtTime(clamp(params.detune, -100, 100), 0);
		source = oscillator;
		stopSource = () => oscillator.stop(durationSeconds * 0.8);
	}

	const curves = params.curves ?? {};
	const sampleCount = 256;
	if (curves.frequency && params.waveform !== 'noise') {
		const samples = sampleCurve(curves.frequency, sampleCount);
		(source as OscillatorNode).frequency.setValueCurveAtTime(samples, 0, durationSeconds);
	}
	if (curves.lpfCutoff) {
		const samples = sampleCurve(curves.lpfCutoff, sampleCount);
		lpf.frequency.setValueCurveAtTime(samples, 0, durationSeconds);
	}
	if (curves.hpfCutoff) {
		const samples = sampleCurve(curves.hpfCutoff, sampleCount);
		hpf.frequency.setValueCurveAtTime(samples, 0, durationSeconds);
	}

	source.connect(workletNode);
	workletNode.connect(lpf);

	applyEnvelope(envelopeGain, params, durationSeconds);
	(source as OscillatorNode | AudioBufferSourceNode).start(0);
	stopSource();

	return offlineCtx.startRendering();
}

export function toWavArrayBuffer(buffer: AudioBuffer): ArrayBuffer {
	return audioBufferToWav(buffer);
}

export function exportWAV(buffer: AudioBuffer): Blob {
	const arrayBuffer = toWavArrayBuffer(buffer);
	return new Blob([arrayBuffer], { type: 'audio/wav' });
}

export async function exportMP3(buffer: AudioBuffer): Promise<Blob> {
	const sampleRate = buffer.sampleRate;
	const encoder = new Mp3Encoder(1, sampleRate, 128);
	const pcm = toInt16(buffer.getChannelData(0));
	const chunkSize = 1152;
	const chunks: ArrayBuffer[] = [];

	for (let i = 0; i < pcm.length; i += chunkSize) {
		const chunk = pcm.subarray(i, i + chunkSize);
		const encoded = encoder.encodeBuffer(chunk);
		if (encoded.length > 0) {
			chunks.push(toArrayBuffer(new Uint8Array(encoded)));
		}
	}

	const end = encoder.flush();
	if (end.length > 0) {
		chunks.push(toArrayBuffer(new Uint8Array(end)));
	}

	return new Blob(chunks, { type: 'audio/mpeg' });
}

export async function exportOGG(buffer: AudioBuffer): Promise<Blob> {
	const { createOggEncoder } = await import('wasm-media-encoders');
	const encoder = await createOggEncoder();
	encoder.configure({
		channels: 1,
		sampleRate: buffer.sampleRate,
		vbrQuality: 3
	});

	const float = buffer.getChannelData(0);
	const chunk = encoder.encode([float]);
	const final = encoder.finalize();
	return new Blob([toArrayBuffer(chunk), toArrayBuffer(final)], { type: 'audio/ogg' });
}

export function downloadBlob(blob: Blob, filename: string): void {
	const objectUrl = URL.createObjectURL(blob);
	const anchor = document.createElement('a');
	anchor.href = objectUrl;
	anchor.download = filename;
	anchor.click();
	URL.revokeObjectURL(objectUrl);
}
