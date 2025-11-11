import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.SENTRY_DSN;
const SENTRY_ENVIRONMENT = process.env.NODE_ENV || 'development';

Sentry.init({
  dsn: SENTRY_DSN,

  // Configuración de ambiente
  environment: SENTRY_ENVIRONMENT,

  // Sample rate ajustado para servidor
  tracesSampleRate: SENTRY_ENVIRONMENT === 'production' ? 0.1 : 1.0,

  // Integraciones del servidor
  integrations: [
    // Prisma Integration - rastrear queries de base de datos
    Sentry.prismaIntegration(),

    // Node Performance Monitoring
    Sentry.nodeProfilingIntegration(),
  ],

  // Filtros de errores
  ignoreErrors: [
    // Errores de timeout comunes
    'ETIMEDOUT',
    'ECONNRESET',
    'ENOTFOUND',

    // Errores de Redis
    'Connection is closed',
    'Redis connection lost',

    // Errores de Prisma conocidos
    'PrismaClientKnownRequestError',
  ],

  // Antes de enviar
  beforeSend(event, hint) {
    const error = hint.originalException;

    // No enviar errores 4xx (excepto 401 y 403)
    if (event.exception?.values?.[0]?.type === 'HttpError') {
      const statusCode = (error as any)?.statusCode;
      if (statusCode >= 400 && statusCode < 500 && statusCode !== 401 && statusCode !== 403) {
        return null;
      }
    }

    // Filtrar información sensible
    if (event.request?.data) {
      const data = event.request.data as any;

      // Remover campos sensibles
      if (typeof data === 'object') {
        delete data.password;
        delete data.token;
        delete data.apiKey;
        delete data.accessToken;
        delete data.refreshToken;
        delete data.secret;
      }
    }

    // Filtrar headers sensibles
    if (event.request?.headers) {
      delete event.request.headers['authorization'];
      delete event.request.headers['cookie'];
      delete event.request.headers['x-api-key'];
    }

    // Agregar contexto útil
    event.contexts = {
      ...event.contexts,
      runtime: {
        name: 'node',
        version: process.version,
      },
    };

    return event;
  },

  // Configuración de breadcrumbs
  beforeBreadcrumb(breadcrumb) {
    // Filtrar queries de Prisma en producción (pueden ser muchas)
    if (breadcrumb.category === 'prisma' && SENTRY_ENVIRONMENT === 'production') {
      return null;
    }

    return breadcrumb;
  },
});
