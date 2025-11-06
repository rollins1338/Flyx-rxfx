/**
 * Popular Searches API
 * GET /api/search/popular - Get popular search terms
 * POST /api/search/popular - Track a search query
 */

import { NextRequest, NextResponse } from 'next/server';
import { initializeDB, getDB } from '@/lib/db/connection';
import { TABLES } from '@/lib/db/schema';

// Normalize search query for consistent tracking
function normalizeQuery(query: string): string {
  return query.toLowerCase().trim().replace(/\s+/g, ' ');
}

// Calculate trending score based on recency and frequency
function calculateTrendingScore(searchCount: number, lastSearched: number): number {
  const now = Date.now();
  const daysSinceLastSearch = (now - lastSearched) / (1000 * 60 * 60 * 24);
  
  // Decay factor: searches lose relevance over time
  const decayFactor = Math.exp(-daysSinceLastSearch / 7); // 7-day half-life
  
  // Trending score combines frequency with recency
  return searchCount * decayFactor;
}

export async function GET() {
  try {
    await initializeDB();
    const db = getDB();

    // Get popular searches ordered by trending score
    const popularSearches = db.query(`
      SELECT 
        display_query,
        search_count,
        click_count,
        trending_score,
        last_searched
      FROM ${TABLES.POPULAR_SEARCHES}
      WHERE search_count >= 2
      ORDER BY trending_score DESC, search_count DESC
      LIMIT 20
    `).all();

    // Get recent trending searches (last 7 days)
    const recentTrending = db.query(`
      SELECT 
        display_query,
        search_count,
        trending_score
      FROM ${TABLES.POPULAR_SEARCHES}
      WHERE last_searched > ? AND search_count >= 3
      ORDER BY trending_score DESC
      LIMIT 10
    `).all(Date.now() - (7 * 24 * 60 * 60 * 1000));

    return NextResponse.json({
      success: true,
      data: {
        popular: popularSearches,
        trending: recentTrending
      }
    });

  } catch (error) {
    console.error('Popular searches API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch popular searches' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { query, sessionId, resultsCount, clickedResult } = await request.json();

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }

    await initializeDB();
    const db = getDB();

    const normalizedQuery = normalizeQuery(query);
    const timestamp = Date.now();

    // Generate unique ID for search query record
    const searchId = `search_${timestamp}_${Math.random().toString(36).substring(2)}`;

    // Insert search query record
    db.query(`
      INSERT INTO ${TABLES.SEARCH_QUERIES} 
      (id, query, normalized_query, session_id, results_count, clicked_result, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(searchId, query, normalizedQuery, sessionId, resultsCount || 0, clickedResult || false, timestamp);

    // Update or insert popular search
    const existingPopular = db.query(`
      SELECT * FROM ${TABLES.POPULAR_SEARCHES} WHERE normalized_query = ?
    `).get(normalizedQuery) as any;

    if (existingPopular) {
      // Update existing popular search
      const newSearchCount = existingPopular.search_count + 1;
      const newClickCount = existingPopular.click_count + (clickedResult ? 1 : 0);
      const newTrendingScore = calculateTrendingScore(newSearchCount, timestamp);

      db.query(`
        UPDATE ${TABLES.POPULAR_SEARCHES}
        SET 
          search_count = ?,
          click_count = ?,
          last_searched = ?,
          trending_score = ?,
          updated_at = ?
        WHERE normalized_query = ?
      `).run(newSearchCount, newClickCount, timestamp, newTrendingScore, timestamp, normalizedQuery);
    } else {
      // Insert new popular search
      const trendingScore = calculateTrendingScore(1, timestamp);
      
      db.query(`
        INSERT INTO ${TABLES.POPULAR_SEARCHES}
        (normalized_query, display_query, search_count, click_count, last_searched, trending_score, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(normalizedQuery, query, 1, clickedResult ? 1 : 0, timestamp, trendingScore, timestamp);
    }

    return NextResponse.json({
      success: true,
      message: 'Search tracked successfully'
    });

  } catch (error) {
    console.error('Track search API error:', error);
    return NextResponse.json(
      { error: 'Failed to track search' },
      { status: 500 }
    );
  }
}