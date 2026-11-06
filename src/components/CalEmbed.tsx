'use client';

import { useEffect } from 'react';

/**
 * Cal.com element-click embed. Initializes the "demo" booking namespace once on
 * mount; after that, any element carrying the data-cal-* attributes (see
 * DEMO_CAL in the marketing page) opens the booking popup on click instead of
 * navigating. Brand color matches HeyVacay's cyan.
 */
export function CalEmbed() {
  useEffect(() => {
    /* eslint-disable @typescript-eslint/no-explicit-any, prefer-rest-params, @typescript-eslint/no-unused-expressions */
    (function (C: any, A: string, L: string) {
      const p = function (a: any, ar: any) {
        a.q.push(ar);
      };
      const d = C.document;
      C.Cal =
        C.Cal ||
        function () {
          const cal = C.Cal;
          // eslint-disable-next-line prefer-rest-params
          const ar = arguments as any;
          if (!cal.loaded) {
            cal.ns = {};
            cal.q = cal.q || [];
            d.head.appendChild(d.createElement('script')).src = A;
            cal.loaded = true;
          }
          if (ar[0] === L) {
            const api = function () {
              // eslint-disable-next-line prefer-rest-params
              p(api, arguments);
            };
            const namespace = ar[1];
            (api as any).q = (api as any).q || [];
            if (typeof namespace === 'string') {
              cal.ns[namespace] = cal.ns[namespace] || api;
              p(cal.ns[namespace], ar);
              p(cal, ['initNamespace', namespace]);
            } else p(cal, ar);
            return;
          }
          p(cal, ar);
        };
    })(window, 'https://app.cal.com/embed/embed.js', 'init');

    const Cal = (window as any).Cal;
    Cal('init', 'demo', { origin: 'https://app.cal.com' });
    Cal.config = Cal.config || {};
    Cal.config.forwardQueryParams = true;
    Cal.ns.demo('ui', {
      cssVarsPerTheme: { light: { 'cal-brand': '#23E3EF' } },
      hideEventTypeDetails: false,
      layout: 'month_view',
    });
    /* eslint-enable @typescript-eslint/no-explicit-any, prefer-rest-params, @typescript-eslint/no-unused-expressions */
  }, []);

  return null;
}
