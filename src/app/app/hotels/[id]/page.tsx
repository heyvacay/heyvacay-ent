import { Suspense } from 'react';
import HotelDetail from './HotelDetail';
import { HvLoader } from '@/components/HvLoader';

export default async function HotelDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense fallback={<HvLoader />}>
      <HotelDetail hid={id} />
    </Suspense>
  );
}
