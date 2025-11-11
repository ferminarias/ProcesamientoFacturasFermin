const { withSentryConfig } = require('@sentry/nextjs');

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
    // Habilitar instrumentation.ts
    instrumentationHook: true,
  },
  images: {
    domains: ['blob.vercel-storage.com'],
  },
}

// Configuración de Sentry
const sentryWebpackPluginOptions = {
  // Para todas las opciones, ver:
  // https://github.com/getsentry/sentry-webpack-plugin#options

  // Suprimir todos los logs
  silent: true,

  // Organización y proyecto de Sentry
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Auth token para subir source maps
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Solo subir source maps en producción
  disableServerWebpackPlugin: process.env.NODE_ENV !== 'production',
  disableClientWebpackPlugin: process.env.NODE_ENV !== 'production',

  // Configuración de source maps
  widenClientFileUpload: true,
  hideSourceMaps: true,
  disableLogger: true,
};

// Envolver la configuración con Sentry
module.exports = withSentryConfig(nextConfig, sentryWebpackPluginOptions)

