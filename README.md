# Sistema de Procesamiento de Documentos Financieros - Multi-Tenant

Sistema completo y autogestivo de procesamiento de documentos financieros argentinos con arquitectura multi-tenant.

## 🏗️ Arquitectura Multi-Tenant

Este sistema está diseñado para soportar múltiples clientes (tenants) de forma aislada:

- **Cada tenant tiene sus propios datos** (documentos, usuarios, integraciones)
- **Aislamiento completo** en base de datos, cache y cola de procesamiento
- **URLs personalizadas** por tenant (subdominios o dominios custom)
- **Límites por plan** (usuarios, documentos, almacenamiento)

## 🚀 Stack Tecnológico

- **Frontend**: Next.js 14+ (App Router), React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Server Actions
- **Database**: Supabase (PostgreSQL)
- **Cache & Queue**: Redis + Bull
- **Storage**: Vercel Blob / Supabase Storage
- **AI**: OpenAI GPT-4o Vision
- **ORM**: Prisma

## 📋 Requisitos Previos

- Node.js 18+
- PostgreSQL (Supabase)
- Redis
- Cuenta de OpenAI
- Cuenta de Vercel (opcional, para storage)

## 🔧 Instalación

### 1. Clonar el repositorio

```bash
git clone <repo-url>
cd ProcesamientoFacturasFermin
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar variables de entorno

Copia `.env.example` a `.env` y configura:

```bash
cp .env.example .env
```

**Variables importantes:**

- `DATABASE_URL`: Connection string de Supabase
- `REDIS_URL`: URL de Redis
- `OPENAI_API_KEY`: API key de OpenAI
- `NEXTAUTH_SECRET`: Secret para NextAuth

### 4. Configurar Supabase

1. Crea un proyecto en [Supabase](https://supabase.com)
2. Obtén la connection string desde: **Project Settings > Database > Connection string**
3. Configúrala en `DATABASE_URL`

### 5. Ejecutar migraciones

```bash
npx prisma migrate dev
# o
npm run db:migrate
```

### 6. Generar Prisma Client

```bash
npx prisma generate
# o
npm run db:generate
```

### 7. Iniciar Redis

```bash
# Con Docker
docker run -d -p 6379:6379 redis:latest

# O instalar Redis localmente
```

### 8. Iniciar desarrollo

```bash
npm run dev
```

## 🏢 Configuración Multi-Tenant

### Crear un nuevo Tenant

#### Opción 1: Desde API (requiere ADMIN_API_KEY)

```bash
POST /api/tenants
Headers:
  Authorization: Bearer <ADMIN_API_KEY>
Body:
{
  "name": "Empresa ABC",
  "slug": "empresa-abc",
  "subdomain": "abc", // opcional
  "plan": "BASIC",
  "ownerEmail": "admin@empresa.com",
  "ownerName": "Juan Pérez"
}
```

#### Opción 2: Desde código (seeding)

```typescript
// prisma/seed.ts
const tenant = await prisma.tenant.create({
  data: {
    name: "Empresa ABC",
    slug: "empresa-abc",
    subdomain: "abc",
    plan: "BASIC",
  },
})

await prisma.tenantUser.create({
  data: {
    tenantId: tenant.id,
    userId: user.id,
    role: "OWNER",
  },
})
```

### Acceder a un Tenant

El sistema detecta el tenant de varias formas:

1. **Header**: `X-Tenant-Id: <tenant-id>`
2. **Subdomain**: `abc.tuapp.com` → busca tenant con `subdomain: "abc"`
3. **Query parameter**: `?tenant=empresa-abc`
4. **Cookie**: `tenant_id=<tenant-id>`

### Ejemplo de uso

```typescript
// Frontend - incluir tenant en requests
const response = await fetch('/api/documents', {
  headers: {
    'X-Tenant-Id': 'tenant-id',
    'X-User-Id': 'user-id',
  },
})

// O usar subdomain
// https://empresa-abc.tuapp.com/api/documents
```

## 📊 Estructura de Base de Datos

### Modelos principales:

- **Tenant**: Organización/cliente
- **TenantUser**: Relación muchos a muchos entre usuarios y tenants
- **User**: Usuarios del sistema
- **Document**: Documentos procesados (aislados por tenant)
- **Integration**: Integraciones (aisladas por tenant)
- **Automation**: Automatizaciones (aisladas por tenant)

### Aislamiento Multi-Tenant:

Todos los modelos sensibles incluyen `tenantId`:
- Documentos
- Integraciones
- Automatizaciones
- Cache (prefijos por tenant)
- Cola de procesamiento (prefijos por tenant)

## 🔐 Seguridad

- **Aislamiento de datos**: Todas las queries filtran por `tenantId`
- **Validación de tenant**: Middleware valida tenant en cada request
- **Roles**: OWNER, ADMIN, MEMBER, VIEWER
- **Cache aislado**: Prefijos por tenant en Redis
- **Cola aislada**: Jobs con prefijos por tenant

## 🚀 Despliegue

### Vercel (Recomendado)

1. Conecta tu repositorio a Vercel
2. Configura las variables de entorno
3. Deploy automático

### Docker

```bash
docker-compose up -d
```

## 📝 API Documentation

### Endpoints principales:

- `POST /api/upload` - Subir documentos
- `GET /api/documents` - Listar documentos
- `GET /api/documents/[id]` - Obtener documento
- `PATCH /api/documents/[id]` - Actualizar documento
- `POST /api/documents/[id]/validate` - Validar documento
- `POST /api/tenants` - Crear tenant (admin)
- `GET /api/tenants` - Obtener información del tenant

Todos los endpoints requieren validación de tenant.

## 🔄 Flujo de Procesamiento

1. **Upload**: Usuario sube documento(s)
2. **Validación**: Sistema valida tenant y límites
3. **Cola**: Documento se agrega a cola de procesamiento
4. **Clasificación**: GPT-4o Vision clasifica el documento
5. **Extracción**: Extractor especializado extrae datos
6. **Validación**: Usuario valida/corrige datos
7. **Exportación**: Datos se exportan a Google Sheets/Excel

## 📦 Planes y Límites

- **FREE**: 5 usuarios, 100 documentos, 1GB storage
- **BASIC**: 10 usuarios, 500 documentos, 5GB storage
- **PROFESSIONAL**: 50 usuarios, 5000 documentos, 50GB storage
- **ENTERPRISE**: Ilimitado

## 🐛 Troubleshooting

### Error: "Tenant no válido"

- Verifica que el tenant existe y está activo
- Verifica que el usuario pertenece al tenant
- Verifica headers/cookies de autenticación

### Error: "Límite de documentos alcanzado"

- Verifica el plan del tenant
- Actualiza el plan si es necesario

### Error de conexión a Redis

- Verifica que Redis esté corriendo
- Verifica `REDIS_URL` en `.env`

## 📄 Licencia

MIT

## 🤝 Contribuir

1. Fork el proyecto
2. Crea una rama (`git checkout -b feature/AmazingFeature`)
3. Commit cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📧 Contacto

Para preguntas o soporte, contacta al equipo de desarrollo.

