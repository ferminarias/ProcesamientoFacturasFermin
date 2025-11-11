# Guía de Usuario

Sistema de Procesamiento de Facturas - Guía completa para usuarios

## Tabla de Contenidos

1. [Introducción](#introducción)
2. [Primeros Pasos](#primeros-pasos)
3. [Subir Documentos](#subir-documentos)
4. [Validar Documentos](#validar-documentos)
5. [Dashboard y Estadísticas](#dashboard-y-estadísticas)
6. [Exportar Datos](#exportar-datos)
7. [Automatizaciones](#automatizaciones)
8. [Consejos y Mejores Prácticas](#consejos-y-mejores-prácticas)

---

## Introducción

El Sistema de Procesamiento de Facturas utiliza inteligencia artificial para extraer automáticamente información de documentos financieros argentinos, incluyendo:

- Facturas (A, B, C, E, M)
- Servicios (Luz, Gas, Agua, Internet, Telefonía, Cable)
- Impuestos (ARBA, ABL, Patente, IIBB, Monotributo, Ganancias)
- Tarjetas de Crédito

### Beneficios

- ⚡ **Procesamiento rápido**: Documentos procesados en segundos
- 🎯 **Alta precisión**: Extracción con 95%+ de confiabilidad
- 🔄 **Automatización**: Configura acciones automáticas
- 📊 **Exportación flexible**: Google Sheets, Excel y más
- 🔒 **Seguro**: Aislamiento completo entre tenants

---

## Primeros Pasos

### Acceder a la Aplicación

1. Navega a `https://facturas.tudominio.com`
2. Ingresa con tu cuenta (el login se configura según tu implementación)
3. Verás el **Dashboard** con estadísticas de tus documentos

### Navegación Principal

La barra lateral izquierda contiene:

- **Dashboard**: Vista general y estadísticas
- **Documentos**: Lista de todos tus documentos
- **Subir Archivos**: Interfaz para subir nuevos documentos
- **Integraciones**: Configurar exportaciones
- **Automatizaciones**: Crear flujos automáticos
- **Configuración**: Ajustes de la cuenta

---

## Subir Documentos

### Método 1: Arrastrar y Soltar

1. Ve a **Subir Archivos**
2. Arrastra uno o más archivos al área de carga
3. Los archivos se agregarán a la cola
4. Haz clic en **"Subir todos"** o sube cada uno individualmente

### Método 2: Seleccionar Archivos

1. Ve a **Subir Archivos**
2. Haz clic en el área de carga
3. Selecciona archivos desde tu computadora
4. Los archivos se procesarán automáticamente

### Formatos Soportados

- **Imágenes**: PNG, JPG, JPEG, GIF, WebP
- **Documentos**: PDF

### Proceso de Subida

Una vez subido, el documento pasa por estas etapas:

1. **QUEUED**: En cola de procesamiento
2. **PROCESSING**: Siendo procesado
3. **CLASSIFYING**: Identificando tipo de documento
4. **EXTRACTING**: Extrayendo datos
5. **VALIDATING**: Listo para validación
6. **COMPLETED**: Proceso completo

---

## Validar Documentos

### Ver Lista de Documentos

1. Ve a **Documentos**
2. Usa los filtros para encontrar documentos:
   - Buscar por nombre
   - Filtrar por tipo
   - Filtrar por estado
3. Haz clic en el ícono de ojo (👁️) para ver detalles

### Validar un Documento

1. Abre el documento
2. Verás tres pestañas:
   - **Datos Extraídos**: Información extraída por IA
   - **Vista Previa**: Imagen del documento original
   - **Metadatos**: Información técnica

#### Editar Datos

1. En **Datos Extraídos**, haz clic en **"Editar"**
2. Modifica los campos que necesites corregir
3. Haz clic en **"Guardar Cambios"**

#### Aprobar/Rechazar

- **Aprobar**: Los datos son correctos, haz clic en **"Aprobar"**
- **Rechazar**: Los datos son incorrectos, haz clic en **"Rechazar"**

### Estados de Validación

- **PENDING**: Pendiente de validación
- **APPROVED**: Aprobado por el usuario
- **REJECTED**: Rechazado
- **EDITED**: Editado con correcciones

---

## Dashboard y Estadísticas

El Dashboard muestra:

### KPIs Principales

- **Total Documentos**: Cantidad total procesada
- **Completados**: Documentos procesados exitosamente
- **En Proceso**: Documentos siendo procesados
- **Fallidos**: Documentos con errores

### Gráficos

#### Documentos por Tipo

Gráfico de barras mostrando la distribución de tipos de documentos:
- Facturas A, B, C
- Servicios
- Impuestos
- Tarjetas

#### Distribución por Estado

Gráfico circular mostrando:
- Completados
- En proceso
- Fallidos
- etc.

#### Tendencia (Últimos 7 días)

Gráfico de línea mostrando la cantidad de documentos procesados por día.

---

## Exportar Datos

### Exportar a Google Sheets

#### Configurar Integración

1. Ve a **Integraciones**
2. En la tarjeta de **Google Sheets**, haz clic en **"Conectar con Google"**
3. Autoriza la aplicación en Google
4. Serás redirigido de vuelta (la integración queda configurada)

#### Exportar

1. Una vez conectado, haz clic en **"Exportar a Sheets"**
2. Ingresa el ID de tu Google Spreadsheet
   - Ejemplo: Si la URL es `https://docs.google.com/spreadsheets/d/1AbC.../edit`
   - El ID es: `1AbC...`
3. Haz clic en **"Exportar"**
4. Los documentos se exportarán automáticamente

**Nota**: Se crean hojas separadas por tipo de documento.

### Exportar a Excel

1. Ve a **Integraciones**
2. En la tarjeta de **Microsoft Excel**, haz clic en **"Descargar Excel"**
3. Se generará y descargará automáticamente un archivo .xlsx

El archivo Excel contiene:
- Hojas separadas por tipo de documento
- Headers formateados
- Todos los campos extraídos

---

## Automatizaciones

Las automatizaciones permiten ejecutar acciones automáticamente cuando se cumplen ciertas condiciones.

### Crear una Automatización

1. Ve a **Automatizaciones**
2. Haz clic en **"Nueva Automatización"**
3. Completa el formulario:

#### Paso 1: Información Básica

- **Nombre**: Nombre descriptivo
- **Descripción**: (Opcional) Explicación detallada

#### Paso 2: Definir el Trigger (Cuándo)

Elige cuándo se ejecutará la automatización:

- **Se procese cualquier documento**: Ejecutar para todos los documentos
- **Se procese un tipo específico**: Solo para un tipo (ej: Factura A)

#### Paso 3: Definir la Acción (Qué)

Elige qué hacer cuando se active el trigger:

- **Exportar a Google Sheets**: Enviar a una planilla
- **Generar archivo Excel**: Crear archivo Excel
- **Enviar email**: Notificar por correo
- **Llamar webhook**: Integrar con otro sistema

#### Paso 4: Configurar la Acción

Según la acción elegida:
- **Google Sheets**: Ingresa el Spreadsheet ID
- **Email**: Ingresa el email destinatario
- **Webhook**: Ingresa la URL del webhook

4. Haz clic en **"Crear Automatización"**

### Ejemplos de Automatizaciones

#### Ejemplo 1: Exportar Facturas A a Sheets

```
Trigger: Se procese un tipo específico (FACTURA_A)
Acción: Exportar a Google Sheets
Config: Spreadsheet ID: 1AbC...
```

#### Ejemplo 2: Notificar Impuestos

```
Trigger: Se procese un tipo específico (IMPUESTO_ARBA)
Acción: Enviar email
Config: Email: contabilidad@empresa.com
```

### Gestionar Automatizaciones

- **Activar/Desactivar**: Usa el botón de power (⚡)
- **Eliminar**: Haz clic en el ícono de basura (🗑️)
- **Ver Ejecuciones**: Muestra cuántas veces se ejecutó

---

## Consejos y Mejores Prácticas

### Calidad de Imágenes

Para mejor precisión:
- ✅ Usa imágenes nítidas y con buena iluminación
- ✅ Asegúrate de que el texto sea legible
- ✅ Evita imágenes borrosas o con reflejos
- ✅ Preferentemente usa PDFs originales

### Validación

- Siempre revisa los datos extraídos antes de aprobar
- Corrige errores para mejorar el aprendizaje del sistema
- Rechaza documentos que no se procesaron correctamente

### Organización

- Usa nombres de archivo descriptivos
- Aprovecha los filtros para encontrar documentos rápidamente
- Exporta regularmente tus datos

### Automatizaciones

- Empieza con automatizaciones simples
- Prueba las automatizaciones con documentos de prueba primero
- Desactiva automatizaciones que no uses

### Límites del Plan

Verifica los límites de tu plan:
- **FREE**: 100 documentos/mes
- **BASIC**: 1,000 documentos/mes
- **PROFESSIONAL**: 10,000 documentos/mes
- **ENTERPRISE**: Ilimitado

---

## Solución de Problemas

### El documento no se procesó

1. Verifica que el formato sea soportado (PDF, PNG, JPG)
2. Asegúrate de que la imagen sea legible
3. Revisa el estado del documento (puede estar en cola)
4. Si sigue fallando, contacta soporte

### La exportación a Google Sheets falla

1. Verifica que la integración esté activa
2. Asegúrate de que el Spreadsheet ID sea correcto
3. Verifica que el spreadsheet exista y tengas permisos
4. Reconecta la integración si es necesario

### La automatización no se ejecuta

1. Verifica que esté activada (estado: Activo)
2. Revisa el trigger - ¿coincide con el documento?
3. Verifica la configuración de la acción
4. Revisa el historial de ejecuciones

---

## Soporte

¿Necesitas ayuda?

- 📧 Email: support@facturas.com
- 📖 Documentación: https://docs.facturas.com
- 💬 Chat en vivo: Disponible en la aplicación

---

## Próximas Funcionalidades

Estamos trabajando en:
- 🔄 Procesamiento por lotes
- 📱 App móvil
- 🤖 IA mejorada para más tipos de documentos
- 📊 Reportes personalizados
- 🔗 Más integraciones (Dropbox, OneDrive, etc.)

¡Gracias por usar nuestro sistema!
