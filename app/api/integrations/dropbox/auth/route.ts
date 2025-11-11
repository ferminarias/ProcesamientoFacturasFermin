import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/integrations/dropbox/auth
 *
 * Inicia el flujo OAuth de Dropbox
 */
export async function GET(request: NextRequest) {
  const tenantId = request.headers.get('x-tenant-id');
  if (!tenantId) {
    return NextResponse.json({ error: 'Tenant ID requerido' }, { status: 400 });
  }

  const DROPBOX_CLIENT_ID = process.env.DROPBOX_CLIENT_ID;
  const REDIRECT_URI = `${process.env.NEXT_PUBLIC_URL}/api/integrations/dropbox/callback`;

  if (!DROPBOX_CLIENT_ID) {
    return NextResponse.json(
      { error: 'Dropbox OAuth no configurado' },
      { status: 500 }
    );
  }

  // Construir URL de autorización de Dropbox
  const authUrl = new URL('https://www.dropbox.com/oauth2/authorize');
  authUrl.searchParams.set('client_id', DROPBOX_CLIENT_ID);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.set('state', tenantId); // Pasamos tenantId en state
  authUrl.searchParams.set('token_access_type', 'offline'); // Para obtener refresh token

  return NextResponse.redirect(authUrl.toString());
}
