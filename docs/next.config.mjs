import { createMDX } from 'fumadocs-mdx/next';
import { fileURLToPath } from 'node:url';

const withMDX = createMDX();

export default withMDX({
  output: 'export',
  images: { unoptimized: true },
  reactStrictMode: true,
  turbopack: {
    // The playground uses the actual library, without requiring an npm release.
    root: fileURLToPath(new URL('../', import.meta.url)),
    resolveAlias: {
      react: { browser: './docs/node_modules/react' },
      'react-dom': { browser: './docs/node_modules/react-dom' },
    },
  },
});
