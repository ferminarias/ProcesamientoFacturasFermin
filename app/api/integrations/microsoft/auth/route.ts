import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/integrations/microsoft/auth
 *
 * Inicia el flujo OAuth de Microsoft OneDrive/Office 365
 */
export async function GET(request: NextRequest) {
  const tenantId = request.headers.get('x-tenant-id');
  if (!tenantId) {
    return NextResponse.json({ error: 'Tenant ID requerido' }, { status: 400 });
  }

  const MICROSOFT_CLIENT_ID = process.env.MICROSOFT_CLIENT_ID;
  const REDIRECT_URI = `${process.env.NEXT_PUBLIC_URL}/api/integrations/microsoft/callback`;

  if (!MICROSOFT_CLIENT_ID) {
    return NextResponse.json(
      { error: 'Microsoft OAuth no configurado' },
      { status: 500 }
    );
  }

  // Scopes necesarios para OneDrive y Excel
  const scopes = [
    'openid',
    'profile',
    'offline_access',
    'Files.ReadWrite.All', // Leer/escribir archivos en OneDrive
    'User.Read', // Leer perfil del usuario
  ].join(' ');

  // Construir URL de autorización de Microsoft
  const authUrl = new URL('https://login.microsoftonline.com/common/oauth2/v2.0/authorize');
  authUrl.searchParams.set('client_id', MICROSOFT_CLIENT_ID);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.set('response_mode', 'query');
  authUrl.searchParams.set('scope', scopes);
  authUrl.searchParams.set('state', tenantId); // Pasamos tenantId en state

  return NextResponse.redirect(authUrl.toString());
}
