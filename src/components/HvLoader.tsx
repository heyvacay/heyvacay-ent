/**
 * The HeyVacay loading screen — the palm mark inside the signature cyan ring
 * spinner (ported from the consumer site). Use this in place of ad-hoc spinner
 * + text while something loads.
 */
export function HvLoader({
  label,
  fullScreen = false,
  className = 'py-20',
}: {
  label?: string;
  fullScreen?: boolean;
  className?: string;
}) {
  const wrap = fullScreen
    ? 'fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/70 backdrop-blur-sm'
    : `flex flex-col items-center justify-center ${className}`;
  return (
    <div className={wrap}>
      <div className="relative">
        <div className="pageloader" />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/assets/svg/heyvacay-logo-mini.svg"
            alt="Loading"
            width={56}
            height={56}
            className="w-14"
          />
        </div>
      </div>
      {label && <p className="mt-6 text-sm font-medium text-slate-500">{label}</p>}
    </div>
  );
}

export default HvLoader;
