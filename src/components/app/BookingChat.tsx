'use client';

import { useState } from 'react';
import { useStore } from '@/lib/store';
import { cn } from './ui';

/**
 * 1:1 chat between a traveler and the approving manager, anchored to a booking.
 * `role` is the current viewer's side — their own messages align right.
 */
export function BookingChat({
  bookingId,
  role,
}: {
  bookingId: string;
  role: 'traveler' | 'manager';
}) {
  const { state, activeUser, sendChat } = useStore();
  const b = state.bookings.find((x) => x.id === bookingId);
  const [text, setText] = useState('');
  if (!b) return null;

  const chat = b.chat ?? [];
  const send = () => {
    if (!text.trim()) return;
    sendChat(bookingId, {
      authorId: activeUser.id,
      author: activeUser.name,
      role,
      text: text.trim(),
    });
    setText('');
  };

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200">
      <div className="border-b border-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">
        Chat with {role === 'manager' ? 'the traveler' : 'your manager'}
      </div>
      <div className="max-h-56 space-y-2 overflow-auto p-3">
        {chat.length === 0 ? (
          <p className="text-xs text-slate-400">No messages yet — say hello.</p>
        ) : (
          chat.map((m) => {
            const mine = m.role === role;
            return (
              <div key={m.id} className={cn('flex', mine && 'justify-end')}>
                <div
                  className={cn(
                    'max-w-[80%] rounded-2xl px-3 py-1.5 text-sm',
                    mine ? 'bg-brand text-navy-deep' : 'bg-slate-100 text-slate-700'
                  )}
                >
                  {!mine && (
                    <p className="text-[11px] font-semibold text-slate-500">{m.author}</p>
                  )}
                  {m.text}
                </div>
              </div>
            );
          })
        )}
      </div>
      <div className="flex gap-2 border-t border-slate-100 p-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="Message…"
          className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
        />
        <button
          onClick={send}
          className="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-navy-deep hover:brightness-95"
        >
          Send
        </button>
      </div>
    </div>
  );
}
