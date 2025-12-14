import { NextRequest, NextResponse } from 'next/server';
import { fetchTMDBData } from '@/app/lib/services/tmdb';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const region = searchParams.get('region') || '';

  try {
    // For origin country filtering, we MUST use /discover endpoint with with_origin_country
    // The /movie/popular etc. endpoints don't support origin country filtering
    const regionParam: Record<string, string> = region ? { with_origin_country: region } : {};

    const [
      popular, topRated, nowPlaying,
      action, comedy, horror, sciFi,
      thriller, romance, drama, documentary,
      fantasy, mystery, adventure, family
    ] = await Promise.all([
      // Use discover for all categories when region is specified to filter by origin country
      region 
        ? fetchTMDBData('/discover/movie', { sort_by: 'popularity.desc', ...regionParam })
        : fetchTMDBData('/movie/popular', { page: '1' }),
      region
        ? fetchTMDBData('/discover/movie', { sort_by: 'vote_average.desc', 'vote_count.gte': '200', ...regionParam })
        : fetchTMDBData('/movie/top_rated', { page: '1' }),
      region
        ? fetchTMDBData('/discover/movie', { 
            sort_by: 'popularity.desc',
            'primary_release_date.gte': new Date(Date.now() - 30*24*60*60*1000).toISOString().split('T')[0],
            'primary_release_date.lte': new Date().toISOString().split('T')[0],
            ...regionParam 
          })
        : fetchTMDBData('/movie/now_playing', { page: '1' }),
      fetchTMDBData('/discover/movie', { with_genres: '28', sort_by: 'popularity.desc', ...regionParam }),
      fetchTMDBData('/discover/movie', { with_genres: '35', sort_by: 'popularity.desc', ...regionParam }),
      fetchTMDBData('/discover/movie', { with_genres: '27', sort_by: 'popularity.desc', ...regionParam }),
      fetchTMDBData('/discover/movie', { with_genres: '878', sort_by: 'popularity.desc', ...regionParam }),
      fetchTMDBData('/discover/movie', { with_genres: '53', sort_by: 'popularity.desc', ...regionParam }),
      fetchTMDBData('/discover/movie', { with_genres: '10749', sort_by: 'popularity.desc', ...regionParam }),
      fetchTMDBData('/discover/movie', { with_genres: '18', sort_by: 'popularity.desc', ...regionParam }),
      fetchTMDBData('/discover/movie', { with_genres: '99', sort_by: 'popularity.desc', ...regionParam }),
      fetchTMDBData('/discover/movie', { with_genres: '14', sort_by: 'popularity.desc', ...regionParam }),
      fetchTMDBData('/discover/movie', { with_genres: '9648', sort_by: 'popularity.desc', ...regionParam }),
      fetchTMDBData('/discover/movie', { with_genres: '12', sort_by: 'popularity.desc', ...regionParam }),
      fetchTMDBData('/discover/movie', { with_genres: '10751', sort_by: 'popularity.desc', ...regionParam }),
    ]);

    const addMediaType = (items: any[]) => items?.map((item: any) => ({ ...item, mediaType: 'movie' })) || [];

    return NextResponse.json({
      popular: { items: addMediaType(popular?.results), total: popular?.total_results || 0 },
      topRated: { items: addMediaType(topRated?.results), total: topRated?.total_results || 0 },
      nowPlaying: { items: addMediaType(nowPlaying?.results), total: nowPlaying?.total_results || 0 },
      action: { items: addMediaType(action?.results), total: action?.total_results || 0 },
      comedy: { items: addMediaType(comedy?.results), total: comedy?.total_results || 0 },
      horror: { items: addMediaType(horror?.results), total: horror?.total_results || 0 },
      sciFi: { items: addMediaType(sciFi?.results), total: sciFi?.total_results || 0 },
      thriller: { items: addMediaType(thriller?.results), total: thriller?.total_results || 0 },
      romance: { items: addMediaType(romance?.results), total: romance?.total_results || 0 },
      drama: { items: addMediaType(drama?.results), total: drama?.total_results || 0 },
      documentary: { items: addMediaType(documentary?.results), total: documentary?.total_results || 0 },
      fantasy: { items: addMediaType(fantasy?.results), total: fantasy?.total_results || 0 },
      mystery: { items: addMediaType(mystery?.results), total: mystery?.total_results || 0 },
      adventure: { items: addMediaType(adventure?.results), total: adventure?.total_results || 0 },
      family: { items: addMediaType(family?.results), total: family?.total_results || 0 },
    });
  } catch (error) {
    console.error('Error fetching movies:', error);
    return NextResponse.json({ error: 'Failed to fetch movies' }, { status: 500 });
  }
}
