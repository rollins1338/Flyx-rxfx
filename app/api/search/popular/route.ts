/**
 * Popular Searches API
 * GET /api/search/popular - Get popular search terms
 * POST /api/search/popular - Track a search query
 * 
 * NOTE: This uses local SQLite which is only available in local dev.
 * On Cloudflare Pages deployment, this gracefully returns empty results.
 * For production, popular searches should be migrated to the CF Analytics Worker's D1.
 */

import { NextRequest, NextResponse } from 'next/server';

// Lazy-load DB to avoid crashes on Cloudflare where better-sqlite3 isn't available
let dbAvailable: boolean | null = null;
let initializeDB: (() => Promise<any>) | null = null;
let getDB: (() => any) | null = null;
let TABLES: Record<string, string> = {};

async function ensureDB(): Promise<boolean> {
  if (dbAvailable !== null) return dbAvailable;
  
  try {
    const dbModule = await import('@/lib/db/connection');
    const schemaModule = await import('@/lib/db/schema');
    initializeDB = dbModule.initializeDB;
    getDB = dbModule.getDB;
    TABLES = schemaModule.TABLES;
    await initializeDB();
    dbAvailable = true;
  } catch {
    console.warn('[Popular Searches] SQLite not available in this environment - returning empty results');
    dbAvailable = false;
  }
  return dbAvailable;
}

// Normalize search query for consistent tracking
function normalizeQuery(query: string): string {
  return query.toLowerCase().trim().replace(/\s+/g, ' ');
}

// Calculate trending score based on recency and frequency
function calculateTrendingScore(searchCount: number, lastSearched: number): number {
  const now = Date.now();
  const daysSinceLastSearch = (now - lastSearched) / (1000 * 60 * 60 * 24);
  const decayFactor = Math.exp(-daysSinceLastSearch / 7);
  return searchCount * decayFactor;
}

export async function GET() {
  try {
    if (!(await ensureDB()) || !getDB) {
      return NextResponse.json({
        success: true,
        data: { popular: [], trending: [] }
      });
    }

    const db = getDB();

    const popularSearches = db.prepare(`
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

    const recentTrending = db.prepare(`
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
    return NextResponse.json({
      success: true,
      data: { popular: [], trending: [] }
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!(await ensureDB()) || !getDB) {
      return NextResponse.json({ success: true, message: 'Tracking skipped - DB not available' });
    }

    const { query, sessionId, resultsCount, clickedResult } = await request.json();

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }

    const db = getDB();
    const normalizedQuery = normalizeQuery(query);
    const timestamp = Date.now();
    const searchId = `search_${timestamp}_${Math.random().toString(36).substring(2)}`;

    db.prepare(`
      INSERT INTO ${TABLES.SEARCH_QUERIES} 
      (id, query, normalized_query, session_id, results_count, clicked_result, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(searchId, query, normalizedQuery, sessionId, resultsCount || 0, clickedResult || false, timestamp);

    const existingPopular = db.prepare(`
      SELECT * FROM ${TABLES.POPULAR_SEARCHES} WHERE normalized_query = ?
    `).get(normalizedQuery) as any;

    if (existingPopular) {
      const newSearchCount = existingPopular.search_count + 1;
      const newClickCount = existingPopular.click_count + (clickedResult ? 1 : 0);
      const newTrendingScore = calculateTrendingScore(newSearchCount, timestamp);

      db.prepare(`
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
      const trendingScore = calculateTrendingScore(1, timestamp);
      
      db.prepare(`
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
      { success: true, message: 'Tracking failed gracefully' }
    );
  }
}
