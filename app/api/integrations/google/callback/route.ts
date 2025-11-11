import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { validateTenant } from '@/lib/middleware/tenant.middleware';
import { prisma } from '@/lib/database/prisma.client';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state'); // Can use state to pass tenantId

    if (!code) {
      return NextResponse.json(
        { error: 'Authorization code not provided' },
        { status: 400 }
      );
    }

    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      return NextResponse.json(
        { error: 'Google OAuth not configured' },
        { status: 500 }
      );
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${process.env.NEXT_PUBLIC_URL}/api/integrations/google/callback`
    );

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);

    // Store tokens (you'll need to get tenantId from session/state)
    // For now, returning tokens to be stored by frontend
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_URL}/integrations?google_auth=success&access_token=${tokens.access_token}&refresh_token=${tokens.refresh_token}`
    );
  } catch (error) {
    console.error('Error in Google OAuth callback:', error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_URL}/integrations?google_auth=error`
    );
  }
}
