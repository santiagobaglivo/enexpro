-- =============================================
-- Turnos de Caja
-- =============================================
CREATE TABLE IF NOT EXISTS turnos_caja (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero INT,
  fecha_apertura DATE DEFAULT CURRENT_DATE,
  hora_apertura TIME DEFAULT CURRENT_TIME,
  fecha_cierre DATE,
  hora_cierre TIME,
  operador TEXT,
  efectivo_inicial NUMERIC(12,2) DEFAULT 0,
  efectivo_real NUMERIC(12,2),
  diferencia NUMERIC(12,2),
  notas TEXT,
  estado TEXT DEFAULT 'abierto',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE turnos_caja ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS allow_all_turnos_caja_select ON turnos_caja FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS allow_all_turnos_caja_insert ON turnos_caja FOR INSERT WITH CHECK (true);
CREATE POLICY IF NOT EXISTS allow_all_turnos_caja_update ON turnos_caja FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS allow_all_turnos_caja_delete ON turnos_caja FOR DELETE USING (true);

-- =============================================
-- Pagos a Proveedores
-- =============================================
CREATE TABLE IF NOT EXISTS pagos_proveedores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proveedor_id UUID NOT NULL REFERENCES proveedores(id) ON DELETE CASCADE,
  fecha DATE DEFAULT CURRENT_DATE,
  monto NUMERIC(12,2) NOT NULL,
  forma_pago TEXT DEFAULT 'Efectivo',
  compra_id UUID REFERENCES compras(id) ON DELETE SET NULL,
  observacion TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE pagos_proveedores ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS allow_all_pagos_prov_select ON pagos_proveedores FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS allow_all_pagos_prov_insert ON pagos_proveedores FOR INSERT WITH CHECK (true);
CREATE POLICY IF NOT EXISTS allow_all_pagos_prov_update ON pagos_proveedores FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS allow_all_pagos_prov_delete ON pagos_proveedores FOR DELETE USING (true);
CREATE INDEX IF NOT EXISTS idx_pagos_proveedores_proveedor ON pagos_proveedores(proveedor_id);
CREATE INDEX IF NOT EXISTS idx_pagos_proveedores_fecha ON pagos_proveedores(fecha);
