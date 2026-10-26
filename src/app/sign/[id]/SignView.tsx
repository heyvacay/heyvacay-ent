'use client';

import { CrmProvider } from '@/lib/crmStore';
import { SignContract } from './SignContract';

export default function SignView({ id }: { id: string }) {
  return (
    <CrmProvider>
      <SignContract id={id} />
    </CrmProvider>
  );
}
