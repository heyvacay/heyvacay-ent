import { Suspense } from 'react';
import EventDetail from './EventDetail';
import { HvLoader } from '@/components/HvLoader';

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense fallback={<HvLoader />}>
      <EventDetail id={id} />
    </Suspense>
  );
}
