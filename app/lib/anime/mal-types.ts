/**
 * MAL (MyAnimeList) type definitions
 * Extracted from app/lib/services/mal.ts for standalone use
 */

export interface MALAnime {
  mal_id: number;
  title: string;
  title_english: string | null;
  title_japanese: string | null;
  type: string;
  episodes: number | null;
  status: string;
  score: number | null;
  scored_by: number | null;
  rank: number | null;
  popularity: number | null;
  members: number | null;
  synopsis: string | null;
  season: string | null;
  year: number | null;
  images: {
    jpg: { image_url: string; large_image_url: string };
    webp: { image_url: string; large_image_url: string };
  };
  aired: {
    from: string | null;
    to: string | null;
    string: string;
  };
  genres: Array<{ mal_id: number; name: string }>;
  studios: Array<{ mal_id: number; name: string }>;
}

export interface MALSearchResult {
  mal_id: number;
  title: string;
  title_english: string | null;
  type: string;
  episodes: number | null;
  score: number | null;
  images: {
    jpg: { image_url: string; large_image_url: string };
  };
}

export interface MALSeason {
  malId: number;
  title: string;
  titleEnglish: string | null;
  episodes: number | null;
  score: number | null;
  members: number | null;
  type: string;
  status: string;
  aired: string;
  synopsis: string | null;
  imageUrl: string;
  seasonOrder: number;
}

export interface MALAnimeDetails {
  mainEntry: MALAnime;
  allSeasons: MALSeason[];
  totalEpisodes: number;
}

export interface MALEpisode {
  mal_id: number;
  title: string;
  title_japanese: string | null;
  title_romanji: string | null;
  aired: string | null;
  score: number | null;
  filler: boolean;
  recap: boolean;
}

/** Service interface for MAL metadata operations */
export interface MALServiceInterface {
  search(query: string, limit?: number): Promise<MALSearchResult[]>;
  getById(malId: number): Promise<MALAnime | null>;
  getEpisodes(malId: number): Promise<MALEpisode[]>;
  getSeriesSeasons(malId: number): Promise<MALAnimeDetails | null>;
}
