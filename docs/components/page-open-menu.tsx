'use client';

import { ChevronDown, ExternalLink, Text } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from 'fumadocs-ui/components/ui/popover';
import { buttonVariants } from 'fumadocs-ui/components/ui/button';
import { PageActionBrandIcon } from './page-action-brand-icon';

export function PageOpenMenu({ markdownUrl, githubUrl, pageUrl }: {
  markdownUrl: string;
  githubUrl: string;
  pageUrl: string;
}) {
  const prompt = `Read ${pageUrl}, I want to ask questions about it.`;
  const items = [
    { title: 'Open in GitHub', href: githubUrl, icon: <PageActionBrandIcon brand="github" /> },
    { title: 'View as Markdown', href: markdownUrl, icon: <Text aria-hidden="true" /> },
    {
      title: 'Open in ChatGPT',
      href: `https://chatgpt.com/?${new URLSearchParams({ prompt, hints: 'search' })}`,
      icon: <PageActionBrandIcon brand="chatgpt" />,
    },
    {
      title: 'Open in Claude',
      href: `https://claude.ai/new?${new URLSearchParams({ q: prompt })}`,
      icon: <PageActionBrandIcon brand="claude" />,
    },
    {
      title: 'Open in Cursor',
      href: `https://cursor.com/link/prompt?${new URLSearchParams({ text: prompt })}`,
      icon: <PageActionBrandIcon brand="cursor" />,
    },
  ];

  return <Popover>
    <PopoverTrigger className={buttonVariants({
      variant: 'secondary',
      size: 'sm',
      className: 'gap-2 data-[state=open]:bg-fd-accent data-[state=open]:text-fd-accent-foreground',
    })}>
      Open <ChevronDown className="size-3.5 text-fd-muted-foreground" aria-hidden="true" />
    </PopoverTrigger>
    <PopoverContent className="flex flex-col">
      {items.map(item => <a
        key={item.title}
        href={item.href}
        target="_blank"
        rel="noreferrer noopener"
        className="text-sm p-2 rounded-lg inline-flex items-center gap-2 hover:text-fd-accent-foreground hover:bg-fd-accent [&_svg]:size-4"
      >
        {item.icon}{item.title}
        <ExternalLink className="text-fd-muted-foreground size-3.5 ms-auto" aria-hidden="true" />
      </a>)}
    </PopoverContent>
  </Popover>;
}
