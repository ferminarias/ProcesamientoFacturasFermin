# Guía de Deployment

Guía completa para desplegar el Sistema de Procesamiento de Facturas en producción.

## Tabla de Contenidos

1. [Requisitos Previos](#requisitos-previos)
2. [Configuración de Servicios](#configuración-de-servicios)
3. [Deployment con Docker](#deployment-con-docker)
4. [Deployment en Vercel](#deployment-en-vercel)
5. [Configuración de Base de Datos](#configuración-de-base-de-datos)
6. [Variables de Entorno](#variables-de-entorno)
7. [CI/CD](#cicd)
8. [Monitoreo y Logs](#monitoreo-y-logs)
9. [Troubleshooting](#troubleshooting)

---

## Requisitos Previos

### Software Requerido

- **Node.js** 20+ (LTS recomendado)
- **PostgreSQL** 16+ (o cuenta de Supabase)
- **Redis** 7+
- **Docker** y **Docker Compose** (para deployment con contenedores)
- **Git**

### Servicios Externos

- **OpenAI Account**: Para GPT-4o Vision API
- **Supabase** (recomendado) o PostgreSQL
- **Vercel Blob** o similar para almacenamiento de archivos
- **Google Cloud Console** (opcional, para Google Sheets)

---

## Configuración de Servicios

### 1. Supabase (Base de Datos)

#### Crear Proyecto

1. Ve a [supabase.com](https://supabase.com)
2. Crea un nuevo proyecto
3. Espera a que se complete la inicialización
4. Ve a **Settings > Database**
5. Copia la **Connection String** (formato: `postgresql://...`)

#### Configurar Connection Pooler

1. En **Settings > Database**, encuentra **Connection Pooling**
2. Copia el **Transaction pooler** URL
3. Úsala como `DATABASE_URL`
4. Usa el **Direct connection** como `DIRECT_URL`

### 2. Redis

#### Opción A: Redis Cloud (Recomendado para Producción)

1. Ve a [redis.com/try-free](https://redis.com/try-free/)
2. Crea una cuenta gratuita
3. Crea una nueva base de datos
4. Copia el **Endpoint** y **Password**

```env
REDIS_HOST=redis-12345.c123.us-east-1-1.ec2.cloud.redislabs.com
REDIS_PORT=12345
REDIS_PASSWORD=your-password
```

#### Opción B: Redis Local (Solo para Desarrollo)

```bash
# macOS
brew install redis
brew services start redis

# Ubuntu/Debian
sudo apt-get install redis-server
sudo systemctl start redis

# Configuración
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
```

### 3. OpenAI API

1. Ve a [platform.openai.com](https://platform.openai.com)
2. Crea una API Key en **API Keys**
3. Asegúrate de tener créditos disponibles
4. Copia la key (empieza con `sk-...`)

```env
OPENAI_API_KEY=sk-proj-...
```

### 4. Vercel Blob (Almacenamiento)

1. Ve a tu proyecto en [vercel.com](https://vercel.com)
2. Ve a **Storage > Create Database**
3. Selecciona **Blob**
4. Copia el **Token**

```env
BLOB_READ_WRITE_TOKEN=vercel_blob_...
```

### 5. Google OAuth (Opcional)

1. Ve a [console.cloud.google.com](https://console.cloud.google.com)
2. Crea un nuevo proyecto
3. Habilita **Google Sheets API** y **Google Drive API**
4. Ve a **Credentials > Create Credentials > OAuth 2.0 Client**
5. Configura:
   - **Application type**: Web application
   - **Authorized redirect URIs**: `https://tudominio.com/api/integrations/google/callback`
6. Copia **Client ID** y **Client Secret**

```env
GOOGLE_CLIENT_ID=123456.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-...
```

---

## Deployment con Docker

### 1. Configurar Variables de Entorno

Crea un archivo `.env.production`:

```env
# Database
DATABASE_URL=postgresql://user:password@host:5432/database?schema=public
DIRECT_URL=postgresql://user:password@host:5432/database?schema=public

# Redis
REDIS_HOST=redis-host
REDIS_PORT=6379
REDIS_PASSWORD=your-password

# OpenAI
OPENAI_API_KEY=sk-proj-...

# Storage
BLOB_READ_WRITE_TOKEN=vercel_blob_...

# Google OAuth (opcional)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# App Config
NEXT_PUBLIC_URL=https://tudominio.com
NODE_ENV=production
```

### 2. Build de la Imagen

```bash
# Build de la imagen
docker build -t facturas-processor:latest .

# O usando docker-compose
docker-compose build
```

### 3. Ejecutar con Docker Compose

```bash
# Iniciar todos los servicios
docker-compose up -d

# Ver logs
docker-compose logs -f app

# Detener servicios
docker-compose down
```

### 4. Ejecutar Migraciones

```bash
# Desde el contenedor
docker-compose exec app npx prisma migrate deploy

# O localmente
DATABASE_URL="..." npx prisma migrate deploy
```

### 5. Verificar Deployment

```bash
# Check de salud
curl http://localhost:3000/api/health

# Revisar logs
docker-compose logs -f
```

---

## Deployment en Vercel

### 1. Preparar el Proyecto

```bash
# Instalar Vercel CLI
npm i -g vercel

# Login
vercel login
```

### 2. Configurar Proyecto

```bash
# Inicializar proyecto
vercel

# Sigue las instrucciones:
# - Set up and deploy? Yes
# - Which scope? (Elige tu cuenta)
# - Link to existing project? No
# - What's your project's name? facturas-processor
# - In which directory is your code located? ./
```

### 3. Configurar Variables de Entorno

En el dashboard de Vercel:

1. Ve a **Settings > Environment Variables**
2. Agrega todas las variables:

```
DATABASE_URL
DIRECT_URL
REDIS_HOST
REDIS_PORT
REDIS_PASSWORD
OPENAI_API_KEY
BLOB_READ_WRITE_TOKEN
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
NEXT_PUBLIC_URL
```

3. Asegúrate de marcarlas para **Production**, **Preview** y **Development**

### 4. Configurar Build Settings

En **Settings > General**:

- **Framework Preset**: Next.js
- **Build Command**: `npm run build`
- **Output Directory**: `.next`
- **Install Command**: `npm ci`

### 5. Deploy

```bash
# Deploy a producción
vercel --prod

# Deploy a preview
vercel
```

### 6. Post-Deploy

#### Ejecutar Migraciones

```bash
# Usando Vercel CLI con conexión remota
DATABASE_URL="..." npx prisma migrate deploy
```

#### Configurar Dominios

1. Ve a **Settings > Domains**
2. Agrega tu dominio personalizado
3. Configura DNS según las instrucciones

---

## Configuración de Base de Datos

### Ejecutar Migraciones Iniciales

```bash
# Development
npm run db:migrate

# Production
DATABASE_URL="..." npx prisma migrate deploy
```

### Seed de Datos (Opcional)

```bash
# Crear datos de prueba
npm run db:seed
```

### Backup de Base de Datos

#### Supabase

```bash
# Backup usando pg_dump
pg_dump -h db.abc123.supabase.co \
  -U postgres \
  -d postgres \
  > backup_$(date +%Y%m%d).sql
```

#### PostgreSQL Local

```bash
# Backup
pg_dump database_name > backup.sql

# Restore
psql database_name < backup.sql
```

---

## Variables de Entorno

### Producción

```env
# Required
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...
REDIS_HOST=redis-host
REDIS_PORT=6379
OPENAI_API_KEY=sk-...
BLOB_READ_WRITE_TOKEN=vercel_blob_...
NEXT_PUBLIC_URL=https://tudominio.com
NODE_ENV=production

# Optional
REDIS_PASSWORD=password
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

### Development

```env
DATABASE_URL=postgresql://localhost:5432/facturas_dev
DIRECT_URL=postgresql://localhost:5432/facturas_dev
REDIS_HOST=localhost
REDIS_PORT=6379
OPENAI_API_KEY=sk-...
NEXT_PUBLIC_URL=http://localhost:3000
NODE_ENV=development
```

---

## CI/CD

### GitHub Actions

El workflow ya está configurado en `.github/workflows/ci.yml`.

#### Configurar Secrets

Ve a **Settings > Secrets and variables > Actions** y agrega:

```
DOCKER_USERNAME
DOCKER_PASSWORD
VERCEL_TOKEN
VERCEL_ORG_ID
VERCEL_PROJECT_ID
```

#### Obtener Vercel Tokens

```bash
# Obtener token
vercel login

# Link project
vercel link

# Ver org y project ID en .vercel/project.json
cat .vercel/project.json
```

### Workflow

El pipeline ejecuta:

1. **Test**: Linter, type-check, tests unitarios
2. **Build Docker**: Construye imagen Docker
3. **Deploy**: Deploy automático a Vercel (solo en main)

---

## Monitoreo y Logs

### Logs en Vercel

1. Ve a tu proyecto en Vercel
2. **Deployments > [Latest] > Logs**
3. Filtrar por:
   - **Build Logs**: Errores de build
   - **Function Logs**: Errores en runtime
   - **Static Logs**: Archivos estáticos

### Logs en Docker

```bash
# Ver logs en tiempo real
docker-compose logs -f app

# Ver últimas 100 líneas
docker-compose logs --tail=100 app

# Solo errores
docker-compose logs app | grep ERROR
```

### Monitoring

#### Opción 1: Vercel Analytics

1. Ve a **Analytics** en tu proyecto Vercel
2. Habilita **Web Analytics**
3. Monitorea métricas de performance

#### Opción 2: Sentry (Recomendado)

```bash
npm install @sentry/nextjs
```

```typescript
// sentry.config.ts
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
});
```

---

## Troubleshooting

### Error: "Prisma Client not found"

```bash
# Regenerar Prisma Client
npx prisma generate
```

### Error: "Cannot connect to database"

1. Verifica que `DATABASE_URL` sea correcta
2. Verifica firewall/IP whitelist en Supabase
3. Prueba conexión directa:

```bash
psql "postgresql://user:pass@host:5432/db"
```

### Error: "Redis connection failed"

1. Verifica `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`
2. Prueba conexión:

```bash
redis-cli -h host -p port -a password ping
```

### Build Failures

```bash
# Limpiar cache
rm -rf .next node_modules
npm ci
npm run build
```

### Performance Issues

1. **Habilita caching**: Redis debe estar configurado
2. **Optimiza imágenes**: Usa formatos comprimidos
3. **Database indexes**: Verifica índices en Prisma schema
4. **Monitor queries**: Usa Prisma Studio

---

## Checklist de Deployment

- [ ] Servicios configurados (Supabase, Redis, OpenAI)
- [ ] Variables de entorno configuradas
- [ ] Migraciones ejecutadas
- [ ] Tests pasando
- [ ] Build exitoso
- [ ] Dominios configurados
- [ ] SSL habilitado
- [ ] Monitoreo configurado
- [ ] Backups automáticos configurados
- [ ] Documentación actualizada

---

## Soporte

¿Problemas con el deployment?

- 📖 Docs: https://docs.facturas.com
- 💬 GitHub Issues: https://github.com/yourorg/facturas/issues
- 📧 Email: devops@facturas.com

¡Feliz deployment! 🚀
