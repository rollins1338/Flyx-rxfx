import { Metadata } from 'next';
import { Suspense } from 'react';
import BrowsePageClient from './BrowsePageClient';
import { fetchTMDBData } from '@/app/lib/services/tmdb';

export const metadata: Metadata = {
  title: 'Browse | FlyX',
  description: 'Browse all content on FlyX',
};

export const revalidate = 3600;

// Fetch multiple pages to get more content (40 items = 2 pages of 20)
const PAGES_TO_FETCH = 2;

interface BrowsePageProps {
  searchParams: Promise<{ type?: string; filter?: string; genre?: string; page?: string; region?: string }>;
}

async function getBrowseData(type: string, filter: string, genre: string, page: number, region: string) {
  try {
    let endpoint = '';
    let params: Record<string, string> = {};

    // Handle different content types and filters
    if (type === 'movie') {
      // For movies with region, always use discover endpoint
      if (region || genre) {
        endpoint = '/discover/movie';
        params.sort_by = 'popularity.desc';
        if (region) params.with_origin_country = region;
        if (genre) params.with_genres = genre;
        if (filter === 'top_rated') {
          params.sort_by = 'vote_average.desc';
          params['vote_count.gte'] = '200';
        } else if (filter === 'now_playing') {
          const today = new Date().toISOString().split('T')[0];
          const monthAgo = new Date(Date.now() - 30*24*60*60*1000).toISOString().split('T')[0];
          params['primary_release_date.gte'] = monthAgo;
          params['primary_release_date.lte'] = today;
        }
      } else if (filter === 'popular') {
        endpoint = '/movie/popular';
      } else if (filter === 'top_rated') {
        endpoint = '/movie/top_rated';
      } else if (filter === 'now_playing') {
        endpoint = '/movie/now_playing';
      } else {
        endpoint = '/movie/popular';
      }
    } else if (type === 'tv') {
      // Always use discover to exclude anime (genre 16) and support region
      endpoint = '/discover/tv';
      params.without_genres = '16';
      params.sort_by = 'popularity.desc';
      
      if (region) params.with_origin_country = region;
      
      if (filter === 'top_rated') {
        params.sort_by = 'vote_average.desc';
        params['vote_count.gte'] = '200';
      } else if (filter === 'on_the_air') {
        params['air_date.gte'] = new Date(Date.now() - 30*24*60*60*1000).toISOString().split('T')[0];
      } else if (filter === 'airing_today') {
        const today = new Date().toISOString().split('T')[0];
        params['air_date.gte'] = today;
        params['air_date.lte'] = today;
      }
      
      if (genre) {
        params.with_genres = genre;
      }
    } else if (type === 'anime') {
      endpoint = '/discover/tv';
      params.with_genres = '16';
      params.with_origin_country = 'JP';
      params.sort_by = 'popularity.desc';
      
      if (filter === 'top_rated') {
        params.sort_by = 'vote_average.desc';
        params['vote_count.gte'] = '100';
      } else if (filter === 'airing') {
        params['air_date.gte'] = new Date(Date.now() - 60*24*60*60*1000).toISOString().split('T')[0];
      } else if (genre === 'action') {
        params.with_genres = '16,10759';
      } else if (genre === 'fantasy') {
        params.with_genres = '16,10765';
      } else if (genre === 'romance') {
        params.with_keywords = '210024';
      }
    } else if (type === 'anime-movies') {
      endpoint = '/discover/movie';
      params.with_genres = '16';
      params.with_origin_country = 'JP';
      params.sort_by = 'popularity.desc';
    }

    if (!endpoint) {
      return { items: [], total: 0, page: 1, totalPages: 0 };
    }

    // Fetch multiple pages for more content
    const startPage = (page - 1) * PAGES_TO_FETCH + 1;
    const pagePromises = [];
    for (let i = 0; i < PAGES_TO_FETCH; i++) {
      pagePromises.push(fetchTMDBData(endpoint, { ...params, page: (startPage + i).toString() }));
    }
    
    const results = await Promise.all(pagePromises);
    const mediaType = type === 'movie' || type === 'anime-movies' ? 'movie' : 'tv';
    
    // Combine results from all pages
    const allItems = results.flatMap(data => 
      data?.results?.map((item: any) => ({ ...item, mediaType })) || []
    );
    
    const firstResult = results[0];
    const totalResults = firstResult?.total_results || 0;
    const totalPages = Math.min(Math.ceil((firstResult?.total_pages || 0) / PAGES_TO_FETCH), 250);
    
    return {
      items: allItems,
      total: totalResults,
      page: page,
      totalPages: totalPages,
    };
  } catch (error) {
    console.error('Error fetching browse data:', error);
    return { items: [], total: 0, page: 1, totalPages: 0 };
  }
}

function getPageTitle(type: string, filter: string, genre: string): string {
  const titles: Record<string, Record<string, string>> = {
    movie: {
      popular: '🔥 Popular Movies',
      top_rated: '⭐ Top Rated Movies',
      now_playing: '🎬 Now Playing',
      '28': '💥 Action Movies',
      '12': '🗡️ Adventure Movies',
      '35': '😂 Comedy Movies',
      '18': '🎭 Drama Movies',
      '27': '👻 Horror Movies',
      '53': '😱 Thriller Movies',
      '878': '🚀 Sci-Fi Movies',
      '14': '✨ Fantasy Movies',
      '10749': '💕 Romance Movies',
      '9648': '🔍 Mystery Movies',
      '10751': '👨‍👩‍👧‍👦 Family Movies',
      '99': '📹 Documentary Movies',
    },
    tv: {
      popular: '🔥 Popular Series',
      top_rated: '⭐ Top Rated Series',
      on_the_air: '📡 On The Air',
      airing_today: '📺 Airing Today',
      '18': '🎭 Drama Series',
      '80': '🔍 Crime Series',
      '9648': '🔎 Mystery Series',
      '10759': '💥 Action & Adventure',
      '10765': '🚀 Sci-Fi & Fantasy',
      '35': '😂 Comedy Series',
      '99': '📹 Documentary Series',
      '10764': '📺 Reality TV',
      '10751': '👨‍👩‍👧‍👦 Family Series',
      '37': '🤠 Western Series',
      '10768': '⚔️ War & Politics',
    },
    anime: {
      popular: '🔥 Popular Anime',
      top_rated: '⭐ Top Rated Anime',
      airing: '📺 Currently Airing',
      action: '⚔️ Action Anime',
      fantasy: '✨ Fantasy Anime',
      romance: '💕 Romance Anime',
    },
    'anime-movies': {
      popular: '🎬 Anime Movies',
    },
  };

  return titles[type]?.[filter] || titles[type]?.[genre] || 'Browse';
}

export default async function BrowsePage({ searchParams }: BrowsePageProps) {
  const params = await searchParams;
  const type = params.type || 'movie';
  const filter = params.filter || 'popular';
  const genre = params.genre || '';
  const page = parseInt(params.page || '1', 10);
  const region = params.region || '';

  const data = await getBrowseData(type, filter, genre, page, region);
  const title = getPageTitle(type, filter, genre);

  return (
    <Suspense fallback={<div className="min-h-screen bg-black" />}>
      <BrowsePageClient
        items={data.items}
        total={data.total}
        currentPage={data.page}
        totalPages={data.totalPages}
        title={title}
        type={type}
        filter={filter}
        genre={genre}
      />
    </Suspense>
  );
}
