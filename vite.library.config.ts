import { defineConfig } from 'vite'
export default defineConfig({
  build: {
    outDir: 'dist/library',
    lib: { entry: { index: 'src/index.ts', core: 'src/core/index.ts', dom: 'src/dom/index.ts', react: 'src/react/index.tsx', regions: 'src/regions/index.ts' }, formats: ['es'] },
    rollupOptions: { external: ['react', 'react/jsx-runtime', 'react-dom'] },
  },
})
