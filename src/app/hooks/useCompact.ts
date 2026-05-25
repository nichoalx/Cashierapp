import { useMemo } from 'react';

/** Returns true on screens narrower than 380px (e.g. Samsung A50 at 360px). */
export function useCompact(): boolean {
  return useMemo(() => typeof window !== 'undefined' && window.innerWidth < 380, []);
}
