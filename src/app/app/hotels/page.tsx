import { Suspense } from 'react';
import HotelsResults from './HotelsResults';
import { HvLoader } from '@/components/HvLoader';

export default function HotelsResultsPage() {
  return (
    <Suspense fallback={<HvLoader />}>
      <HotelsResults />
    </Suspense>
  );
}
