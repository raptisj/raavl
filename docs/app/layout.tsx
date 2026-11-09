import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Provider } from '@/components/provider';
import { siteUrl } from '@/lib/site-config.mjs';
import './global.css';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  alternates: { canonical: '/' },
  title: { default: 'raavl', template: '%s · raavl' },
  description: 'A TypeScript audio waveform player for JavaScript and React. Your controls, your styles, one shared player.',
  icons: { icon: '/icon.svg' },
};

export default function Layout({ children }: { children: ReactNode }) {
  return <html lang="en" suppressHydrationWarning><body><Provider>{children}</Provider></body></html>;
}
