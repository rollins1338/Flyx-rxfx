/**
 * Admin Authentication Utilities for Cloudflare Workers
 * 
 * This module provides authentication utilities compatible with Cloudflare Workers runtime.
 * Uses Web Crypto API for password hashing and JWT handling.
 * 
 * Requirements: 6.1, 4.3
 */

import { NextRequest } from 'next/server';
import type { D1Env } from '../db/d1-connection';
import { getAdminAdapter } from '../db/adapter';

// ============================================
// Constants
// ============================================

const JWT_SECRET = (() => {
  const secret = process.env.JWT_SECRET;
  if (!secret && typeof window === 'undefined') {
    console.warn('[admin-auth] JWT_SECRET is not set! Authentication will fail in production.');
  }
  return secret || 'INSECURE_FALLBACK_DO_NOT_USE_IN_PRODUCTION';
})();
const ADMIN_COOKIE = 'admin_token';
const JWT_EXPIRY_HOURS = 24;

// ============================================
// Types
// ============================================

export interface AdminUser {
  id: string | number;
  username: string;
  password_hash?: string;
  role?: string;
  permissions?: string;
  specific_permissions?: string;
  created_at?: string | number;
  last_login?: string | number | null;
}

export interface AuthResult {
  success: boolean;
  user?: {
    id: string | number;
    username: string;
    role?: string;
  };
  error?: string;
}

export interface JWTPayload {
  userId: string | number;
  username: string;
  iat: number;
  exp: number;
}

// ============================================
// Crypto Utilities (Node.js fallback for testing)
// ============================================

/**
 * Get random bytes - uses Web Crypto API or Node.js crypto as fallback
 */
async function getRandomBytes(length: number): Promise<Uint8Array> {
  // Try Web Crypto API first (Cloudflare Workers)
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return bytes;
  }
  
  // Fallback to Node.js crypto
  try {
    const nodeCrypto = await import('node:crypto');
    if (nodeCrypto.randomBytes) {
      return new Uint8Array(nodeCrypto.randomBytes(length));
    }
    // Try webcrypto from Node.js
    if (nodeCrypto.webcrypto && nodeCrypto.webcrypto.getRandomValues) {
      const bytes = new Uint8Array(length);
      nodeCrypto.webcrypto.getRandomValues(bytes);
      return bytes;
    }
  } catch {
    // Ignore and try next fallback
  }
  
  // Last resort: use Math.random (not cryptographically secure, but works for testing)
  const bytes = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  return bytes;
}

/**
 * Derive key using PBKDF2 - uses Web Crypto API or Node.js crypto as fallback
 */
async function pbkdf2Derive(
  password: string,
  salt: Uint8Array,
  iterations: number,
  keyLength: number
): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  
  // Try Web Crypto API first (Cloudflare Workers)
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        'PBKDF2',
        false,
        ['deriveBits']
      );
      
      const derivedBits = await crypto.subtle.deriveBits(
        {
          name: 'PBKDF2',
          salt: salt.buffer as ArrayBuffer,
          iterations: iterations,
          hash: 'SHA-256',
        },
        keyMaterial,
        keyLength * 8
      );
      
      return new Uint8Array(derivedBits);
    } catch {
      // Fall through to Node.js fallback
    }
  }
  
  // Fallback to Node.js crypto
  try {
    const nodeCrypto = await import('node:crypto');
    
    // Try webcrypto first
    if (nodeCrypto.webcrypto && nodeCrypto.webcrypto.subtle) {
      const keyMaterial = await nodeCrypto.webcrypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        'PBKDF2',
        false,
        ['deriveBits']
      );
      
      const derivedBits = await nodeCrypto.webcrypto.subtle.deriveBits(
        {
          name: 'PBKDF2',
          salt: salt.buffer as ArrayBuffer,
          iterations: iterations,
          hash: 'SHA-256',
        },
        keyMaterial,
        keyLength * 8
      );
      
      return new Uint8Array(derivedBits);
    }
    
    // Fallback to pbkdf2Sync
    if (nodeCrypto.pbkdf2Sync) {
      const derivedKey = nodeCrypto.pbkdf2Sync(
        password,
        Buffer.from(salt),
        iterations,
        keyLength,
        'sha256'
      );
      return new Uint8Array(derivedKey);
    }
  } catch {
    // Ignore and throw error
  }
  
  throw new Error('No PBKDF2 implementation available');
}

/**
 * HMAC sign data - uses Web Crypto API or Node.js crypto as fallback
 */
