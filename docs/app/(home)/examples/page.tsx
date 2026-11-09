import type { Metadata } from 'next';
import { Examples } from '../../../../examples/live/Examples';

export const metadata: Metadata = {
  title: 'Examples',
  alternates: { canonical: '/examples' },
  description: 'Ten interactive raavl playgrounds with JavaScript and React code, themes, annotations, a SoundCloud-style player, and optional modules.',
};

export default function ExamplesPage() {
  return <Examples />;
}
