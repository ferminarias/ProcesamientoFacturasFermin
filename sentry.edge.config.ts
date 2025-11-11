import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.SENTRY_DSN;
const SENTRY_ENVIRONMENT = process.env.NODE_ENV || 'development';

Sentry.init({
  dsn: SENTRY_DSN,

  // Configuración de ambiente
  environment: SENTRY_ENVIRONMENT,

  // Sample rate para edge runtime
  tracesSampleRate: SENTRY_ENVIRONMENT === 'production' ? 0.1 : 1.0,

  // Filtros de errores
  ignoreErrors: [
    'Network request failed',
    'Failed to fetch',
  ],

  // Antes de enviar
  beforeSend(event) {
    // Filtrar información sensible
    if (event.request?.headers) {
      delete event.request.headers['authorization'];
      delete event.request.headers['cookie'];
      delete event.request.headers['x-api-key'];
      delete event.request.headers['x-tenant-id'];
    }

    return event;
  },
});
