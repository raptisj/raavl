import type { Metadata } from 'next';
import { ExamplesGallery } from '@/components/examples-gallery';

export const metadata: Metadata = {
  title: 'Examples',
  alternates: { canonical: '/examples' },
  description: 'Ten interactive raavl playgrounds with JavaScript and React code, themes, annotations, a SoundCloud-style player, and optional modules.',
};

export default function ExamplesPage() {
  return <ExamplesGallery />;
}
