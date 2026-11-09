import assert from 'node:assert/strict';
import { access, readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { prepareSkills, skillFiles } from './prepare-skills.mjs';
import { skillName, skillInstallCommand } from '../lib/skill-config.ts';
import { publicUrl } from '../lib/site-config.mjs';

const root = new URL('../out/', import.meta.url);
const content = new URL('../content/docs/', import.meta.url);
const pages = (await readdir(content)).filter(file => file.endsWith('.mdx'));
const full = await readFile(new URL('llms-full.txt', root), 'utf8');
const index = await readFile(new URL('llms.txt', root), 'utf8');

async function exists(path) {
  try { await access(new URL(path, root)); return true; } catch { return false; }
}

for (const file of pages) {
  const slug = file === 'index.mdx' ? '' : file.slice(0, -4);
  const htmlPath = slug ? `docs/${slug}.html` : 'docs.html';
  const markdownPath = join('markdown', slug, 'content.md');
  assert(await exists(htmlPath), `Missing HTML: ${htmlPath}`);
  const markdown = await readFile(new URL(markdownPath, root), 'utf8');
  const html = await readFile(new URL(htmlPath, root), 'utf8');
  const pageUrl = publicUrl(slug ? `/docs/${slug}` : '/docs');
  assert(html.includes(`rel="canonical" href="${pageUrl}"`), `Missing canonical URL: ${htmlPath}`);
  for (const text of [html, markdown]) {
    assert(!/127\.0\.0\.1|localhost|private local|not currently published|absolute\/path\/to/.test(text), `Development-only content in ${htmlPath}`);
  }
  assert(markdown.startsWith('# '), `Missing Markdown title: ${markdownPath}`);
  assert(markdown.length > 300, `Unexpected empty Markdown: ${markdownPath}`);
  assert(full.includes(markdown), `Full text omits ${markdownPath}`);
  assert(index.includes(`/${markdownPath}`), `Index omits ${markdownPath}`);

  // Every internal content link must point to something actually exported.
  const mdx = await readFile(new URL(file, content), 'utf8');
  for (const [, href] of mdx.matchAll(/\]\((\/[^\s)]*)\)/g)) {
    const path = href.split(/[?#]/)[0].slice(1);
    assert(await exists(path || 'index.html') || await exists(`${path}.html`), `Broken link in ${file}: ${href}`);
  }
}

const search = JSON.parse(await readFile(new URL('api/search', root), 'utf8'));
assert(search.type, 'Static search index is missing its database type');
for (const file of ['demo-a.wav', 'demo-b.wav', 'demo-a.json', 'demo-b.json']) {
  await access(new URL(file, root));
}
const examples = await readFile(new URL('examples.html', root), 'utf8');
const { scenes } = await import('../../examples/live/routes.ts');
for (const [id, , title] of scenes) {
  assert(examples.includes(`#demos/${id}/vanilla`), `Missing playground link: ${id}`);
  assert(examples.includes(title.replaceAll('&', '&amp;')), `Missing playground: ${title}`);
}
assert(examples.includes('href="/docs"'), 'Examples must link to the canonical documentation');
assert(!examples.includes('#docs/start'), 'Examples must not expose a second documentation UI');
const home = await readFile(new URL('index.html', root), 'utf8');
assert(home.includes('Prompt for your coding agent'), 'Missing agent CTA');
assert(home.includes('Recording waveform'), 'Missing live player');
assert(!await exists('PRODUCT.md'), 'Internal product reference must not be a public asset');
assert(!await exists('ANNOTATIONS.md'), 'Internal Markdown must not be a public asset');
await prepareSkills({ check: true });
const skillDirectory = new URL(`../../skills/${skillName}/`, import.meta.url);
const canonicalSkill = await readFile(new URL('SKILL.md', skillDirectory), 'utf8');
assert.equal(await readFile(new URL('skill.md', root), 'utf8'), canonicalSkill);
for (const file of skillFiles) {
  assert.equal(
    await readFile(new URL(`skills/${skillName}/${file}`, root), 'utf8'),
    await readFile(new URL(file, skillDirectory), 'utf8'),
  );
}
const skillsPage = await readFile(new URL('docs/skills.html', root), 'utf8');
assert(skillsPage.includes(skillInstallCommand('codex')), 'Missing skill install command');
assert(skillsPage.includes('Read the full skill instructions'), 'Missing generated skill preview');
assert(skillsPage.includes('href="/skill.md"'), 'Missing skill download');
assert(home.includes('/skill.md'), 'Hero prompt must reference the published skill');
assert(index.includes('/skill.md'), 'LLM index must advertise the integration skill');
assert(await exists('docs/agents.html'), 'Missing legacy agent-guide alias');
assert.equal(
  await readFile(new URL('markdown/agents/content.md', root), 'utf8'),
  await readFile(new URL('markdown/skills/content.md', root), 'utf8'),
);
console.log(`Verified ${pages.length} docs pages, ${scenes.length} playgrounds, skill/metadata parity, legacy aliases, shared assets, Markdown/index parity, links, and search.`);
