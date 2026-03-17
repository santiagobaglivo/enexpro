-- V4: E-commerce storefront tables

-- Store configuration
CREATE TABLE IF NOT EXISTS tienda_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre_tienda TEXT DEFAULT 'DulceSur',
  logo_url TEXT DEFAULT 'https://www.dulcesur.com/assets/logotipo.png',
  descripcion TEXT DEFAULT 'Tu tienda de golosinas online',
  color_primario TEXT DEFAULT '#d946ef',
  monto_minimo_pedido NUMERIC(12,2) DEFAULT 0,
  umbral_envio_gratis NUMERIC(12,2) DEFAULT 0,
  max_categorias_destacadas INTEGER DEFAULT 6,
  pago_mixto_habilitado BOOLEAN DEFAULT true,
  dias_entrega TEXT[] DEFAULT ARRAY['Lunes','Martes','Miércoles','Jueves','Viernes'],
  hora_corte TIME DEFAULT '18:00',
  dias_max_programacion INTEGER DEFAULT 7,
  tienda_activa BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Featured categories for storefront
CREATE TABLE IF NOT EXISTS categorias_destacadas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria_id UUID NOT NULL REFERENCES categorias(id) ON DELETE CASCADE,
  orden INTEGER DEFAULT 0,
  imagen_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Customer auth (separate from admin usuarios)
CREATE TABLE IF NOT EXISTS clientes_auth (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  nombre TEXT NOT NULL,
  telefono TEXT,
  verificado BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Customer addresses
CREATE TABLE IF NOT EXISTS cliente_direcciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_auth_id UUID NOT NULL REFERENCES clientes_auth(id) ON DELETE CASCADE,
  alias TEXT DEFAULT 'Casa',
  calle TEXT NOT NULL,
  numero TEXT NOT NULL,
  piso TEXT,
  departamento TEXT,
  localidad TEXT NOT NULL,
  provincia TEXT DEFAULT 'Buenos Aires',
  codigo_postal TEXT,
  referencia TEXT,
  predeterminada BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Store orders (from storefront)
CREATE TABLE IF NOT EXISTS pedidos_tienda (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero TEXT NOT NULL,
  cliente_auth_id UUID REFERENCES clientes_auth(id),
  nombre_cliente TEXT NOT NULL,
  email TEXT NOT NULL,
  telefono TEXT,
  estado TEXT DEFAULT 'pendiente',
  metodo_entrega TEXT DEFAULT 'retiro_local',
  direccion_id UUID REFERENCES cliente_direcciones(id),
  direccion_texto TEXT,
  fecha_entrega DATE,
  metodo_pago TEXT DEFAULT 'efectivo',
  subtotal NUMERIC(12,2) DEFAULT 0,
  costo_envio NUMERIC(12,2) DEFAULT 0,
  total NUMERIC(12,2) DEFAULT 0,
  observacion TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Store order items
CREATE TABLE IF NOT EXISTS pedido_tienda_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id UUID NOT NULL REFERENCES pedidos_tienda(id) ON DELETE CASCADE,
  producto_id UUID REFERENCES productos(id),
  nombre TEXT NOT NULL,
  presentacion TEXT DEFAULT 'Unidad',
  cantidad INTEGER DEFAULT 1,
  precio_unitario NUMERIC(12,2) NOT NULL,
  subtotal NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Insert default store config
INSERT INTO tienda_config (id) VALUES (gen_random_uuid()) ON CONFLICT DO NOTHING;

-- Add image_url to productos if not exists
DO $$ BEGIN
  ALTER TABLE productos ADD COLUMN IF NOT EXISTS imagen_url TEXT;
EXCEPTION WHEN others THEN NULL;
END $$;

-- Add destacado to categorias if not exists
DO $$ BEGIN
  ALTER TABLE categorias ADD COLUMN IF NOT EXISTS imagen_url TEXT;
EXCEPTION WHEN others THEN NULL;
END $$;
