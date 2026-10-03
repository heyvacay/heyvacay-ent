import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

function Base({ children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      {children}
    </svg>
  );
}

export const Check = (p: IconProps) => (
  <Base {...p}>
    <path d="M20 6 9 17l-5-5" />
  </Base>
);

export const ArrowRight = (p: IconProps) => (
  <Base {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Base>
);

export const Plane = (p: IconProps) => (
  <Base {...p}>
    <path d="M10.5 13.5 3 11l1-2 8 1 4.5-5c.8-.8 2.2-.9 3 0 .8.8.7 2.1 0 3l-5 4.5 1 8-2 1-2.5-7.5-3 3L6 19l-1.5-.5L4.5 17z" />
  </Base>
);

export const Receipt = (p: IconProps) => (
  <Base {...p}>
    <path d="M5 3v18l2-1 2 1 2-1 2 1 2-1 2 1V3l-2 1-2-1-2 1-2-1-2 1z" />
    <path d="M8.5 8h7M8.5 12h7M8.5 16h4" />
  </Base>
);

export const Users = (p: IconProps) => (
  <Base {...p}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
    <path d="M16 5.5a3 3 0 0 1 0 5.5M17 20a5.5 5.5 0 0 0-3-5" />
  </Base>
);

export const Gift = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 11h16v9H4z" />
    <path d="M3 7h18v4H3zM12 7v13" />
    <path d="M12 7S10.5 3.5 8.5 4s-.5 3 3.5 3M12 7s1.5-3.5 3.5-3 .5 3-3.5 3" />
  </Base>
);

export const ChartBar = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 20V4M4 20h16" />
    <path d="M8 20v-6M12.5 20V9M17 20v-9" />
  </Base>
);

export const Shield = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 3 5 6v5c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6z" />
    <path d="m9 12 2 2 4-4" />
  </Base>
);

export const Globe = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18" />
  </Base>
);

export const Calendar = (p: IconProps) => (
  <Base {...p}>
    <rect x="3.5" y="5" width="17" height="16" rx="2.5" />
    <path d="M3.5 9.5h17M8 3v4M16 3v4" />
  </Base>
);

export const Wallet = (p: IconProps) => (
  <Base {...p}>
    <rect x="3" y="6" width="18" height="13" rx="2.5" />
    <path d="M3 10h18M16.5 14h.01" />
    <path d="M17 6V4.5a1.5 1.5 0 0 0-1.9-1.45L5 5.5" />
  </Base>
);

export const MapPin = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11z" />
    <circle cx="12" cy="10" r="2.5" />
  </Base>
);

export const Leaf = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 20C4 10 11 4 20 4c0 9-6 16-16 16z" />
    <path d="M4 20c4-6 8-9 13-11" />
  </Base>
);

export const Sparkles = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 3l1.8 4.5L18 9l-4.2 1.5L12 15l-1.8-4.5L6 9l4.2-1.5z" />
    <path d="M18 14l.9 2.3L21 17l-2.1.7L18 20l-.9-2.3L15 17l2.1-.7z" />
  </Base>
);

export const Building = (p: IconProps) => (
  <Base {...p}>
    <path d="M5 21V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v16" />
    <path d="M16 10h2a2 2 0 0 1 2 2v9M3 21h18" />
    <path d="M8.5 7h3M8.5 11h3M8.5 15h3" />
  </Base>
);

export const Bell = (p: IconProps) => (
  <Base {...p}>
    <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6z" />
    <path d="M10 19a2 2 0 0 0 4 0" />
  </Base>
);

export const Lock = (p: IconProps) => (
  <Base {...p}>
    <rect x="4.5" y="10" width="15" height="10" rx="2.5" />
    <path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v2" />
  </Base>
);

export const Route = (p: IconProps) => (
  <Base {...p}>
    <circle cx="6" cy="18" r="2.5" />
    <circle cx="18" cy="6" r="2.5" />
    <path d="M8.5 18H14a4 4 0 0 0 0-8H9a4 4 0 0 1 0-8h1.5" />
  </Base>
);
