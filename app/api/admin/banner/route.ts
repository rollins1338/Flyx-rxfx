import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

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

// GET - Fetch current banner
export async function GET() {
  try {
    // Try to get banner from database
    const result = await sql`
      SELECT * FROM site_settings WHERE key = 'banner' LIMIT 1
    `;
    
    if (result.length > 0 && result[0].value) {
      const banner = JSON.parse(result[0].value) as BannerConfig;
      
      // Check if banner has expired
      if (banner.expiresAt && new Date(banner.expiresAt) < new Date()) {
        return NextResponse.json({ banner: null });
      }
      
      // Only return if enabled
      if (!banner.enabled) {
        return NextResponse.json({ banner: null });
      }
      
      return NextResponse.json({ banner });
    }
    
    return NextResponse.json({ banner: null });
  } catch (error) {
    console.error('[Banner API] Error fetching banner:', error);
    // Return null banner on error (don't break the site)
    return NextResponse.json({ banner: null });
  }
}

// POST - Update banner (admin only)
export async function POST(request: NextRequest) {
  try {
    // Check admin auth
    const authHeader = request.headers.get('authorization');
    const adminPassword = process.env.ADMIN_PASSWORD;
    
    if (!adminPassword || authHeader !== `Bearer ${adminPassword}`) {
      // Also check cookie-based auth
      const cookies = request.cookies;
      const adminAuth = cookies.get('admin_auth')?.value;
      
      if (adminAuth !== adminPassword) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }
    
    const body = await request.json();
    const { message, type = 'info', enabled = true, dismissible = true, linkText, linkUrl, expiresAt } = body;
    
    const banner: BannerConfig = {
      id: 'main-banner',
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
    
    return NextResponse.json({ success: true, banner });
  } catch (error) {
    console.error('[Banner API] Error updating banner:', error);
    return NextResponse.json(
      { error: 'Failed to update banner' },
      { status: 500 }
    );
  }
}

// DELETE - Disable/remove banner (admin only)
export async function DELETE(request: NextRequest) {
  try {
    // Check admin auth
    const authHeader = request.headers.get('authorization');
    const adminPassword = process.env.ADMIN_PASSWORD;
    
    if (!adminPassword || authHeader !== `Bearer ${adminPassword}`) {
      const cookies = request.cookies;
      const adminAuth = cookies.get('admin_auth')?.value;
      
      if (adminAuth !== adminPassword) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }
    
    // Set banner to disabled
    await sql`
      UPDATE site_settings 
      SET value = jsonb_set(value::jsonb, '{enabled}', 'false')::text,
          updated_at = NOW()
      WHERE key = 'banner'
    `;
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Banner API] Error deleting banner:', error);
    return NextResponse.json(
      { error: 'Failed to delete banner' },
      { status: 500 }
    );
  }
}
