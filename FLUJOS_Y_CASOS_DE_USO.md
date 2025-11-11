# 📊 FLUJOS COMPLETOS Y CASOS DE USO - Sistema de Procesamiento con Templates

## 🎯 VISIÓN GENERAL

Este sistema permite procesar CUALQUIER tipo de documento financiero argentino con:
- **OCR inteligente** (Google Vision para fotos, extracción directa para PDFs)
- **Templates personalizables** creados por el usuario
- **IA que sugiere** qué campos extraer
- **Aprendizaje automático** que mejora con el tiempo
- **Conversaciones interactivas** cuando falta información

---

## 🔄 FLUJO 1: USUARIO SUBE DOCUMENTO **SIN TEMPLATE**

### Caso: Primera vez que procesas un tipo de documento

```
┌─────────────────────────────────────┐
│ 1. Usuario sube PDF/foto            │
│    "factura_edenor_enero.pdf"       │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│ 2. Sistema hace OCR automático      │
│    - ¿Es PDF limpio? → Extracción  │
│      directa (gratis, 1-2 seg)      │
│    - ¿Es foto/escaneo? → Google    │
│      Vision ($0.0015, 3-5 seg)      │
│                                     │
│    Guarda: OCRResult                │
│    - rawText                        │
│    - confidence: 0.92               │
│    - provider: GOOGLE_VISION        │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│ 3. Sistema busca Template           │
│    auto-detectable                  │
│                                     │
│    ¿Hay template con:              │
│    - keywords: ["EDENOR"]?          │
│    - supplierCuit: "30-50014060-6"? │
│                                     │
│    ❌ NO ENCONTRADO                 │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│ 4. IA ANALIZA y SUGIERE             │
│    POST /api/templates/analyze      │
│    { documentId: "abc123" }         │
│                                     │
│    GPT-4o analiza el OCR y sugiere: │
│    {                                │
│      suggestedName: "Facturas       │
│        Edenor",                     │
│      detectedType: "SERVICIO",      │
│      fields: [                      │
│        {                            │
│          name: "numero_cliente",    │
│          label: "Número de Cliente",│
│          fieldType: "TEXT",         │
│          isRequired: true,          │
│          sampleValue: "12345678",   │
│          confidence: 0.95           │
│        },                           │
│        {                            │
│          name: "consumo_kwh",       │
│          label: "Consumo en kWh",   │
│          fieldType: "NUMBER",       │
│          sampleValue: 450,          │
│          confidence: 0.92           │
│        },                           │
│        {                            │
│          name: "total",             │
│          label: "Total a Pagar",    │
│          fieldType: "CURRENCY",     │
│          isRequired: true,          │
│          sampleValue: 15750.50,     │
│          confidence: 0.98           │
│        }                            │
│        // ... más campos            │
│      ]                              │
│    }                                │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│ 5. FRONTEND muestra al usuario:    │
│                                     │
│    "Detectamos estos campos en tu  │
│     factura de Edenor:              │
│                                     │
│     ✅ Número de Cliente (95%)     │
│     ✅ Consumo en kWh (92%)         │
│     ✅ Total a Pagar (98%)          │
│     ☑️  Fecha de Vencimiento (75%) │
│     ☑️  Período Facturado (80%)    │
│                                     │
│     ¿Quieres crear un template     │
│      con estos campos?"             │
│                                     │
│    [Crear Template] [Procesar Solo]│
└────────────┬────────────────────────┘
             │
      ┌──────┴───────┐
      │              │
      ▼              ▼
   OPCIÓN A      OPCIÓN B
```

### OPCIÓN A: Usuario crea Template

```
┌─────────────────────────────────────┐
│ Usuario edita y confirma:           │
│ - Nombre: "Facturas Edenor"         │
│ - Selecciona campos (4 de 5)        │
│ - Edita nombre de un campo          │
│ - Marca "Auto-detectar para         │
│   próximos documentos"              │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│ POST /api/templates/from-document   │
│ {                                   │
│   documentId: "abc123",             │
│   name: "Facturas Edenor",          │
│   selectedFields: [                 │
│     "numero_cliente",               │
│     "consumo_kwh",                  │
│     "total",                        │
│     "fecha_vencimiento"             │
│   ]                                 │
│ }                                   │
│                                     │
│ Sistema CREA template y lo VINCULA │
│ al documento actual                 │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│ ✅ Template guardado!               │
│    De ahora en adelante, cualquier  │
│    factura de Edenor se procesará   │
│    automáticamente con este template│
│                                     │
│ ✅ Documento actual procesado con   │
│    los 4 campos seleccionados       │
└─────────────────────────────────────┘
```

### OPCIÓN B: Usuario solo procesa este documento

