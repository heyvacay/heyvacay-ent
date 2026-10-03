'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';

export default function AppIndex() {
  const { role } = useStore();
  const router = useRouter();
  useEffect(() => {
    router.replace(role === 'admin' ? '/app/dashboard' : '/app/me');
  }, [role, router]);
  return (
    <div className="grid place-items-center py-20">
      <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-300 border-t-brand" />
    </div>
  );
}
