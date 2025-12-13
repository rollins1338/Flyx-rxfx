import { NextRequest, NextResponse } from 'next/server';
import { fetchTMDBData } from '@/app/lib/services/tmdb';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const region = searchParams.get('region') || '';

  try {
    const regionParam: Record<string, string> = region ? { with_origin_country: region } : {};
    const today = new Date().toISOString().split('T')[0];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const [
      popular, topRated, onAir, airingToday,
      drama, crime, sciFi, comedy,
      mystery, thriller, documentary, reality,
      family, western, war
    ] = await Promise.all([
      fetchTMDBData('/discover/tv', { sort_by: 'popularity.desc', without_genres: '16', ...regionParam }),
      fetchTMDBData('/discover/tv', { sort_by: 'vote_average.desc', without_genres: '16', 'vote_count.gte': '200', ...regionParam }),
      fetchTMDBData('/discover/tv', { sort_by: 'popularity.desc', without_genres: '16', 'air_date.gte': thirtyDaysAgo, ...regionParam }),
      fetchTMDBData('/discover/tv', { sort_by: 'popularity.desc', without_genres: '16', 'air_date.gte': today, 'air_date.lte': today, ...regionParam }),
      fetchTMDBData('/discover/tv', { with_genres: '18', without_genres: '16', sort_by: 'popularity.desc', ...regionParam }),
      fetchTMDBData('/discover/tv', { with_genres: '80', without_genres: '16', sort_by: 'popularity.desc', ...regionParam }),
      fetchTMDBData('/discover/tv', { with_genres: '10765', without_genres: '16', sort_by: 'popularity.desc', ...regionParam }),
      fetchTMDBData('/discover/tv', { with_genres: '35', without_genres: '16', sort_by: 'popularity.desc', ...regionParam }),
      fetchTMDBData('/discover/tv', { with_genres: '9648', without_genres: '16', sort_by: 'popularity.desc', ...regionParam }),
      fetchTMDBData('/discover/tv', { with_genres: '10759', without_genres: '16', sort_by: 'popularity.desc', ...regionParam }),
      fetchTMDBData('/discover/tv', { with_genres: '99', without_genres: '16', sort_by: 'popularity.desc', ...regionParam }),
      fetchTMDBData('/discover/tv', { with_genres: '10764', without_genres: '16', sort_by: 'popularity.desc', ...regionParam }),
      fetchTMDBData('/discover/tv', { with_genres: '10751', without_genres: '16', sort_by: 'popularity.desc', ...regionParam }),
      fetchTMDBData('/discover/tv', { with_genres: '37', without_genres: '16', sort_by: 'popularity.desc', ...regionParam }),
      fetchTMDBData('/discover/tv', { with_genres: '10768', without_genres: '16', sort_by: 'popularity.desc', ...regionParam }),
    ]);

    const addMediaType = (items: any[]) => items?.map((item: any) => ({ ...item, mediaType: 'tv' })) || [];

    return NextResponse.json({
      popular: { items: addMediaType(popular?.results), total: popular?.total_results || 0 },
      topRated: { items: addMediaType(topRated?.results), total: topRated?.total_results || 0 },
      onAir: { items: addMediaType(onAir?.results), total: onAir?.total_results || 0 },
      airingToday: { items: addMediaType(airingToday?.results), total: airingToday?.total_results || 0 },
      drama: { items: addMediaType(drama?.results), total: drama?.total_results || 0 },
      crime: { items: addMediaType(crime?.results), total: crime?.total_results || 0 },
      sciFi: { items: addMediaType(sciFi?.results), total: sciFi?.total_results || 0 },
      comedy: { items: addMediaType(comedy?.results), total: comedy?.total_results || 0 },
      mystery: { items: addMediaType(mystery?.results), total: mystery?.total_results || 0 },
      thriller: { items: addMediaType(thriller?.results), total: thriller?.total_results || 0 },
      documentary: { items: addMediaType(documentary?.results), total: documentary?.total_results || 0 },
      reality: { items: addMediaType(reality?.results), total: reality?.total_results || 0 },
      family: { items: addMediaType(family?.results), total: family?.total_results || 0 },
      western: { items: addMediaType(western?.results), total: western?.total_results || 0 },
      war: { items: addMediaType(war?.results), total: war?.total_results || 0 },
    });
  } catch (error) {
    console.error('Error fetching series:', error);
    return NextResponse.json({ error: 'Failed to fetch series' }, { status: 500 });
  }
}