async function hmacSign(key: string, data: string): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  
  // Try Web Crypto API first (Cloudflare Workers)
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      encoder.encode(key),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signature = await crypto.subtle.sign(
      'HMAC',
      cryptoKey,
      encoder.encode(data)
    );
    
    return new Uint8Array(signature);
  }
  
  // Fallback to Node.js crypto
  try {
    const nodeCrypto = await import('crypto');
    const hmac = nodeCrypto.createHmac('sha256', key);
    hmac.update(data);
    return new Uint8Array(hmac.digest());
  } catch {
    throw new Error('No crypto implementation available');
  }
}

/**
 * HMAC verify data - uses Web Crypto API or Node.js crypto as fallback
 */
async function hmacVerify(key: string, data: string, signature: Uint8Array): Promise<boolean> {
  const encoder = new TextEncoder();
  
  // Try Web Crypto API first (Cloudflare Workers)
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      encoder.encode(key),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    
    return crypto.subtle.verify(
      'HMAC',
      cryptoKey,
      signature.buffer as ArrayBuffer,
      encoder.encode(data)
    );
  }
  
  // Fallback to Node.js crypto
  try {
    const nodeCrypto = await import('crypto');
    const hmac = nodeCrypto.createHmac('sha256', key);
    hmac.update(data);
    const expected = new Uint8Array(hmac.digest());
    
    // Constant-time comparison
    if (expected.length !== signature.length) return false;
    let result = 0;
    for (let i = 0; i < expected.length; i++) {
      result |= expected[i] ^ signature[i];
    }
    return result === 0;
  } catch {
    throw new Error('No crypto implementation available');
  }
}

// ============================================
// Web Crypto API Password Hashing
// ============================================

/**
 * Hash a password using PBKDF2 with Web Crypto API
 * Compatible with Cloudflare Workers runtime
 * Falls back to Node.js crypto for testing
 * 
 * @param password - Plain text password to hash
 * @returns Promise<string> - Base64 encoded hash with salt
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = await getRandomBytes(16);
  const derivedKey = await pbkdf2Derive(password, salt, 100000, 32);
  
  // Combine salt and hash for storage
  const combined = new Uint8Array(salt.length + derivedKey.length);
  combined.set(salt);
  combined.set(derivedKey, salt.length);
  
  return btoa(String.fromCharCode(...combined));
}

/**
 * Verify a password against a stored hash
 * Compatible with Cloudflare Workers runtime
 * Falls back to Node.js crypto for testing
 * 
 * @param password - Plain text password to verify
 * @param storedHash - Base64 encoded hash with salt
 * @returns Promise<boolean> - True if password matches
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  try {
    // Decode the stored hash
    const combined = Uint8Array.from(atob(storedHash), c => c.charCodeAt(0));
    const salt = combined.slice(0, 16);
    const storedHashBytes = combined.slice(16);
    
    // Derive the hash from the provided password
    const derivedHashBytes = await pbkdf2Derive(password, salt, 100000, 32);
    
    // Constant-time comparison
    if (derivedHashBytes.length !== storedHashBytes.length) {
      return false;
    }
    
    let result = 0;
    for (let i = 0; i < derivedHashBytes.length; i++) {
      result |= derivedHashBytes[i] ^ storedHashBytes[i];
    }
    
    return result === 0;
  } catch (error) {
    console.error('Password verification error:', error);
    return false;
  }
}

/**
 * Verify password with bcrypt fallback for legacy hashes
 * Supports both new Web Crypto hashes and legacy bcrypt hashes
 * 
 * @param password - Plain text password to verify
 * @param storedHash - Stored hash (either Web Crypto or bcrypt format)
 * @returns Promise<boolean> - True if password matches
 */
export async function verifyPasswordWithFallback(password: string, storedHash: string): Promise<boolean> {
  console.log('[verifyPasswordWithFallback] Hash type:', storedHash.startsWith('$2') ? 'bcrypt' : 'webcrypto');
  
  // Check if it's a bcrypt hash (starts with $2a$, $2b$, or $2y$)
  if (storedHash.startsWith('$2')) {
    try {
      // Dynamic import bcryptjs for legacy support
      const bcrypt = await import('bcryptjs');
      console.log('[verifyPasswordWithFallback] bcryptjs imported successfully');
      const result = bcrypt.compareSync(password, storedHash);
      console.log('[verifyPasswordWithFallback] bcrypt compare result:', result);
      return result;
    } catch (error) {
      console.error('[verifyPasswordWithFallback] bcrypt verification failed:', error);
      return false;
    }
  }
  
  // Use Web Crypto verification for new hashes
  console.log('[verifyPasswordWithFallback] Using Web Crypto verification');
  return verifyPassword(password, storedHash);
}

