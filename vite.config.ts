import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  root: 'examples',
  resolve: { alias: {
    'ravl/react': fileURLToPath(new URL('./src/react/index.tsx', import.meta.url)),
    'ravl/themes.json': fileURLToPath(new URL('./src/themes/presets.json', import.meta.url)),
    'ravl/themes': fileURLToPath(new URL('./src/themes/index.ts', import.meta.url)),
    'ravl/styles.css': fileURLToPath(new URL('./src/styles.css', import.meta.url)),
    'ravl': fileURLToPath(new URL('./src/index.ts', import.meta.url)),
  } },
  server: { host: '127.0.0.1', port: 4173, strictPort: true },
  build: { outDir: '../dist/examples', emptyOutDir: true },
})
