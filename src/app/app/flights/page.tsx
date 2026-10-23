import { Suspense } from 'react';
import FlightsResults from './FlightsResults';
import { HvLoader } from '@/components/HvLoader';

export default function FlightsResultsPage() {
  return (
    <Suspense fallback={<HvLoader />}>
      <FlightsResults />
    </Suspense>
  );
}
