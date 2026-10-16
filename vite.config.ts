import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// Tauri expects a fixed port and its own console output, so Vite must not clear it.
export default defineConfig({
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: { ignored: ['**/src-tauri/**', '**/target/**'] },
  },
  envPrefix: ['VITE_', 'TAURI_ENV_'],
  build: {
    target: 'chrome120',
    outDir: 'dist',
    rollupOptions: {
      // One HTML page per Tauri window.
      input: {
        island: resolve(import.meta.dirname, 'island.html'),
        park: resolve(import.meta.dirname, 'park.html'),
      },
    },
  },
});
