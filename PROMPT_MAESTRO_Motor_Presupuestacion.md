# PROMPT MAESTRO — Motor de Presupuestación Log Metal SRL
## Stack: Next.js 14 (App Router) + Supabase + OpenAI / Whisper + Tailwind CSS

---

## 🎯 CONTEXTO DEL PROYECTO

Eres un desarrollador full-stack senior. Debes construir un **Motor de Presupuestación Omnicanal** para **Log Metal SRL**, empresa fabricadora de estructuras metálicas industriales (galpones, naves industriales) ubicada en Mendoza, Argentina.

El sistema recibe datos por múltiples canales de entrada (WhatsApp audio/texto, formulario web, PDF/Word), los procesa con IA para extraer variables clave, y genera automáticamente dos documentos de salida:

1. **Presupuesto Base 0** — Análisis de costos internos (estructura de costos por rubro/subrubro)
2. **R-04 Presupuesto Comercial** — Oferta formal para el cliente

---

## 🏗️ ARQUITECTURA GENERAL

```
┌─────────────────────────────────────────────────┐
│              CANALES DE ENTRADA                  │
│  WhatsApp (audio/texto) │ Web Form │ PDF/DOCX    │
└──────────────┬──────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────┐
│         PROCESAMIENTO IA (OpenAI)                │
│  Whisper (transcripción) + GPT-4o (extracción)  │
│  → Variables clave del R-09                      │
└──────────────┬──────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────┐
│         MOTOR DE CÁLCULO (Supabase Edge Fn)      │
│  Ratios Base 0 × Superficie/TN → Costos          │
│  Estructura Flexxus (rubros 01-27)               │
└──────────────┬──────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────┐
│         VALIDACIÓN COMERCIAL (Next.js UI)        │
│  Borrador editable → Aprobación del equipo       │
└──────────────┬──────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────┐
│              OUTPUTS                             │
│  R-04 PDF/Excel  │  Actualización Flexxus (API)  │
└─────────────────────────────────────────────────┘
```

---

## 🗄️ ESQUEMA DE BASE DE DATOS (Supabase / PostgreSQL)

Crea las siguientes tablas en Supabase:

