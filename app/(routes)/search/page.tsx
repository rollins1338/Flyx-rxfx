import React from 'react';
import SearchPageClient from './SearchPageClient';

interface SearchPageProps {
  searchParams: Promise<{ q?: string; type?: string; genre?: string }>;
}

/**
 * Search Page - Server Component
 * Handles search functionality with beautiful UI and analytics
 */
export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q, type, genre } = await searchParams;
  const query = q || '';
  const contentType = type || 'all';
  const genreFilter = genre || '';

  return (
    <SearchPageClient
      initialQuery={query}
      initialContentType={contentType}
      initialGenre={genreFilter}
    />
  );
}