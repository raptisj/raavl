import { Sparkles } from 'lucide-react';
import { CopyButton } from './copy-button';
import { integrationPrompt, skillPage } from '@/lib/skill-config';

export function AgentPrompt() {
  const prompt = integrationPrompt();
  return <div className="agent-prompt">
    <div className="prompt-heading"><span><Sparkles size={15} aria-hidden="true" /> Prompt for your coding agent</span><span className="prompt-agents">Codex · Claude Code · Cursor</span></div>
    <p>{prompt}</p>
    <div className="prompt-footer"><a href={skillPage}>Explore the integration skill ↗</a><CopyButton text={prompt} label="Copy prompt" /></div>
  </div>;
}