// ============================================
// JWT Handling with Web Crypto API
// ============================================

/**
 * Create a JWT token using Web Crypto API
 * Compatible with Cloudflare Workers runtime
 * Falls back to Node.js crypto for testing
 * 
 * @param payload - Data to encode in the token
 * @returns Promise<string> - JWT token string
 */
export async function createJWT(payload: { userId: string | number; username: string }): Promise<string> {
  const header = {
    alg: 'HS256',
    typ: 'JWT',
  };
  
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: JWTPayload = {
    ...payload,
    iat: now,
    exp: now + (JWT_EXPIRY_HOURS * 60 * 60),
  };
  
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));
  
  const data = `${encodedHeader}.${encodedPayload}`;
  
  // Sign the data using HMAC
  const signature = await hmacSign(JWT_SECRET, data);
  const encodedSignature = base64UrlEncode(String.fromCharCode(...signature));
  
  return `${data}.${encodedSignature}`;
}

/**
 * Verify and decode a JWT token using Web Crypto API
 * Compatible with Cloudflare Workers runtime
 * Falls back to Node.js crypto for testing
 * 
 * @param token - JWT token string to verify
 * @returns Promise<JWTPayload | null> - Decoded payload or null if invalid
 */
export async function verifyJWT(token: string): Promise<JWTPayload | null> {
  try {
    const parts = token.split('.');
    
    if (parts.length !== 3) {
      return null;
    }
    
    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    const data = `${encodedHeader}.${encodedPayload}`;
    
    // Decode the signature
    const signature = Uint8Array.from(base64UrlDecode(encodedSignature), c => c.charCodeAt(0));
    
    // Verify the signature using HMAC
    const isValid = await hmacVerify(JWT_SECRET, data, signature);
    
    if (!isValid) {
      return null;
    }
    
    // Decode the payload
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as JWTPayload;
    
    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return null;
    }
    
    return payload;
  } catch (error) {
    console.error('JWT verification error:', error);
    return null;
  }
}

/**
 * Verify JWT with fallback to jsonwebtoken for legacy tokens
 * 
 * @param token - JWT token string to verify
 * @returns Promise<JWTPayload | null> - Decoded payload or null if invalid
 */
export async function verifyJWTWithFallback(token: string): Promise<JWTPayload | null> {
  // First try Web Crypto verification
  const result = await verifyJWT(token);
  if (result) {
    return result;
  }
  
  // Fallback to jsonwebtoken for legacy tokens
  try {
    const jwt = await import('jsonwebtoken');
    const decoded = jwt.default.verify(token, JWT_SECRET) as { userId: string | number; username: string };
    return {
      userId: decoded.userId,
      username: decoded.username,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (JWT_EXPIRY_HOURS * 60 * 60),
    };
  } catch (error) {
    console.error('Legacy JWT verification failed:', error);
    return null;
  }
}

// ============================================
// Base64 URL Encoding/Decoding
// ============================================

