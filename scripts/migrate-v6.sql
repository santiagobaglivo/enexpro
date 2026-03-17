-- migrate-v6.sql: Descuentos (discounts) table

CREATE TABLE IF NOT EXISTS descuentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  descripcion TEXT,
  porcentaje NUMERIC(5,2) NOT NULL DEFAULT 0,
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE,
  aplica_a TEXT DEFAULT 'todos', -- 'todos', 'categorias', 'productos'
  categorias_ids UUID[] DEFAULT '{}',
  productos_ids UUID[] DEFAULT '{}',
  presentacion TEXT DEFAULT 'todas', -- 'todas', 'unidad', 'caja'
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE descuentos ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'descuentos' AND policyname = 'descuentos_all'
  ) THEN
    CREATE POLICY descuentos_all ON descuentos FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
