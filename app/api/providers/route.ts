/**
 * Provider Availability API
 * Returns which stream providers are enabled/available
 */

import { NextResponse } from 'next/server';
import { VIDSRC_ENABLED } from '@/app/lib/services/vidsrc-extractor';

export async function GET() {
  return NextResponse.json({
    providers: {
      videasy: {
        enabled: true,
        name: 'Videasy',
        primary: true, // Videasy is the primary provider with multi-language support
      },
      vidsrc: {
        enabled: VIDSRC_ENABLED,
        name: 'VidSrc',
      },
    },
  });
}
