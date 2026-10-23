'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { HvLoader } from '@/components/HvLoader';

export default function AppIndex() {
  const { role } = useStore();
  const router = useRouter();
  useEffect(() => {
    router.replace(role === 'admin' ? '/app/dashboard' : '/app/book');
  }, [role, router]);
  return <HvLoader className="py-24" />;
}
