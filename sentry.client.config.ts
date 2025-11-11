import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;
const SENTRY_ENVIRONMENT = process.env.NODE_ENV || 'development';

Sentry.init({
  dsn: SENTRY_DSN,

  // Configuración de ambiente
  environment: SENTRY_ENVIRONMENT,

  // Ajustar sample rate según el ambiente
  // En producción, capturamos el 100% de los errores
  // pero solo el 10% de las transacciones de performance
  tracesSampleRate: SENTRY_ENVIRONMENT === 'production' ? 0.1 : 1.0,

  // Configuración de sesión
  // Capturamos el 100% de las replays de sesión con errores
  // y el 10% de las sesiones normales
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  // Integraciones
  integrations: [
    // Session Replay - captura interacciones del usuario
    Sentry.replayIntegration({
      maskAllText: true,  // Ocultar texto sensible
      blockAllMedia: true, // Bloquear imágenes/videos
    }),

    // Browser Tracing - performance monitoring
    Sentry.browserTracingIntegration({
      // Rastrear navegación y transiciones
      traceFetch: true,
      traceXHR: true,
    }),
  ],

  // Filtros de errores - ignorar errores conocidos/no críticos
  ignoreErrors: [
    // Errores de red comunes
    'Network request failed',
    'NetworkError',
    'Failed to fetch',

    // Errores de extensiones del browser
    'Non-Error promise rejection captured',

    // Errores de usuario cerrando tabs
    'ResizeObserver loop limit exceeded',

    // Errores de navegación
    'cancelled',
    'Navigation cancelled',
  ],

  // Antes de enviar un evento, podemos modificarlo o filtrarlo
  beforeSend(event, hint) {
    // Filtrar información sensible de las URLs
    if (event.request?.url) {
      // Remover tokens de query params
      event.request.url = event.request.url.replace(/[?&]token=[^&]+/, '');
    }

    // Filtrar headers sensibles
    if (event.request?.headers) {
      delete event.request.headers['Authorization'];
      delete event.request.headers['Cookie'];
    }

    return event;
  },

  // Configuración de breadcrumbs (rastros de navegación)
  beforeBreadcrumb(breadcrumb) {
    // Filtrar breadcrumbs de console.log en producción
    if (breadcrumb.category === 'console' && SENTRY_ENVIRONMENT === 'production') {
      return null;
    }

    return breadcrumb;
  },
});
