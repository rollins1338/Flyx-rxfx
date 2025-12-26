/**
 * Admin User Info API
 * GET /api/admin/me - Get current admin user info with roles and permissions
 */

import { NextRequest, NextResponse } from 'next/server';
import { initializeDB, getDB } from '@/lib/db/server-connection';
import { AdminAuthService } from '@/app/admin/middleware/auth-server';

export async function GET(request: NextRequest) {
  const requestId = `admin_me_${Date.now()}`;
  
  console.log(`[${requestId}] Admin me endpoint called`);
  
  try {
    // Use the enhanced authentication service
    const authResult = await AdminAuthService.authenticateRequest(request);
    
    if (!authResult.success || !authResult.user) {
      console.log(`[${requestId}] Authentication failed:`, authResult.error);
      return NextResponse.json(
        { error: authResult.error || 'Authentication required' },
        { status: 401 }
      );
    }

    const user = authResult.user;
    console.log(`[${requestId}] Successfully authenticated user:`, user.username);

    // Update last login timestamp
    const now = Date.now();
    
    try {
      await initializeDB();
      const db = getDB();
      const adapter = db.getAdapter();
      
      if (db.isUsingNeon()) {
        await adapter.execute(
          'UPDATE admin_users SET last_login = $1 WHERE id = $2',
          [now, user.id]
        );
      } else {
        await adapter.execute(
          'UPDATE admin_users SET last_login = ? WHERE id = ?',
          [now, user.id]
        );
      }
      console.log(`[${requestId}] Updated last login for user:`, user.username);
    } catch (updateError) {
      console.error(`[${requestId}] Failed to update last login:`, updateError);
      // Don't fail the request for this
    }

    // Return enhanced user info with permissions
    const userInfo = {
      id: user.id,
      username: user.username,
      role: user.role,
      permissions: user.permissions,
      specificPermissions: user.specificPermissions,
      createdAt: user.createdAt,
      lastLogin: now,
      permissionScope: AdminAuthService.getUserPermissionScope(user)
    };

    console.log(`[${requestId}] Successfully retrieved enhanced user info for:`, user.username);
    
    return NextResponse.json({
      success: true,
      user: userInfo,
      requestId,
    });
    
  } catch (error) {
    const errorInfo = error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack
    } : {
      name: 'UnknownError',
      message: String(error),
      stack: undefined
    };
    
    console.error(`[${requestId}] Admin me endpoint failed:`, errorInfo);
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        requestId,
        debug: process.env.NODE_ENV === 'development' ? errorInfo : undefined
      },
      { status: 500 }
    );
  }
}

// Handle OPTIONS for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}