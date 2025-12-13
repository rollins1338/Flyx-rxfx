/**
 * Provider Availability API
 * Returns which stream providers are enabled/available
 */

import { NextResponse } from 'next/server';
import { VIDSRC_ENABLED } from '@/app/lib/services/vidsrc-extractor';
import { ANIMEKAI_ENABLED } from '@/app/lib/services/animekai-extractor';

export async function GET() {
  return NextResponse.json({
    providers: {
      animekai: {
        enabled: ANIMEKAI_ENABLED,
        name: 'AnimeKai',
        primary: false, // Primary only for anime content (auto-detected)
        animeOnly: true, // Only available for anime content
      },
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
