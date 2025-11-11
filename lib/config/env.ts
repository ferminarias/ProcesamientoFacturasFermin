// Configuración de variables de entorno

export const env = {
  // Database - Supabase PostgreSQL
  DATABASE_URL: process.env.DATABASE_URL!,
  // Formato Supabase:
  // postgresql://postgres:[PASSWORD]@[PROJECT_REF].supabase.co:5432/postgres
  
  // Redis
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  
  // OpenAI
  OPENAI_API_KEY: process.env.OPENAI_API_KEY!,
  
  // Storage - Vercel Blob o Supabase Storage
  BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN,
  SUPABASE_STORAGE_BUCKET: process.env.SUPABASE_STORAGE_BUCKET || 'documents',
  
  // Google
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  
  // Microsoft
  MICROSOFT_CLIENT_ID: process.env.MICROSOFT_CLIENT_ID,
  MICROSOFT_CLIENT_SECRET: process.env.MICROSOFT_CLIENT_SECRET,
  
  // NextAuth
  NEXTAUTH_URL: process.env.NEXTAUTH_URL || 'http://localhost:3000',
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET!,
  
  // App
  NODE_ENV: process.env.NODE_ENV || 'development',
  
  // Queue
  QUEUE_CONCURRENCY: parseInt(process.env.QUEUE_CONCURRENCY || '5'),
  MAX_RETRY_ATTEMPTS: parseInt(process.env.MAX_RETRY_ATTEMPTS || '3'),
  
  // Multi-tenant
  DEFAULT_TENANT_PLAN: process.env.DEFAULT_TENANT_PLAN || 'FREE',
  ADMIN_API_KEY: process.env.ADMIN_API_KEY, // Para crear tenants desde API
}

// Validar variables requeridas
const requiredEnvVars = [
  'DATABASE_URL',
  'OPENAI_API_KEY',
  'NEXTAUTH_SECRET',
]

if (process.env.NODE_ENV === 'production') {
  for (const varName of requiredEnvVars) {
    if (!process.env[varName]) {
      throw new Error(`Missing required environment variable: ${varName}`)
    }
  }
}