function base64UrlEncode(str: string): string {
  return btoa(str)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlDecode(str: string): string {
  // Add padding if needed
  let padded = str;
  const padding = 4 - (str.length % 4);
  if (padding !== 4) {
    padded += '='.repeat(padding);
  }
  
  return atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
}

// ============================================
// Authentication Functions
// ============================================

/**
 * Verify admin authentication from request
 * Uses D1 database for user lookup
 * 
 * @param request - NextRequest object
 * @param env - Optional D1 environment for Workers context
 * @returns Promise<AuthResult> - Authentication result
 */
export async function verifyAdminAuth(request: NextRequest): Promise<AuthResult> {
  try {
    // Get token from cookie or Authorization header
    const token = request.cookies.get(ADMIN_COOKIE)?.value || 
                 request.headers.get('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return { success: false, error: 'No authentication token' };
    }

    // Verify JWT token with fallback for legacy tokens
    const decoded = await verifyJWTWithFallback(token);
    
    if (!decoded) {
      return { success: false, error: 'Invalid authentication token' };
    }
    
    return {
      success: true,
      user: {
        id: decoded.userId,
        username: decoded.username,
      },
    };
  } catch (error) {
    console.error('Admin auth verification error:', error);
    return { success: false, error: 'Invalid authentication token' };
  }
}

/**
 * Authenticate admin user with username and password
 * Uses D1 database for user lookup and verification
 * 
 * @param username - Admin username
 * @param password - Admin password
 * @param env - Optional D1 environment for Workers context
 * @returns Promise<{ success: boolean; token?: string; user?: AdminUser; error?: string }>
 */
export async function authenticateAdmin(
  username: string,
  password: string,
  env?: D1Env
): Promise<{ success: boolean; token?: string; user?: AdminUser; error?: string }> {
  try {
    console.log('[authenticateAdmin] Starting authentication for:', username);
    
    // Get admin database adapter (uses ADMIN_DB binding)
    const adapter = getAdminAdapter({ d1Env: env });
    
    console.log('[authenticateAdmin] Got admin adapter, querying database...');
    
    // Query for admin user
    const result = await adapter.queryFirst<AdminUser>(
      'SELECT * FROM admin_users WHERE username = ?',
      [username]
    );
    
    console.log('[authenticateAdmin] Query result:', { 
      hasData: !!result.data, 
      error: result.error,
      source: result.source 
    });
    
    if (result.error || !result.data) {
      console.log('[authenticateAdmin] User not found or query error');
      return { success: false, error: 'Invalid credentials' };
    }
    
    const admin = result.data;
    console.log('[authenticateAdmin] Found user:', { 
      id: admin.id, 
      username: admin.username,
      hasPasswordHash: !!admin.password_hash,
      hashPrefix: admin.password_hash?.substring(0, 10)
    });
    
    // Verify password with fallback for legacy bcrypt hashes
    const isValid = await verifyPasswordWithFallback(password, admin.password_hash || '');
    
    console.log('[authenticateAdmin] Password verification result:', isValid);
    
    if (!isValid) {
      return { success: false, error: 'Invalid credentials' };
    }
    
    // Create JWT token
    const token = await createJWT({
      userId: admin.id,
      username: admin.username,
    });
    
    // Update last login
    await adapter.execute(
      'UPDATE admin_users SET last_login = ? WHERE id = ?',
      [Date.now(), admin.id]
    );
    
    return {
      success: true,
      token,
      user: {
        id: admin.id,
        username: admin.username,
        role: admin.role,
      },
    };
  } catch (error) {
    console.error('Admin authentication error:', error);
    // Pass through D1 availability errors for environment detection
    const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
    return { success: false, error: errorMessage };
  }
}

/**
 * Get admin user by ID from D1 database
 * 
 * @param userId - Admin user ID
 * @param env - Optional D1 environment for Workers context
 * @returns Promise<AdminUser | null>
 */
export async function getAdminById(userId: string | number, env?: D1Env): Promise<AdminUser | null> {
  try {
    const adapter = getAdminAdapter({ d1Env: env });
    
    const result = await adapter.queryFirst<AdminUser>(
      'SELECT * FROM admin_users WHERE id = ?',
      [userId]
    );
    
    if (result.error || !result.data) {
      return null;
    }
    
    return result.data;
  } catch (error) {
    console.error('Get admin by ID error:', error);
    return null;
  }
}

/**
 * Create admin middleware for route protection
 * 
 * @returns Middleware function
 */
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

/**
 * Change admin password
 * 
 * @param userId - Admin user ID
 * @param currentPassword - Current password for verification
 * @param newPassword - New password to set
 * @param env - Optional D1 environment for Workers context
 * @returns Promise<{ success: boolean; error?: string }>
 */
export async function changeAdminPassword(
  userId: string | number,
  currentPassword: string,
  newPassword: string,
  env?: D1Env
): Promise<{ success: boolean; error?: string }> {
  try {
    const adapter = getAdminAdapter({ d1Env: env });
    
    // Get current user
    const result = await adapter.queryFirst<AdminUser>(
      'SELECT * FROM admin_users WHERE id = ?',
      [userId]
    );
    
    if (result.error || !result.data) {
      return { success: false, error: 'User not found' };
    }
    
    const admin = result.data;
    
    // Verify current password
    const isValid = await verifyPasswordWithFallback(currentPassword, admin.password_hash || '');
    
    if (!isValid) {
      return { success: false, error: 'Current password is incorrect' };
    }
    
    // Hash new password using Web Crypto
    const newPasswordHash = await hashPassword(newPassword);
    
    // Update password
    const updateResult = await adapter.execute(
      'UPDATE admin_users SET password_hash = ? WHERE id = ?',
      [newPasswordHash, userId]
    );
    
    if (!updateResult.success) {
      return { success: false, error: 'Failed to update password' };
    }
    
    return { success: true };
  } catch (error) {
    console.error('Change password error:', error);
    return { success: false, error: 'Failed to change password' };
  }
}

// ============================================
// Exports
// ============================================

export { ADMIN_COOKIE, JWT_EXPIRY_HOURS };
