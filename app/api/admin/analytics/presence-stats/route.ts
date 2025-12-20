/**
 * Presence Statistics API
 * GET /api/admin/analytics/presence-stats - Get detailed presence tracking stats
 * 
 * Provides insights into:
 * - Active users breakdown
 * - Session quality (validation scores)
 * - Duplicate detection stats
 * - Geographic distribution of active users
 */

import { NextRequest, NextResponse } from 'next/server';
import { initializeDB, getDB } from '@/lib/db/neon-connection';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const minutes = parseInt(searchParams.get('minutes') || '30');

    await initializeDB();
    const db = getDB();
    const adapter = db.getAdapter();
    const isNeon = db.isUsingNeon();

    const now = Date.now();
    const cutoffTime = now - (minutes * 60 * 1000);
    const strictCutoff = now - (30 * 1000); // 30 seconds for "truly active"

    // Get active users by activity type
    const activityBreakdown = isNeon
      ? await adapter.query(`
          SELECT 
            activity_type,
            COUNT(DISTINCT user_id) as user_count,
            COUNT(DISTINCT CASE WHEN last_heartbeat >= $2 THEN user_id END) as truly_active
          FROM live_activity
          WHERE is_active = TRUE AND last_heartbeat >= $1
          GROUP BY activity_type
        `, [cutoffTime, strictCutoff])
      : await adapter.query(`
          SELECT 
            activity_type,
            COUNT(DISTINCT user_id) as user_count,
            COUNT(DISTINCT CASE WHEN last_heartbeat >= ? THEN user_id END) as truly_active
          FROM live_activity
          WHERE is_active = 1 AND last_heartbeat >= ?
          GROUP BY activity_type
        `, [strictCutoff, cutoffTime]);

    // Get validation score distribution from user_activity
    const validationScores = isNeon
      ? await adapter.query(`
          SELECT 
            CASE 
              WHEN human_score >= 80 THEN 'high_trust'
              WHEN human_score >= 50 THEN 'medium_trust'
              WHEN human_score >= 30 THEN 'low_trust'
              ELSE 'suspicious'
            END as trust_level,
            COUNT(*) as user_count,
            AVG(human_score) as avg_score
          FROM user_activity
          WHERE last_seen >= $1
          GROUP BY 
            CASE 
              WHEN human_score >= 80 THEN 'high_trust'
              WHEN human_score >= 50 THEN 'medium_trust'
              WHEN human_score >= 30 THEN 'low_trust'
              ELSE 'suspicious'
            END
          ORDER BY avg_score DESC
        `, [cutoffTime])
      : await adapter.query(`
          SELECT 
            CASE 
              WHEN human_score >= 80 THEN 'high_trust'
              WHEN human_score >= 50 THEN 'medium_trust'
              WHEN human_score >= 30 THEN 'low_trust'
              ELSE 'suspicious'
            END as trust_level,
            COUNT(*) as user_count,
            AVG(human_score) as avg_score
          FROM user_activity
          WHERE last_seen >= ?
          GROUP BY 
            CASE 
              WHEN human_score >= 80 THEN 'high_trust'
              WHEN human_score >= 50 THEN 'medium_trust'
              WHEN human_score >= 30 THEN 'low_trust'
              ELSE 'suspicious'
            END
          ORDER BY avg_score DESC
        `, [cutoffTime]);

    // Get mouse entropy distribution (indicator of human behavior)
    const entropyStats = isNeon
      ? await adapter.query(`
          SELECT 
            CASE 
              WHEN mouse_entropy_avg >= 0.5 THEN 'high_entropy'
              WHEN mouse_entropy_avg >= 0.3 THEN 'medium_entropy'
              WHEN mouse_entropy_avg >= 0.1 THEN 'low_entropy'
              ELSE 'minimal_entropy'
            END as entropy_level,
            COUNT(*) as user_count,
            AVG(total_mouse_samples) as avg_samples
          FROM user_activity
          WHERE last_seen >= $1 AND total_mouse_samples > 0
          GROUP BY 
            CASE 
              WHEN mouse_entropy_avg >= 0.5 THEN 'high_entropy'
              WHEN mouse_entropy_avg >= 0.3 THEN 'medium_entropy'
              WHEN mouse_entropy_avg >= 0.1 THEN 'low_entropy'
              ELSE 'minimal_entropy'
            END
        `, [cutoffTime])
      : await adapter.query(`
          SELECT 
            CASE 
              WHEN mouse_entropy_avg >= 0.5 THEN 'high_entropy'
              WHEN mouse_entropy_avg >= 0.3 THEN 'medium_entropy'
              WHEN mouse_entropy_avg >= 0.1 THEN 'low_entropy'
              ELSE 'minimal_entropy'
            END as entropy_level,
            COUNT(*) as user_count,
            AVG(total_mouse_samples) as avg_samples
          FROM user_activity
          WHERE last_seen >= ? AND total_mouse_samples > 0
          GROUP BY 
            CASE 
              WHEN mouse_entropy_avg >= 0.5 THEN 'high_entropy'
              WHEN mouse_entropy_avg >= 0.3 THEN 'medium_entropy'
              WHEN mouse_entropy_avg >= 0.1 THEN 'low_entropy'
              ELSE 'minimal_entropy'
            END
        `, [cutoffTime]);

    // Get geographic distribution of active users
    const geoDistribution = isNeon
      ? await adapter.query(`
          SELECT 
            country,
            city,
            COUNT(DISTINCT user_id) as user_count
          FROM live_activity
          WHERE is_active = TRUE AND last_heartbeat >= $1 AND country IS NOT NULL
          GROUP BY country, city
          ORDER BY user_count DESC
          LIMIT 20
        `, [cutoffTime])
      : await adapter.query(`
          SELECT 
            country,
            city,
            COUNT(DISTINCT user_id) as user_count
          FROM live_activity
          WHERE is_active = 1 AND last_heartbeat >= ? AND country IS NOT NULL
          GROUP BY country, city
          ORDER BY user_count DESC
          LIMIT 20
        `, [cutoffTime]);

    // Get device type distribution
    const deviceDistribution = isNeon
      ? await adapter.query(`
          SELECT 
            device_type,
            COUNT(DISTINCT user_id) as user_count
          FROM live_activity
          WHERE is_active = TRUE AND last_heartbeat >= $1
          GROUP BY device_type
        `, [cutoffTime])
      : await adapter.query(`
          SELECT 
            device_type,
            COUNT(DISTINCT user_id) as user_count
          FROM live_activity
          WHERE is_active = 1 AND last_heartbeat >= ?
          GROUP BY device_type
        `, [cutoffTime]);

    // Get content being watched
    const activeContent = isNeon
      ? await adapter.query(`
          SELECT 
            content_title,
            content_type,
            activity_type,
            COUNT(DISTINCT user_id) as viewer_count
          FROM live_activity
          WHERE is_active = TRUE 
            AND last_heartbeat >= $1 
            AND content_title IS NOT NULL
            AND activity_type IN ('watching', 'livetv')
          GROUP BY content_title, content_type, activity_type
          ORDER BY viewer_count DESC
          LIMIT 10
        `, [cutoffTime])
      : await adapter.query(`
          SELECT 
            content_title,
            content_type,
            activity_type,
            COUNT(DISTINCT user_id) as viewer_count
          FROM live_activity
          WHERE is_active = 1 
            AND last_heartbeat >= ? 
            AND content_title IS NOT NULL
            AND activity_type IN ('watching', 'livetv')
          GROUP BY content_title, content_type, activity_type
          ORDER BY viewer_count DESC
          LIMIT 10
        `, [cutoffTime]);

    // Calculate totals
    const totals = isNeon
      ? await adapter.query(`
          SELECT 
            COUNT(DISTINCT user_id) as total_active,
            COUNT(DISTINCT CASE WHEN last_heartbeat >= $2 THEN user_id END) as truly_active,
            COUNT(DISTINCT session_id) as total_sessions
          FROM live_activity
          WHERE is_active = TRUE AND last_heartbeat >= $1
        `, [cutoffTime, strictCutoff])
      : await adapter.query(`
          SELECT 
            COUNT(DISTINCT user_id) as total_active,
            COUNT(DISTINCT CASE WHEN last_heartbeat >= ? THEN user_id END) as truly_active,
            COUNT(DISTINCT session_id) as total_sessions
          FROM live_activity
          WHERE is_active = 1 AND last_heartbeat >= ?
        `, [strictCutoff, cutoffTime]);

    return NextResponse.json({
      success: true,
      timestamp: now,
      period: { minutes, cutoffTime },
      totals: totals[0] || { total_active: 0, truly_active: 0, total_sessions: 0 },
      activityBreakdown,
      validationScores,
      entropyStats,
      geoDistribution,
      deviceDistribution,
      activeContent,
    });
  } catch (error) {
    console.error('Failed to get presence stats:', error);
    return NextResponse.json(
      { error: 'Failed to get presence stats' },
      { status: 500 }
    );
  }
}
