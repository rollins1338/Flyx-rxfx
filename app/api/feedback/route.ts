import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL || '');

// Ensure feedback table has screenshot column
let tableChecked = false;
async function ensureScreenshotColumn() {
  if (tableChecked) return;
  try {
    // Try to add the column if it doesn't exist
    await sql`
      ALTER TABLE feedback 
      ADD COLUMN IF NOT EXISTS screenshot TEXT
    `;
  } catch {
    // Column might already exist or table structure is different
  }
  tableChecked = true;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, message, email, url, userAgent, screenshot } = body;

    // Validate required fields
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    if (message.length > 2000) {
      return NextResponse.json(
        { error: 'Message is too long (max 2000 characters)' },
        { status: 400 }
      );
    }

    // Validate feedback type
    const validTypes = ['bug', 'feature', 'general', 'content'];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: 'Invalid feedback type' },
        { status: 400 }
      );
    }

    // Validate screenshot if provided (should be base64 data URL)
    if (screenshot) {
      if (typeof screenshot !== 'string' || !screenshot.startsWith('data:image/')) {
        return NextResponse.json(
          { error: 'Invalid screenshot format' },
          { status: 400 }
        );
      }
      // Check size (base64 is ~33% larger than original, so 5MB file = ~6.7MB base64)
      if (screenshot.length > 7 * 1024 * 1024) {
        return NextResponse.json(
          { error: 'Screenshot is too large' },
          { status: 400 }
        );
      }
    }

    // Get client IP for rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 
               request.headers.get('x-real-ip') || 
               'unknown';

    // Ensure screenshot column exists
    await ensureScreenshotColumn();

    // Store feedback in database
    await sql`
      INSERT INTO feedback (type, message, email, url, user_agent, ip_address, screenshot, created_at)
      VALUES (${type}, ${message.trim()}, ${email || null}, ${url || null}, ${userAgent || null}, ${ip}, ${screenshot || null}, NOW())
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error submitting feedback:', error);
    return NextResponse.json(
      { error: 'Failed to submit feedback' },
      { status: 500 }
    );
  }
}
