-- migrate-v8-combo-items.sql
-- Crea la tabla combo_items si no existe, y configura RLS correctamente.

CREATE TABLE IF NOT EXISTS combo_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  combo_id UUID NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  producto_id UUID NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  cantidad INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE combo_items ENABLE ROW LEVEL SECURITY;

-- Política permisiva para todo (igual que otras tablas del sistema)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'combo_items' AND policyname = 'combo_items_all'
  ) THEN
    CREATE POLICY combo_items_all ON combo_items FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Asegurarse de que productos tenga el campo es_combo
ALTER TABLE productos ADD COLUMN IF NOT EXISTS es_combo BOOLEAN DEFAULT false;

-- Índices útiles
CREATE INDEX IF NOT EXISTS combo_items_combo_id_idx ON combo_items(combo_id);
CREATE INDEX IF NOT EXISTS combo_items_producto_id_idx ON combo_items(producto_id);
