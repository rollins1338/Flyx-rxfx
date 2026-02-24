import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Block admin routes on non-Cloudflare environments (Vercel)
  // Self-hosted mode always allows admin access
  if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
    const isSelfHosted = process.env.FLYX_SELF_HOSTED === 'true';
    const isCloudflare = request.headers.get('cf-ray') !== null;
    
    if (!isCloudflare && !isSelfHosted) {
      // Return 404 for admin routes on Vercel
      return new NextResponse(null, { status: 404 });
    }
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
};
