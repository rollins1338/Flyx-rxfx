import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import { sendFeedbackResponse, isEmailConfigured } from '@/app/lib/services/email';

const sql = neon(process.env.DATABASE_URL || '');
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
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

    // Get the feedback entry
    const feedbackResult = await sql`
      SELECT id, type, message, email, status FROM feedback WHERE id = ${feedbackId}
    `;

    if (feedbackResult.length === 0) {
      return NextResponse.json({ error: 'Feedback not found' }, { status: 404 });
    }

    const feedback = feedbackResult[0];

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
    await sql`
      UPDATE feedback 
      SET status = 'resolved', 
          updated_at = NOW(),
          admin_response = ${responseMessage},
          responded_at = NOW(),
          responded_by = ${admin.username}
      WHERE id = ${feedbackId}
    `;

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
