/**
 * Admin Authentication API
 * POST /api/admin/auth - Login
 * DELETE /api/admin/auth - Logout
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { initializeDB, getDB } from '@/lib/db/connection';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const ADMIN_COOKIE = 'admin_token';

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password required' },
        { status: 400 }
      );
    }

    // Initialize database and get admin user
    await initializeDB();
    const db = getDB();
    const stmt = db.query('SELECT * FROM admin_users WHERE username = ?');
    const admin = stmt.get(username) as any;

    if (!admin || !bcrypt.compareSync(password, admin.password_hash)) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Update last login
    const updateStmt = db.query('UPDATE admin_users SET last_login = ? WHERE id = ?');
    updateStmt.run(Date.now(), admin.id);

    // Create JWT token
    const token = jwt.sign(
      { id: admin.id, username: admin.username },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Set secure cookie
    const cookieStore = cookies();
    cookieStore.set(ADMIN_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60, // 24 hours
    });

    return NextResponse.json({
      success: true,
      user: {
        id: admin.id,
        username: admin.username,
      },
    });
  } catch (error) {
    console.error('Admin auth error:', error);
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const cookieStore = cookies();
    cookieStore.delete(ADMIN_COOKIE);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Admin logout error:', error);
    return NextResponse.json(
      { error: 'Logout failed' },
      { status: 500 }
    );
  }
}