import { loader } from 'fumadocs-core/source';
import { defineDocs } from 'fumadocs-mdx/macro';
import { publicUrl } from './site-config.mjs';

const docs = defineDocs({
  dir: 'content/docs',
  docs: { postprocess: { includeProcessedMarkdown: true } },
});

export const source = loader({
  baseUrl: '/docs',
  source: docs.toFumadocsSource(),
});

export function markdownUrl(slugs: string[]) {
  return `/markdown/${[...slugs, 'content.md'].join('/')}`;
}

export async function pageMarkdown(page: ReturnType<typeof source.getPages>[number]) {
  const body = (await page.data.getText('processed')).replace(
    /\]\((\/(?!\/)[^\s)]*)\)/g,
    (_match: string, path: string) => `](${publicUrl(path)})`,
  );
  return `# ${page.data.title}\n\n${page.data.description ?? ''}\n\n${body}`;
}