```
┌─────────────────────────────────────┐
│ Sistema usa extracción genérica     │
│ basada en el tipo detectado         │
│                                     │
│ - Usa prompt base de "SERVICIO"     │
│ - Extrae con GPT-4o Vision          │
│ - Guarda en tabla Servicio          │
│                                     │
│ ⚠️  Próximo documento del mismo     │
│    tipo VOLVERÁ a pedir confirmar   │
└─────────────────────────────────────┘
```

---

## 🔄 FLUJO 2: USUARIO SUBE DOCUMENTO **CON TEMPLATE EXISTENTE**

### Caso: Ya procesaste facturas de Edenor antes

```
┌─────────────────────────────────────┐
│ 1. Usuario sube                     │
│    "factura_edenor_febrero.pdf"     │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│ 2. OCR automático                   │
│    rawText: "EDENOR S.A. ..."       │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│ 3. Sistema AUTO-DETECTA template    │
│                                     │
│    Busca templates con:             │
│    - autoDetect: true               │
│    - keywords incluye "EDENOR"      │
│                                     │
│    ✅ ENCONTRADO:                   │
│       Template "Facturas Edenor"    │
│       (creado en FLUJO 1)           │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│ 4. Extracción con PROMPT            │
│    PERSONALIZADO                    │
│                                     │
│    Prompt dinámico del template:    │
│    "Extrae los siguientes datos de  │
│     esta factura de Edenor:         │
│                                     │
│     - Número de Cliente (REQUERIDO) │
│       [Buscar después de 'Cliente']│
│     - Consumo en kWh                │
│     - Total a Pagar (REQUERIDO)     │
│     - Fecha de Vencimiento          │
│                                     │
│     VALIDACIONES:                   │
│     - consumo_kwh debe ser > 0      │
│     - total debe tener formato      │
│       moneda argentina              │
│                                     │
│     Responde en JSON..."            │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│ 5. GPT-4o extrae con el template    │
│                                     │
│    {                                │
│      numero_cliente: "12345678",    │
│      consumo_kwh: 520,              │
│      total: 18250.75,               │
│      fecha_vencimiento: "2025-02-15"│
│    }                                │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│ 6. Validación contra template       │
│                                     │
│    ✅ Todos los campos requeridos   │
│    ✅ Tipos correctos                │
│    ✅ Validaciones pasadas           │
│                                     │
│    confidence: 0.95 (alta)          │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│ 7. Guardar en tabla especializada   │
│                                     │
│    INSERT INTO servicios (          │
│      documentId,                    │
│      tipo_servicio: "luz",          │
│      empresa_proveedora: "EDENOR",  │
│      numero_cuenta: "12345678",     │
│      consumo_unidades: 520,         │
│      total_a_pagar: 18250.75,       │
│      primer_vencimiento: "2025-..."│
│    )                                │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│ 8. Usuario ve resultado              │
│                                     │
│    ✅ Procesado automáticamente     │
│    📋 Template: "Facturas Edenor"   │
│    ⚡ Confidence: 95%                │
│    ⏱️  Tiempo: 3.2 seg               │
│    💰 Costo: $0.03                  │
│                                     │
│    [Ver Datos] [Editar] [Aprobar]  │
└─────────────────────────────────────┘
```

---

## 🔄 FLUJO 3: DOCUMENTO CON CAMPO FALTANTE → **CONVERSACIÓN**

### Caso: Template esperaba un campo pero no se encontró

```
┌─────────────────────────────────────┐
│ 1. Extracción con template          │
│                                     │
│    Datos extraídos:                 │
│    {                                │
│      numero_cliente: "12345678",    │
│      consumo_kwh: 520,              │
│      total: 18250.75,               │
│      fecha_vencimiento: null  ❌    │
│    }                                │
│                                     │
│    Validación:                      │
│    missingFields: ["fecha_venc..."] │
│    confidence: 0.75 (baja)          │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│ 2. Sistema INICIA CONVERSACIÓN      │
│    (si template.askIfMissing=true)  │
│                                     │
│    CREATE ExtractionConversation {  │
│      documentId,                    │
│      templateId,                    │
│      status: ACTIVE,                │
│      currentData: {...},            │
│      missingFields: ["fecha_..."]   │
│    }                                │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│ 3. IA pregunta al usuario           │
│                                     │
│    CREATE ConversationMessage {     │
│      role: ASSISTANT,               │
│      content: "No encontré la fecha │
│        de vencimiento en la factura.│
│        ¿Podrías proporcionármela?", │
│      fieldName: "fecha_vencimiento",│
│      confidence: 0.0                │
│    }                                │
│                                     │
│    Frontend muestra chat:           │
│    🤖 "No encontré la fecha de      │
│         vencimiento. ¿Cuál es?"     │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│ 4. Usuario responde                 │
│                                     │
│    CREATE ConversationMessage {     │
│      role: USER,                    │
│      content: "15/02/2025"          │
│    }                                │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│ 5. IA procesa respuesta             │
│                                     │
│    - Normaliza: "15/02/2025" →      │
│      "2025-02-15"                   │
│    - Valida formato                 │
│    - Actualiza currentData          │
│                                     │
│    CREATE ConversationMessage {     │
│      role: ASSISTANT,               │
│      content: "Perfecto, guardé     │
│        15/02/2025 como fecha de     │
│        vencimiento. ✅"              │
│    }                                │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│ 6. Completar extracción             │
│                                     │
│    UPDATE ExtractionConversation {  │
│      status: COMPLETED,             │
│      completedAt: now()             │
│    }                                │
│                                     │
│    Guardar documento con todos      │
│    los datos completos              │
└─────────────────────────────────────┘
```

