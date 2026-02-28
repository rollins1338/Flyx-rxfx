'use client';

/**
 * Admin root page — redirects to /admin/dashboard
 *
 * The consolidated dashboard is now at /admin/dashboard.
 * This page renders the dashboard inline so /admin still works.
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminRootPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/admin/dashboard');
  }, [router]);

  return (
    <div style={{ textAlign: 'center', padding: '60px', color: '#94a3b8' }}>
      Redirecting to dashboard...
    </div>
  );
}
