'use client';
/** @deprecated Consolidated into /admin/content */
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
export default function InsightsPage() {
  const router = useRouter();
  useEffect(() => { router.replace('/admin/content'); }, [router]);
  return <div style={{ textAlign: 'center', padding: '60px', color: '#94a3b8' }}>Redirecting to Content Analytics...</div>;
}
