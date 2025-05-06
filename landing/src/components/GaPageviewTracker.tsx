'use client';

import { Suspense } from 'react';
import useGaPageview from '@/hooks/useGaPageview';

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