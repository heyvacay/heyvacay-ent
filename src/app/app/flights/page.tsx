import { Suspense } from 'react';
import FlightsResults from './FlightsResults';

export default function FlightsResultsPage() {
  return (
    <Suspense
      fallback={
        <div className="grid place-items-center py-24 text-slate-400">
          <span className="h-7 w-7 animate-spin rounded-full border-2 border-slate-300 border-t-brand" />
        </div>
      }
    >
      <FlightsResults />
    </Suspense>
  );
}
