# 🏢 Arquitectura Multi-Tenant

Este documento explica cómo funciona el sistema multi-tenant y cómo se asegura el aislamiento de datos.

## 📋 Conceptos Clave

### Tenant (Organización)
Un tenant representa un cliente/organización que usa el sistema. Cada tenant tiene:
- Sus propios datos (documentos, usuarios, integraciones)
- Sus propios límites (plan, usuarios máximos, documentos máximos)
- Sus propias configuraciones
- Aislamiento completo de otros tenants

### Aislamiento de Datos
Todos los datos sensibles están aislados por `tenantId`:
- **Documentos**: Cada documento pertenece a un tenant
- **Usuarios**: Los usuarios pueden pertenecer a múltiples tenants (muchos a muchos)
- **Integraciones**: Cada integración pertenece a un tenant
- **Automatizaciones**: Cada automatización pertenece a un tenant
- **Cache**: Prefijos por tenant en Redis
- **Cola**: Prefijos por tenant en Bull/Redis

## 🔐 Seguridad Multi-Tenant

### 1. Validación de Tenant
Todas las rutas API validan el tenant antes de procesar:

```typescript
// Middleware de validación
const tenantValidation = await validateTenant(request)
if ('error' in tenantValidation) {
  return tenantValidation.error
}
const { context } = tenantValidation
const { tenantId, userId } = context
```

### 2. Filtrado en Queries
Todas las queries de Prisma filtran por `tenantId`:

```typescript
// ✅ CORRECTO: Filtra por tenantId
const documents = await prisma.document.findMany({
  where: {
    tenantId, // MULTI-TENANT: Aislado
    userId,
  },
})

// ❌ INCORRECTO: No filtra por tenantId
const documents = await prisma.document.findMany({
  where: {
    userId,
  },
})
```

### 3. Verificación en Updates/Deletes
Antes de actualizar o eliminar, se verifica que el recurso pertenece al tenant:

```typescript
// Verificar que el documento pertenece al tenant
const document = await prisma.document.findFirst({
  where: {
    id: documentId,
    tenantId, // MULTI-TENANT: Verificar tenantId
    userId,
  },
})

if (!document) {
  return NextResponse.json(
    { error: 'Documento no encontrado' },
    { status: 404 }
  )
}
```

## 💾 Cache Multi-Tenant

### Prefijos por Tenant
Todas las claves de cache incluyen el `tenantId`:

```typescript
// Clave de cache: tenant:{tenantId}:{key}
function getTenantKey(tenantId: string, key: string): string {
  return `tenant:${tenantId}:${key}`
}
```

### Ejemplos de Cache
```typescript
// Cache de documento
await TenantCache.set(tenantId, `document:${documentId}`, data, 3600)

// Cache de lista de documentos
await TenantCache.set(tenantId, `documents:${userId}:${filters}`, data, 300)

// Invalidar cache
await TenantCache.delete(tenantId, `document:${documentId}`)
await TenantCache.deleteAll(tenantId) // Eliminar todo el cache del tenant
```

### Beneficios
- **Aislamiento**: Cada tenant tiene su propio espacio de cache
- **Invalidación**: Se puede invalidar el cache de un tenant sin afectar a otros
- **Rendimiento**: Cache separado mejora el rendimiento por tenant

## 🔄 Cola de Procesamiento Multi-Tenant

### Prefijos por Tenant
Cada job en la cola incluye el `tenantId`:

```typescript
// Job data incluye tenantId
await documentQueue.add({
  documentId: document.id,
  tenantId, // MULTI-TENANT: Requerido
  userId,
  fileName: file.name,
  fileUrl: blob.url,
}, {
  jobId: `${tenantId}:${document.id}`, // MULTI-TENANT: Prefijo con tenantId
})
```

### Verificación en Processor
El processor verifica que el documento pertenece al tenant:

```typescript
// Verificar que el documento pertenece al tenant
const document = await prisma.document.findFirst({
  where: {
    id: documentId,
    tenantId: tenantId, // MULTI-TENANT: Verificar tenantId
  },
})

if (!document) {
  throw new Error(`Documento ${documentId} no encontrado para tenant ${tenantId}`)
}
```

### Colas Separadas (Opcional)
También se pueden crear colas separadas por tenant:

```typescript
// Crear cola específica para un tenant
export function createTenantQueue(tenantId: string) {
  return new Queue(`document-processing:${tenantId}`, {
    redis: { /* ... */ },
  })
}
```

## 🌐 Detección de Tenant

El sistema detecta el tenant de varias formas:

