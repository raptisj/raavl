import { createMDX } from 'fumadocs-mdx/next';
import { fileURLToPath } from 'node:url';

const withMDX = createMDX();
const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));

export default withMDX({
  output: 'export',
  agentRules: false,
  images: { unoptimized: true },
  reactStrictMode: true,
  // The live player imports the library source outside the docs application.
  turbopack: { root: repositoryRoot },
  outputFileTracingRoot: repositoryRoot,
});
