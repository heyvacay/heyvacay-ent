import { Suspense } from 'react';
import HotelDetail from './HotelDetail';

export default async function HotelDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense
      fallback={
        <div className="grid place-items-center py-24 text-slate-400">
          <span className="h-7 w-7 animate-spin rounded-full border-2 border-slate-300 border-t-brand" />
        </div>
      }
    >
      <HotelDetail hid={id} />
    </Suspense>
  );
}
