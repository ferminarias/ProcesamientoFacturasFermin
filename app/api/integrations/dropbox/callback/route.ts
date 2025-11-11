import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { encrypt } from '@/lib/utils/encryption';

/**
 * GET /api/integrations/dropbox/callback
 *
 * Callback OAuth de Dropbox
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state'); // Tenant ID
  const error = searchParams.get('error');

  if (error) {
    console.error('Dropbox OAuth error:', error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_URL}/dashboard?error=dropbox_auth_failed`
    );
  }

  if (!code || !state) {
    return NextResponse.json(
      { error: 'Código de autorización o state faltante' },
      { status: 400 }
    );
  }

  const tenantId = state;

  try {
    // Intercambiar código por tokens
    const DROPBOX_CLIENT_ID = process.env.DROPBOX_CLIENT_ID;
    const DROPBOX_CLIENT_SECRET = process.env.DROPBOX_CLIENT_SECRET;
    const REDIRECT_URI = `${process.env.NEXT_PUBLIC_URL}/api/integrations/dropbox/callback`;

    const tokenResponse = await fetch('https://api.dropbox.com/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(
          `${DROPBOX_CLIENT_ID}:${DROPBOX_CLIENT_SECRET}`
        ).toString('base64')}`,
      },
      body: new URLSearchParams({
        code,
        grant_type: 'authorization_code',
        redirect_uri: REDIRECT_URI,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error('Dropbox token exchange error:', errorData);
      throw new Error('Failed to exchange code for tokens');
    }

    const tokens = await tokenResponse.json();
    const { access_token, refresh_token, expires_in } = tokens;

    // Obtener información de la cuenta de Dropbox
    const accountResponse = await fetch('https://api.dropboxapi.com/2/users/get_current_account', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    const accountData = await accountResponse.json();

    // Guardar integración en base de datos
    await prisma.integration.upsert({
      where: {
        tenantId_provider: {
          tenantId,
          provider: 'dropbox',
        },
      },
      update: {
        accessToken: encrypt(access_token),
        refreshToken: refresh_token ? encrypt(refresh_token) : null,
        expiresAt: expires_in ? new Date(Date.now() + expires_in * 1000) : null,
        metadata: {
          email: accountData.email,
          displayName: accountData.name.display_name,
          accountId: accountData.account_id,
        },
      },
      create: {
        tenantId,
        provider: 'dropbox',
        accessToken: encrypt(access_token),
        refreshToken: refresh_token ? encrypt(refresh_token) : null,
        expiresAt: expires_in ? new Date(Date.now() + expires_in * 1000) : null,
        metadata: {
          email: accountData.email,
          displayName: accountData.name.display_name,
          accountId: accountData.account_id,
        },
      },
    });

    // Redirigir al dashboard con éxito
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_URL}/dashboard?success=dropbox_connected`
    );
  } catch (error) {
    console.error('Error en callback de Dropbox:', error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_URL}/dashboard?error=dropbox_connection_failed`
    );
  }
}
