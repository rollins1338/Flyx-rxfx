/**
 * Admin Audit Log API
 * POST /api/admin/audit-log - Log administrative action
 * GET /api/admin/audit-log - Retrieve audit logs
 */

import { NextRequest, NextResponse } from 'next/server';
import { AdminAuthService, AuditLogService } from '@/app/admin/middleware/auth-server';
import { initializeDB, getDB } from '@/lib/db/server-connection';

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const authResult = await AdminAuthService.authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { error: authResult.error || 'Authentication required' },
        { status: 401 }
      );
    }

    // Check audit logging permission
    const permissionCheck = AdminAuthService.checkPermissions(
      authResult.user,
      'audit_logs',
      'write'
    );

    if (!permissionCheck.allowed) {
      return NextResponse.json(
        { error: 'Insufficient permissions for audit logging' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { actionType, success = true, targetResource, targetId, details = {}, duration } = body;

    if (!actionType) {
      return NextResponse.json(
        { error: 'Action type is required' },
        { status: 400 }
      );
    }

    // Log the action
    const enrichedDetails = {
      ...details,
      success,
      targetResource,
      targetId,
      duration
    };

    const clientIP = request.headers.get('x-forwarded-for') || 
                    request.headers.get('x-real-ip') || 
                    'unknown';

    await AuditLogService.logAction(
      authResult.user.id,
      actionType,
      enrichedDetails,
      clientIP
    );

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Audit log API error:', error);
    return NextResponse.json(
      { error: 'Failed to log audit entry' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const authResult = await AdminAuthService.authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { error: authResult.error || 'Authentication required' },
        { status: 401 }
      );
    }

    // Check audit log viewing permission
    const permissionCheck = AdminAuthService.checkPermissions(
      authResult.user,
      'audit_logs',
      'read'
    );

    if (!permissionCheck.allowed) {
      return NextResponse.json(
        { error: 'Insufficient permissions to view audit logs' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');
    const userId = searchParams.get('userId');
    const actionType = searchParams.get('actionType');
    const startTime = searchParams.get('startTime');
    const endTime = searchParams.get('endTime');

    await initializeDB();
    const db = getDB();
    const adapter = db.getAdapter();

    // Build query
    let query = 'SELECT * FROM audit_logs WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (userId) {
      if (db.isUsingNeon()) {
        query += ` AND user_id = $${paramIndex}`;
      } else {
        query += ` AND user_id = ?`;
      }
      params.push(userId);
      paramIndex++;
    }

    if (actionType) {
      if (db.isUsingNeon()) {
        query += ` AND action_type = $${paramIndex}`;
      } else {
        query += ` AND action_type = ?`;
      }
      params.push(actionType);
      paramIndex++;
    }

    if (startTime) {
      if (db.isUsingNeon()) {
        query += ` AND timestamp >= $${paramIndex}`;
      } else {
        query += ` AND timestamp >= ?`;
      }
      params.push(parseInt(startTime));
      paramIndex++;
    }

    if (endTime) {
      if (db.isUsingNeon()) {
        query += ` AND timestamp <= $${paramIndex}`;
      } else {
        query += ` AND timestamp <= ?`;
      }
      params.push(parseInt(endTime));
      paramIndex++;
    }

    query += ' ORDER BY timestamp DESC';

    if (db.isUsingNeon()) {
      query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    } else {
      query += ` LIMIT ? OFFSET ?`;
    }
    params.push(limit, offset);

    const logs = await adapter.query(query, params);

    // Parse JSON fields
    const parsedLogs = logs.map(log => ({
      ...log,
      actionDetails: typeof log.action_details === 'string' 
        ? JSON.parse(log.action_details) 
        : log.action_details
    }));

    return NextResponse.json({
      success: true,
      logs: parsedLogs,
      pagination: {
        limit,
        offset,
        total: logs.length
      }
    });

  } catch (error) {
    console.error('Audit log retrieval error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve audit logs' },
      { status: 500 }
    );
  }
}