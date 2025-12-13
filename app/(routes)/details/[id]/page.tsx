import React from 'react';
import { notFound } from 'next/navigation';
import { tmdbService } from '@/lib/services/tmdb';
import type { MediaItem } from '@/types/media';
import DetailsPageClient from './DetailsPageClient';

interface DetailsPageProps {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    type?: 'movie' | 'tv';
  }>;
}

/**
 * Content Details Page - Server Component
 * Fetches content details and related content on the server
 */
export default async function DetailsPage({ params, searchParams }: DetailsPageProps) {
  const { id } = await params;
  const { type } = await searchParams;
  const mediaType = type || 'movie';

  let content: MediaItem | null = null;
  let relatedContent: MediaItem[] = [];
  let error: string | null = null;

  try {
    // Fetch content details
    content = await tmdbService.getDetails(id, mediaType);

    // Fetch related content based on type
    const [trending, popular] = await Promise.all([
      tmdbService.getTrending(mediaType, 'week').catch(() => []),
      mediaType === 'movie' 
        ? tmdbService.getPopularMovies(1).catch(() => [])
        : tmdbService.getPopularTV(1).catch(() => []),
    ]);

    // Combine and filter out current item
    relatedContent = [...trending, ...popular]
      .filter(item => item.id !== id)
      .slice(0, 12);

  } catch (err) {
    console.error('Error fetching content details:', err);
    error = 'Failed to load content details. Please try again later.';
    
    // If content fetch failed, show 404
    if (!content) {
      notFound();
    }
  }

  return (
    <DetailsPageClient
      content={content}
      relatedContent={relatedContent}
      error={error}
    />
  );
}
