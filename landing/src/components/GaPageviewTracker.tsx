'use client';

import { Suspense } from 'react';
import useGaPageview from '@/hooks/useGaPageview';

/**
 * Isolated client component whose only job is to call the GA page-view hook.
 * Wrapped in `<Suspense>` to satisfy the Next.js 15 rule for useSearchParams().
 */
export default function GaPageviewTracker() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}

function Inner() {
  useGaPageview();
  return null;
} 