### 1. Header HTTP
```typescript
Headers: {
  'X-Tenant-Id': '<tenant-id>'
}
```

### 2. Subdomain
```
https://demo.tuapp.com → busca tenant con subdomain: "demo"
```

### 3. Query Parameter
```
https://tuapp.com/api/documents?tenant=demo
```

### 4. Cookie
```typescript
Cookie: tenant_id=<tenant-id>
```

### Orden de Prioridad
1. Header `X-Tenant-Id`
2. Subdomain
3. Query parameter `tenant`
4. Cookie `tenant_id`

## 👥 Gestión de Usuarios

### Relación Muchos a Muchos
Un usuario puede pertenecer a múltiples tenants:

```typescript
// Modelo TenantUser
model TenantUser {
  tenantId  String
  userId    String
  role      TenantRole // OWNER, ADMIN, MEMBER, VIEWER
  
  @@unique([tenantId, userId])
}
```

### Roles
- **OWNER**: Dueño del tenant, acceso completo
- **ADMIN**: Administrador, puede gestionar usuarios y configuraciones
- **MEMBER**: Miembro, puede crear y editar documentos
- **VIEWER**: Solo lectura

### Verificación de Permisos
```typescript
// Verificar si un usuario tiene permiso
const hasPermission = await hasTenantPermission(
  tenantId,
  userId,
  'ADMIN' // rol requerido
)
```

## 📊 Límites por Plan

Cada tenant tiene límites según su plan:

```typescript
model Tenant {
  plan          TenantPlan // FREE, BASIC, PROFESSIONAL, ENTERPRISE
  maxUsers      Int        // Máximo de usuarios
  maxDocuments  Int        // Máximo de documentos
  maxStorageGB  Int        // Máximo de almacenamiento
}
```

### Verificación de Límites
```typescript
// Verificar límites antes de crear documento
const tenant = await prisma.tenant.findUnique({
  where: { id: tenantId },
  select: { maxDocuments: true, _count: { select: { documents: true } } },
})

if (tenant && tenant._count.documents >= tenant.maxDocuments) {
  return NextResponse.json(
    { error: 'Límite de documentos alcanzado para este plan' },
    { status: 403 }
  )
}
```

## 🚀 Mejores Prácticas

### 1. Siempre Filtrar por TenantId
```typescript
// ✅ CORRECTO
const documents = await prisma.document.findMany({
  where: { tenantId, userId },
})

// ❌ INCORRECTO
const documents = await prisma.document.findMany({
  where: { userId },
})
```

### 2. Validar Tenant en Cada Request
```typescript
// ✅ CORRECTO
const tenantValidation = await validateTenant(request)
if ('error' in tenantValidation) {
  return tenantValidation.error
}
const { context } = tenantValidation
```

### 3. Usar Cache con Prefijos
```typescript
// ✅ CORRECTO
await TenantCache.set(tenantId, `document:${id}`, data)

// ❌ INCORRECTO
await redis.set(`document:${id}`, data)
```

### 4. Incluir TenantId en Jobs
```typescript
// ✅ CORRECTO
await documentQueue.add({
  documentId,
  tenantId, // Requerido
  userId,
  // ...
})
```

## 🔍 Debugging

### Verificar Tenant Actual
```typescript
const context = await getTenantContext(request)
console.log('Tenant:', context.tenantId)
console.log('User:', context.userId)
console.log('Role:', context.userRole)
```

### Verificar Cache
```typescript
// Ver todas las claves de un tenant
const keys = await redis.keys(`tenant:${tenantId}:*`)
console.log('Cache keys:', keys)
```

### Verificar Cola
```typescript
// Ver jobs de un tenant
const stats = await getTenantQueueStats(tenantId)
console.log('Queue stats:', stats)
```

## 📝 Checklist de Seguridad

- [ ] Todas las queries filtran por `tenantId`
- [ ] Todas las rutas API validan el tenant
- [ ] Todas las actualizaciones verifican pertenencia al tenant
- [ ] Todas las claves de cache incluyen `tenantId`
- [ ] Todos los jobs incluyen `tenantId`
- [ ] Los límites se verifican antes de crear recursos
- [ ] Los permisos se verifican antes de operaciones sensibles

## 🎯 Conclusión

El sistema multi-tenant asegura:
- **Aislamiento completo** de datos entre tenants
- **Seguridad** mediante validación y filtrado
- **Escalabilidad** mediante cache y cola separados
- **Flexibilidad** mediante planes y límites configurables

¡El sistema está listo para soportar múltiples clientes de forma segura y escalable! 🚀

