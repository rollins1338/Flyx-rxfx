/**
 * Live TV Channels API
 * 
 * Returns all 850+ live TV channels from DLHD organized by category and country.
 */

import { NextRequest, NextResponse } from 'next/server';
import channelData from '@/app/data/dlhd-channels.json';

export const runtime = 'nodejs';
export const revalidate = 300;

interface Channel {
  id: string;
  name: string;
  category: string;
  country: string;
  firstLetter: string;
}

const CATEGORY_INFO: Record<string, { name: string; icon: string }> = {
  sports: { name: 'Sports', icon: '⚽' },
  news: { name: 'News', icon: '📰' },
  entertainment: { name: 'Entertainment', icon: '🎬' },
  movies: { name: 'Movies & Premium', icon: '🎥' },
  documentary: { name: 'Documentary', icon: '🌍' },
  kids: { name: 'Kids & Family', icon: '🧸' },
};

const COUNTRY_INFO: Record<string, { name: string; flag: string }> = {
  usa: { name: 'United States', flag: '🇺🇸' },
  uk: { name: 'United Kingdom', flag: '🇬🇧' },
  spain: { name: 'Spain', flag: '🇪🇸' },
  france: { name: 'France', flag: '🇫🇷' },
  germany: { name: 'Germany', flag: '🇩🇪' },
  italy: { name: 'Italy', flag: '🇮🇹' },
  portugal: { name: 'Portugal', flag: '🇵🇹' },
  poland: { name: 'Poland', flag: '🇵🇱' },
  brazil: { name: 'Brazil', flag: '🇧🇷' },
  argentina: { name: 'Argentina', flag: '🇦🇷' },
  mexico: { name: 'Mexico', flag: '🇲🇽' },
  canada: { name: 'Canada', flag: '🇨🇦' },
  australia: { name: 'Australia', flag: '🇦🇺' },
  turkey: { name: 'Turkey', flag: '🇹🇷' },
  'middle-east': { name: 'Middle East', flag: '🌍' },
  balkans: { name: 'Balkans', flag: '🌍' },
  russia: { name: 'Russia', flag: '🇷🇺' },
  netherlands: { name: 'Netherlands', flag: '🇳🇱' },
  greece: { name: 'Greece', flag: '🇬🇷' },
  israel: { name: 'Israel', flag: '🇮🇱' },
  malaysia: { name: 'Malaysia', flag: '🇲🇾' },
  denmark: { name: 'Denmark', flag: '🇩🇰' },
  sweden: { name: 'Sweden', flag: '🇸🇪' },
  hungary: { name: 'Hungary', flag: '🇭🇺' },
  romania: { name: 'Romania', flag: '🇷🇴' },
  bulgaria: { name: 'Bulgaria', flag: '🇧🇬' },
  cyprus: { name: 'Cyprus', flag: '🇨🇾' },
  international: { name: 'International', flag: '🌐' },
};

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category');
    const country = searchParams.get('country');
    const search = searchParams.get('search');
    const letter = searchParams.get('letter');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '100');

    let channels: Channel[] = channelData.channels;

    // Filter by category
    if (category && category !== 'all') {
      channels = channels.filter(ch => ch.category === category);
    }

    // Filter by country
    if (country && country !== 'all') {
      channels = channels.filter(ch => ch.country === country);
    }

    // Filter by first letter
    if (letter && letter !== 'all') {
      channels = channels.filter(ch => ch.firstLetter.toUpperCase() === letter.toUpperCase());
    }

    // Filter by search
    if (search) {
      const searchLower = search.toLowerCase();
      channels = channels.filter(ch => ch.name.toLowerCase().includes(searchLower));
    }

    // Get unique categories and countries for filters
    const allChannels: Channel[] = channelData.channels;
    const uniqueCategories = Array.from(new Set(allChannels.map(ch => ch.category)));
    const uniqueCountries = Array.from(new Set(allChannels.map(ch => ch.country)));
    const uniqueLetters = Array.from(new Set(allChannels.map(ch => ch.firstLetter))).sort();

    // Pagination
    const totalChannels = channels.length;
    const totalPages = Math.ceil(totalChannels / limit);
    const startIndex = (page - 1) * limit;
    const paginatedChannels = channels.slice(startIndex, startIndex + limit);

    // Format channels for response
    const formattedChannels = paginatedChannels.map(ch => ({
      id: `ch-${ch.id}`,
      name: ch.name,
      category: ch.category,
      country: ch.country,
      streamId: ch.id,
      firstLetter: ch.firstLetter,
      isHD: true,
      categoryInfo: CATEGORY_INFO[ch.category] || { name: ch.category, icon: '📺' },
      countryInfo: COUNTRY_INFO[ch.country] || { name: ch.country, flag: '🌐' },
    }));

    // Group by category for category view
    const groupedByCategory = uniqueCategories.map(cat => ({
      id: cat,
      ...CATEGORY_INFO[cat],
      count: allChannels.filter(ch => ch.category === cat).length,
    }));

    // Group by country for country view
    const groupedByCountry = uniqueCountries.map(c => ({
      id: c,
      ...COUNTRY_INFO[c],
      count: allChannels.filter(ch => ch.country === c).length,
    })).sort((a, b) => b.count - a.count);

    return NextResponse.json({
      success: true,
      channels: formattedChannels,
      pagination: {
        page,
        limit,
        totalChannels,
        totalPages,
        hasMore: page < totalPages,
      },
      filters: {
        categories: groupedByCategory,
        countries: groupedByCountry,
        letters: uniqueLetters,
      },
      stats: {
        totalChannels: channelData.totalChannels,
        lastUpdated: channelData.lastUpdated,
      },
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });

  } catch (error) {
    console.error('[LiveTV API] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch channels' },
      { status: 500 }
    );
  }
}
