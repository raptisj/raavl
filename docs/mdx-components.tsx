import defaultComponents from 'fumadocs-ui/mdx';
import { Tab, Tabs } from 'fumadocs-ui/components/tabs';
import type { MDXComponents } from 'mdx/types';
import { AgentPrompt } from '@/components/agent-prompt';
import { SkillInstall } from '@/components/skill-install';
import { SkillPreview } from '@/components/skill-preview';
import { OwnershipPreview } from '../examples/live/OwnershipPreview';

export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return { ...defaultComponents, Tab, Tabs, AgentPrompt, SkillInstall, SkillPreview, OwnershipPreview, ...components };
}

export const useMDXComponents = getMDXComponents;
