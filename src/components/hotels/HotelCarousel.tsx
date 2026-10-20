'use client';

import { useCallback, useEffect, useState } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Building } from '@/components/icons';

/** Swipeable hotel image carousel with arrows + dots and a branded fallback. */
export function HotelCarousel({
  images,
  alt,
  className = 'h-52 w-full',
  rounded = '',
  startIndex = 0,
}: {
  images: string[];
  alt: string;
  className?: string;
  rounded?: string;
  startIndex?: number;
}) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false, startIndex });
  const [selected, setSelected] = useState(0);
  const [failed, setFailed] = useState<Record<number, boolean>>({});

  const onSelect = useCallback(() => {
    if (emblaApi) setSelected(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.on('select', onSelect);
    onSelect();
    return () => {
      emblaApi.off('select', onSelect);
    };
  }, [emblaApi, onSelect]);

  const usable = images.filter(Boolean);
  if (usable.length === 0) {
    return (
      <div
        className={`relative ${className} ${rounded} grid place-items-center bg-gradient-to-br from-slate-200 to-brand/25 text-slate-400`}
      >
        <Building className="h-8 w-8" />
      </div>
    );
  }

  const scroll = (dir: -1 | 1) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (dir === -1) emblaApi?.scrollPrev();
    else emblaApi?.scrollNext();
  };

  return (
    <div className={`group/car relative overflow-hidden ${className} ${rounded}`}>
      <div className="h-full overflow-hidden" ref={emblaRef}>
        <div className="flex h-full">
          {usable.map((src, i) => (
            <div key={i} className="relative h-full min-w-0 flex-[0_0_100%]">
              {failed[i] ? (
                <div className="grid h-full w-full place-items-center bg-gradient-to-br from-slate-200 to-brand/25 text-slate-400">
                  <Building className="h-8 w-8" />
                </div>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={src}
                  alt={alt}
                  loading={i === 0 ? 'eager' : 'lazy'}
                  onError={() => setFailed((f) => ({ ...f, [i]: true }))}
                  className="h-full w-full object-cover"
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {usable.length > 1 && (
        <>
          <button
            type="button"
            aria-label="Previous photo"
            onClick={scroll(-1)}
            className="absolute left-2 top-1/2 hidden -translate-y-1/2 rounded-full bg-white/90 p-1 text-slate-700 shadow-sm transition hover:bg-white group-hover/car:block"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Next photo"
            onClick={scroll(1)}
            className="absolute right-2 top-1/2 hidden -translate-y-1/2 rounded-full bg-white/90 p-1 text-slate-700 shadow-sm transition hover:bg-white group-hover/car:block"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center gap-1">
            {usable.slice(0, 8).map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === selected ? 'w-4 bg-white' : 'w-1.5 bg-white/60'
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
