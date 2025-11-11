import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { encrypt } from '@/lib/utils/encryption';

/**
 * GET /api/integrations/microsoft/callback
 *
 * Callback OAuth de Microsoft
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state'); // Tenant ID
  const error = searchParams.get('error');

  if (error) {
    console.error('Microsoft OAuth error:', error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_URL}/dashboard?error=microsoft_auth_failed`
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
    const MICROSOFT_CLIENT_ID = process.env.MICROSOFT_CLIENT_ID;
    const MICROSOFT_CLIENT_SECRET = process.env.MICROSOFT_CLIENT_SECRET;
    const REDIRECT_URI = `${process.env.NEXT_PUBLIC_URL}/api/integrations/microsoft/callback`;

    const tokenResponse = await fetch(
      'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: MICROSOFT_CLIENT_ID!,
          client_secret: MICROSOFT_CLIENT_SECRET!,
          code,
          redirect_uri: REDIRECT_URI,
          grant_type: 'authorization_code',
        }),
      }
    );

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error('Microsoft token exchange error:', errorData);
      throw new Error('Failed to exchange code for tokens');
    }

    const tokens = await tokenResponse.json();
    const { access_token, refresh_token, expires_in } = tokens;

    // Obtener información del usuario de Microsoft
    const userResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    const userData = await userResponse.json();

    // Guardar integración en base de datos
    await prisma.integration.upsert({
      where: {
        tenantId_provider: {
          tenantId,
          provider: 'microsoft',
        },
      },
      update: {
        accessToken: encrypt(access_token),
        refreshToken: refresh_token ? encrypt(refresh_token) : null,
        expiresAt: new Date(Date.now() + expires_in * 1000),
        metadata: {
          email: userData.mail || userData.userPrincipalName,
          displayName: userData.displayName,
          id: userData.id,
        },
      },
      create: {
        tenantId,
        provider: 'microsoft',
        accessToken: encrypt(access_token),
        refreshToken: refresh_token ? encrypt(refresh_token) : null,
        expiresAt: new Date(Date.now() + expires_in * 1000),
        metadata: {
          email: userData.mail || userData.userPrincipalName,
          displayName: userData.displayName,
          id: userData.id,
        },
      },
    });

    // Redirigir al dashboard con éxito
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_URL}/dashboard?success=microsoft_connected`
    );
  } catch (error) {
    console.error('Error en callback de Microsoft:', error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_URL}/dashboard?error=microsoft_connection_failed`
    );
  }
}
