# Retro SFX Maker — Development Backlog

> Stack: SvelteKit · TypeScript · Vite · Vitest · Tone.js · Tailwind CSS v4 · Netlify

---

## Task 1 — Project Scaffold & Configuration

**Goal:** Bootstrap the SvelteKit project with all dependencies, tooling, and base configuration in place. Nothing should be built yet — this task is purely infrastructure.

### Steps

1. Run `npx sv create retro-sfx-maker` — choose SvelteKit, TypeScript, Vitest, ESLint, Prettier
2. Install dependencies:
   ```
   npm install tone audiobuffer-to-wav lamejs ogg-opus-encoder
   npm install -D tailwindcss @tailwindcss/vite
   ```
3. Configure Tailwind v4 — add the `@tailwindcss/vite` plugin to `vite.config.ts`, import `tailwindcss` in `app.css`
4. Add Press Start 2P from Google Fonts in `app.html` via a `<link>` tag
5. Configure Vitest in `vite.config.ts` — set `environment: 'jsdom'`, add a `test` alias for `$lib`
6. Set up `netlify.toml` at the root:
   ```toml
   [build]
     command = "npm run build"
     publish = "build"
   ```
   Do **not** add a `[[redirects]]` block — `@sveltejs/adapter-netlify` generates its own `_redirects` file and Netlify function handlers. A manual SPA redirect rule conflicts with the adapter's server-side routing.
7. Install `@sveltejs/adapter-netlify` and configure it in `svelte.config.js`
8. Add `.env.example` and `.gitignore` entries for `.env`, `node_modules`, `.svelte-kit`
9. Verify `npm run dev`, `npm run build`, and `npm run test` all pass with the default scaffold

### Unit Tests

- None at this stage — verify tooling works with the auto-generated scaffold test if present

---

## Task 2 — BitCrusher AudioWorklet

**Goal:** Implement a custom `AudioWorkletProcessor` that performs bit-depth quantization and sample-rate reduction. This is the only audio primitive not provided by Tone.js and must be built and tested in isolation first.

### Steps

1. Create `src/worklets/BitCrusherProcessor.js` — this must be plain JS (no TypeScript), as worklets run in a separate global scope:
   ```js
   class BitCrusherProcessor extends AudioWorkletProcessor {
   	static get parameterDescriptors() {
   		return [
   			{ name: 'bitDepth', defaultValue: 16, minValue: 1, maxValue: 16 },
   			{ name: 'sampleRateReduction', defaultValue: 1, minValue: 1, maxValue: 32 }
   		];
   	}
   	constructor() {
   		super();
   		this._phase = 0;
   		this._lastSample = 0;
   	}
   	process(inputs, outputs, parameters) {
   		/* quantize + hold */
   	}
   }
   registerProcessor('bit-crusher', BitCrusherProcessor);
   ```
2. Implement `process()`:
   - **Quantization**: `steps = 2 ** (bitDepth - 1)`, `out = Math.round(sample * steps) / steps`
     — Use `bitDepth - 1` because audio samples are signed values in `[-1, 1]`. For 16-bit this gives 32768 steps (correct for signed 16-bit PCM); `2 ** bitDepth` would double the resolution and misstate the bit depth.
   - **Sample rate reduction**: increment `_phase` each sample; only resample when `_phase >= sampleRateReduction`, else hold `_lastSample`
3. Create `src/lib/audio/BitCrusherNode.ts` — a Tone.js-compatible wrapper:
   - Extends `ToneAudioNode`
   - **Use a static async factory** — constructors are synchronous but `addAudioWorkletModule` returns a `Promise`. Calling it in the constructor fires-and-forgets, then immediately tries to instantiate the `AudioWorkletNode` before the processor is registered, throwing `DOMException: 'bit-crusher' is not defined`:
     ```ts
     static async create(context: ToneAudioContext): Promise<BitCrusherNode> {
       // Bypass Tone.js wrapper to avoid single-module bug in Tone.js 15.x (issue #1326)
       await context.rawContext.audioWorklet.addModule(workletUrl);
       return new BitCrusherNode(context);
     }
     ```
   - The private constructor runs synchronously after the module is registered
   - Exposes `.bitDepth` and `.sampleRateReduction` as `ToneAudioParam` proxies
