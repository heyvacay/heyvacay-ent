import { NextResponse, type NextRequest } from 'next/server';

/**
 * Host-based split between the customer app and Nova (the internal sales
 * console), so each has its own URL:
 *
 *   • nova.<env>.heyvacay.co  → Nova. The root path serves the sales console
 *     (/sales); /app stays reachable so a rep can "enter" a customer account
 *     and impersonate their workspace within this same origin.
 *   • ent.<env>.heyvacay.co   → the customer app. /sales is NOT served here —
 *     any hit is redirected to the Nova host — and the "Sales console (Nova)"
 *     sidebar link is hidden (see AppShell).
 *
 * Both hostnames point at the same deployment; this only decides what each
 * origin exposes. Local dev (localhost) keeps everything on one origin.
 */
export function middleware(req: NextRequest) {
  const host = (req.headers.get('host') || '').split(':')[0].toLowerCase();
  const { pathname, search } = req.nextUrl;

  const isLocal = host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local');
  const isNova = /^nova\./.test(host);

  if (isLocal) return NextResponse.next();

  // Nova host: land reps on the sales console instead of the marketing site.
  if (isNova) {
    if (pathname === '/') {
      return NextResponse.rewrite(new URL('/sales', req.url));
    }
    return NextResponse.next();
  }

  // Customer host: keep Nova off this URL. Send any /sales hit to the Nova host.
  if (pathname === '/sales' || pathname.startsWith('/sales/')) {
    const novaHost = host.includes('.') ? host.replace(/^[^.]+\./, 'nova.') : `nova.${host}`;
    return NextResponse.redirect(`https://${novaHost}${pathname}${search}`);
  }

  return NextResponse.next();
}

export const config = {
  // Run on pages only — skip API routes (OAuth callbacks, etc.), Next internals and static assets.
  matcher: ['/((?!api|_next/static|_next/image|assets|favicon.ico|robots.txt|sitemap.xml).*)'],
};