```sql
-- Proyectos / Leads
CREATE TABLE proyectos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo TEXT UNIQUE NOT NULL,           -- ej: PROY-2026-001
  cliente TEXT NOT NULL,
  razon_social TEXT,
  cuit TEXT,
  contacto TEXT,
  telefono TEXT,
  email TEXT,
  ubicacion TEXT,
  estado TEXT DEFAULT 'borrador',        -- borrador | revision | aprobado | enviado
  canal_origen TEXT,                     -- whatsapp | web | documento
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Variables técnicas del R-09
CREATE TABLE datos_tecnicos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  proyecto_id UUID REFERENCES proyectos(id) ON DELETE CASCADE,
  ancho NUMERIC,                         -- metros
  largo NUMERIC,                         -- metros
  superficie NUMERIC,                   -- m2
  altura_libre NUMERIC,                  -- metros
  tipologia TEXT,                        -- nave simple | doble nave | entrepiso
  -- Alcance contratado (booleans)
  incluye_proyecto BOOLEAN DEFAULT false,
  incluye_calculo BOOLEAN DEFAULT false,
  incluye_fabricacion BOOLEAN DEFAULT false,
  incluye_montaje BOOLEAN DEFAULT false,
  incluye_obra_civil BOOLEAN DEFAULT false,
  incluye_cubierta BOOLEAN DEFAULT false,
  incluye_cerramiento_lateral BOOLEAN DEFAULT false,
  incluye_portones BOOLEAN DEFAULT false,
  incluye_piso BOOLEAN DEFAULT false,
  incluye_electrica BOOLEAN DEFAULT false,
  incluye_sanitaria BOOLEAN DEFAULT false,
  -- Especificaciones
  tipo_perfileria TEXT,
  tipo_cubierta TEXT,
  tipo_cerramiento TEXT,
  aislacion TEXT,
  cantidad_portones INT,
  especificaciones_adicionales TEXT,
  -- Condiciones comerciales
  forma_pago JSONB,                     -- {anticipo: 0.5, cert1: 0.2, ...}
  plazo_obra_dias INT,
  observaciones TEXT,
  raw_data JSONB,                        -- datos crudos extraídos por IA
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Rubros y subrubros (espejo de Flexxus)
CREATE TABLE rubros (
  id SERIAL PRIMARY KEY,
  codigo_flexxus INT UNIQUE NOT NULL,    -- coincide con CODIGORUBRO de Flexxus
  nombre TEXT NOT NULL,
  activo BOOLEAN DEFAULT true
);

CREATE TABLE subrubros (
  id SERIAL PRIMARY KEY,
  codigo_flexxus INT UNIQUE,
  rubro_id INT REFERENCES rubros(id),
  nombre TEXT NOT NULL,
  tipo TEXT,                             -- MATERIAL | MO_FABRICACION | MO_MONTAJE | ARTEFACTO
  activo BOOLEAN DEFAULT true
);

-- Ratios de costo por rubro (Presupuesto Base 0)
CREATE TABLE ratios_costos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  subrubro_id INT REFERENCES subrubros(id),
  unidad TEXT,                           -- kg/m2 | m2 | uni | lts | m3
  ratio_cantidad NUMERIC,                -- ej: 22.5 (kg acero / m2)
  precio_unitario_usd NUMERIC,           -- en USD
  precio_unitario_ars NUMERIC,           -- en ARS (se actualiza periódicamente)
  fecha_actualizacion DATE DEFAULT CURRENT_DATE,
  fuente TEXT,                           -- 'manual' | 'flexxus' | 'mercado'
  vigente BOOLEAN DEFAULT true
);

-- Líneas del Presupuesto Base 0
CREATE TABLE presupuesto_base_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  proyecto_id UUID REFERENCES proyectos(id) ON DELETE CASCADE,
  rubro_id INT REFERENCES rubros(id),
  subrubro_id INT REFERENCES subrubros(id),
  descripcion TEXT,
  unidad TEXT,
  cantidad NUMERIC,
  precio_unitario_ars NUMERIC,
  precio_unitario_usd NUMERIC,
  costo_total_ars NUMERIC,
  costo_total_usd NUMERIC,
  margen NUMERIC DEFAULT 0,              -- porcentaje de utilidad
  precio_venta_ars NUMERIC,
  precio_venta_usd NUMERIC,
  incluido BOOLEAN DEFAULT true,
  orden INT,
  observaciones TEXT
);

-- Presupuesto Comercial R-04
CREATE TABLE presupuesto_comercial (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  proyecto_id UUID REFERENCES proyectos(id) ON DELETE CASCADE,
  version INT DEFAULT 1,
  fecha DATE DEFAULT CURRENT_DATE,
  tipo_cambio_usd NUMERIC,               -- BNA oficial al momento
  superficie_m2 NUMERIC,
  tn_estructura NUMERIC,
  kg_m2 NUMERIC,
  total_costo_usd NUMERIC,
  total_venta_usd NUMERIC,
  iva_porcentaje NUMERIC DEFAULT 21,
  total_con_iva_usd NUMERIC,
  total_por_m2_usd NUMERIC,
  condiciones_pago TEXT,
  validez_oferta_dias INT DEFAULT 15,
  estado TEXT DEFAULT 'borrador',
  aprobado_por TEXT,
  fecha_aprobacion TIMESTAMPTZ,
  pdf_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Auditoría de entradas (omnicanalidad)
CREATE TABLE ingestas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  proyecto_id UUID REFERENCES proyectos(id),
  canal TEXT NOT NULL,                   -- whatsapp | web | pdf | docx | audio
  raw_content TEXT,                      -- texto original o transcripción
  archivo_url TEXT,                      -- si aplica
  ia_response JSONB,                     -- respuesta completa del modelo
  variables_extraidas JSONB,             -- variables parseadas del R-09
  procesado BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed: Rubros de Flexxus (01-27 activos)
INSERT INTO rubros (codigo_flexxus, nombre) VALUES
(46, '01. HONORARIOS'),
(47, '02. PRELIMINARES'),
(48, '03. MOVIMIENTO DE SUELO'),
(49, '04. FUNDACIONES'),
(50, '05. ESTRUCTURA METALICA'),
(51, '06. CERRAMIENTO LATERAL'),
(52, '07. CERRAMIENTO CUBIERTA'),
(53, '08. PORTONES'),
(54, '09. ESCALERAS'),
(55, '10. ALEROS'),
(56, '11. ZINGUERIA'),
(57, '12. CENEFA'),
(58, '13. PISO INDUSTRIAL'),
(59, '14. VEREDIN'),
(60, '15. TABIQUES LIVIANOS Y CIELORRASO'),
(61, '16. CARPINTERIAS'),
(62, '17. REVESTIMIENTOS'),
(63, '18. INSTALACION SANITARIA'),
(64, '19. INSTALACION ELECTRICA'),
(65, '20. SISTEMA CONTRA INCENDIOS'),
(66, '21. INSTALACION TERMOMECANICA'),
(67, '22. OBRA CIVIL'),
(68, '23. ESTRUCTURA METALICA (COMPRAS)'),
(69, '24. LOGISTICA Y EQUIPOS'),
(70, '25. FINAL DE OBRA'),
(71, '26. COSTOS INDIRECTOS DE OBRA'),
(72, '27. COSTOS COMERCIALES Y FINANCIEROS');
```

