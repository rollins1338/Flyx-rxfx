/**
 * Cable Channels API
 * 
 * Returns the list of available cable TV channels with filtering support.
 */

import { NextRequest, NextResponse } from 'next/server';
import { CABLE_CHANNELS, CHANNEL_CATEGORIES, CableChannel } from '@/app/lib/data/cable-channels';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category');
    const search = searchParams.get('search')?.toLowerCase();
    
    let channels: CableChannel[] = [...CABLE_CHANNELS];
    
    // Filter by category
    if (category && category !== 'all') {
      channels = channels.filter(ch => ch.category === category);
    }
    
    // Filter by search
    if (search) {
      channels = channels.filter(ch => 
        ch.name.toLowerCase().includes(search) ||
        ch.shortName.toLowerCase().includes(search) ||
        ch.aliases.some(alias => alias.toLowerCase().includes(search)) ||
        ch.category.toLowerCase().includes(search)
      );
    }
    
    // Group by category for response
    const grouped = channels.reduce((acc, channel) => {
      if (!acc[channel.category]) {
        acc[channel.category] = [];
      }
      acc[channel.category].push(channel);
      return acc;
    }, {} as Record<string, CableChannel[]>);
    
    // Build category stats
    const categoryStats = Object.entries(CHANNEL_CATEGORIES).map(([id, info]) => ({
      id,
      name: info.name,
      icon: info.icon,
      count: grouped[id]?.length || 0,
    }));
    
    // Format channels for response
    const formattedChannels = channels.map(ch => ({
      id: ch.id,
      name: ch.name,
      shortName: ch.shortName,
      category: ch.category,
      categoryName: CHANNEL_CATEGORIES[ch.category]?.name || ch.category,
      categoryIcon: CHANNEL_CATEGORIES[ch.category]?.icon || '📺',
      hdVariants: ch.hdVariants || [],
      aliases: ch.aliases,
    }));
    
    return NextResponse.json({
      success: true,
      channels: formattedChannels,
      grouped,
      categories: categoryStats,
      total: channels.length,
    });
  } catch (error: any) {
    console.error('Cable channels API error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to fetch cable channels',
      channels: [],
      categories: [],
      total: 0,
    }, { status: 500 });
  }
}