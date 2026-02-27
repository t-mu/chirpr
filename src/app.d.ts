// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}

	abstract class AudioWorkletProcessor {
		constructor(options?: AudioWorkletNodeOptions);
		readonly port: MessagePort;
		process(
			inputs: Float32Array[][],
			outputs: Float32Array[][],
			parameters: Record<string, Float32Array>
		): boolean;
	}

	function registerProcessor(
		name: string,
		processorCtor: new (options?: AudioWorkletNodeOptions) => AudioWorkletProcessor
	): void;
}

export {};
