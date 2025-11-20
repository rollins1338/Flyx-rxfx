import { NextRequest, NextResponse } from 'next/server';
import { initializeDB } from '@/app/lib/db/neon-connection';

export async function GET(req: NextRequest) {
    try {
        const searchParams = req.nextUrl.searchParams;
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '20');
        const offset = (page - 1) * limit;

        const db = await initializeDB();

        // Fetch sessions with user and content details
        const sessionsQuery = `
      SELECT 
        ws.id,
        ws.user_id,
        ws.content_id,
        ws.content_type,
        ws.started_at,
        ws.duration,
        ws.device_type,
        ws.ip_address,
        u.email as user_email,
        u.username as user_name
      FROM watch_sessions ws
      LEFT JOIN users u ON ws.user_id = u.id
      ORDER BY ws.started_at DESC
      LIMIT $1 OFFSET $2
    `;

        const countQuery = `SELECT COUNT(*) as total FROM watch_sessions`;

        // Use getAdapter().query() as the db instance itself doesn't expose query()
        const sessionsResult = await db.getAdapter().query(sessionsQuery, [limit, offset]);
        const countResult = await db.getAdapter().query(countQuery);

        // Handle potential difference in return type (rows array vs result object)
        const sessions = Array.isArray(sessionsResult) ? sessionsResult : (sessionsResult as any).rows || [];

        // Handle count result safely
        let total = 0;
        if (Array.isArray(countResult) && countResult.length > 0) {
            total = parseInt(countResult[0].total || countResult[0].count || '0');
        } else if ((countResult as any).rows && (countResult as any).rows.length > 0) {
            total = parseInt((countResult as any).rows[0].total || (countResult as any).rows[0].count || '0');
        }

        return NextResponse.json({
            data: sessions,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error('Failed to fetch sessions:', error);
        return NextResponse.json(
            { error: 'Failed to fetch sessions' },
            { status: 500 }
        );
    }
}