---

## 📁 ESTRUCTURA DE CARPETAS Next.js 14

```
/app
  /api
    /ingest          → POST: recibe archivos, audio, texto
      /whatsapp      → webhook WhatsApp (audio .ogg + texto)
      /document      → upload PDF/DOCX
      /form          → datos del formulario web
    /extract         → POST: llama a GPT-4o para extraer variables R-09
    /calculate       → POST: motor de cálculo Base 0
    /presupuesto     → GET/POST/PATCH: CRUD presupuestos
    /export          → GET: genera PDF del R-04
    /flexxus         → POST: sincroniza con ERP (webhook o API REST Flexxus)

  /(dashboard)
    /page.tsx                    → Dashboard principal: proyectos recientes
    /proyectos
      /page.tsx                  → Lista de proyectos
      /nuevo/page.tsx            → Formulario de nuevo proyecto (estilo Nurpanel)
      /[id]/page.tsx             → Detalle del proyecto
      /[id]/r09/page.tsx         → Visualización/edición R-09
      /[id]/base0/page.tsx       → Presupuesto Base 0 (editable)
      /[id]/r04/page.tsx         → Presupuesto Comercial R-04 (editable)
      /[id]/validar/page.tsx     → Pantalla de validación antes de envío
    /configuracion
      /ratios/page.tsx           → ABM de ratios de costo
      /rubros/page.tsx           → ABM de rubros Flexxus
      /tipo-cambio/page.tsx      → Actualización tipo de cambio USD/ARS

/components
  /ui                            → shadcn/ui base
  /forms
    ProyectoForm.tsx             → Formulario omnicanal (paso a paso)
    R09Form.tsx                  → Formulario R-09 editable
  /presupuesto
    Base0Table.tsx               → Tabla editable Presupuesto Base 0
    R04Preview.tsx               → Preview del R-04 estilo documento
    ItemRow.tsx                  → Fila de ítem editable
  /ingesta
    AudioUploader.tsx            → Sube .ogg, muestra transcripción
    DocumentUploader.tsx         → Sube PDF/DOCX
    VariablesExtracted.tsx       → Muestra variables extraídas por IA
  /dashboard
    ProyectosTable.tsx
    EstadoBadge.tsx
    KpiCards.tsx

/lib
  supabase.ts                    → cliente Supabase (server + browser)
  openai.ts                      → cliente OpenAI
  calculator.ts                  → motor de cálculo Base 0
  extractor.ts                   → prompt de extracción R-09
  pdf-generator.ts               → generación R-04 PDF (usando react-pdf)
  flexxus.ts                     → integración ERP Flexxus

/types
  proyecto.ts
  presupuesto.ts
  flexxus.ts
```

---

## 🤖 MÓDULO 1: INGESTA OMNICANAL

