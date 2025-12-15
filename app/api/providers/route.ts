/**
 * Provider Availability API
 * Returns which stream providers are enabled/available
 * 
 * Provider Priority:
 * - VidSrc: PRIMARY provider (if enabled via ENABLE_VIDSRC_PROVIDER=true)
 * - 1movies: 2nd backup provider (111movies.com)
 * - Videasy: Fallback provider with multi-language support (always enabled)
 * - AnimeKai: PRIMARY for anime content only (auto-detected)
 */

import { NextResponse } from 'next/server';
import { VIDSRC_ENABLED } from '@/app/lib/services/vidsrc-extractor';
import { ANIMEKAI_ENABLED } from '@/app/lib/services/animekai-extractor';
import { ONEMOVIES_ENABLED } from '@/app/lib/services/onemovies-extractor';

export async function GET() {
  return NextResponse.json({
    providers: {
      vidsrc: {
        enabled: VIDSRC_ENABLED,
        name: 'VidSrc',
        primary: true, // VidSrc is PRIMARY when enabled
        description: 'Primary streaming source (disabled by default)',
      },
      '1movies': {
        enabled: ONEMOVIES_ENABLED,
        name: '1movies',
        primary: false, // 2nd backup between vidsrc and videasy
        description: '111movies.com - Multiple servers with HLS streams',
      },
      videasy: {
        enabled: true,
        name: 'Videasy',
        primary: false, // Fallback provider with multi-language support
        description: 'Multi-language streaming with English, German, French, Spanish, Portuguese, and more',
      },
      animekai: {
        enabled: ANIMEKAI_ENABLED,
        name: 'AnimeKai',
        primary: false, // Primary only for anime content (auto-detected)
        animeOnly: true, // Only available for anime content
        description: 'Specialized anime streaming with Japanese audio',
      },
    },
  });
}
