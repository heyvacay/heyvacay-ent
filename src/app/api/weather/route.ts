import { NextResponse } from 'next/server';
import { WEATHER } from '@/lib/config.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CONDITIONS = [
  { label: 'Clear', emoji: '☀️' },
  { label: 'Partly cloudy', emoji: '⛅' },
  { label: 'Cloudy', emoji: '☁️' },
  { label: 'Light rain', emoji: '🌦️' },
  { label: 'Rain', emoji: '🌧️' },
];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h >>> 0);
}

/** Current weather for a place. OpenWeather when keyed, else a stable mock. */
export async function POST(req: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    /* empty ok */
  }
  const q = String(body.q || '').trim();
  if (!q) return NextResponse.json({ error: 'q required' }, { status: 400 });

  if (WEATHER.live) {
    try {
      const url = `${WEATHER.base}/weather?q=${encodeURIComponent(q)}&units=imperial&appid=${WEATHER.apiKey}`;
      const res = await fetch(url, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data?.main) {
          return NextResponse.json({
            tempF: Math.round(data.main.temp),
            label: data.weather?.[0]?.main ?? 'Clear',
            emoji: '🌡️',
            source: 'openweather',
          });
        }
      }
    } catch {
      /* fall through */
    }
  }

  const h = hash(q + new Date().toISOString().slice(0, 10));
  const cond = CONDITIONS[h % CONDITIONS.length];
  const tempF = 52 + (h % 38); // 52–89°F, stable per place per day
  return NextResponse.json({
    tempF,
    label: cond.label,
    emoji: cond.emoji,
    source: WEATHER.live ? 'openweather_fallback' : 'mock',
  });
}