### 1A. Endpoint WhatsApp (audio .ogg)
```typescript
// app/api/ingest/whatsapp/route.ts
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase'

export async function POST(req: Request) {
  const formData = await req.formData()
  const audioFile = formData.get('audio') as File
  const textMessage = formData.get('text') as string

  const openai = new OpenAI()
  let transcripcion = textMessage

  // Si viene audio, transcribir con Whisper
  if (audioFile) {
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: 'es',
    })
    transcripcion = transcription.text
  }

  // Guardar ingesta cruda
  const supabase = createClient()
  const { data: ingesta } = await supabase
    .from('ingestas')
    .insert({ canal: audioFile ? 'whatsapp_audio' : 'whatsapp_texto', raw_content: transcripcion })
    .select()
    .single()

  // Extraer variables con GPT-4o
  const variables = await extraerVariablesR09(transcripcion)

  await supabase
    .from('ingestas')
    .update({ variables_extraidas: variables, procesado: true })
    .eq('id', ingesta.id)

  return Response.json({ ingesta_id: ingesta.id, variables, transcripcion })
}
```

### 1B. Extractor de Variables R-09 (GPT-4o)
```typescript
// lib/extractor.ts
export async function extraerVariablesR09(texto: string) {
  const openai = new OpenAI()

  const prompt = `
Eres un asistente especializado en análisis de proyectos de construcción de galpones industriales metálicos.

Dado el siguiente texto (puede ser una transcripción de audio de WhatsApp, un email, o fragmento de pliego):

<texto>
${texto}
</texto>

Extrae TODAS las variables que puedas identificar y devuelve SOLO un JSON con la siguiente estructura.
Si un campo no está mencionado, usa null.

{
  "cliente": string | null,
  "razon_social": string | null,
  "telefono": string | null,
  "email": string | null,
  "ubicacion": string | null,
  "ancho_m": number | null,
  "largo_m": number | null,
  "superficie_m2": number | null,
  "altura_libre_m": number | null,
  "tipologia": "nave_simple" | "doble_nave" | "entrepiso" | null,
  "incluye_proyecto": boolean | null,
  "incluye_calculo": boolean | null,
  "incluye_fabricacion": boolean | null,
  "incluye_montaje": boolean | null,
  "incluye_obra_civil": boolean | null,
  "incluye_cubierta": boolean | null,
  "incluye_cerramiento_lateral": boolean | null,
  "incluye_portones": boolean | null,
  "incluye_piso_industrial": boolean | null,
  "incluye_instalacion_electrica": boolean | null,
  "incluye_instalacion_sanitaria": boolean | null,
  "tipo_perfileria": string | null,
  "tipo_cubierta": string | null,
  "cantidad_portones": number | null,
  "plazo_obra_dias": number | null,
  "forma_pago": {
    "anticipo": number | null,
    "certificado_1": number | null,
    "certificado_2": number | null,
    "certificado_3": number | null
  } | null,
  "observaciones": string | null,
  "confianza": "alta" | "media" | "baja"
}
`

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    temperature: 0.1,
  })

  return JSON.parse(response.choices[0].message.content!)
}
```

---

## 🧮 MÓDULO 2: MOTOR DE CÁLCULO (Presupuesto Base 0)

