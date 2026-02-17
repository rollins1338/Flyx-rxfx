/**
 * Admin Feedback Response API
 * 
 * POST - Send email response to feedback and update status
 * GET - Check email configuration status
 * 
 * Uses D1 database after Cloudflare migration (Requirement 12.8)
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import { sendFeedbackResponse, isEmailConfigured } from '@/app/lib/services/email';
import { getD1Database } from '@/app/lib/db/d1-connection';

const JWT_SECRET = (() => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.warn('[feedback-respond] JWT_SECRET is not set! Authentication will fail in production.');
  }
  return secret || 'INSECURE_FALLBACK_DO_NOT_USE_IN_PRODUCTION';
})();
const ADMIN_COOKIE = 'admin_token';

async function verifyAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value;
  
  if (!token) return null;
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; username: string };
    return decoded;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check if email is configured
  if (!isEmailConfigured()) {
    return NextResponse.json(
      { error: 'Email service not configured. Set SMTP_USER and SMTP_PASS environment variables.' },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const { feedbackId, responseMessage } = body;

    if (!feedbackId || !responseMessage) {
      return NextResponse.json(
        { error: 'Missing feedbackId or responseMessage' },
        { status: 400 }
      );
    }

    if (responseMessage.length > 5000) {
      return NextResponse.json(
        { error: 'Response message too long (max 5000 characters)' },
        { status: 400 }
      );
    }

    // Get D1 database
    const db = getD1Database();

    // Get the feedback entry
    const feedback = await db.prepare(
      'SELECT id, type, message, email, status FROM feedback WHERE id = ?'
    ).bind(feedbackId).first<{
      id: number;
      type: string;
      message: string;
      email: string | null;
      status: string;
    }>();

    if (!feedback) {
      return NextResponse.json({ error: 'Feedback not found' }, { status: 404 });
    }

    if (!feedback.email) {
      return NextResponse.json(
        { error: 'This feedback does not have an email address to respond to' },
        { status: 400 }
      );
    }

    // Send the email
    const emailResult = await sendFeedbackResponse(
      feedback.email,
      feedback.message,
      responseMessage,
      feedback.type
    );

    if (!emailResult.success) {
      return NextResponse.json(
        { error: `Failed to send email: ${emailResult.error}` },
        { status: 500 }
      );
    }

    // Update feedback status to 'resolved' and store the response
    await db.prepare(`
      UPDATE feedback 
      SET status = 'resolved', 
          updated_at = datetime('now'),
          admin_response = ?,
          responded_at = datetime('now')
      WHERE id = ?
    `).bind(responseMessage, feedbackId).run();

    return NextResponse.json({
      success: true,
      messageId: emailResult.messageId,
      message: `Response sent to ${feedback.email}`,
    });
  } catch (error) {
    console.error('Error sending feedback response:', error);
    return NextResponse.json(
      { error: 'Failed to send response' },
      { status: 500 }
    );
  }
}

// GET endpoint to check email configuration status
export async function GET() {
  const admin = await verifyAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({
    configured: isEmailConfigured(),
    fromEmail: process.env.FROM_EMAIL || 'support@vynx.cc',
  });
}
