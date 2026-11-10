'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';

export const playgroundModes = ['playback', 'regions'] as const;
export type PlaygroundMode = (typeof playgroundModes)[number];

const PlaygroundModeContext = createContext<{
  mode: PlaygroundMode;
  setMode: (mode: PlaygroundMode) => void;
} | null>(null);

export function PlaygroundModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<PlaygroundMode>('playback');
  return <PlaygroundModeContext.Provider value={{ mode, setMode }}>{children}</PlaygroundModeContext.Provider>;
}

export function usePlaygroundMode() {
  const context = useContext(PlaygroundModeContext);
  if (!context) throw new Error('Playground components require PlaygroundModeProvider');
  return context;
}
