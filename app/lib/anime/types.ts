/** Normalized stream source returned by all providers */
export interface StreamSource {
  quality: string;
  title: string;
  url: string;
  type: 'hls';
  referer: string;
  requiresSegmentProxy: boolean;
  skipOrigin?: boolean;
  language?: string;
  skipIntro?: [number, number];
  skipOutro?: [number, number];
}

/** Subtitle track */
export interface SubtitleTrack {
  label: string;
  url: string;
  language: string;
}

/** Result from a single provider extraction */
export interface ExtractionResult {
  success: boolean;
  sources: StreamSource[];
  subtitles?: SubtitleTrack[];
  error?: string;
}

/** Provider configuration */
export interface ProviderConfig {
  /** Whether stream URLs from this provider need residential proxy */
  requiresProxy: boolean;
  /** Request timeout in ms */
  timeout: number;
  /** Provider domains (for referer headers) */
  domains: string[];
}

/** Common provider interface that all streaming providers implement */
export interface AnimeProvider {
  /** Unique provider identifier */
  readonly name: string;
  /** Provider configuration (proxy needs, timeouts, domains) */
  readonly config: ProviderConfig;
  /**
   * Extract streams for a given anime episode.
   * @param malId - MAL ID of the anime
   * @param title - Anime title (for search-based providers)
   * @param episode - Episode number relative to the MAL entry (undefined for movies)
   * @param type - 'movie' or 'tv'
   */
  extractStreams(
    malId: number,
    title: string,
    episode: number | undefined,
    type: 'movie' | 'tv',
  ): Promise<ExtractionResult>;
}

/** Proxy config interface for transforming URLs based on provider requirements */
export interface ProxyConfigInterface {
  /** Transform a URL for a given provider's proxy requirements */
  applyProxy(url: string, provider: AnimeProvider): string;
}

/** Combined result from stream resolver (multiple providers) */
export interface CombinedExtractionResult {
  success: boolean;
  sources: StreamSource[];
  subtitles: SubtitleTrack[];
  providers: string[];
  anime: {
    malId: number;
    title: string;
    titleEnglish: string | null;
    episodes: number | null;
    type: string;
  };
  executionTime: number;
}
