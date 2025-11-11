import Redis from 'ioredis'
import { env } from '@/lib/config/env'

// Cliente Redis para cache multi-tenant
const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
})

/**
 * Clave de cache con prefijo de tenant
 * MULTI-TENANT: Todas las claves de cache incluyen tenantId
 */
function getTenantKey(tenantId: string, key: string): string {
  return `tenant:${tenantId}:${key}`
}

/**
 * Cache multi-tenant
 */
export class TenantCache {
  /**
   * Obtiene un valor del cache para un tenant
   */
  static async get<T>(tenantId: string, key: string): Promise<T | null> {
    const tenantKey = getTenantKey(tenantId, key)
    const value = await redis.get(tenantKey)
    if (!value) return null
    return JSON.parse(value) as T
  }

  /**
   * Guarda un valor en el cache para un tenant
   */
  static async set(
    tenantId: string,
    key: string,
    value: any,
    ttlSeconds?: number
  ): Promise<void> {
    const tenantKey = getTenantKey(tenantId, key)
    const serialized = JSON.stringify(value)
    if (ttlSeconds) {
      await redis.setex(tenantKey, ttlSeconds, serialized)
    } else {
      await redis.set(tenantKey, serialized)
    }
  }

  /**
   * Elimina un valor del cache para un tenant
   */
  static async delete(tenantId: string, key: string): Promise<void> {
    const tenantKey = getTenantKey(tenantId, key)
    await redis.del(tenantKey)
  }

  /**
   * Elimina todos los valores del cache de un tenant
   */
  static async deleteAll(tenantId: string): Promise<void> {
    const pattern = getTenantKey(tenantId, '*')
    const keys = await redis.keys(pattern)
    if (keys.length > 0) {
      await redis.del(...keys)
    }
  }

  /**
   * Verifica si una clave existe en el cache
   */
  static async exists(tenantId: string, key: string): Promise<boolean> {
    const tenantKey = getTenantKey(tenantId, key)
    const result = await redis.exists(tenantKey)
    return result === 1
  }

  /**
   * Incrementa un contador en el cache
   */
  static async increment(
    tenantId: string,
    key: string,
    amount: number = 1
  ): Promise<number> {
    const tenantKey = getTenantKey(tenantId, key)
    return await redis.incrby(tenantKey, amount)
  }

  /**
   * Obtiene múltiples valores del cache
   */
  static async mget<T>(tenantId: string, keys: string[]): Promise<(T | null)[]> {
    const tenantKeys = keys.map(key => getTenantKey(tenantId, key))
    const values = await redis.mget(...tenantKeys)
    return values.map(value => (value ? JSON.parse(value) : null)) as (T | null)[]
  }

  /**
   * Guarda múltiples valores en el cache
   */
  static async mset(
    tenantId: string,
    data: Record<string, any>,
    ttlSeconds?: number
  ): Promise<void> {
    const pipeline = redis.pipeline()
    for (const [key, value] of Object.entries(data)) {
      const tenantKey = getTenantKey(tenantId, key)
      const serialized = JSON.stringify(value)
      if (ttlSeconds) {
        pipeline.setex(tenantKey, ttlSeconds, serialized)
      } else {
        pipeline.set(tenantKey, serialized)
      }
    }
    await pipeline.exec()
  }
}

/**
 * Utilidades de cache para documentos
 */
export const DocumentCache = {
  /**
   * Cache de documento procesado (TTL: 1 hora)
   */
  async getDocument(tenantId: string, documentId: string) {
    return TenantCache.get(tenantId, `document:${documentId}`)
  },

  async setDocument(tenantId: string, documentId: string, data: any) {
    return TenantCache.set(tenantId, `document:${documentId}`, data, 3600)
  },

  async deleteDocument(tenantId: string, documentId: string) {
    return TenantCache.delete(tenantId, `document:${documentId}`)
  },

  /**
   * Cache de lista de documentos (TTL: 5 minutos)
   */
  async getDocumentList(tenantId: string, userId: string, filters: string) {
    return TenantCache.get(tenantId, `documents:${userId}:${filters}`)
  },

  async setDocumentList(
    tenantId: string,
    userId: string,
    filters: string,
    data: any
  ) {
    return TenantCache.set(tenantId, `documents:${userId}:${filters}`, data, 300)
  },

  async invalidateDocumentList(tenantId: string, userId: string) {
    const pattern = `documents:${userId}:*`
    // Nota: Redis keys es lento en producción, considerar usar SCAN
    const keys = await redis.keys(`tenant:${tenantId}:${pattern}`)
    if (keys.length > 0) {
      await redis.del(...keys)
    }
  },
}

export default redis

