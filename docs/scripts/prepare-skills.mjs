import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { skillName } from '../lib/skill-config.ts';

export const skillFiles = ['SKILL.md', 'agents/openai.yaml'];

export async function prepareSkills({
  sourceDirectory = fileURLToPath(new URL(`../../skills/${skillName}/`, import.meta.url)),
  publicDirectory = fileURLToPath(new URL('../public/', import.meta.url)),
  check = false,
} = {}) {
  const markdown = await readFile(join(sourceDirectory, 'SKILL.md'), 'utf8');
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(markdown)?.[1];
  assert(frontmatter, 'Skill must contain YAML frontmatter');
  assert(new RegExp(`^name: ${skillName}$`, 'm').test(frontmatter), 'Skill name must match the published directory');
  assert(/^description: .+$/m.test(frontmatter), 'Skill description is required');

  for (const file of skillFiles) {
    const expected = await readFile(join(sourceDirectory, file), 'utf8');
    const destinations = [join(publicDirectory, 'skills', skillName, file)];
    if (file === 'SKILL.md') destinations.push(join(publicDirectory, 'skill.md'));
    for (const destination of destinations) {
      if (check) {
        assert.equal(await readFile(destination, 'utf8'), expected, `Stale generated skill: ${destination}`);
      } else {
        await mkdir(dirname(destination), { recursive: true });
        await writeFile(destination, expected);
      }
    }
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const check = process.argv.includes('--check');
  await prepareSkills({ check });
  console.log(`${check ? 'Verified' : 'Prepared'} ${skillName}: /skill.md and /skills/${skillName}/`);
}
