# API Documentation

Sistema de Procesamiento de Facturas - Documentación completa de la API REST

## Tabla de Contenidos

- [Autenticación](#autenticación)
- [Endpoints de Documentos](#endpoints-de-documentos)
- [Endpoints de Estadísticas](#endpoints-de-estadísticas)
- [Endpoints de Exportación](#endpoints-de-exportación)
- [Endpoints de Integraciones](#endpoints-de-integraciones)
- [Endpoints de Automatizaciones](#endpoints-de-automatizaciones)
- [Códigos de Error](#códigos-de-error)

---

## Autenticación

Todos los endpoints requieren el header `x-tenant-id` para identificar el tenant.

```http
x-tenant-id: acme-corp
```

En producción, deberías usar un sistema de autenticación completo (JWT, OAuth, etc.).

---

## Endpoints de Documentos

### Subir Documento

Sube un nuevo documento para procesamiento.

**Endpoint:** `POST /api/upload`

**Headers:**
```
Content-Type: multipart/form-data
x-tenant-id: {tenantId}
```

**Body (FormData):**
```
file: File (image/* or application/pdf)
```

**Respuesta Exitosa (200):**
```json
{
  "success": true,
  "documentId": "clx123...",
  "message": "Documento subido y en cola de procesamiento"
}
```

**Errores:**
- `400` - Archivo no válido o límites excedidos
- `401` - Tenant no válido
- `500` - Error del servidor

---

### Listar Documentos

Obtiene la lista de documentos del tenant.

**Endpoint:** `GET /api/documents`

**Headers:**
```
x-tenant-id: {tenantId}
```

**Query Parameters:**
- `search` (opcional) - Búsqueda por nombre de archivo
- `type` (opcional) - Filtrar por tipo de documento
- `status` (opcional) - Filtrar por estado
- `limit` (opcional) - Número de resultados (default: 50)
- `offset` (opcional) - Paginación (default: 0)

**Respuesta Exitosa (200):**
```json
{
  "documents": [
    {
      "id": "clx123...",
      "fileName": "factura-001.pdf",
      "status": "COMPLETED",
      "classification": {
        "type": "FACTURA_A",
        "confidence": 0.95,
        "reason": "Documento identificado como Factura A por..."
      },
      "extractedData": { ... },
      "validationStatus": "PENDING",
      "createdAt": "2024-01-15T10:00:00Z",
      "updatedAt": "2024-01-15T10:05:00Z"
    }
  ],
  "total": 100,
  "limit": 50,
  "offset": 0
}
```

---

### Obtener Documento

Obtiene los detalles de un documento específico.

**Endpoint:** `GET /api/documents/{id}`

**Headers:**
```
x-tenant-id: {tenantId}
```

**Respuesta Exitosa (200):**
```json
{
  "id": "clx123...",
  "fileName": "factura-001.pdf",
  "fileUrl": "https://...",
  "mimeType": "application/pdf",
  "fileSize": 102400,
  "status": "COMPLETED",
  "classification": {
    "type": "FACTURA_A",
    "confidence": 0.95,
    "reason": "..."
  },
  "extractedData": {
    "tipo_factura": "A",
    "numero": "0001-00012345",
    "fecha_emision": "2024-01-15",
    "emisor": { ... },
    "receptor": { ... },
    "items": [ ... ],
    "total": 121.00
  },
  "validationStatus": "PENDING",
  "createdAt": "2024-01-15T10:00:00Z"
}
```

**Errores:**
- `404` - Documento no encontrado
- `401` - No autorizado

---

### Validar Documento

Valida o edita los datos extraídos de un documento.

**Endpoint:** `POST /api/documents/{id}/validate`

**Headers:**
```
Content-Type: application/json
x-tenant-id: {tenantId}
```

**Body:**
```json
{
  "status": "APPROVED",  // APPROVED | REJECTED | EDITED
  "extractedData": {
    // Datos corregidos
    "total": 125.00
  },
  "corrections": [
    {
      "field": "total",
      "oldValue": "121.00",
      "newValue": "125.00",
      "reason": "Error en cálculo de IVA"
    }
  ]
}
```

**Respuesta Exitosa (200):**
```json
{
  "success": true,
  "document": { ... }
}
```

---

## Endpoints de Estadísticas

### Obtener Estadísticas

Obtiene estadísticas agregadas de documentos.

**Endpoint:** `GET /api/stats`

**Headers:**
```
x-tenant-id: {tenantId}
```

**Respuesta Exitosa (200):**
```json
{
  "kpis": {
    "total": 1500,
    "completed": 1350,
    "processing": 100,
    "failed": 50
  },
  "byType": [
    { "type": "FACTURA_A", "count": 450 },
    { "type": "FACTURA_B", "count": 300 },
    { "type": "SERVICIO_LUZ", "count": 200 }
  ],
  "byStatus": [
    { "name": "COMPLETED", "count": 1350 },
    { "name": "PROCESSING", "count": 100 },
    { "name": "FAILED", "count": 50 }
  ],
  "trend": [
    { "date": "10/01", "count": 45 },
    { "date": "11/01", "count": 52 },
    { "date": "12/01", "count": 48 }
  ]
}
```

---

## Endpoints de Exportación

### Exportar a Google Sheets

Exporta documentos a Google Sheets.

**Endpoint:** `POST /api/exports/sheets`

**Headers:**
```
Content-Type: application/json
x-tenant-id: {tenantId}
```

**Body:**
```json
{
  "spreadsheetId": "1AbC...",
  "documentIds": ["clx123...", "clx456..."]  // Opcional, si no se envía exporta todos
}
```

**Respuesta Exitosa (200):**
```json
{
  "success": true,
  "documentCount": 50,
  "spreadsheetId": "1AbC..."
}
```

**Errores:**
- `400` - Integración no configurada
- `500` - Error al exportar

---

### Exportar a Excel

Genera y descarga un archivo Excel con los documentos.

**Endpoint:** `POST /api/exports/excel`

**Headers:**
```
Content-Type: application/json
x-tenant-id: {tenantId}
```

**Body:**
```json
{
  "documentIds": ["clx123...", "clx456..."]  // Opcional
}
```

**Respuesta Exitosa (200):**
```
Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
Content-Disposition: attachment; filename="documents-export-{timestamp}.xlsx"

[Binary Excel file]
```

---

## Endpoints de Integraciones

### Listar Integraciones

Obtiene las integraciones configuradas.

**Endpoint:** `GET /api/integrations`

**Headers:**
```
x-tenant-id: {tenantId}
```

**Respuesta Exitosa (200):**
```json
{
  "integrations": [
    {
      "id": "clx123...",
      "provider": "GOOGLE_SHEETS",
      "isActive": true,
      "createdAt": "2024-01-15T10:00:00Z"
    }
  ]
}
```

---

### Crear Integración

Crea una nueva integración.

**Endpoint:** `POST /api/integrations`

**Headers:**
```
Content-Type: application/json
x-tenant-id: {tenantId}
```

**Body:**
```json
{
  "provider": "GOOGLE_SHEETS",
  "accessToken": "ya29...",
  "refreshToken": "1//..."
}
```

**Respuesta Exitosa (200):**
```json
{
  "integration": {
    "id": "clx123...",
    "provider": "GOOGLE_SHEETS",
    "isActive": true,
    "createdAt": "2024-01-15T10:00:00Z"
  }
}
```

---

### Eliminar Integración

Elimina una integración.

**Endpoint:** `DELETE /api/integrations?id={id}`

**Headers:**
```
x-tenant-id: {tenantId}
```

**Respuesta Exitosa (200):**
```json
{
  "success": true
}
```

---

### OAuth Google - Obtener URL de Autorización

Obtiene la URL para iniciar el flujo OAuth de Google.

**Endpoint:** `GET /api/integrations/google/auth`

**Respuesta Exitosa (200):**
```json
{
  "authUrl": "https://accounts.google.com/o/oauth2/v2/auth?..."
}
```

---

### OAuth Google - Callback

Callback de OAuth de Google (maneja automáticamente el intercambio de código por tokens).

**Endpoint:** `GET /api/integrations/google/callback?code={code}`

**Respuesta:**
Redirección a `/integrations?google_auth=success&access_token=...&refresh_token=...`

---

## Endpoints de Automatizaciones

### Listar Automatizaciones

Obtiene las automatizaciones configuradas.

**Endpoint:** `GET /api/automations`

**Headers:**
```
x-tenant-id: {tenantId}
```

**Respuesta Exitosa (200):**
```json
{
  "automations": [
    {
      "id": "clx123...",
      "name": "Exportar facturas A a Sheets",
      "description": "Automáticamente exporta facturas tipo A",
      "trigger": {
        "type": "DOCUMENT_TYPE",
        "config": {
          "documentType": "FACTURA_A"
        }
      },
      "actions": [
        {
          "type": "EXPORT_SHEETS",
          "config": {
            "spreadsheetId": "1AbC..."
          }
        }
      ],
      "enabled": true,
      "_count": {
        "executions": 125
      },
      "createdAt": "2024-01-15T10:00:00Z"
    }
  ]
}
```

---

### Crear Automatización

Crea una nueva automatización.

**Endpoint:** `POST /api/automations`

**Headers:**
```
Content-Type: application/json
x-tenant-id: {tenantId}
```

**Body:**
```json
{
  "name": "Exportar facturas A",
  "description": "Descripción opcional",
  "trigger": {
    "type": "DOCUMENT_TYPE",  // DOCUMENT_PROCESSED | DOCUMENT_TYPE | SCHEDULE
    "config": {
      "documentType": "FACTURA_A"  // Solo para DOCUMENT_TYPE
    }
  },
  "actions": [
    {
      "type": "EXPORT_SHEETS",  // EXPORT_SHEETS | EXPORT_EXCEL | SEND_EMAIL | WEBHOOK
      "config": {
        "spreadsheetId": "1AbC..."
      }
    }
  ],
  "enabled": true
}
```

**Respuesta Exitosa (200):**
```json
{
  "automation": { ... }
}
```

---

### Obtener Automatización

Obtiene los detalles de una automatización.

**Endpoint:** `GET /api/automations/{id}`

**Headers:**
```
x-tenant-id: {tenantId}
```

**Respuesta Exitosa (200):**
```json
{
  "automation": {
    "id": "clx123...",
    "name": "Exportar facturas A",
    "trigger": { ... },
    "actions": [ ... ],
    "enabled": true,
    "executions": [
      {
        "id": "exec-1",
        "status": "COMPLETED",
        "createdAt": "2024-01-15T10:00:00Z",
        "completedAt": "2024-01-15T10:00:05Z"
      }
    ]
  }
}
```

---

### Actualizar Automatización

Actualiza una automatización existente.

**Endpoint:** `PATCH /api/automations/{id}`

**Headers:**
```
Content-Type: application/json
x-tenant-id: {tenantId}
```

**Body:**
```json
{
  "enabled": false,  // Campos opcionales
  "name": "Nuevo nombre"
}
```

**Respuesta Exitosa (200):**
```json
{
  "automation": { ... }
}
```

---

### Eliminar Automatización

Elimina una automatización.

**Endpoint:** `DELETE /api/automations/{id}`

**Headers:**
```
x-tenant-id: {tenantId}
```

**Respuesta Exitosa (200):**
```json
{
  "success": true
}
```

---

## Códigos de Error

### Errores Comunes

| Código | Descripción |
|--------|-------------|
| 400 | Bad Request - Datos inválidos |
| 401 | Unauthorized - Tenant inválido o no autorizado |
| 403 | Forbidden - Límites del plan excedidos |
| 404 | Not Found - Recurso no encontrado |
| 429 | Too Many Requests - Rate limit excedido |
| 500 | Internal Server Error - Error del servidor |

### Formato de Error

```json
{
  "error": "Mensaje de error descriptivo",
  "code": "ERROR_CODE",
  "details": {
    // Detalles adicionales opcionales
  }
}
```

---

## Rate Limits

Los rate limits varían según el plan:

- **FREE**: 100 requests/hora
- **BASIC**: 1,000 requests/hora
- **PROFESSIONAL**: 10,000 requests/hora
- **ENTERPRISE**: Ilimitado

---

## Webhooks

Puedes configurar webhooks para recibir notificaciones de eventos:

**Eventos Disponibles:**
- `document.completed` - Documento procesado exitosamente
- `document.failed` - Error al procesar documento
- `export.completed` - Exportación completada

**Formato del Payload:**
```json
{
  "event": "document.completed",
  "tenantId": "acme-corp",
  "timestamp": "2024-01-15T10:00:00Z",
  "data": {
    "documentId": "clx123...",
    "type": "FACTURA_A",
    "status": "COMPLETED"
  }
}
```

---

## Soporte

Para soporte técnico o preguntas sobre la API:
- Email: support@facturas.com
- Documentación: https://docs.facturas.com
- GitHub Issues: https://github.com/yourorg/facturas/issues
