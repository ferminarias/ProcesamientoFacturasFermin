import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Iniciando seed...')

  // Crear usuario admin
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      name: 'Admin User',
    },
  })

  console.log('✅ Usuario admin creado:', adminUser.email)

  // Crear tenant de ejemplo
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'demo' },
    update: {},
    create: {
      name: 'Empresa Demo',
      slug: 'demo',
      subdomain: 'demo',
      plan: 'PROFESSIONAL',
      isActive: true,
      maxUsers: 50,
      maxDocuments: 5000,
      maxStorageGB: 50,
      settings: {
        theme: 'light',
        language: 'es',
      },
    },
  })

  console.log('✅ Tenant demo creado:', tenant.slug)

  // Asignar usuario admin como OWNER del tenant
  const tenantUser = await prisma.tenantUser.upsert({
    where: {
      tenantId_userId: {
        tenantId: tenant.id,
        userId: adminUser.id,
      },
    },
    update: {},
    create: {
      tenantId: tenant.id,
      userId: adminUser.id,
      role: 'OWNER',
    },
  })

  console.log('✅ Usuario asignado al tenant:', tenantUser.role)

  // Crear más usuarios de ejemplo
  const users = [
    {
      email: 'usuario1@demo.com',
      name: 'Usuario 1',
      role: 'ADMIN' as const,
    },
    {
      email: 'usuario2@demo.com',
      name: 'Usuario 2',
      role: 'MEMBER' as const,
    },
  ]

  for (const userData of users) {
    const user = await prisma.user.upsert({
      where: { email: userData.email },
      update: {},
      create: {
        email: userData.email,
        name: userData.name,
      },
    })

    await prisma.tenantUser.upsert({
      where: {
        tenantId_userId: {
          tenantId: tenant.id,
          userId: user.id,
        },
      },
      update: {},
      create: {
        tenantId: tenant.id,
        userId: user.id,
        role: userData.role,
      },
    })

    console.log(`✅ Usuario ${userData.email} creado y asignado como ${userData.role}`)
  }

  console.log('🎉 Seed completado!')
  console.log('\n📋 Credenciales de acceso:')
  console.log('Tenant Slug: demo')
  console.log('Admin Email: admin@example.com')
  console.log('\n💡 Para acceder, usa:')
  console.log('- Header: X-Tenant-Id: <tenant-id>')
  console.log('- Subdomain: demo.tuapp.com')
  console.log('- Query: ?tenant=demo')
}

main()
  .catch((e) => {
    console.error('❌ Error en seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