```typescript
// lib/calculator.ts
import { createClient } from '@/lib/supabase'

export interface DatosTecnicos {
  superficie_m2: number
  altura_libre_m: number
  tipologia: string
  incluye_fabricacion: boolean
  incluye_montaje: boolean
  incluye_cubierta: boolean
  incluye_cerramiento_lateral: boolean
  incluye_portones: boolean
  incluye_piso_industrial: boolean
  incluye_instalacion_electrica: boolean
  incluye_instalacion_sanitaria: boolean
  [key: string]: unknown
}

export async function calcularBase0(proyectoId: string, datos: DatosTecnicos) {
  const supabase = createClient()

  // Obtener ratios de costo vigentes
  const { data: ratios } = await supabase
    .from('ratios_costos')
    .select('*, subrubros(*, rubros(*))')
    .eq('vigente', true)

  if (!ratios) throw new Error('No hay ratios de costo configurados')

  const items = []

  for (const ratio of ratios) {
    const subrubro = ratio.subrubros
    const rubro = subrubro?.rubros

    // Verificar si el rubro está incluido en el alcance
    const incluido = esRubroIncluido(rubro?.nombre, datos)
    if (!incluido) continue

    // Calcular cantidad según unidad y ratio
    const cantidad = calcularCantidad(ratio, datos)
    const costoARS = cantidad * ratio.precio_unitario_ars
    const costoUSD = cantidad * ratio.precio_unitario_usd

    items.push({
      proyecto_id: proyectoId,
      rubro_id: rubro?.id,
      subrubro_id: subrubro?.id,
      descripcion: subrubro?.nombre,
      unidad: ratio.unidad,
      cantidad,
      precio_unitario_ars: ratio.precio_unitario_ars,
      precio_unitario_usd: ratio.precio_unitario_usd,
      costo_total_ars: costoARS,
      costo_total_usd: costoUSD,
      margen: 0.20, // 20% default, editable
      precio_venta_ars: costoARS * 1.20,
      precio_venta_usd: costoUSD * 1.20,
      incluido: true,
    })
  }

  // Guardar items calculados
  await supabase.from('presupuesto_base_items').insert(items)

  return items
}

function calcularCantidad(ratio: any, datos: DatosTecnicos): number {
  switch (ratio.unidad) {
    case 'kg/m2':
      return ratio.ratio_cantidad * datos.superficie_m2
    case 'm2':
      return ratio.ratio_cantidad * datos.superficie_m2
    case 'uni':
      return ratio.ratio_cantidad
    case 'm3':
      return ratio.ratio_cantidad * datos.superficie_m2
    default:
      return ratio.ratio_cantidad
  }
}

function esRubroIncluido(nombreRubro: string | undefined, datos: DatosTecnicos): boolean {
  if (!nombreRubro) return false
  const n = nombreRubro.toLowerCase()
  if (n.includes('estructura') && !datos.incluye_fabricacion) return false
  if (n.includes('cubierta') && !datos.incluye_cubierta) return false
  if (n.includes('cerramiento lateral') && !datos.incluye_cerramiento_lateral) return false
  if (n.includes('porton') && !datos.incluye_portones) return false
  if (n.includes('piso') && !datos.incluye_piso_industrial) return false
  if (n.includes('electrica') && !datos.incluye_instalacion_electrica) return false
  if (n.includes('sanitaria') && !datos.incluye_instalacion_sanitaria) return false
  return true
}
```

---

## 🖥️ MÓDULO 3: INTERFAZ FRONTEND (Next.js + Tailwind)

### Referencia visual: Nurpanel (https://nurpanel.com/distribuidores.html)
El formulario de nuevo proyecto debe seguir este patrón:
- **Paso 1**: Canal de entrada (selector de 4 opciones: WhatsApp Audio / WhatsApp Texto / Formulario Manual / Subir PDF/DOCX)
- **Paso 2**: Ingesta según canal elegido (uploader de audio, textarea, o drop de archivo)
- **Paso 3**: Variables extraídas (R-09) — editable por el usuario antes de calcular
- **Paso 4**: Presupuesto Base 0 generado — tabla editable con márgenes por rubro
- **Paso 5**: Preview R-04 — borrador del documento comercial
- **Paso 6**: Validación y envío

### Paleta de colores (industrial / metálica):
```css
:root {
  --color-primary: #1B2A47;      /* Azul industrial oscuro */
  --color-accent: #F05A28;       /* Naranja metálico */
  --color-bg: #F4F5F7;           /* Gris claro */
  --color-surface: #FFFFFF;
  --color-text: #1A1A2E;
  --color-muted: #6B7280;
  --color-success: #10B981;
  --color-warning: #F59E0B;
  --color-border: #E5E7EB;
}
```

