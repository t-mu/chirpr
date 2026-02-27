declare module 'audiobuffer-to-wav' {
	export default function audioBufferToWav(buffer: AudioBuffer): ArrayBuffer;
}

declare module 'lamejs' {
	export class Mp3Encoder {
		constructor(channels: number, sampleRate: number, kbps: number);
		encodeBuffer(left: Int16Array, right?: Int16Array): Int8Array;
		flush(): Int8Array;
	}
}
