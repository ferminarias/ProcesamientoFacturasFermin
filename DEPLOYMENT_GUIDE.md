# 🚀 Guía Completa de Deployment

Esta guía te llevará paso a paso desde cero hasta tener tu aplicación funcionando en producción con todas las integraciones configuradas.

## 📑 Tabla de Contenidos

1. [Requisitos Previos](#1-requisitos-previos)
2. [Configurar Supabase (Base de Datos)](#2-configurar-supabase-base-de-datos)
3. [Configurar Upstash Redis](#3-configurar-upstash-redis)
4. [Configurar Vercel Blob](#4-configurar-vercel-blob)
5. [Configurar OpenAI](#5-configurar-openai)
6. [Configurar Google OAuth](#6-configurar-google-oauth)
7. [Configurar Microsoft OAuth](#7-configurar-microsoft-oauth)
8. [Configurar Dropbox OAuth](#8-configurar-dropbox-oauth)
9. [Configurar Sentry (Opcional)](#9-configurar-sentry-opcional)
10. [Deploy a Vercel](#10-deploy-a-vercel)
11. [Configuración Post-Deploy](#11-configuración-post-deploy)
12. [Verificación Final](#12-verificación-final)

---

## 1. Requisitos Previos

### Cuentas Necesarias (todas gratuitas para empezar):
- ✅ Cuenta de [GitHub](https://github.com)
- ✅ Cuenta de [Vercel](https://vercel.com)
- ✅ Cuenta de [Supabase](https://supabase.com)
- ✅ Cuenta de [Upstash](https://upstash.com)
- ✅ Cuenta de [OpenAI](https://platform.openai.com)

### Cuentas Opcionales (para integraciones):
- 📧 Cuenta de [Google Cloud Console](https://console.cloud.google.com)
- 🟦 Cuenta de [Azure Portal](https://portal.azure.com)
- 📦 Cuenta de [Dropbox Developers](https://www.dropbox.com/developers)
- 🔍 Cuenta de [Sentry](https://sentry.io) (monitoreo de errores)

---

## 2. Configurar Supabase (Base de Datos)

### 2.1. Crear Proyecto en Supabase

1. Ve a [https://supabase.com](https://supabase.com)
2. Click en "Start your project"
3. Crea una nueva organización o selecciona una existente
4. Click en "New Project"
5. Completa:
   - **Name**: `financial-doc-processor` (o el nombre que prefieras)
   - **Database Password**: Genera una contraseña segura y **GUÁRDALA**
   - **Region**: Elige la más cercana a tus usuarios (ej: `South America (São Paulo)`)
   - **Pricing Plan**: Free (suficiente para empezar)
6. Click en "Create new project" y espera 2-3 minutos

### 2.2. Obtener Connection Strings

1. Una vez creado el proyecto, ve a **Settings** (ícono de engranaje en la barra lateral)
2. Click en **Database**
3. En la sección "Connection string", verás varias opciones:

**Para DATABASE_URL** (usa "Transaction" mode):
```
postgresql://postgres.xxxxx:[YOUR-PASSWORD]@aws-0-sa-east-1.pooler.supabase.com:6543/postgres
```

**Para DIRECT_URL** (usa "Session" mode):
```
postgresql://postgres.xxxxx:[YOUR-PASSWORD]@aws-0-sa-east-1.pooler.supabase.com:5432/postgres
```

4. **IMPORTANTE**: Reemplaza `[YOUR-PASSWORD]` con la contraseña que guardaste
5. Copia ambas URLs, las necesitarás después

### 2.3. Habilitar Extensions (Opcional pero Recomendado)

1. Ve a **Database** → **Extensions** en Supabase
2. Busca y habilita:
   - `pg_stat_statements` (para monitoreo de queries)
   - `uuid-ossp` (para UUIDs)

---

## 3. Configurar Upstash Redis

### 3.1. Crear Base de Datos Redis

1. Ve a [https://console.upstash.com](https://console.upstash.com)
2. Regístrate o inicia sesión
3. Click en "Create Database"
4. Completa:
   - **Name**: `financial-doc-processor-redis`
   - **Type**: Regional
   - **Region**: Elige la misma región que Supabase (o la más cercana)
   - **TLS**: Enabled
5. Click en "Create"

### 3.2. Obtener Credenciales

1. Una vez creada, click en tu database
2. En la pestaña "Details", verás:
   - **Endpoint**: `usw1-xxxx.upstash.io`
   - **Port**: `6379`
   - **Password**: `AxxxxxxxxxxxxxxxxxxxQ==`

3. Guarda estos valores:
```env
REDIS_HOST=usw1-xxxx.upstash.io
REDIS_PORT=6379
REDIS_PASSWORD=AxxxxxxxxxxxxxxxxxxxQ==
```

---

## 4. Configurar Vercel Blob

### 4.1. Crear Blob Store

1. Ve a [https://vercel.com](https://vercel.com)
2. Inicia sesión
3. Ve a **Storage** en el menú lateral
4. Click en "Create Database"
5. Selecciona **Blob**
6. Completa:
   - **Name**: `financial-docs`
7. Click en "Create"

### 4.2. Obtener Token

1. Una vez creado, verás el **Blob Token**
2. Guárdalo:
```env
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxxxxxxxxxxxx
```

**NOTA**: Este token se auto-configurará cuando hagas deploy en Vercel, pero guárdalo por si acaso.

---

## 5. Configurar OpenAI

### 5.1. Obtener API Key

1. Ve a [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Inicia sesión o crea una cuenta
3. Click en "Create new secret key"
4. Dale un nombre: `financial-doc-processor`
5. **COPIA LA KEY INMEDIATAMENTE** (solo se muestra una vez)
6. Guárdala:
```env
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 5.2. Añadir Créditos

1. Ve a **Settings** → **Billing**
2. Añade al menos $5 USD de crédito
3. El procesamiento de documentos usa GPT-4o Vision (~$0.01 por documento)

---

## 6. Configurar Google OAuth

### 6.1. Crear Proyecto en Google Cloud Console

1. Ve a [https://console.cloud.google.com](https://console.cloud.google.com)
2. Click en el selector de proyectos (arriba a la izquierda)
3. Click en "NEW PROJECT"
4. Completa:
   - **Project name**: `financial-doc-processor`
   - **Organization**: Deja en blanco si no tienes
5. Click en "CREATE"

### 6.2. Habilitar APIs

1. Ve a **APIs & Services** → **Library**
2. Busca y habilita las siguientes APIs:
   - ✅ **Google Sheets API**
   - ✅ **Google Drive API**
3. Para cada una, click en "ENABLE"

### 6.3. Configurar OAuth Consent Screen

1. Ve a **APIs & Services** → **OAuth consent screen**
2. Selecciona **External** (para que cualquiera pueda usar tu app)
3. Click en "CREATE"
4. Completa el formulario:

**App information:**
- **App name**: `Financial Document Processor`
- **User support email**: Tu email
- **App logo**: (opcional, puedes dejarlo en blanco)

**App domain:**
- **Application home page**: `https://tu-dominio.vercel.app` (lo tendrás después del deploy)
- **Application privacy policy**: `https://tu-dominio.vercel.app/privacy` (créalo después)
- **Application terms of service**: `https://tu-dominio.vercel.app/terms` (créalo después)

**Developer contact information:**
- **Email addresses**: Tu email

5. Click en "SAVE AND CONTINUE"

**Scopes:**
1. Click en "ADD OR REMOVE SCOPES"
2. Filtra y selecciona:
   - ✅ `https://www.googleapis.com/auth/spreadsheets` (ver y editar spreadsheets)
   - ✅ `https://www.googleapis.com/auth/drive.file` (ver y gestionar archivos creados por la app)
   - ✅ `https://www.googleapis.com/auth/userinfo.profile`
   - ✅ `https://www.googleapis.com/auth/userinfo.email`
3. Click en "UPDATE" y luego "SAVE AND CONTINUE"

**Test users (opcional):**
1. Si quieres probar antes de publicar, añade emails de prueba aquí
2. Click en "SAVE AND CONTINUE"

**Summary:**
1. Revisa todo
2. Click en "BACK TO DASHBOARD"

### 6.4. Crear OAuth Credentials

1. Ve a **APIs & Services** → **Credentials**
2. Click en "CREATE CREDENTIALS" → "OAuth client ID"
3. Selecciona:
   - **Application type**: Web application
   - **Name**: `Financial Doc Processor - Web`
4. En **Authorized JavaScript origins**, añade:
   ```
   https://tu-dominio.vercel.app
   http://localhost:3000
   ```
5. En **Authorized redirect URIs**, añade:
   ```
   https://tu-dominio.vercel.app/api/integrations/google/callback
   http://localhost:3000/api/integrations/google/callback
   ```
6. Click en "CREATE"
7. **COPIA** el Client ID y Client Secret
8. Guárdalos:
```env
GOOGLE_CLIENT_ID=123456789-xxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxxxxxxxx
```

### 6.5. Publicar App (Opcional)

Para que cualquier usuario pueda conectar su Google Sheets:

1. Ve a **OAuth consent screen**
2. Click en "PUBLISH APP"
3. Confirma la publicación
4. **IMPORTANTE**: Google puede pedirte verificación si vas a usarlo en producción con muchos usuarios

---

## 7. Configurar Microsoft OAuth

### 7.1. Crear App Registration en Azure

1. Ve a [https://portal.azure.com](https://portal.azure.com)
2. Inicia sesión con tu cuenta Microsoft
3. Busca "Azure Active Directory" o "Microsoft Entra ID"
4. En el menú lateral, ve a **App registrations**
5. Click en "+ New registration"

### 7.2. Configurar Registro de App

1. Completa el formulario:
   - **Name**: `Financial Document Processor`
   - **Supported account types**:
     - Selecciona "Accounts in any organizational directory and personal Microsoft accounts"
   - **Redirect URI**:
     - **Platform**: Web
     - **URI**: `https://tu-dominio.vercel.app/api/integrations/microsoft/callback`
2. Click en "Register"

### 7.3. Obtener Credenciales

1. Una vez creada, verás la **Overview** page
2. **Copia** los siguientes valores:
   - **Application (client) ID**: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
   - **Directory (tenant) ID**: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`

3. Ahora crea el Client Secret:
   - En el menú lateral, ve a **Certificates & secrets**
   - Click en "+ New client secret"
   - **Description**: `Production Secret`
   - **Expires**: 24 months (o el que prefieras)
   - Click en "Add"
   - **COPIA EL VALUE INMEDIATAMENTE** (solo se muestra una vez)

4. Guarda las credenciales:
```env
MICROSOFT_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
MICROSOFT_CLIENT_SECRET=xxx~xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 7.4. Configurar Permisos de API

1. En el menú lateral, ve a **API permissions**
2. Verás que ya tiene "User.Read" por defecto
3. Click en "+ Add a permission"
4. Selecciona **Microsoft Graph**
5. Selecciona **Delegated permissions**
6. Busca y selecciona:
   - ✅ **Files.ReadWrite.All** (leer/escribir archivos en OneDrive)
   - ✅ **offline_access** (para refresh tokens)
7. Click en "Add permissions"

8. **IMPORTANTE**: Otorga consentimiento de admin:
   - Click en "Grant admin consent for [Your Directory]"
   - Confirma con "Yes"
   - Deberías ver checkmarks verdes en todas las permissions

### 7.5. Añadir URLs de Redirect Adicionales

1. Ve a **Authentication** en el menú lateral
2. En **Platform configurations** → **Web**, debajo de Redirect URIs
3. Click en "Add URI"
4. Añade:
   ```
   http://localhost:3000/api/integrations/microsoft/callback
   ```
5. **Implicit grant and hybrid flows**: NO selecciones nada
6. Click en "Save"

---

## 8. Configurar Dropbox OAuth

### 8.1. Crear App en Dropbox

1. Ve a [https://www.dropbox.com/developers/apps](https://www.dropbox.com/developers/apps)
2. Inicia sesión con tu cuenta Dropbox
3. Click en "Create app"

### 8.2. Configurar App

1. Selecciona:
   - **Choose an API**: Scoped access
   - **Choose the type of access you need**: Full Dropbox
   - **Name your app**: `financial-doc-processor` (debe ser único globalmente)
2. Acepta los términos
3. Click en "Create app"

### 8.3. Configurar Permisos

1. En la pestaña **Permissions**, selecciona:
   - ✅ `files.metadata.write`
   - ✅ `files.metadata.read`
   - ✅ `files.content.write`
   - ✅ `files.content.read`
   - ✅ `sharing.write` (para crear links compartidos)
   - ✅ `sharing.read`
2. Click en "Submit" al final de la página

### 8.4. Configurar OAuth2

1. Ve a la pestaña **Settings**
2. En la sección "OAuth 2":
   - **Redirect URIs**: Click en "Add" y añade:
     ```
     https://tu-dominio.vercel.app/api/integrations/dropbox/callback
     http://localhost:3000/api/integrations/dropbox/callback
     ```
3. En **App key** y **App secret**:
   - Copia el **App key**
   - Click en "Show" en App secret y cópialo

4. Guarda las credenciales:
```env
DROPBOX_CLIENT_ID=xxxxxxxxxxxxxxxxxxx
DROPBOX_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxx
```

### 8.5. Habilitar Refresh Tokens

1. Todavía en **Settings**, baja hasta "Advanced settings"
2. Busca "Access token expiration"
3. Selecciona **Long-lived access tokens**
4. Click en "Save"

---

## 9. Configurar Sentry (Opcional)

### 9.1. Crear Proyecto en Sentry

1. Ve a [https://sentry.io](https://sentry.io)
2. Regístrate o inicia sesión
3. Click en "Create Project"
4. Selecciona:
   - **Platform**: Next.js
   - **Project name**: `financial-doc-processor`
5. Click en "Create Project"

### 9.2. Obtener DSN y Auth Token

1. Una vez creado, verás el **DSN** en el onboarding:
   ```
   https://xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx@sentry.io/xxxxxxx
   ```
2. Cópialo

3. Para obtener el Auth Token:
   - Ve a **Settings** → **Auth Tokens**
   - Click en "Create New Token"
   - **Name**: `Vercel Deploy Token`
   - **Scopes**: Selecciona:
     - ✅ `project:releases`
     - ✅ `org:read`
   - Click en "Create Token"
   - **COPIA EL TOKEN**

4. Guarda las credenciales:
```env
SENTRY_DSN=https://xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx@sentry.io/xxxxxxx
NEXT_PUBLIC_SENTRY_DSN=https://xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx@sentry.io/xxxxxxx
SENTRY_ORG=tu-organizacion
SENTRY_PROJECT=financial-doc-processor
SENTRY_AUTH_TOKEN=sntrys_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

## 10. Deploy a Vercel

### 10.1. Preparar el Proyecto

1. Asegúrate de que todos los cambios estén commiteados:
```bash
git status
git add .
git commit -m "chore: Preparar para deployment"
git push origin main
```

### 10.2. Conectar GitHub con Vercel

1. Ve a [https://vercel.com](https://vercel.com)
2. Click en "Add New..." → "Project"
3. Busca tu repositorio `ProcesamientoFacturasFermin`
4. Click en "Import"

### 10.3. Configurar Variables de Entorno

En la sección "Configure Project":

1. Abre la sección **Environment Variables**
2. Añade TODAS las siguientes variables (usa los valores que guardaste):

```env
# Database (Supabase)
DATABASE_URL=postgresql://postgres.xxxxx:[YOUR-PASSWORD]@aws-0-sa-east-1.pooler.supabase.com:6543/postgres
DIRECT_URL=postgresql://postgres.xxxxx:[YOUR-PASSWORD]@aws-0-sa-east-1.pooler.supabase.com:5432/postgres

# Redis (Upstash)
REDIS_HOST=usw1-xxxx.upstash.io
REDIS_PORT=6379
REDIS_PASSWORD=AxxxxxxxxxxxxxxxxxxxQ==

# OpenAI
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# App Config
NEXT_PUBLIC_URL=https://tu-proyecto.vercel.app
NODE_ENV=production

# Vercel Blob (se auto-configura, pero puedes añadirlo)
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxxxxxxxxxxxx

# Encryption (GENERAR UNO NUEVO)
ENCRYPTION_KEY=tu_clave_de_64_caracteres_hex_aqui

# Google OAuth
GOOGLE_CLIENT_ID=123456789-xxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxxxxxxxx

# Microsoft OAuth
MICROSOFT_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
MICROSOFT_CLIENT_SECRET=xxx~xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Dropbox
DROPBOX_CLIENT_ID=xxxxxxxxxxxxxxxxxxx
DROPBOX_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxx

# Sentry (opcional)
SENTRY_DSN=https://xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx@sentry.io/xxxxxxx
NEXT_PUBLIC_SENTRY_DSN=https://xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx@sentry.io/xxxxxxx
SENTRY_ORG=tu-organizacion
SENTRY_PROJECT=financial-doc-processor
SENTRY_AUTH_TOKEN=sntrys_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**IMPORTANTE - Generar ENCRYPTION_KEY:**

En tu terminal local, ejecuta:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copia el resultado (64 caracteres hexadecimales) y úsalo como ENCRYPTION_KEY.

3. Click en "Deploy"

### 10.4. Esperar el Deploy

1. Vercel empezará a buildear tu proyecto
2. Esto tomará 3-5 minutos
3. Si hay errores, revisa los logs y corrige

### 10.5. Obtener URL Final

1. Una vez que el deploy esté completo, verás tu URL:
   ```
   https://tu-proyecto.vercel.app
   ```
2. **COPIA ESTA URL**, la necesitas para actualizar las configuraciones de OAuth

---

## 11. Configuración Post-Deploy

### 11.1. Actualizar NEXT_PUBLIC_URL

1. Ve a tu proyecto en Vercel
2. Ve a **Settings** → **Environment Variables**
3. Encuentra `NEXT_PUBLIC_URL`
4. Edítalo y cambia a tu URL real:
   ```
   https://tu-proyecto.vercel.app
   ```
5. **IMPORTANTE**: Redeploy para que tome efecto:
   - Ve a **Deployments**
   - Click en los tres puntos de tu último deployment
   - Click en "Redeploy"

### 11.2. Actualizar Google OAuth

1. Ve a [Google Cloud Console](https://console.cloud.google.com)
2. Ve a **APIs & Services** → **Credentials**
3. Click en tu OAuth Client ID
4. En **Authorized JavaScript origins**, actualiza:
   ```
   https://tu-proyecto.vercel.app
   ```
5. En **Authorized redirect URIs**, actualiza:
   ```
   https://tu-proyecto.vercel.app/api/integrations/google/callback
   ```
6. Click en "Save"

### 11.3. Actualizar Microsoft OAuth

1. Ve a [Azure Portal](https://portal.azure.com)
2. Ve a **Azure Active Directory** → **App registrations**
3. Selecciona tu app
4. Ve a **Authentication**
5. En **Redirect URIs**, actualiza:
   ```
   https://tu-proyecto.vercel.app/api/integrations/microsoft/callback
   ```
6. Click en "Save"

### 11.4. Actualizar Dropbox OAuth

1. Ve a [Dropbox Developers](https://www.dropbox.com/developers/apps)
2. Selecciona tu app
3. Ve a **Settings**
4. En **Redirect URIs**, actualiza:
   ```
   https://tu-proyecto.vercel.app/api/integrations/dropbox/callback
   ```
5. Click en "Save"

### 11.5. Migrar Base de Datos

1. En tu terminal local, ejecuta:
```bash
# Generar el cliente de Prisma con la nueva URL de producción
DATABASE_URL="tu_database_url_de_produccion" npx prisma generate

# Aplicar las migraciones
DATABASE_URL="tu_database_url_de_produccion" npx prisma migrate deploy
```

2. Verifica que las tablas se crearon correctamente:
```bash
DATABASE_URL="tu_database_url_de_produccion" npx prisma studio
```

### 11.6. Crear Tenant de Prueba

1. Conecta a tu base de datos con Prisma Studio o SQL Editor de Supabase
2. Crea un tenant de prueba:
```sql
INSERT INTO tenants (id, name, slug, plan, "isActive", "maxUsers", "maxDocuments", "maxStorageGB")
VALUES ('acme-corp', 'Acme Corp', 'acme-corp', 'FREE', true, 5, 100, 1);
```

### 11.7. Configurar Worker (Opcional - Para Producción)

Para que el worker de procesamiento funcione en Vercel, necesitas usar un servicio externo como:

**Opción A: Railway (Recomendado)**
1. Ve a [https://railway.app](https://railway.app)
2. Crea un nuevo proyecto desde GitHub
3. Selecciona tu repositorio
4. En **Settings** → **Build**:
   - **Build Command**: `npm install && npx prisma generate`
   - **Start Command**: `npx tsx scripts/worker.ts`
5. Añade las mismas variables de entorno que en Vercel
6. Deploy

**Opción B: Render**
1. Ve a [https://render.com](https://render.com)
2. New → Background Worker
3. Conecta tu repositorio
4. **Build Command**: `npm install && npx prisma generate`
5. **Start Command**: `npx tsx scripts/worker.ts`
6. Añade variables de entorno
7. Create Service

---

## 12. Verificación Final

### 12.1. Verificar Health Check

1. Abre tu navegador y ve a:
   ```
   https://tu-proyecto.vercel.app/api/health
   ```

2. Deberías ver algo como:
```json
{
  "status": "healthy",
  "timestamp": "2025-01-11T...",
  "uptime": 123,
  "checks": {
    "database": { "status": "ok", "responseTime": 45 },
    "redis": { "status": "ok", "responseTime": 12 },
    "openai": { "status": "ok", "configured": true }
  },
  "responseTime": 58
}
```

### 12.2. Probar Integraciones

**Google Sheets:**
```
https://tu-proyecto.vercel.app/api/integrations/google/auth
```
- Deberías ser redirigido a Google
- Autoriza la aplicación
- Deberías volver al dashboard con un mensaje de éxito

**Microsoft OneDrive:**
```
https://tu-proyecto.vercel.app/api/integrations/microsoft/auth
```
- Deberías ser redirigido a Microsoft
- Autoriza la aplicación
- Deberías volver al dashboard con un mensaje de éxito

**Dropbox:**
```
https://tu-proyecto.vercel.app/api/integrations/dropbox/auth
```
- Deberías ser redirigido a Dropbox
- Autoriza la aplicación
- Deberías volver al dashboard con un mensaje de éxito

### 12.3. Probar Procesamiento de Documentos

1. Sube un documento de prueba (factura, servicio, etc.)
2. Verifica que:
   - El documento se procesa correctamente
   - Los datos se extraen
   - Puedes validarlo
   - Puedes exportarlo a Google Sheets/OneDrive/Dropbox

---

## 🎉 ¡Felicitaciones!

Tu aplicación está completamente deployada y funcionando. Los usuarios ahora pueden:

- ✅ Subir documentos financieros
- ✅ Ver el procesamiento en tiempo real
- ✅ Validar y corregir datos extraídos
- ✅ Conectar sus cuentas de Google, Microsoft y Dropbox
- ✅ Exportar a Excel/Google Sheets
- ✅ Ver analytics y dashboard avanzado
- ✅ Recibir notificaciones de vencimientos

---

## 🔧 Troubleshooting

### Error: "ENCRYPTION_KEY is not defined"
- Genera una nueva key con: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- Añádela en Vercel Environment Variables
- Redeploy

### Error: "Failed to connect to database"
- Verifica que DATABASE_URL esté correcto
- Verifica que tu IP no esté bloqueada en Supabase (Settings → Database → Connection Pooling)
- Asegúrate de usar el modo "Transaction" (puerto 6543)

### Error: "OpenAI API key invalid"
- Verifica que la key empiece con `sk-proj-`
- Verifica que tengas créditos en OpenAI
- Regenera la key si es necesario

### Error: "OAuth redirect_uri_mismatch"
- Verifica que las URLs de redirect coincidan EXACTAMENTE en:
  - Google Cloud Console / Azure Portal / Dropbox Developers
  - Tu código (en los archivos de route)
  - NEXT_PUBLIC_URL en Vercel
- Recuerda actualizar todas las URLs después del deploy

### Worker no procesa documentos
- Asegúrate de haber deployado el worker en Railway/Render
- Verifica que tenga las mismas variables de entorno
- Verifica los logs del worker para errores

---

## 📚 Recursos Adicionales

- [Documentación de Supabase](https://supabase.com/docs)
- [Documentación de Prisma](https://www.prisma.io/docs)
- [Documentación de Vercel](https://vercel.com/docs)
- [Google OAuth Scopes](https://developers.google.com/identity/protocols/oauth2/scopes)
- [Microsoft Graph Permissions](https://learn.microsoft.com/en-us/graph/permissions-reference)
- [Dropbox API Reference](https://www.dropbox.com/developers/documentation)

---

## 🆘 Soporte

Si tienes problemas:
1. Revisa esta guía paso a paso
2. Verifica los logs en Vercel (Deployments → View Function Logs)
3. Verifica los logs en Sentry (si lo configuraste)
4. Revisa los Health Checks (`/api/health`)