### Componente: Formulario paso a paso
```tsx
// components/forms/ProyectoForm.tsx
'use client'
import { useState } from 'react'

type Canal = 'whatsapp_audio' | 'whatsapp_texto' | 'manual' | 'documento'

const PASOS = [
  { id: 1, titulo: 'Canal de entrada', icono: '📡' },
  { id: 2, titulo: 'Carga de datos', icono: '📥' },
  { id: 3, titulo: 'Variables R-09', icono: '📋' },
  { id: 4, titulo: 'Presupuesto Base 0', icono: '🏗️' },
  { id: 5, titulo: 'R-04 Comercial', icono: '📄' },
  { id: 6, titulo: 'Validar y enviar', icono: '✅' },
]

export default function ProyectoForm() {
  const [paso, setPaso] = useState(1)
  const [canal, setCanal] = useState<Canal | null>(null)
  const [variables, setVariables] = useState<Record<string, unknown>>({})
  const [proyectoId, setProyectoId] = useState<string | null>(null)

  // Renderizar paso correspondiente
  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Stepper */}
      <div className="flex items-center mb-10 gap-2">
        {PASOS.map((p, i) => (
          <div key={p.id} className="flex items-center gap-2">
            <div className={`
              w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold
              ${paso >= p.id ? 'bg-[#F05A28] text-white' : 'bg-gray-200 text-gray-500'}
            `}>
              {paso > p.id ? '✓' : p.id}
            </div>
            <span className="hidden md:block text-sm text-gray-600">{p.titulo}</span>
            {i < PASOS.length - 1 && <div className="w-8 h-px bg-gray-300 mx-1" />}
          </div>
        ))}
      </div>

      {/* Contenido de cada paso */}
      {paso === 1 && <PasoCanal onSelect={(c) => { setCanal(c); setPaso(2) }} />}
      {paso === 2 && canal && (
        <PasoCarga
          canal={canal}
          onExtracted={(vars, id) => { setVariables(vars); setProyectoId(id); setPaso(3) }}
        />
      )}
      {paso === 3 && (
        <PasoVariables
          variables={variables}
          onChange={setVariables}
          onNext={() => setPaso(4)}
        />
      )}
      {paso === 4 && proyectoId && (
        <PasoBase0
          proyectoId={proyectoId}
          variables={variables}
          onNext={() => setPaso(5)}
        />
      )}
      {paso === 5 && proyectoId && (
        <PasoR04 proyectoId={proyectoId} onNext={() => setPaso(6)} />
      )}
      {paso === 6 && proyectoId && (
        <PasoValidacion proyectoId={proyectoId} />
      )}
    </div>
  )
}
```

---

## 📄 MÓDULO 4: GENERACIÓN R-04 PDF

