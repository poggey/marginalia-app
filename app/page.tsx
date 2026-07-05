'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getMeta } from '@/lib/db';

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    getMeta<boolean>('onboarded').then((done) => {
      router.replace(done ? '/for-you' : '/onboarding');
    });
  }, [router]);
  return null;
}
