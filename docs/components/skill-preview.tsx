import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { skillMarkdown, skillName, skillSourceUrl } from '@/lib/skill-config';
import { CopyButton } from './copy-button';

export async function SkillPreview() {
  // Prepared from skills/raavl-integrate/SKILL.md before dev, typecheck, and build.
  const markdown = await readFile(join(process.cwd(), 'public', 'skill.md'), 'utf8');
  return <div className="not-prose skill-preview">
    <div className="skill-preview-heading"><code>{skillName}/SKILL.md</code><CopyButton text={markdown} label="Copy skill" /></div>
    <details><summary>Read the full skill instructions</summary><pre tabIndex={0}><code>{markdown}</code></pre></details>
    <div className="skill-preview-links"><a href={skillMarkdown}>Read raw Markdown ↗</a><a href={skillMarkdown} download="SKILL.md">Download SKILL.md</a><a href={skillSourceUrl}>View source on GitHub ↗</a></div>
  </div>;
}
