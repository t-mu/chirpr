import tailwindcss from '@tailwindcss/vite';
import { playwright } from '@vitest/browser-playwright';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	optimizeDeps: {
		include: ['tone', 'audiobuffer-to-wav', 'lamejs', 'wasm-media-encoders']
	},
	test: {
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'client',
					browser: {
						enabled: true,
						provider: playwright(),
						instances: [{ browser: 'chromium', headless: true }]
					},
					include: ['src/lib/components/**/*.test.ts']
				}
			},
			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'jsdom',
					setupFiles: ['./vitest.setup.ts'],
					alias: {
						test: '$lib'
					},
					include: ['src/**/*.test.ts'],
					exclude: ['src/lib/components/**/*.test.ts']
				}
			}
		]
	}
});
