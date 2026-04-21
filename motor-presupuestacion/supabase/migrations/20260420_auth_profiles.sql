-- Tabla de perfiles de usuario (vinculada a auth.users de Supabase)
CREATE TABLE perfiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  nombre TEXT,
  rol TEXT NOT NULL DEFAULT 'comercial',  -- comercial | admin
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Trigger para crear perfil automáticamente al registrar usuario
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.perfiles (id, nombre, rol)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nombre', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'rol', 'comercial')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Agregar campos de contacto del cliente a proyectos
ALTER TABLE proyectos
  ADD COLUMN IF NOT EXISTS apellido TEXT,
  ADD COLUMN IF NOT EXISTS dni TEXT,
  ADD COLUMN IF NOT EXISTS observaciones TEXT;

-- RLS: habilitar en perfiles
ALTER TABLE perfiles ENABLE ROW LEVEL SECURITY;

-- Políticas de perfiles: solo puede ver/editar su propio perfil
CREATE POLICY "Perfil propio" ON perfiles
  FOR ALL USING (auth.uid() = id);

-- RLS en proyectos: lectura para comerciales autenticados, inserción pública (wizard)
ALTER TABLE proyectos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Inserción pública de proyectos" ON proyectos
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Lectura para comerciales" ON proyectos
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM perfiles
      WHERE perfiles.id = auth.uid()
      AND perfiles.rol IN ('comercial', 'admin')
    )
  );

CREATE POLICY "Actualización para comerciales" ON proyectos
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM perfiles
      WHERE perfiles.id = auth.uid()
      AND perfiles.rol IN ('comercial', 'admin')
    )
  );

-- RLS en datos_tecnicos: mismo patrón
ALTER TABLE datos_tecnicos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Inserción pública de datos técnicos" ON datos_tecnicos
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Lectura para comerciales - datos técnicos" ON datos_tecnicos
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM perfiles
      WHERE perfiles.id = auth.uid()
      AND perfiles.rol IN ('comercial', 'admin')
    )
  );

-- RLS en presupuesto_base_items
ALTER TABLE presupuesto_base_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Inserción pública de items" ON presupuesto_base_items
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Lectura para comerciales - items" ON presupuesto_base_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM perfiles
      WHERE perfiles.id = auth.uid()
      AND perfiles.rol IN ('comercial', 'admin')
    )
  );

CREATE POLICY "Actualización para comerciales - items" ON presupuesto_base_items
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM perfiles
      WHERE perfiles.id = auth.uid()
      AND perfiles.rol IN ('comercial', 'admin')
    )
  );

-- RLS en ratios_costos (solo comerciales pueden leer/editar)
ALTER TABLE ratios_costos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lectura pública de ratios" ON ratios_costos
  FOR SELECT USING (true);

CREATE POLICY "Escritura para comerciales - ratios" ON ratios_costos
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM perfiles
      WHERE perfiles.id = auth.uid()
      AND perfiles.rol IN ('comercial', 'admin')
    )
  );

-- RLS en rubros y subrubros (lectura pública, escritura para comerciales)
ALTER TABLE rubros ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Lectura pública rubros" ON rubros FOR SELECT USING (true);

ALTER TABLE subrubros ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Lectura pública subrubros" ON subrubros FOR SELECT USING (true);
