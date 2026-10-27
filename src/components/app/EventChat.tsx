'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Avatar, Button, cn } from '@/components/app/ui';
import { REACTIONS, type EventMessage } from '@/lib/events';

function msgTime(ts: string): string {
  const d = new Date(ts);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

/**
 * Modern group chat for an event: avatars, grouped bubbles, reply-to quoting,
 * and emoji reactions that appear on hover.
 */
export function EventChat({
  messages,
  activeUserId,
  onSend,
  onReact,
}: {
  messages: EventMessage[];
  activeUserId: string;
  onSend: (text: string, replyTo?: string) => void;
  onReact: (messageId: string, emoji: string) => void;
}) {
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<EventMessage | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const byId = useMemo(() => {
    const m = new Map<string, EventMessage>();
    messages.forEach((x) => m.set(x.id, x));
    return m;
  }, [messages]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const send = () => {
    const t = text.trim();
    if (!t) return;
    onSend(t, replyTo?.id);
    setText('');
    setReplyTo(null);
  };

  return (
    <div className="flex h-[62vh] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div ref={scrollRef} className="flex-1 space-y-1 overflow-auto bg-slate-50 p-4">
        {messages.map((m, i) => {
          if (m.system) {
            return (
              <div key={m.id} className="my-2 flex justify-center">
                <span className="rounded-full bg-white px-3 py-1 text-center text-xs text-slate-500 ring-1 ring-slate-200">
                  {m.text}
                </span>
              </div>
            );
          }
          const mine = m.authorId === activeUserId;
          const prev = messages[i - 1];
          const grouped = prev && !prev.system && prev.authorId === m.authorId;
          const parent = m.replyTo ? byId.get(m.replyTo) : undefined;
          const reactions = Object.entries(m.reactions ?? {});
          return (
            <div
              key={m.id}
              className={cn('group flex items-end gap-2', mine && 'flex-row-reverse', grouped ? 'mt-0.5' : 'mt-3')}
            >
              {/* avatar (left for others, hidden when grouped) */}
              <div className={cn('w-7 shrink-0', mine && 'hidden')}>
                {!grouped && <Avatar name={m.author} size="sm" />}
              </div>

              <div className={cn('max-w-[78%]', mine ? 'items-end' : 'items-start', 'flex flex-col')}>
                {!grouped && (
                  <span className={cn('mb-0.5 px-1 text-xs font-semibold text-slate-500', mine && 'self-end')}>
                    {mine ? 'You' : m.author}
                  </span>
                )}

                <div className={cn('relative flex items-center gap-1.5', mine && 'flex-row-reverse')}>
                  <div
                    className={cn(
                      'rounded-2xl px-3 py-2 text-sm shadow-sm',
                      mine
                        ? 'rounded-br-md bg-brand text-navy-deep'
                        : 'rounded-bl-md bg-white text-slate-700 ring-1 ring-slate-200'
                    )}
                  >
                    {parent && (
                      <div
                        className={cn(
                          'mb-1 border-l-2 pl-2 text-xs',
                          mine ? 'border-navy-deep/40 text-navy-deep/70' : 'border-brand text-slate-400'
                        )}
                      >
                        <span className="font-semibold">
                          {parent.authorId === activeUserId ? 'You' : parent.author}
                        </span>
                        <span className="ml-1 line-clamp-1">{parent.text}</span>
                      </div>
                    )}
                    <p className="whitespace-pre-wrap break-words">{m.text}</p>
                    <span className={cn('mt-0.5 block text-[10px]', mine ? 'text-navy-deep/60' : 'text-slate-400')}>
                      {msgTime(m.ts)}
                    </span>
                  </div>

                  {/* hover actions: reactions + reply */}
                  <div className="flex items-center gap-0.5 rounded-full border border-slate-200 bg-white px-1 py-0.5 opacity-0 shadow-sm transition-opacity group-hover:opacity-100">
                    {REACTIONS.map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => onReact(m.id, emoji)}
                        className="rounded-full px-1 text-sm hover:bg-slate-100"
                        aria-label={`React ${emoji}`}
                      >
                        {emoji}
                      </button>
                    ))}
                    <button
                      onClick={() => setReplyTo(m)}
                      className="rounded-full px-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100"
                    >
                      Reply
                    </button>
                  </div>
                </div>

                {/* reaction chips */}
                {reactions.length > 0 && (
                  <div className={cn('mt-1 flex flex-wrap gap-1', mine && 'justify-end')}>
                    {reactions.map(([emoji, users]) => {
                      const mineReacted = users.includes(activeUserId);
                      return (
                        <button
                          key={emoji}
                          onClick={() => onReact(m.id, emoji)}
                          className={cn(
                            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs transition-colors',
                            mineReacted
                              ? 'bg-brand/15 text-brand-dark ring-1 ring-brand/30'
                              : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                          )}
                        >
                          <span>{emoji}</span>
                          <span className="font-semibold">{users.length}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* composer */}
      <div className="border-t border-slate-100 bg-white p-3">
        {replyTo && (
          <div className="mb-2 flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-1.5 text-xs">
            <span className="min-w-0 truncate text-slate-500">
              Replying to{' '}
              <span className="font-semibold text-slate-700">
                {replyTo.authorId === activeUserId ? 'You' : replyTo.author}
              </span>
              : {replyTo.text}
            </span>
            <button
              onClick={() => setReplyTo(null)}
              className="shrink-0 rounded px-1 text-slate-400 hover:text-slate-600"
              aria-label="Cancel reply"
            >
              ✕
            </button>
          </div>
        )}
        <div className="flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), send())}
            placeholder={replyTo ? 'Write a reply…' : 'Message the group…'}
            className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
          <Button onClick={send}>Send</Button>
        </div>
      </div>
    </div>
  );
}
