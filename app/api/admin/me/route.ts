/**
 * Admin User Info API
 * GET /api/admin/me - Get current admin user info
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import { initializeDB, getDB } from '@/lib/db/connection';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const ADMIN_COOKIE = 'admin_token';

export async function GET() {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get(ADMIN_COOKIE)?.value;

    if (!token) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Verify JWT token
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    // Get user from database
    await initializeDB();
    const db = getDB();
    const stmt = db.query('SELECT id, username, created_at, last_login FROM admin_users WHERE id = ?');
    const admin = stmt.get(decoded.id) as any;

    if (!admin) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      user: {
        id: admin.id,
        username: admin.username,
        createdAt: admin.created_at,
        lastLogin: admin.last_login,
      },
    });
  } catch (error) {
    console.error('Admin me error:', error);
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 401 }
    );
  }
}