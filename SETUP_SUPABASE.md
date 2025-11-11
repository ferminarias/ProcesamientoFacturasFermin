# 🔧 Configuración de Supabase

Guía paso a paso para configurar Supabase como base de datos para el sistema multi-tenant.

## 📋 Pasos de Configuración

### 1. Crear Proyecto en Supabase

1. Ve a [https://supabase.com](https://supabase.com)
2. Crea una cuenta o inicia sesión
3. Clic en "New Project"
4. Completa el formulario:
   - **Name**: Nombre del proyecto
   - **Database Password**: Contraseña para la base de datos (¡guárdala!)
   - **Region**: Elige la región más cercana
   - **Pricing Plan**: Elige el plan (Free tier es suficiente para desarrollo)

### 2. Obtener Connection String

1. Ve a **Project Settings** > **Database**
2. Busca la sección **Connection string**
3. Selecciona **URI** en el dropdown
4. Copia la connection string (formato: `postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres`)
5. Reemplaza `[PASSWORD]` con tu contraseña de base de datos

### 3. Configurar Variables de Entorno

Crea un archivo `.env` en la raíz del proyecto:

```env
DATABASE_URL="postgresql://postgres:TU_PASSWORD@db.xxxxx.supabase.co:5432/postgres"
```

### 4. Ejecutar Migraciones

```bash
# Generar Prisma Client
npm run db:generate

# Ejecutar migraciones
npm run db:migrate

# O si prefieres push (desarrollo)
npm run db:push
```

### 5. Verificar Conexión

```bash
# Abrir Prisma Studio
npm run db:studio
```

Deberías ver todas las tablas creadas en Supabase.

## 🔐 Configuración de Seguridad

### Row Level Security (RLS) - Opcional

Supabase soporta Row Level Security, pero como estamos usando Prisma y validamos el tenant en la aplicación, no es estrictamente necesario. Sin embargo, puedes habilitarlo para una capa adicional de seguridad:

```sql
-- Ejemplo: Habilitar RLS en tabla documents
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Crear política para que los usuarios solo vean sus documentos
CREATE POLICY "Users can view their own documents"
ON documents FOR SELECT
USING (auth.uid()::text = "userId");
```

**Nota**: Esto requiere configurar Supabase Auth, lo cual es opcional si ya tienes tu propio sistema de autenticación.

## 📊 Verificar Tablas

Después de ejecutar las migraciones, verifica que las tablas se crearon correctamente:

1. Ve a **Table Editor** en Supabase
2. Deberías ver las siguientes tablas:
   - `tenants`
   - `tenant_users`
   - `users`
   - `documents`
   - `document_feedbacks`
   - `integrations`
   - `automations`
   - `automation_executions`
   - `export_logs`

## 🧪 Probar Conexión

Crea un script de prueba:

```typescript
// test-connection.ts
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function test() {
  try {
    const count = await prisma.tenant.count()
    console.log('✅ Conexión exitosa! Tenants:', count)
  } catch (error) {
    console.error('❌ Error de conexión:', error)
  } finally {
    await prisma.$disconnect()
  }
}

test()
```

Ejecuta:
```bash
tsx test-connection.ts
```

## 🚀 Seed de Datos

Ejecuta el seed para crear datos de ejemplo:

```bash
npm run db:seed
```

Esto creará:
- Un usuario admin (`admin@example.com`)
- Un tenant demo (`demo`)
- Usuarios de ejemplo

## 🔍 Troubleshooting

### Error: "Connection refused"

- Verifica que la connection string sea correcta
- Verifica que la contraseña sea correcta
- Verifica que el proyecto de Supabase esté activo

### Error: "relation does not exist"

- Ejecuta las migraciones: `npm run db:migrate`
- Verifica que las migraciones se ejecutaron correctamente

### Error: "password authentication failed"

- Verifica la contraseña en la connection string
- Verifica que el usuario `postgres` tenga permisos

## 📝 Notas Importantes

1. **Connection Pooling**: Para producción, considera usar Supabase Connection Pooler:
   ```
   postgresql://postgres:...@[HOST]:6543/postgres?pgbouncer=true
   ```

2. **Backups**: Supabase hace backups automáticos, pero puedes configurar backups adicionales si es necesario.

3. **Migrations**: Siempre ejecuta migraciones en un entorno de staging antes de producción.

4. **Monitoring**: Usa el dashboard de Supabase para monitorear el rendimiento de la base de datos.

## 🎯 Próximos Pasos

1. Configura Redis para cache y cola
2. Configura OpenAI API key
3. Configura Vercel Blob para almacenamiento
4. Ejecuta el seed para crear datos de ejemplo
5. Inicia el servidor de desarrollo

¡Listo! Tu base de datos está configurada y lista para usar. 🚀

