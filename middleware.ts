import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Block admin routes on non-Cloudflare environments (Vercel)
  if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
    // Check if we're on Cloudflare by looking for CF-specific headers
    // Note: cf-ray is set by Cloudflare's edge and cannot be spoofed by end users
    // when the request goes through Cloudflare's network. However, if the origin
    // is directly accessible, this check can be bypassed. Ensure the origin server
    // only accepts traffic from Cloudflare IPs for full protection.
    const isCloudflare = request.headers.get('cf-ray') !== null;
    
    if (!isCloudflare) {
      // Return 404 for admin routes on Vercel
      return new NextResponse(null, { status: 404 });
    }
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
};
