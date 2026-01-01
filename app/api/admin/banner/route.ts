/**
 * Admin Banner API
 * GET /api/admin/banner - Fetch current banner (public for display, admin for editing)
 * POST /api/admin/banner - Update banner (admin only)
 * DELETE /api/admin/banner - Disable banner (admin only)
 * 
 * Implements standardized response format per Requirements 16.2, 16.3, 16.4, 16.5
 */

import { NextRequest } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { verifyAdminAuth } from '../../../lib/utils/admin-auth';
import {
  successResponse,
  unauthorizedResponse,
  internalErrorResponse,
} from '../../../lib/utils/api-response';

const sql = neon(process.env.DATABASE_URL!);

export interface BannerConfig {
  id: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'error';
  enabled: boolean;
  dismissible: boolean;
  linkText?: string;
  linkUrl?: string;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

// GET - Fetch current banner (public endpoint for display)
export async function GET(request: NextRequest) {
  try {
    // Check if this is an admin request (should return banner even if disabled)
    const url = new URL(request.url);
    const isAdminRequest = url.searchParams.get('admin') === 'true';
    
    // Try to get banner from database
    const result = await sql`
      SELECT * FROM site_settings WHERE key = 'banner' LIMIT 1
    `;
    
    if (result.length > 0 && result[0].value) {
      const banner = JSON.parse(result[0].value) as BannerConfig;
      
      // For admin requests, always return the banner for editing
      if (isAdminRequest) {
        return successResponse({ banner });
      }
      
      // Check if banner has expired
      if (banner.expiresAt && new Date(banner.expiresAt) < new Date()) {
        return successResponse({ banner: null });
      }
      
      // Only return if enabled
      if (!banner.enabled) {
        return successResponse({ banner: null });
      }
      
      return successResponse({ banner });
    }
    
    return successResponse({ banner: null });
  } catch (error) {
    console.error('[Banner API] Error fetching banner:', error);
    // Return null banner on error (don't break the site)
    return successResponse({ banner: null });
  }
}

// Generate a unique banner ID based on timestamp and random string
function generateBannerId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `banner-${timestamp}-${random}`;
}

// POST - Update banner (admin only)
export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication - Requirements 16.3
    const authResult = await verifyAdminAuth(request);
    if (!authResult.success) {
      return unauthorizedResponse(authResult.error || 'Authentication required');
    }
    
    const body = await request.json();
    const { message, type = 'info', enabled = true, dismissible = true, linkText, linkUrl, expiresAt } = body;
    
    // Generate a new unique ID each time the banner is saved
    // This ensures users who dismissed an old banner will see the new one
    const banner: BannerConfig = {
      id: generateBannerId(),
      message: message || '',
      type,
      enabled,
      dismissible,
      linkText,
      linkUrl,
      expiresAt,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    // Ensure site_settings table exists
    await sql`
      CREATE TABLE IF NOT EXISTS site_settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;
    
    // Upsert banner
    await sql`
      INSERT INTO site_settings (key, value, updated_at)
      VALUES ('banner', ${JSON.stringify(banner)}, NOW())
      ON CONFLICT (key) DO UPDATE SET
        value = ${JSON.stringify(banner)},
        updated_at = NOW()
    `;
    
    return successResponse({ banner }, { message: 'Banner updated successfully' });
  } catch (error) {
    console.error('[Banner API] Error updating banner:', error);
    return internalErrorResponse('Failed to update banner', error instanceof Error ? error : undefined);
  }
}

// DELETE - Disable/remove banner (admin only)
export async function DELETE(request: NextRequest) {
  try {
    // Verify admin authentication - Requirements 16.3
    const authResult = await verifyAdminAuth(request);
    if (!authResult.success) {
      return unauthorizedResponse(authResult.error || 'Authentication required');
    }
    
    // Set banner to disabled
    await sql`
      UPDATE site_settings 
      SET value = jsonb_set(value::jsonb, '{enabled}', 'false')::text,
          updated_at = NOW()
      WHERE key = 'banner'
    `;
    
    return successResponse(null, { message: 'Banner disabled successfully' });
  } catch (error) {
    console.error('[Banner API] Error deleting banner:', error);
    return internalErrorResponse('Failed to delete banner', error instanceof Error ? error : undefined);
  }
}
