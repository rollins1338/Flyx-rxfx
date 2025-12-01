/**
 * Admin Password Change API
 * POST /api/admin/change-password - Change admin password
 */

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { initializeDB, getDB } from '@/lib/db/neon-connection';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const ADMIN_COOKIE = 'admin_token';

export async function POST(request: NextRequest) {
  try {
    // Get token from cookie
    const token = request.cookies.get(ADMIN_COOKIE)?.value;
    
    if (!token) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Verify JWT token
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET) as { id: string; username: string };
    } catch {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    const { currentPassword, newPassword } = await request.json();

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: 'Current password and new password are required' },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: 'New password must be at least 6 characters' },
        { status: 400 }
      );
    }

    // Initialize database and get admin user
    await initializeDB();
    const db = getDB();
    const adapter = db.getAdapter();
    
    let adminQuery, updateQuery;
    if (db.isUsingNeon()) {
      adminQuery = 'SELECT * FROM admin_users WHERE id = $1';
      updateQuery = 'UPDATE admin_users SET password_hash = $1 WHERE id = $2';
    } else {
      adminQuery = 'SELECT * FROM admin_users WHERE id = ?';
      updateQuery = 'UPDATE admin_users SET password_hash = ? WHERE id = ?';
    }
    
    const adminResult = await adapter.query(adminQuery, [decoded.id]);
    const admin = adminResult[0];

    if (!admin) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Verify current password
    if (!bcrypt.compareSync(currentPassword, admin.password_hash)) {
      return NextResponse.json(
        { error: 'Current password is incorrect' },
        { status: 401 }
      );
    }

    // Hash new password and update
    const newPasswordHash = bcrypt.hashSync(newPassword, 10);
    await adapter.execute(updateQuery, [newPasswordHash, decoded.id]);

    return NextResponse.json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error) {
    console.error('Password change error:', error);
    return NextResponse.json(
      { error: 'Failed to change password' },
      { status: 500 }
    );
  }
}
