'use client';
/** @deprecated Consolidated into /admin/settings */
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
export default function MigrateSyncPage() {
  const router = useRouter();
  useEffect(() => { router.replace('/admin/settings'); }, [router]);
  return <div style={{ textAlign: 'center', padding: '60px', color: '#94a3b8' }}>Redirecting to Settings...</div>;
}