4. Register the worklet URL via Vite's `?url` import: `import workletUrl from '../../worklets/BitCrusherProcessor.js?url'`
5. Add `?worker` / `?url` to Vite config if needed so the worklet file is served correctly
   > **Note — Tone.js 15.x bug**: `Tone.context.addAudioWorkletModule()` re-loads the first module URL on every subsequent call (issue #1326). Always call `context.rawContext.audioWorklet.addModule(url)` directly to avoid this. Pin the Tone.js version in `package.json` and re-test if upgrading.

### Unit Tests (`src/lib/audio/BitCrusher.test.ts`)

Extract the quantization logic into a pure helper function `quantize(sample, bitDepth, phase, sampleRateReduction)` so it can be imported and tested directly without a Web Audio context.

- Given 16-bit depth, `steps = 32768` — verify `quantize(0.7, 16, ...)` equals `Math.round(0.7 * 32768) / 32768` (≈ 0.70001)
- Given 8-bit depth, `steps = 128` — verify `quantize(0.5, 8, ...)` equals `Math.round(0.5 * 128) / 128 = 0.5`
- Given `sampleRateReduction = 4`, verify the same output sample is held for frames 1–3 and a new sample is taken on frame 4
- Given `sampleRateReduction = 1`, verify each frame gets a fresh sample (no holding)
- Given 1-bit depth (`steps = 1`), verify `quantize(0.3, 1, ...)` returns `0.0` and `quantize(0.7, 1, ...)` returns `1.0` — not just `{-1, 1}` as mid-tread rounding produces 0 for near-zero inputs

---

## Task 3 — Audio Engine & Signal Chain

**Goal:** Wire the complete Tone.js signal chain from oscillator to output, expose a clean imperative API (`play`, `stop`, `updateParam`), and integrate the `BitCrusherNode` from Task 2.

### Steps

1. Create `src/lib/audio/engine.ts` — initialize Tone.js context on first user interaction (required by browsers):
   ```ts
   export async function initAudio() {
   	await Tone.start();
   }
   ```
2. Create `src/lib/audio/synthesizer.ts` — build the signal chain:
   ```
   Tone.Synth / Tone.NoiseSynth
     → BitCrusherNode        (async — use BitCrusherNode.create())
     → Tone.Vibrato
     → Tone.Chorus           (flanger — NOT Tone.FeedbackDelay, which has no LFO modulation)
     → Tone.Filter (LPF)
     → Tone.Filter (HPF)
     → Tone.Waveform         (for oscilloscope — use Tone.Waveform, not Tone.Analyser)
     → Tone.Destination
   ```
   `Tone.Chorus` with feedback > 0 produces flanger-type effects. Its `frequency`, `depth`, `feedback`, and `wet` properties map directly to `flangerRate`, `flangerDepth`, `flangerFeedback`, `flangerWet` in `SynthParams`. `Tone.Waveform` is Tone.js's dedicated class for time-domain display; its `getValue()` always returns a single `Float32Array`.
3. Expose a `SynthesizerAPI` interface:
   - `play(note?: string): void` — if arpeggio is active, starts `Tone.Transport` and `Tone.Pattern`; if not, calls `synth.triggerAttack(note ?? 'C4')`. When waveform is `'noise'`, note is ignored and `noiseSynth.triggerAttack()` is called.
   - `stop(): void` — releases the envelope **and** stops `Tone.Transport`, `Tone.Pattern`, and `Tone.Loop` if running. Must be safe to call before `play()`.
   - `updateParams(params: Partial<SynthParams>): void` — applies param delta to running nodes
   - `getWaveformData(): Float32Array` — returns current waveform buffer from `Tone.Waveform`
4. Handle waveform switching — `Tone.Synth` supports `square`, `sawtooth`, `sine`; switch to `Tone.NoiseSynth` when noise is selected. **Switching requires disposing the old node and re-wiring the chain** — these are entirely different classes, not a property change:
   ```ts
   currentSynth.disconnect();
   currentSynth.dispose();
   currentSynth = waveform === 'noise' ? new Tone.NoiseSynth() : new Tone.Synth();
   currentSynth.connect(bitCrusherNode);
   ```
5. Wire arpeggio using `Tone.Pattern` on `Tone.Transport` — pattern type driven by `arpPattern` param. Arpeggio and retrigger are **mutually exclusive**: enabling one must disable the other. Do not run both simultaneously on the same synth.
6. Wire retrigger using `Tone.Loop` on `Tone.Transport`. Start the Transport only when arpeggio or retrigger is active.
7. Duty cycle (pulse width): **first** set `oscillator.type = 'pulse'`, **then** set `oscillator.width`. Accessing `oscillator.width` when the type is not `'pulse'` throws at runtime. Guard all duty-cycle writes:
   ```ts
   if (params.waveform === 'square') {
   	synth.oscillator.type = 'pulse';
   	synth.oscillator.width.value = params.dutyCycle;
   }
   ```
8. Dispose all nodes on synthesizer teardown (component unmount, HMR): call `.dispose()` on synth, BitCrusherNode, Vibrato, Chorus, both Filters, Waveform, Pattern, and Loop.

### Unit Tests (`src/lib/audio/synthesizer.test.ts`)

Mock Tone.js nodes entirely — do not instantiate real audio nodes in jsdom. Verify behaviour through the mock call records.

- `updateParams({ waveform: 'noise' })` disposes the current synth and creates a `NoiseSynth`
- `updateParams({ waveform: 'sine' })` after noise disposes `NoiseSynth` and creates a `Synth`
- `updateParams({ dutyCycle: 0.3 })` when waveform is not `'square'` does **not** attempt to write `oscillator.width` (no throw)
- Arpeggio pattern `'up'` generates notes in ascending order
- Arpeggio pattern `'down'` generates notes in descending order
- `stop()` called before `play()` does not throw
- `stop()` stops the Transport and Pattern if they are running
- `updateParams` with out-of-range frequency is clamped, not passed raw to Tone.js

---

## Task 4 — State Stores & SynthParams Type

**Goal:** Define the canonical `SynthParams` type and build Svelte 5 rune-based reactive stores for synth state and localStorage-backed preset management.

### Steps

1. Create `src/lib/types/SynthParams.ts` — define the full parameter type:

   ```ts
   export type Waveform = 'square' | 'sawtooth' | 'sine' | 'noise';
   export type ArpPattern = 'up' | 'down' | 'random';

   export interface SynthParams {
   	// Oscillator
   	waveform: Waveform;
   	frequency: number; // 20–2000 Hz
   	detune: number; // -100–100 cents
   	// Envelope
   	attack: number; // 0.001–2 s
   	decay: number; // 0.001–2 s
   	sustain: number; // 0–1
   	release: number; // 0.001–5 s
   	// Duty cycle
   	dutyCycle: number; // 0–1 (pulse width)
   	// Vibrato
   	vibratoRate: number; // 0–20 Hz
   	vibratoDepth: number; // 0–1
   	// Arpeggio
   	arpSpeed: number; // 0–20 Hz
   	arpSteps: number[]; // semitone offsets e.g. [0, 4, 7]
   	arpPattern: ArpPattern;
   	// Flanger
   	flangerRate: number; // 0–20 Hz
   	flangerDepth: number; // 0–1
   	flangerFeedback: number; // 0–0.95
   	flangerWet: number; // 0–1
   	// Filters
   	lpfCutoff: number; // 20–20000 Hz
   	lpfResonance: number; // 0.1–20
   	hpfCutoff: number; // 20–20000 Hz
   	hpfResonance: number; // 0.1–20
   	// Bit crusher
   	bitDepth: number; // 1–16
   	sampleRateReduction: number; // 1–32
   	// Retrigger
   	retriggerRate: number; // 0–20 Hz
   	retriggerCount: number; // 0–16
   }
   ```

2. Define `DEFAULT_PARAMS: SynthParams` with sensible starting values (audible clean tone)
3. Create `src/lib/stores/synthParams.svelte.ts`:
   - Use Svelte 5 `$state` rune for reactive params object: `export const params = $state<SynthParams>({ ...DEFAULT_PARAMS })`
   - Export `updateParam(key, value)` — validates range before applying
   - Export `resetParams()` — **must use `Object.assign(params, DEFAULT_PARAMS)`**, not `params = DEFAULT_PARAMS`. Exported `$state` bindings cannot be reassigned from outside the module; only property mutation preserves reactivity. Same applies to `setParams()` used by preset loading.
4. Create `src/lib/stores/presets.svelte.ts`:
   - `Preset` type: `{ id: string, name: string, params: SynthParams, createdAt: number }`
   - Load from `localStorage` on module init
   - `savePreset(name: string, params: SynthParams): Preset`
   - `loadPreset(id: string): SynthParams` — caller must apply via `Object.assign(params, loaded)` in the store, not reassignment
   - `deletePreset(id: string): void`
   - `renamePreset(id: string, name: string): void`
   - Persist to `localStorage` on every mutation (JSON.stringify)

### Unit Tests

- **`synthParams.test.ts`**: `updateParam('frequency', -1)` clamps to `20`, not `-1`
- **`synthParams.test.ts`**: `updateParam('frequency', 99999)` clamps to `2000`
- **`synthParams.test.ts`**: `resetParams()` restores all values to `DEFAULT_PARAMS`
- **`presets.test.ts`**: `savePreset` → `loadPreset` round-trip returns identical params — use `expect(loaded).toEqual(saved)` (deep equality), not `toBe`, because `arpSteps` is an array
- **`presets.test.ts`**: `deletePreset` removes the preset and persists the deletion
- **`presets.test.ts`**: Saving with a duplicate name is allowed (names are not unique keys)
- **`presets.test.ts`**: Corrupt `localStorage` value is gracefully ignored (returns empty array)

---

## Task 5 — Core UI Components

**Goal:** Build the reusable pixel art styled UI primitives that all sections of the dashboard will use.

### Steps

1. **`PixelSlider.svelte`** — wraps `<input type="range">` with pixel art styling:
   - Props: `label`, `min`, `max`, `step`, `value`, `unit` (optional suffix like "Hz")
   - Emits `change` event with new value
   - Displays current value as a pixel-font readout below the track
   - CSS: custom `appearance: none` track + thumb using `box-shadow` pixel borders
2. **`PixelToggle.svelte`** — pixel art radio button group:
   - Props: `options: { value, label }[]`, `selected`
   - Used for waveform picker and arpeggio pattern picker
   - Selected state renders as a filled/inverted pixel button
3. **`Oscilloscope.svelte`** — live canvas waveform:
   - Props: `waveform: Tone.Waveform` (use `Tone.Waveform`, not `Tone.Analyser` — `Waveform` always returns a single `Float32Array` with no channel-ambiguity; `Analyser.getValue()` returns `Float32Array | Float32Array[]` depending on channel count)
   - Uses `requestAnimationFrame` loop calling `waveform.getValue()` → draw to canvas
   - Guard against null canvas context: `const ctx = canvas.getContext('2d'); if (!ctx) return`
   - Handle pre-interaction state: when the AudioContext hasn't started yet, `getValue()` returns an all-zero array — render a flat line, do not throw
   - Canvas style: cyan (`#00e5ff`) trace, `#0a0a1a` background, pixel-dot grid lines
   - Use Svelte 5 `$effect` for the RAF loop — the cleanup return cancels the latest frame ID:
     ```ts
     $effect(() => {
     	let frameId: number;
     	const loop = () => {
     		draw();
     		frameId = requestAnimationFrame(loop);
     	};
     	frameId = requestAnimationFrame(loop);
     	return () => cancelAnimationFrame(frameId);
     });
     ```
4. **`SectionCard.svelte`** — layout wrapper for each param group:
   - Renders a pixel-border card with a header label (e.g. "ENVELOPE", "FILTERS")
   - Used to visually group related sliders
5. Apply global retro styles in `app.css`:
   - CSS variables for the color palette
   - `font-family: 'Press Start 2P'` on `body`
   - Scrollbar styling, selection color
   - `image-rendering: pixelated` utility class

### Unit Tests

Install `jest-canvas-mock` (or `vitest-canvas-mock`) and import it in the Vitest setup file — jsdom returns `null` for `canvas.getContext('2d')`, which will throw on any drawing call without a mock.

- **`PixelSlider.test.ts`**: Renders with correct `min`, `max`, `value` attributes on the input
- **`PixelSlider.test.ts`**: Emits `change` event with correct numeric value on input
- **`PixelToggle.test.ts`**: Clicking an option emits `change` with the correct value
- **`PixelToggle.test.ts`**: Selected option has the active CSS class applied
- **`Oscilloscope.test.ts`**: Component mounts without error when given a mock `Tone.Waveform` that returns a zeroed `Float32Array` from `getValue()`

---

## Task 6 — Dashboard Layout

**Goal:** Assemble the `Dashboard.svelte` main page — lay out all parameter groups using `SectionCard` and `PixelSlider` components, wired to the synth state store and audio engine.

### Steps

1. Create `src/lib/components/Dashboard.svelte` — two-column layout:
   - **Left column**: parameter sections (Oscillator, Envelope, Duty Cycle, Vibrato, Arpeggio, Flanger, LPF, HPF, Bit Crusher, Retrigger)
   - **Right column**: Oscilloscope, Play/Stop button, Preset panel, Randomizer panel, Export panel
2. **Do not call `initAudio()` on mount** — browsers require AudioContext creation to happen inside a user gesture handler. Calling it on mount creates a suspended context with no way to resume it. Instead, instantiate the `Synthesizer` lazily on the first Play button click.
3. Wire each `PixelSlider` `change` event to `updateParam()` from the store, then call `synthesizer.updateParams()`
4. Wire waveform `PixelToggle` to switch oscillator type
5. Duty cycle slider: show/hide with a Svelte `{#if params.waveform === 'square'}` block
6. Play button:
   - Click → `Tone.start()` must be the **first** call inside the handler with no preceding `await` — yielding before `Tone.start()` breaks the gesture chain in Safari iOS and leaves the AudioContext suspended → then `await synthesizer.init()` (first time only) → `synthesizer.play()`
   - Space bar shortcut → same behavior, but **guard against focus inside form inputs**: `if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return`
   - Visual: large pixel-art button, changes label to "■ STOP" while playing
7. Add a header bar: app title "SFX MAKER" in large Press Start 2P, version, GitHub link
8. Mount `Dashboard` in `src/routes/+page.svelte`

### Unit Tests

- No pure logic to unit test here — this is integration/layout. Manual verification sufficient.
- If using Svelte Testing Library: assert Play button renders, assert clicking it doesn't throw.

---

## Task 7 — Preset System

**Goal:** Build the `PresetPanel` component with full CRUD UI, wired to the `presets` store from Task 4.

### Steps

1. Create `src/lib/components/PresetPanel.svelte`:
   - Scrollable list of saved presets (pixel art list items)
   - Each row: preset name + **Load** button + **Delete** button (red)
   - Input field + **Save** button at the top — saves current params with entered name
   - Double-click on name → inline rename (contenteditable or input swap)
2. **Load flow**: `loadPreset(id)` returns `SynthParams` → call `setParams()` on store → call `synthesizer.updateParams()`
3. **Save flow**: read current params from store → call `savePreset(name, params)` → list updates reactively
4. **Delete flow**: confirm with a pixel art `window.confirm`-style inline modal (not browser native)
5. Empty state: show "NO PRESETS SAVED" in dim pixel text when list is empty
6. Add 5–8 built-in factory presets (hardcoded `SynthParams` snapshots) seeded on first run — e.g. "8BIT LASER", "JUMP", "COIN", "EXPLODE", "POWER UP". **Do not check "if localStorage is empty"** — if the user deletes all their presets, the factory set would re-appear on next visit. Instead, use a separate key to track seeding:
   ```ts
   if (!localStorage.getItem('sfx_initialized')) {
   	FACTORY_PRESETS.forEach((p) => savePreset(p.name, p.params));
   	localStorage.setItem('sfx_initialized', '1');
   }
   ```

### Unit Tests

- Tests for store logic are covered in Task 4
- **`PresetPanel.test.ts`**: Saving a preset adds it to the rendered list
- **`PresetPanel.test.ts`**: Deleting a preset removes it from the rendered list
- **`PresetPanel.test.ts`**: Loading a preset fires the correct store update

---

## Task 8 — Randomizer

**Goal:** Implement per-category random preset generation. Each category produces a `SynthParams` object with values biased toward that sound type.

### Steps

1. Create `src/lib/audio/randomizer.ts`:
   - Export `randomize(category: SoundCategory): SynthParams`
   - Categories: `'shoot' | 'jump' | 'explosion' | 'powerup' | 'coin' | 'hit' | 'blip'`
   - Each category defines a `ParamRange` map — per-param `{ min, max }` overrides on top of defaults
2. Example biases:
   - **shoot**: high freq (800–2000Hz), fast attack (0.001s), fast decay (0.05–0.15s), low sustain, square/saw
   - **explosion**: noise waveform, slow attack, long decay (0.3–1s), HPF low, LPF low, high bit crush
   - **coin**: high freq, very fast attack+decay, sine/square, arpeggio up, short release
   - **jump**: high detune (random static offset in ±50–100 cents for a pitch-shifted feel), medium attack, sawtooth, slight vibrato — note: `detune` is a fixed offset, not an automated sweep; a true frequency sweep would require signal automation not present in `SynthParams`
   - **powerup**: ascending arpeggio, square wave, increasing frequency
   - **hit**: noise burst, very fast attack, fast decay, no sustain
   - **blip**: sine, short attack, very short decay, high freq
3. Helper `randomBetween(min, max): number` and `randomChoice<T>(arr: T[]): T`
4. Create `src/lib/components/RandomizerPanel.svelte`:
   - Row of pixel-art buttons, one per category
   - On click: `params = randomize(category)` → update store → `synthesizer.updateParams(params)` → auto-play once

### Unit Tests (`src/lib/audio/randomizer.test.ts`)

- For each category: output `frequency` is within the defined range
- For each category: all output values satisfy the global `SynthParams` type constraints (no NaN, no out-of-range)
- `randomBetween(5, 10)` never returns a value outside `[5, 10]` (run 1000 iterations)
- `randomize('explosion')` always returns `waveform: 'noise'`
- `randomize('coin')` always returns `arpPattern: 'up'` (if that is hardcoded for the category)

---

## Task 9 — Export Pipeline

**Goal:** Render the current synth state to an audio buffer via `OfflineAudioContext` and encode it to WAV, MP3, and OGG for download.

### Steps

1. Create `src/lib/audio/exporter.ts`:
   - `renderToBuffer(params: SynthParams, durationSeconds: number): Promise<AudioBuffer>`
     - Reconstruct the full signal chain in an `OfflineAudioContext` (same topology as Task 3)
     - **Re-register the BitCrusher worklet on the offline context** — module registration does not carry over from the live context: `await offlineCtx.audioWorklet.addModule(bitCrusherUrl)`
     - Apply all `params` to the offline nodes
     - **Explicitly trigger the note at time 0**: call `synth.triggerAttackRelease('C4', durationSeconds * 0.8, 0)` — without this, `startRendering()` returns silence
     - Note: Transport-driven arpeggio and retrigger patterns do not transfer to the offline context; export always renders a single triggered note regardless of arpeggio state
     - Call `offlineCtx.startRendering()` and return the resulting `AudioBuffer`
     - Wrap in try/catch — `audioWorklet.addModule` can fail in Safari on `OfflineAudioContext`; surface a user-friendly error rather than hanging
2. `exportWAV(buffer: AudioBuffer): Blob`
   - `audiobuffer-to-wav` returns an `ArrayBuffer`, **not a `Blob`** — wrap it:
     ```ts
     const arrayBuffer = audioBufferToWav(buffer);
     return new Blob([arrayBuffer], { type: 'audio/wav' });
     ```
3. `exportMP3(buffer: AudioBuffer): Promise<Blob>`
   - Extract PCM data: `buffer.getChannelData(0)` returns `Float32Array` in `[-1, 1]`
   - **Convert to `Int16Array`** before passing to lamejs — it expects `Int16Array` in `[-32768, 32767]`:
     ```ts
     const float32 = buffer.getChannelData(0);
     const int16 = new Int16Array(float32.length);
     for (let i = 0; i < float32.length; i++) {
     	int16[i] = Math.max(-32768, Math.min(32767, float32[i] * 32768));
     }
     ```
   - Encode via `lamejs` `Mp3Encoder`, return `Blob` with type `audio/mpeg`
4. `exportOGG(buffer: AudioBuffer): Promise<Blob>`
   - Lazy-import `ogg-opus-encoder` (WASM — do not load until needed)
   - **Configure Vite to handle the WASM asset**: add `vite-plugin-wasm` to `vite.config.ts`, or import the `.wasm` file via `?url` and pass the URL to the encoder's init function. Without this, the WASM fetch will 404 in production.
   - Encode and return `Blob` with type `audio/ogg`
5. `downloadBlob(blob: Blob, filename: string): void` — utility using `URL.createObjectURL` + `<a>` click
6. Create `src/lib/components/ExportPanel.svelte`:
   - Duration selector (0.5s / 1s / 2s / 4s)
   - Format selector: WAV / MP3 / OGG (pixel toggle)
   - Large "EXPORT" button — shows pixel spinner while rendering
   - On complete: trigger download, show "DOWNLOADED!" flash message

### Unit Tests (`src/lib/audio/exporter.test.ts`)

Mock `OfflineAudioContext` and the BitCrusher worklet registration — jsdom does not implement these. Use `standardized-audio-context-mock` or write a manual mock.

- WAV `ArrayBuffer` (before Blob wrapping) starts with `RIFF` magic bytes — read via `new DataView(arrayBuffer).getUint32(0, false) === 0x52494646`
- WAV `ArrayBuffer` has the correct sample rate written at byte offset 24 (little-endian `uint32`)
- `renderToBuffer` with `durationSeconds: 1` returns a buffer with `sampleRate * 1` frames (mock the offline context to verify)
- `downloadBlob` creates and clicks an anchor element (mock `document.createElement`)
- `exportMP3` calls the encoder with `Int16Array` data, not `Float32Array` (verify via mock)

---

## Task 10 — Visual Polish & UX

**Goal:** Finalize the pixel art aesthetic, add micro-interactions, keyboard shortcuts, and make the UI feel complete.

### Steps

1. **Color pass** — enforce the palette consistently across all components:
   - Background: `#0a0a1a`, Surface: `#111128`, Accent: `#00e5ff`, Yellow: `#ffe600`, Red: `#ff3c3c`
2. **Pixel borders** — apply 2px hard-shadow `box-shadow` to all cards, buttons, and inputs for the NES panel look
3. **Button press animation** — `transform: translateY(2px)` + shadow reduction on `:active`
4. **Slider value flash** — when a value changes, briefly highlight the readout in yellow (`#ffe600`) for 200ms
5. **Oscilloscope CRT effect** — add a subtle scanline overlay (CSS repeating gradient) on the oscilloscope canvas wrapper
6. **Keyboard shortcuts**:
   All global shortcuts must guard against firing when focus is inside an editable element:
   ```ts
   if (
   	e.target instanceof HTMLInputElement ||
   	e.target instanceof HTMLTextAreaElement ||
   	(e.target as HTMLElement).isContentEditable
   )
   	return;
   ```

   - `Space` → Play / Stop (with input focus guard above)
   - `R` → Randomize (re-roll last category)
   - `S` → Focus the preset name input (ready to save) — do **not** use `Ctrl+S`; browsers may show "Save Page As" regardless of `preventDefault()`
   - `Escape` → Reset params to defaults — do **not** use `Ctrl+Z`; it conflicts with the browser's native undo in text inputs and cannot be reliably intercepted on all platforms
7. **Responsive layout** — at < 900px, collapse to single column with sections in accordions
8. **Page title + favicon** — set `<title>SFX MAKER</title>` and a pixel art favicon (16×16 SVG)
9. **Loading state** — show a pixel art boot screen ("LOADING AUDIO ENGINE...") before `initAudio()` resolves

### Unit Tests

- No logic tests — validate shortcuts manually or with integration tests if time permits

---

## Task 11 — Test Suite Completion

**Goal:** Ensure all unit tests from previous tasks are written, passing, and achieving meaningful coverage on the pure logic modules.

### Steps

1. Set up test infrastructure in `vitest.setup.ts`:
   - Import `jest-canvas-mock` (or equivalent) to prevent `canvas.getContext('2d')` returning `null` in jsdom
   - Set up Tone.js node mocks (manual mock at `src/__mocks__/tone.ts`) so no real `AudioContext` is created in unit tests
   - Reference the setup file in `vite.config.ts`: `setupFiles: ['./vitest.setup.ts']`
2. Run `npm run test -- --coverage` and review coverage report
3. Identify any untested branches in:
   - `randomizer.ts` (all 7 categories hit)
   - `exporter.ts` (WAV header correctness, `Float32Array → Int16Array` conversion)
   - `presets.svelte.ts` (edge cases: empty store, corrupt JSON)
   - `synthesizer.ts` (waveform switching with dispose, duty cycle guard, Transport stop on `stop()`)
   - `BitCrusherProcessor.js` pure quantization logic
4. Fill gaps — write missing tests, no coverage targets, just meaningful cases
5. Add a `test:watch` script to `package.json` for development comfort
6. Ensure all tests pass in CI (Netlify build will run `npm run test` before `npm run build`)
7. Update the Netlify build command:
   ```toml
   command = "npm run test && npm run build"
   ```

### Completion Criteria

- `npm run test` exits 0
- `npm run build` exits 0
- No TypeScript errors (`npm run check`)

---

## Task 12 — Netlify Deployment

**Goal:** Configure and ship the app to Netlify with a working production URL.

### Steps

1. Push project to a GitHub repository
2. Log in to Netlify → "Add new site" → "Import from Git" → select the repo
3. Netlify auto-detects SvelteKit — confirm build settings:
   - Build command: `npm run test && npm run build`
   - Publish directory: `build` (set by `@sveltejs/adapter-netlify` — not `.svelte-kit/output/client`)
4. Verify `@sveltejs/adapter-netlify` is configured in `svelte.config.js`
5. Check that `netlify.toml` is committed at the repo root
6. Trigger first deploy — verify the live URL works end-to-end:
   - Audio plays in Chrome and Firefox
   - Export downloads a valid WAV file
   - Presets persist across page refreshes
7. Set up a custom domain if desired (Netlify DNS or external CNAME)
8. Enable Netlify's "Deploy Previews" for all PRs in site settings

### Checklist

- [ ] Site live at `*.netlify.app`
- [ ] `npm run test` runs in CI before build
- [ ] WAV export works in production
- [ ] OGG WASM loads correctly from CDN/static assets
- [ ] No console errors in production build