```typescript
// lib/pdf-generator.ts
// Usar @react-pdf/renderer para generar el R-04

import { Document, Page, Text, View, StyleSheet, pdf } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 9, fontFamily: 'Helvetica' },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  title: { fontSize: 14, fontWeight: 'bold', color: '#1B2A47' },
  table: { display: 'flex', width: '100%', borderStyle: 'solid', borderWidth: 1, borderColor: '#E5E7EB' },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  tableHeader: { backgroundColor: '#1B2A47', color: 'white', padding: 6, fontWeight: 'bold' },
  tableCell: { padding: 5, flex: 1 },
  totalRow: { backgroundColor: '#F05A28', color: 'white', flexDirection: 'row', padding: 8 },
})

export async function generarR04PDF(presupuesto: any, items: any[]) {
  // Agrupar items por rubro
  const porRubro = items.reduce((acc, item) => {
    const rubro = item.rubro?.nombre || 'Otros'
    if (!acc[rubro]) acc[rubro] = []
    acc[rubro].push(item)
    return acc
  }, {} as Record<string, any[]>)

  const doc = (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>LOG METAL SRL</Text>
            <Text>PRESUPUESTO — R-04</Text>
          </View>
          <View>
            <Text>Código: R-04 | Rev. 01</Text>
            <Text>Fecha: {new Date().toLocaleDateString('es-AR')}</Text>
          </View>
        </View>

        {/* Datos del proyecto */}
        <View style={{ marginBottom: 16 }}>
          <Text>OBRA: {presupuesto.proyecto?.cliente}</Text>
          <Text>UBICACIÓN: {presupuesto.proyecto?.ubicacion}</Text>
          <Text>SUPERFICIE: {presupuesto.superficie_m2} m²</Text>
          <Text>TN ESTRUCTURA: {presupuesto.tn_estructura} kg</Text>
        </View>

        {/* Tabla de ítems por rubro */}
        {Object.entries(porRubro).map(([rubro, rubItems]) => (
          <View key={rubro} style={{ marginBottom: 12 }}>
            <View style={[styles.tableRow, { backgroundColor: '#1B2A47' }]}>
              <Text style={[styles.tableCell, { color: 'white', fontWeight: 'bold' }]}>{rubro}</Text>
            </View>
            {(rubItems as any[]).map((item, i) => (
              <View key={i} style={styles.tableRow}>
                <Text style={[styles.tableCell, { flex: 3 }]}>{item.descripcion}</Text>
                <Text style={styles.tableCell}>{item.unidad}</Text>
                <Text style={styles.tableCell}>{item.cantidad?.toFixed(2)}</Text>
                <Text style={styles.tableCell}>u$d {item.precio_venta_usd?.toFixed(2)}</Text>
                <Text style={styles.tableCell}>u$d {item.precio_venta_usd?.toFixed(2)}</Text>
              </View>
            ))}
          </View>
        ))}

        {/* Totales */}
        <View style={styles.totalRow}>
          <Text style={{ flex: 1 }}>TOTAL VENTA (SIN IVA)</Text>
          <Text>u$d {presupuesto.total_venta_usd?.toFixed(2)}</Text>
        </View>
        <View style={{ flexDirection: 'row', padding: 6 }}>
          <Text style={{ flex: 1 }}>IVA 21%</Text>
          <Text>u$d {(presupuesto.total_venta_usd * 0.21)?.toFixed(2)}</Text>
        </View>
        <View style={[styles.totalRow, { backgroundColor: '#1B2A47' }]}>
          <Text style={{ flex: 1 }}>TOTAL CON IVA</Text>
          <Text>u$d {presupuesto.total_con_iva_usd?.toFixed(2)}</Text>
        </View>

        {/* Condiciones comerciales */}
        <View style={{ marginTop: 20, fontSize: 8 }}>
          <Text style={{ fontWeight: 'bold', marginBottom: 4 }}>CONDICIONES COMERCIALES</Text>
          <Text>Tipo de cambio: Dólar Oficial BNA — ${presupuesto.tipo_cambio_usd}</Text>
          <Text>Forma de pago: {presupuesto.condiciones_pago}</Text>
          <Text>Validez de oferta: {presupuesto.validez_oferta_dias} días corridos</Text>
          <Text>Plazo de obra: según contrato</Text>
        </View>
      </Page>
    </Document>
  )

  return await pdf(doc).toBuffer()
}
```

---

## 🔗 MÓDULO 5: INTEGRACIÓN FLEXXUS

```typescript
// lib/flexxus.ts
// Flexxus ERP — módulo Gastos por Proyectos

export interface FlexxusProyecto {
  codigo: string
  descripcion: string
  cliente: string
  fecha_inicio: string
  rubros: FlexxusRubro[]
}

export interface FlexxusRubro {
  codigo_rubro: number
  codigo_subrubro: number
  descripcion: string
  importe: number
  moneda: 'ARS' | 'USD'
}

export async function sincronizarConFlexxus(proyectoId: string, items: any[]) {
  // NOTA: Adaptar a la API REST o método de importación disponible en Flexxus
  // Opciones:
  // A) API REST (si Flexxus lo expone)
  // B) Generación de archivo CSV/Excel para importación manual
  // C) Webhook saliente desde el sistema hacia Flexxus

  const payload: FlexxusProyecto = {
    codigo: `PROY-${proyectoId.slice(0, 8).toUpperCase()}`,
    descripcion: 'Generado desde Motor de Presupuestación',
    cliente: '',
    fecha_inicio: new Date().toISOString().split('T')[0],
    rubros: items.map(item => ({
      codigo_rubro: item.rubro?.codigo_flexxus,
      codigo_subrubro: item.subrubro?.codigo_flexxus,
      descripcion: item.descripcion,
      importe: item.costo_total_usd,
      moneda: 'USD',
    })),
  }

  // Opción A: API REST Flexxus
  const response = await fetch(`${process.env.FLEXXUS_API_URL}/proyectos`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.FLEXXUS_API_KEY}`,
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    // Si falla la API, generar Excel para importación manual
    return generarExcelFlexxus(payload)
  }

  return response.json()
}
```

---

## ⚙️ VARIABLES DE ENTORNO (.env.local)

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# OpenAI (Whisper + GPT-4o)
OPENAI_API_KEY=sk-...

# Flexxus ERP (si tiene API)
FLEXXUS_API_URL=https://api.flexxus.com.ar
FLEXXUS_API_KEY=...

# WhatsApp Business (Twilio o Meta)
WHATSAPP_WEBHOOK_TOKEN=...
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...

# App
NEXT_PUBLIC_APP_URL=https://presupuestos.logmetal.com.ar
```

