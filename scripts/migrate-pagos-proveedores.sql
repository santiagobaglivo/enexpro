-- =============================================
-- Pagos a Proveedores
-- =============================================

CREATE TABLE IF NOT EXISTS pagos_proveedores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  proveedor_id UUID NOT NULL REFERENCES proveedores(id) ON DELETE CASCADE,
  fecha DATE DEFAULT CURRENT_DATE,
  monto NUMERIC(12,2) NOT NULL,
  forma_pago TEXT DEFAULT 'Efectivo',
  compra_id UUID REFERENCES compras(id) ON DELETE SET NULL,
  observacion TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE pagos_proveedores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_select_pagos_proveedores" ON pagos_proveedores FOR SELECT USING (true);
CREATE POLICY "allow_all_insert_pagos_proveedores" ON pagos_proveedores FOR INSERT WITH CHECK (true);
CREATE POLICY "allow_all_update_pagos_proveedores" ON pagos_proveedores FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_delete_pagos_proveedores" ON pagos_proveedores FOR DELETE USING (true);

CREATE INDEX IF NOT EXISTS idx_pagos_proveedores_proveedor ON pagos_proveedores(proveedor_id);
CREATE INDEX IF NOT EXISTS idx_pagos_proveedores_fecha ON pagos_proveedores(fecha);
