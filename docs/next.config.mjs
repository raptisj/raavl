import { createMDX } from 'fumadocs-mdx/next';
import { fileURLToPath } from 'node:url';

const withMDX = createMDX();
const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));

export default withMDX({
  output: 'export',
  agentRules: false,
  images: { unoptimized: true },
  reactStrictMode: true,
  // The library build replaces dist between starts. Avoid persisting stale
  // "module not found" entries for that generated tree across dev sessions.
  experimental: { turbopackFileSystemCacheForDev: false },
  // Shared examples and the built library live outside the docs application.
  turbopack: { root: repositoryRoot },
  outputFileTracingRoot: repositoryRoot,
});
