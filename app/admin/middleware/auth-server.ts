/**
 * Server-side Admin Authentication Service
 * Database operations and server-only authentication logic
 */

import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';
import { initializeDB, getDB } from '@/lib/db/server-connection';
import { 
  AdminUser, 
  AuthResult, 
  PermissionCheck, 
  AdminRole, 
  PermissionLevel, 
  FunctionalityCategory,
  ADMIN_COOKIE,
  ClientAuthUtils
} from '../types/auth';

// Constants
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key';

/**
 * Server-side Authentication Service
 */
export class AdminAuthService {
  /**
   * Authenticate admin user from request
   */
  static async authenticateRequest(request: NextRequest): Promise<AuthResult> {
    try {
      // Get token from cookie or Authorization header
      const token = request.cookies.get(ADMIN_COOKIE)?.value || 
                   request.headers.get('Authorization')?.replace('Bearer ', '');

      if (!token) {
        return {
          success: false,
          error: 'No authentication token provided',
          shouldRedirect: true
        };
      }

      // Verify JWT token
      let decoded: any;
      try {
        decoded = jwt.verify(token, JWT_SECRET);
      } catch (jwtError) {
        return {
          success: false,
          error: 'Invalid or expired token',
          shouldRedirect: true
        };
      }

      if (!decoded.userId) {
        return {
          success: false,
          error: 'Invalid token payload',
          shouldRedirect: true
        };
      }

      // Initialize database
      await initializeDB();
      const db = getDB();
      const adapter = db.getAdapter();

      // Get user from database
      const users = await adapter.query(
        'SELECT * FROM admin_users WHERE id = ?',
        [decoded.userId]
      );

      if (users.length === 0) {
        return {
          success: false,
          error: 'User not found',
          shouldRedirect: true
        };
      }

      const dbUser = users[0];

      // Construct admin user object
      const user: AdminUser = {
        id: dbUser.id,
        username: dbUser.username,
        role: (dbUser.role || 'viewer') as AdminRole,
        permissions: dbUser.permissions ? JSON.parse(dbUser.permissions) : ['read'],
        specificPermissions: dbUser.specific_permissions ? JSON.parse(dbUser.specific_permissions) : [],
        lastLogin: dbUser.last_login || Date.now(),
        createdAt: dbUser.created_at || Date.now()
      };

      return {
        success: true,
        user
      };

    } catch (error) {
      console.error('Authentication error:', error);
      return {
        success: false,
        error: 'Authentication failed',
        shouldRedirect: true
      };
    }
  }

  /**
   * Check if user has required permission level for a functionality category
   */
  static checkPermissions(
    user: AdminUser,
    category: FunctionalityCategory,
    requiredLevel: PermissionLevel = 'read'
  ): PermissionCheck {
    return ClientAuthUtils.checkPermissions(user, category, requiredLevel);
  }

  /**
   * Get user's permission scope for display purposes
   */
  static getUserPermissionScope(user: AdminUser) {
    return ClientAuthUtils.getUserPermissionScope(user);
  }

  /**
   * Create JWT token for user
   */
  static createToken(userId: string): string {
    return jwt.sign(
      { userId, iat: Math.floor(Date.now() / 1000) },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
  }

  /**
   * Update user's last login timestamp
   */
  static async updateLastLogin(userId: string): Promise<void> {
    try {
      await initializeDB();
      const db = getDB();
      const adapter = db.getAdapter();
      
      await adapter.execute(
        'UPDATE admin_users SET last_login = ? WHERE id = ?',
        [Date.now(), userId]
      );
    } catch (error) {
      console.error('Failed to update last login:', error);
    }
  }
}

/**
 * Audit Logging Service
 */
export class AuditLogService {
  /**
   * Log admin action for audit trail
   */
  static async logAction(
    userId: string,
    action: string,
    details: Record<string, any> = {},
    ipAddress?: string
  ): Promise<void> {
    try {
      await initializeDB();
      const db = getDB();
      const adapter = db.getAdapter();

      const logEntry = {
        id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        user_id: userId,
        action,
        details: JSON.stringify(details),
        ip_address: ipAddress,
        timestamp: Date.now(),
        created_at: Date.now()
      };

      await adapter.execute(
        `INSERT INTO audit_logs (id, user_id, action, details, ip_address, timestamp, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          logEntry.id,
          logEntry.user_id,
          logEntry.action,
          logEntry.details,
          logEntry.ip_address,
          logEntry.timestamp,
          logEntry.created_at
        ]
      );

    } catch (error) {
      console.error('Failed to log audit action:', error);
    }
  }

  /**
   * Get audit logs with pagination
   */
  static async getAuditLogs(
    page: number = 1,
    limit: number = 50,
    userId?: string,
    action?: string,
    startDate?: number,
    endDate?: number
  ): Promise<{
    logs: any[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    try {
      await initializeDB();
      const db = getDB();
      const adapter = db.getAdapter();

      let whereClause = 'WHERE 1=1';
      const params: any[] = [];

      if (userId) {
        whereClause += ' AND user_id = ?';
        params.push(userId);
      }

      if (action) {
        whereClause += ' AND action LIKE ?';
        params.push(`%${action}%`);
      }

      if (startDate) {
        whereClause += ' AND timestamp >= ?';
        params.push(startDate);
      }

      if (endDate) {
        whereClause += ' AND timestamp <= ?';
        params.push(endDate);
      }

      // Get total count
      const countResult = await adapter.query(
        `SELECT COUNT(*) as total FROM audit_logs ${whereClause}`,
        params
      );
      const total = countResult[0]?.total || 0;

      // Get paginated logs
      const offset = (page - 1) * limit;
      const logs = await adapter.query(
        `SELECT al.*, au.username 
         FROM audit_logs al 
         LEFT JOIN admin_users au ON al.user_id = au.id 
         ${whereClause} 
         ORDER BY al.timestamp DESC 
         LIMIT ? OFFSET ?`,
        [...params, limit, offset]
      );

      return {
        logs: logs.map(log => ({
          ...log,
          details: log.details ? JSON.parse(log.details) : {}
        })),
        total,
        page,
        totalPages: Math.ceil(total / limit)
      };

    } catch (error) {
      console.error('Failed to get audit logs:', error);
      return {
        logs: [],
        total: 0,
        page: 1,
        totalPages: 0
      };
    }
  }
}