---

## 📦 DEPENDENCIAS (package.json)

```json
{
  "dependencies": {
    "next": "^14.2.0",
    "@supabase/supabase-js": "^2.43.0",
    "@supabase/ssr": "^0.4.0",
    "openai": "^4.52.0",
    "@react-pdf/renderer": "^3.4.4",
    "react-hook-form": "^7.52.0",
    "zod": "^3.23.8",
    "@hookform/resolvers": "^3.9.0",
    "tailwindcss": "^3.4.4",
    "shadcn-ui": "latest",
    "lucide-react": "^0.400.0",
    "xlsx": "^0.18.5",
    "date-fns": "^3.6.0",
    "react-dropzone": "^14.2.3"
  }
}
```

---

## 🚀 INSTRUCCIONES DE IMPLEMENTACIÓN

### Fase 1 — Scaffolding (Día 1-2)
1. `npx create-next-app@latest motor-presupuestacion --typescript --tailwind --app`
2. Configurar Supabase: crear proyecto, ejecutar el SQL de esquema arriba
3. Configurar variables de entorno
4. Instalar shadcn/ui: `npx shadcn-ui@latest init`
5. Seed de rubros y subrubros Flexxus en Supabase

### Fase 2 — Backend APIs (Día 3-5)
1. `/api/ingest/whatsapp` — Whisper transcripción
2. `/api/ingest/document` — PDF/DOCX parsing
3. `/api/extract` — GPT-4o extracción R-09
4. `/api/calculate` — Motor Base 0
5. `/api/export` — Generación PDF R-04

### Fase 3 — Frontend (Día 6-10)
1. Dashboard principal con KPIs
2. Formulario multi-paso (estilo Nurpanel)
3. Tabla Base 0 editable con márgenes por rubro
4. Preview R-04 editable antes de aprobar
5. Pantalla de configuración: ratios, tipo de cambio

### Fase 4 — Integraciones (Día 11-14)
1. Webhook WhatsApp (Meta Business API o Twilio)
2. Integración Flexxus (API o exportación Excel)
3. Actualización automática tipo de cambio BNA
4. Notificaciones por email (Resend)

---

## 📋 NOTAS DE NEGOCIO CRÍTICAS

- **Tipo de cambio**: Siempre usar Dólar Oficial BNA (consultar API BCRA)
- **Validez de oferta**: Default 15 días corridos
- **Forma de pago default**: 50% anticipo / 20% cert.1 / 20% cert.2 / 10% final
- **Margen default por rubro**: 20% sobre costo (configurable por rubro)
- **Unidad de presupuesto**: Siempre en USD, con equivalente ARS al momento
- **Superficie de referencia**: Usar superficie real del techo (no planta)
- **Plazo estándar**: 120 días corridos desde aprobación municipal
- **Ratio estructura referencia**: ~22-25 kg acero / m² para nave simple
- **IVA**: 21% sobre precio de venta

---

## ✅ CRITERIOS DE ACEPTACIÓN

- [ ] Audio .ogg de WhatsApp → transcripción correcta con Whisper
- [ ] Texto libre → extracción de mínimo 80% de variables R-09
- [ ] Documento Word R-09 completo → 100% de variables extraídas
- [ ] Cálculo Base 0 generado en < 3 segundos
- [ ] PDF R-04 descargable y con formato idéntico al original
- [ ] Items del presupuesto editables antes de aprobar
- [ ] Sincronización con Flexxus (rubros 01-27)
- [ ] UI responsive (mobile + desktop)
- [ ] Multi-usuario con auth Supabase (comercial / técnico / admin)
