import React from 'react';
import SearchPageClient from './SearchPageClient';

/**
 * Search Page - Server Component
 * Handles search functionality with beautiful UI and analytics
 */
export default function SearchPage({
  searchParams,
}: {
  searchParams: { q?: string; type?: string; genre?: string };
}) {
  const query = searchParams.q || '';
  const contentType = searchParams.type || 'all';
  const genre = searchParams.genre || '';

  return (
    <SearchPageClient
      initialQuery={query}
      initialContentType={contentType}
      initialGenre={genre}
    />
  );
}