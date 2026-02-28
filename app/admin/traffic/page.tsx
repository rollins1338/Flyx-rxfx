'use client';
/** @deprecated Consolidated into /admin/users */
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
export default function TrafficPage() {
  const router = useRouter();
  useEffect(() => { router.replace('/admin/users'); }, [router]);
  return <div style={{ textAlign: 'center', padding: '60px', color: '#94a3b8' }}>Redirecting to User Analytics...</div>;
}
