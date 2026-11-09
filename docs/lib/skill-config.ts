import { publicUrl } from './site-config.mjs';

export const skillName = 'raavl-integrate';
export const skillRepository = 'raptisj/raavl';
export const skillPage = '/docs/skills';
export const skillMarkdown = '/skill.md';
export const skillSourceUrl = `https://github.com/${skillRepository}/tree/main/skills/${skillName}`;

export const skillAgents = [
  { name: 'Codex', id: 'codex', directory: '.agents/skills/' },
  { name: 'Cursor', id: 'cursor', directory: '.agents/skills/' },
  { name: 'Claude Code', id: 'claude-code', directory: '.claude/skills/' },
] as const;

export function skillInstallCommand(agent: typeof skillAgents[number]['id']) {
  return `npx skills add ${skillRepository} --skill ${skillName} --agent ${agent}`;
}

export function integrationPrompt() {
  return `Add a raavl audio waveform player to this app. Read ${publicUrl(skillMarkdown)} and follow its integration workflow. Use ${publicUrl('/llms.txt')} to find the relevant API documentation. Match this app's framework, preserve its existing styles, and verify playback, accessible seeking, errors, and resource cleanup.`;
}

// Existing copied prompts and bookmarks keep resolving to the maintained page.
export function canonicalDocSlugs(slugs?: string[]) {
  return slugs?.length === 1 && slugs[0] === 'agents' ? ['skills'] : slugs;
}
