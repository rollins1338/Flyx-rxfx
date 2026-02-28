'use client';
/** @deprecated Consolidated into /admin/dashboard */
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
export default function LiveTestPage() {
  const router = useRouter();
  useEffect(() => { router.replace('/admin/dashboard'); }, [router]);
  return <div style={{ textAlign: 'center', padding: '60px', color: '#94a3b8' }}>Redirecting to Dashboard...</div>;
}
