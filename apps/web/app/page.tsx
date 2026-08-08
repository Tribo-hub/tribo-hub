'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// A raiz vai direto para o login (e-mail/senha). O tema é aplicado pelo layout.
export default function Home() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/login');
  }, [router]);

  return <main className="min-h-screen bg-slate-100 dark:bg-slate-900" />;
}
