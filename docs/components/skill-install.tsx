'use client';

import { Tab, Tabs } from 'fumadocs-ui/components/tabs';
import { skillAgents, skillInstallCommand, skillName } from '@/lib/skill-config';
import { CopyButton } from './copy-button';

export function SkillInstall() {
  return <div className="not-prose skill-install">
    <Tabs items={skillAgents.map(agent => agent.name)}>
      {skillAgents.map(agent => {
        const command = skillInstallCommand(agent.id);
        return <Tab key={agent.id} value={agent.name}>
          <div className="skill-command-heading"><span>Run in your application</span><CopyButton text={command} label="Copy install command" /></div>
          <pre tabIndex={0} aria-label={`${agent.name} skill installation command`}><code>{command}</code></pre>
          <p>Installs into <code>{agent.directory}{skillName}/</code> in your project.</p>
        </Tab>;
      })}
    </Tabs>
  </div>;
}
