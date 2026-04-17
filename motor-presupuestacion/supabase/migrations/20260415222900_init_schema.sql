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
