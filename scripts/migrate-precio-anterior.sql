ALTER TABLE productos ADD COLUMN IF NOT EXISTS precio_anterior numeric DEFAULT 0;