---

## 🔄 FLUJO 4: USUARIO QUIERE **CREAR TEMPLATE** DESDE CERO

### Caso: Usuario planea procesar muchos tickets de supermercado

```
┌─────────────────────────────────────┐
│ 1. Usuario va a "Templates" →       │
│    "Crear Nuevo Template"           │
│                                     │
│    Opciones:                        │
│    • Desde documento ejemplo        │
│    • Desde cero (manual)            │
│                                     │
│    Usuario elige: "Desde documento" │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│ 2. Sube ticket de ejemplo           │
│    "ticket_coto_ejemplo.jpg"        │
│                                     │
│    Sistema hace OCR                 │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│ 3. IA analiza y muestra UI:         │
│                                     │
│    "Detecté que es un TICKET con    │
│     estos datos:                    │
│                                     │
│     DATOS DETECTADOS:               │
│     ┌─────────────────────────────┐│
│     │ ✅ Comercio: "COTO"   (98%) ││
│     │ ✅ Total: $12,450     (95%) ││
│     │ ✅ Fecha: 10/01/2025  (92%) ││
│     │ ☑️  Items (array)      (85%) ││
│     │ ☑️  Método Pago        (70%) ││
│     │ ☑️  CUIT                (60%) ││
│     └─────────────────────────────┘│
│                                     │
│     ¿Qué campos quieres incluir?"   │
│                                     │
│    [Seleccionar Todos] [Personalizar]│
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│ 4. Usuario personaliza:             │
│                                     │
│    Campo: "comercio"                │
│    • Renombra a: "supermercado"     │
│    • Tipo: SELECT                   │
│    • Opciones: [COTO, DIA%, CARREFOUR]│
│    • ✅ Requerido                   │
│                                     │
│    Campo: "total"                   │
│    • Tipo: CURRENCY                 │
│    • Validación: min: 0, max: 100000│
│    • ✅ Requerido                   │
│                                     │
│    Campo: "items"                   │
│    • Tipo: JSON (array)             │
│    • ❌ Opcional                     │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│ 5. Configurar auto-detección        │
│                                     │
│    "¿Cuándo aplicar este template?" │
│                                     │
│    ✅ Auto-detectar                 │
│                                     │
│    Reglas de detección:             │
│    • Si contiene: "COTO", "DIA%",   │
│      "CARREFOUR"                    │
│    • Y es tipo: TICKET              │
│                                     │
│    ✅ Preguntar si falta info       │
│    ✅ Permitir conversación         │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│ 6. Sistema genera prompt            │
│                                     │
│    customPrompt auto-generado:      │
│    "Extrae los siguientes datos de  │
│     este ticket de supermercado:    │
│                                     │
│     - Supermercado (REQUERIDO)      │
│       Opciones: COTO, DIA%, CARREFOUR│
│     - Total (REQUERIDO)             │
│       Formato: moneda argentina     │
│     - Fecha                         │
│     - Items (array opcional)        │
│       Cada item: {                  │
│         producto: string,           │
│         precio: number              │
│       }                             │
│                                     │
│     VALIDACIONES:                   │
│     - total debe estar entre        │
│       $0 y $100,000                 │
│                                     │
│     Si un campo no está, usa null"  │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│ 7. Guardar template                 │
│                                     │
│    POST /api/templates              │
│    {                                │
│      name: "Tickets Supermercado",  │
│      documentType: "OTRO",          │
│      customPrompt: "...",           │
│      fields: [...],                 │
│      autoDetect: true,              │
│      detectionRules: {              │
│        keywords: ["COTO", "DIA"],   │
│        type: "TICKET"               │
│      }                              │
│    }                                │
│                                     │
│    ✅ Template creado!              │
│       ID: tmpl_abc123               │
└─────────────────────────────────────┘
```

---

## 🎯 CASOS DE USO ESPECIALES

### CASO A: Documento con MÚLTIPLES opciones de template

