/**
 * Admin Authentication Utilities
 */

import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

interface AdminUser {
  id: string;
  username: string;
}

interface AuthResult {
  success: boolean;
  user?: AdminUser;
  error?: string;
}

export async function verifyAdminAuth(request: NextRequest): Promise<AuthResult> {
  try {
    // Get token from cookie
    const token = request.cookies.get('admin_token')?.value;
    
    if (!token) {
      return { success: false, error: 'No authentication token' };
    }

    // Verify JWT token
    const decoded = jwt.verify(token, JWT_SECRET) as AdminUser;
    
    return {
      success: true,
      user: {
        id: decoded.id,
        username: decoded.username,
      },
    };
  } catch (error) {
    console.error('Admin auth verification error:', error);
    return { success: false, error: 'Invalid authentication token' };
  }
}

export function createAdminMiddleware() {
  return async (request: NextRequest) => {
    const authResult = await verifyAdminAuth(request);
    
    if (!authResult.success) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    return null; // Continue to route handler
  };
}