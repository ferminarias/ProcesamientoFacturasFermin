/**
 * Instrumentation for Sentry
 *
 * Este archivo es cargado automáticamente por Next.js al inicio
 * Se usa para inicializar Sentry antes de que la aplicación arranque
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Servidor Node.js
    await import('./sentry.server.config');
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    // Edge runtime (middleware, edge functions)
    await import('./sentry.edge.config');
  }
}
