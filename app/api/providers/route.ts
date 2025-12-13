/**
 * Provider Availability API
 * Returns which stream providers are enabled/available
 * 
 * Provider Priority:
 * - Videasy: PRIMARY provider with multi-language support (always enabled)
 * - AnimeKai: PRIMARY for anime content only (auto-detected)
 * - VidSrc: OPTIONAL, disabled by default (requires ENABLE_VIDSRC_PROVIDER=true)
 */

import { NextResponse } from 'next/server';
import { VIDSRC_ENABLED } from '@/app/lib/services/vidsrc-extractor';
import { ANIMEKAI_ENABLED } from '@/app/lib/services/animekai-extractor';

export async function GET() {
  return NextResponse.json({
    providers: {
      videasy: {
        enabled: true,
        name: 'Videasy',
        primary: true, // Videasy is the PRIMARY provider with multi-language support
        description: 'Multi-language streaming with English, German, French, Spanish, Portuguese, and more',
      },
      animekai: {
        enabled: ANIMEKAI_ENABLED,
        name: 'AnimeKai',
        primary: false, // Primary only for anime content (auto-detected)
        animeOnly: true, // Only available for anime content
        description: 'Specialized anime streaming with Japanese audio',
      },
      vidsrc: {
        enabled: VIDSRC_ENABLED,
        name: 'VidSrc',
        primary: false,
        description: 'Alternative streaming source (disabled by default)',
      },
    },
  });
}
