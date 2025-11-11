import * as Sentry from '@sentry/nextjs';

/**
 * Utilidades para capturar errores manualmente con Sentry
 */

/**
 * Capturar un error manualmente
 */
export function captureError(error: Error, context?: Record<string, any>) {
  Sentry.captureException(error, {
    extra: context,
  });
}

/**
 * Capturar un mensaje (warning, info, etc.)
 */
export function captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info') {
  Sentry.captureMessage(message, level);
}

/**
 * Agregar contexto del usuario actual
 */
export function setUser(user: {
  id: string;
  email?: string;
  username?: string;
  tenantId?: string;
}) {
  Sentry.setUser({
    id: user.id,
    email: user.email,
    username: user.username,
    tenantId: user.tenantId,
  });
}

/**
 * Remover contexto del usuario (logout)
 */
export function clearUser() {
  Sentry.setUser(null);
}

/**
 * Agregar tags personalizados a eventos
 */
export function setTag(key: string, value: string) {
  Sentry.setTag(key, value);
}

/**
 * Agregar contexto adicional
 */
export function setContext(name: string, context: Record<string, any>) {
  Sentry.setContext(name, context);
}

/**
 * Agregar breadcrumb manual
 */
export function addBreadcrumb(message: string, data?: Record<string, any>) {
  Sentry.addBreadcrumb({
    message,
    level: 'info',
    data,
  });
}

/**
 * Wrapper para funciones async que captura errores automáticamente
 */
export function withErrorCapture<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  context?: Record<string, any>
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args);
    } catch (error) {
      captureError(error as Error, context);
      throw error;
    }
  }) as T;
}

/**
 * Iniciar una transacción de performance
 */
export function startTransaction(name: string, operation: string) {
  return Sentry.startTransaction({
    name,
    op: operation,
  });
}

/**
 * Ejemplo de uso en API routes:
 *
 * import { captureError, setUser, addBreadcrumb } from '@/lib/utils/sentry';
 *
 * export async function POST(request: NextRequest) {
 *   try {
 *     const userId = request.headers.get('x-user-id');
 *     setUser({ id: userId, tenantId: 'acme-corp' });
 *
 *     addBreadcrumb('Processing document', { documentId: '123' });
 *
 *     // ... lógica de la API ...
 *
 *     return NextResponse.json({ success: true });
 *   } catch (error) {
 *     captureError(error, {
 *       endpoint: '/api/documents',
 *       method: 'POST',
 *     });
 *     return NextResponse.json({ error: 'Error' }, { status: 500 });
 *   }
 * }
 */