```
Usuario sube: "recibo_sueldo.pdf"

Sistema encuentra 2 templates:
1. "Recibos de Sueldo - Empresa A" (confidence: 0.8)
2. "Recibos de Sueldo - Genérico" (confidence: 0.6)

Frontend muestra:
"¿Con qué template quieres procesar?"
[Empresa A (recomendado)] [Genérico] [Otro]
```

### CASO B: Template con VALIDACIÓN MATEMÁTICA

```
Template: "Facturas AFIP"

validationRules: {
  "total": "subtotal + iva_21 + iva_105 debe ser == total"
}

Si extracción da:
{
  subtotal: 10000,
  iva_21: 2100,
  iva_105: 0,
  total: 12000  ❌ (debería ser 12100)
}

Sistema:
1. Detecta inconsistencia
2. Recalcula automáticamente: total = 12100
3. O pregunta: "El total no coincide con subtotal + IVA. ¿Es correcto $12,000 o debería ser $12,100?"
```

### CASO C: Mejora CONTINUA de template

```
Usuario procesa 10 facturas de Edenor

Documento #5 tiene campo nuevo: "recargo_mora"

Sistema:
POST /api/templates/[id]/suggest-improvements
{
  documentId: "doc_005",
  extractedData: { ..., recargo_mora: 450 }
}

Response:
{
  newFields: [
    {
      name: "recargo_mora",
      label: "Recargo por Mora",
      fieldType: "CURRENCY",
      confidence: 0.85,
      reason: "Encontrado en 20% de documentos recientes"
    }
  ]
}

Frontend notifica:
"🔔 Detectamos un campo nuevo en tus facturas de Edenor: Recargo por Mora
¿Quieres agregarlo al template?"
[Agregar] [Ignorar] [Recordar después]
```

---

## 💡 RECOMENDACIONES DE IMPLEMENTACIÓN

### Para el FRONTEND:

1. **Vista de Templates**
   - Lista de templates con estadísticas (timesUsed, successRate)
   - Botón "Crear desde documento ejemplo"
   - Preview de prompt personalizado

2. **Durante Upload de Documento**
   - Si no hay template → Mostrar sugerencias inline
   - Si hay template → Mostrar "Procesando con template X"
   - Progress bar con steps: OCR → Detectar → Extraer → Validar

3. **Chat de Conversación**
   - Widget tipo WhatsApp para campos faltantes
   - Sugerencias de la IA con % de confianza
   - Historial de conversaciones por documento

### Para el BACKEND:

1. **Webhooks/SSE**
   - Notificar cuando OCR completa
   - Notificar cuando template auto-detectado
   - Notificar cuando hay campos faltantes

2. **Caché**
   - Templates usados frecuentemente
   - Resultados de OCR recientes
   - Sugerencias de campos por tipo de documento

3. **Queue Priority**
   - Alta: Documentos con template (procesamiento rápido)
   - Media: Documentos sin template (análisis con IA)
   - Baja: Mejoras de templates (background)

---

## 📊 MÉTRICAS Y COSTOS

### Por Documento:

**Escenario 1: PDF Limpio + Template Existente** (IDEAL)
- OCR: Extracción directa → $0
- Detección template: Búsqueda BD → $0
- Extracción: GPT-4o Vision → $0.02
- **TOTAL: ~$0.02** (2 centavos)
- **TIEMPO: ~2 segundos**

**Escenario 2: Foto Borrosa + Sin Template** (PEOR CASO)
- OCR: Google Vision → $0.0015
- Análisis IA: GPT-4o → $0.03
- Usuario crea template: GPT-4o → $0.02
- Extracción: GPT-4o Vision → $0.02
- **TOTAL: ~$0.07** (7 centavos)
- **TIEMPO: ~8 segundos**

**Escenario 3: Foto + Template + Conversación**
- OCR: Google Vision → $0.0015
- Extracción: GPT-4o → $0.02
- Conversación (2 mensajes): GPT-4o → $0.005
- **TOTAL: ~$0.027** (2.7 centavos)
- **TIEMPO: ~4 segundos + usuario**

### Escalado:

**1,000 documentos/mes:**
- 70% con template → $14
- 20% foto sin template → $14
- 10% conversaciones → $2.70
- **TOTAL MENSUAL: ~$31**

**Potencial de Ingreso:**
- Cobrar $0.10 por documento
- Ingreso: $100/mes
- **Margen: 69%** 🚀

---

## 🚀 PRÓXIMOS PASOS

1. ✅ Schema completo
2. ✅ Servicios de OCR y Template Builder
3. ✅ APIs de Templates
4. ⏳ Actualizar document processor
5. ⏳ Frontend para crear/editar templates
6. ⏳ Chat de conversaciones
7. ⏳ Dashboard de analytics

