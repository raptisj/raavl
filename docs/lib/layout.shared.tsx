import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { AudioLines } from 'lucide-react';

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: <span className="raavl-brand"><AudioLines size={24} aria-hidden="true" /> raavl</span>,
    },
    links: [
      { text: 'Documentation', url: '/docs', active: 'nested-url' },
      { text: 'Examples', url: '/examples', active: 'nested-url' },
      { text: 'Skills', url: '/docs/skills', active: 'nested-url' },
    ],
    githubUrl: 'https://github.com/raptisj/raavl',
    themeSwitch: { enabled: true, mode: 'light-dark-system' },
  };
}
