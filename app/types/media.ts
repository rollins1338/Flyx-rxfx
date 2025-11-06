/**
 * Media Types - Content models for movies and TV shows
 */

export interface Genre {
  id: number;
  name: string;
}

export interface MediaItem {
  id: number | string;
  title?: string;
  name?: string;
  overview?: string;
  poster_path?: string;
  backdrop_path?: string;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
  vote_count?: number;
  mediaType?: 'movie' | 'tv';
  media_type?: 'movie' | 'tv';
  genres?: Genre[];
  genre_ids?: number[];
  runtime?: number;
  seasons?: Season[];
  // Legacy support for backward compatibility
  posterPath?: string;
  backdropPath?: string;
  releaseDate?: string;
  rating?: number;
  voteCount?: number;
}

export interface Season {
  seasonNumber: number;
  episodeCount: number;
  episodes: Episode[];
}

export interface Episode {
  id: string;
  episodeNumber: number;
  seasonNumber: number;
  title: string;
  overview: string;
  stillPath: string;
  airDate: string;
  runtime: number;
}

export interface SearchResult {
  id: string;
  title: string;
  posterPath: string;
  mediaType: 'movie' | 'tv';
  releaseDate: string;
  rating: number;
}

export interface StreamSource {
  url: string;
  quality: 'auto' | '1080p' | '720p' | '480p' | '360p';
  type: 'hls' | 'mp4';
}

export interface SubtitleTrack {
  label: string;
  language: string;
  url: string;
}

export interface VideoData {
  sources: StreamSource[];
  subtitles: SubtitleTrack[];
  poster?: string;
  duration?: number;
}
