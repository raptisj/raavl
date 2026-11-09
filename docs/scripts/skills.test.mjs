import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { prepareSkills, skillFiles } from './prepare-skills.mjs';
import { canonicalDocSlugs, integrationPrompt, skillAgents, skillInstallCommand, skillName } from '../lib/skill-config.ts';
import { publicUrl, siteUrl } from '../lib/site-config.mjs';

const original = fileURLToPath(new URL(`../../skills/${skillName}/`, import.meta.url));

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'raavl-skill-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const sourceDirectory = join(root, 'source');
  for (const file of skillFiles) {
    await mkdir(dirname(join(sourceDirectory, file)), { recursive: true });
    await writeFile(join(sourceDirectory, file), await readFile(join(original, file)));
  }
  return { sourceDirectory, publicDirectory: join(root, 'public') };
}

test('publishes identical skill downloads and optional metadata from one source', async t => {
  const options = await fixture(t);
  await writeFile(join(options.sourceDirectory, 'not-public.txt'), 'Internal authoring notes');
  await prepareSkills(options);
  await prepareSkills({ ...options, check: true });
  const canonical = await readFile(join(options.sourceDirectory, 'SKILL.md'), 'utf8');
  assert.equal(await readFile(join(options.publicDirectory, 'skill.md'), 'utf8'), canonical);
  for (const file of skillFiles) {
    assert.equal(
      await readFile(join(options.publicDirectory, 'skills', skillName, file), 'utf8'),
      await readFile(join(options.sourceDirectory, file), 'utf8'),
    );
  }
  assert.deepEqual((await readdir(join(options.publicDirectory, 'skills', skillName))).sort(), ['SKILL.md', 'agents']);
});

test('detects source drift and refreshes every published copy', async t => {
  const options = await fixture(t);
  await prepareSkills(options);
  const path = join(options.sourceDirectory, 'SKILL.md');
  const changed = `${await readFile(path, 'utf8')}\nAdditional integration guidance.\n`;
  await writeFile(path, changed);
  await assert.rejects(prepareSkills({ ...options, check: true }), /Stale generated skill/);
  await prepareSkills(options);
  await prepareSkills({ ...options, check: true });
  assert.equal(await readFile(join(options.publicDirectory, 'skill.md'), 'utf8'), changed);
});

test('rejects a skill whose discovery name does not match its directory', async t => {
  const options = await fixture(t);
  const path = join(options.sourceDirectory, 'SKILL.md');
  await writeFile(path, (await readFile(path, 'utf8')).replace(`name: ${skillName}`, 'name: another-skill'));
  await assert.rejects(prepareSkills(options), /Skill name must match/);
});

test('skill reference links point to the canonical docs in this repository', async () => {
  const markdown = await readFile(join(original, 'SKILL.md'), 'utf8');
  const links = [...markdown.matchAll(/https:\/\/github\.com\/raptisj\/ravl\/blob\/main\/(docs\/content\/docs\/[^)\s]+)/g)];
  assert(links.length > 0);
  for (const [, path] of links) await readFile(new URL(`../../${path}`, import.meta.url));
  const metadata = await readFile(join(original, 'agents/openai.yaml'), 'utf8');
  assert(metadata.includes(`$${skillName}`), 'Codex prompt must explicitly invoke the shared skill');
});

test('public URLs and copied prompts use the canonical HTTPS domain', () => {
  assert.equal(new URL(siteUrl).protocol, 'https:');
  assert.equal(publicUrl('/docs/quickstart'), `${siteUrl}/docs/quickstart`);
  assert.equal(publicUrl('/examples#demos/styling/react'), `${siteUrl}/examples#demos/styling/react`);
  const urls = [...integrationPrompt().matchAll(/https?:\/\/[^\s]+/g)].map(match => new URL(match[0]));
  assert.deepEqual(urls.map(url => url.origin), [siteUrl, siteUrl]);
  assert.deepEqual(urls.map(url => url.pathname), ['/skill.md', '/llms.txt']);
});

test('agent installation choices select one shared skill in the consuming project', () => {
  assert.deepEqual(skillAgents.map(agent => agent.id), ['codex', 'cursor', 'claude-code']);
  for (const agent of skillAgents) {
    const command = skillInstallCommand(agent.id);
    assert(command.includes(`--skill ${skillName}`));
    assert(command.endsWith(`--agent ${agent.id}`));
    assert(!command.includes('--global'), 'Default installation must stay project-scoped');
  }
});

test('legacy guide aliases resolve to the canonical Skills page without changing other slugs', () => {
  assert.deepEqual(canonicalDocSlugs(['agents']), ['skills']);
  assert.deepEqual(canonicalDocSlugs(['skills']), ['skills']);
  assert.equal(canonicalDocSlugs(undefined), undefined);
  assert.deepEqual(canonicalDocSlugs(['agents', 'unknown']), ['agents', 'unknown']);
});
