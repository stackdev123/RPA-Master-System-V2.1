
-- 1. Gunakan schema public
SET search_path TO public;

-- [BAGIAN BARU: FUNGSI UNTUK LOADING CEPAT]
-- LIMIT DIHAPUS TOTAL untuk memastikan semua data terangkut.
CREATE OR REPLACE FUNCTION get_app_initial_data()
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'coops', (SELECT json_agg(t) FROM (SELECT * FROM master_coops ORDER BY name ASC) t),
        'customers', (SELECT json_agg(t) FROM (SELECT * FROM master_customers ORDER BY name ASC) t),
        'plates', (SELECT json_agg(plate_number) FROM (SELECT plate_number FROM master_plates ORDER BY plate_number ASC) t),
        'masterItems', (SELECT json_agg(t) FROM (SELECT * FROM master_items ORDER BY name ASC) t),
        'currentStock', (SELECT json_agg(t) FROM current_stock t),
        'deliveryOrders', (SELECT json_agg(t) FROM (SELECT * FROM delivery_orders ORDER BY timestamp DESC) t),
        'invoices', (SELECT json_agg(t) FROM (SELECT * FROM invoices ORDER BY timestamp DESC) t),
        'expenses', (SELECT json_agg(t) FROM (SELECT * FROM expenses ORDER BY tanggal DESC) t),
        'salaries', (SELECT json_agg(t) FROM (SELECT * FROM salaries ORDER BY tanggal DESC) t),
        'ledger', (SELECT json_agg(t) FROM (SELECT * FROM ledger_entries ORDER BY timestamp DESC) t),
        'stockLogs', (SELECT json_agg(t) FROM (SELECT * FROM stock_logs ORDER BY timestamp DESC) t),
        'productionLogs', (SELECT json_agg(t) FROM (SELECT * FROM production_logs ORDER BY timestamp DESC) t),
        'tradingPurchases', (SELECT json_agg(t) FROM (SELECT * FROM trading_purchases ORDER BY tanggal DESC) t),
        'stockDisposals', (SELECT json_agg(t) FROM (SELECT * FROM stock_disposals ORDER BY tanggal DESC) t)
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql STABLE;

-- 2. Setup Master Tables (Pastikan tabel ada)
CREATE TABLE IF NOT EXISTS master_items (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT UNIQUE NOT NULL, created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS master_coops (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT UNIQUE NOT NULL, address TEXT, created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS master_customers (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT UNIQUE NOT NULL, address TEXT, created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS master_plates (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), plate_number TEXT UNIQUE NOT NULL, created_at TIMESTAMPTZ DEFAULT now());

-- [NEW] Setup Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "user" TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'admin',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Insert default admin if not exists (Optional, adjust as needed)
INSERT INTO users ("user", password) VALUES ('admin', 'admin123') ON CONFLICT DO NOTHING;

-- 3. Setup Transactional Tables
CREATE TABLE IF NOT EXISTS current_stock (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_name TEXT UNIQUE NOT NULL REFERENCES master_items(name) ON UPDATE CASCADE,
    quantity NUMERIC DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS production_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tanggal_produksi DATE NOT NULL,
    item_name TEXT NOT NULL REFERENCES master_items(name) ON UPDATE CASCADE,
    qty NUMERIC NOT NULL,
    ekor INTEGER DEFAULT 0,
    kg NUMERIC DEFAULT 0,
    mobil TEXT NOT NULL,
    harga_beli_kg NUMERIC DEFAULT 0,
    kematian_ekor INTEGER DEFAULT 0,
    kematian_kg NUMERIC DEFAULT 0,
    nama_kandang TEXT NOT NULL REFERENCES master_coops(name) ON UPDATE CASCADE,
    driver TEXT,
    is_applied BOOLEAN DEFAULT FALSE,
    timestamp TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS trading_purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tanggal DATE NOT NULL,
    item_name TEXT NOT NULL REFERENCES master_items(name) ON UPDATE CASCADE,
    kg NUMERIC NOT NULL,
    harga_per_kg NUMERIC NOT NULL,
    total_harga NUMERIC GENERATED ALWAYS AS (kg * harga_per_kg) STORED,
    timestamp TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS stock_disposals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tanggal DATE NOT NULL,
    item_name TEXT NOT NULL REFERENCES master_items(name) ON UPDATE CASCADE,
    kg NUMERIC NOT NULL,
    harga_valuasi_kg NUMERIC NOT NULL,
    total_kerugian NUMERIC GENERATED ALWAYS AS (kg * harga_valuasi_kg) STORED,
    keterangan TEXT,
    timestamp TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS delivery_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tanggal DATE NOT NULL,
    nomor_sj TEXT NOT NULL,
    customer TEXT NOT NULL REFERENCES master_customers(name) ON UPDATE CASCADE,
    nama_item TEXT NOT NULL REFERENCES master_items(name) ON UPDATE CASCADE,
    qty_kirim NUMERIC NOT NULL,
    qty_diterima NUMERIC DEFAULT 0,
    retur NUMERIC DEFAULT 0,
    susut_selisih NUMERIC DEFAULT 0,
    timestamp TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tanggal DATE NOT NULL,
    nomor_sj TEXT NOT NULL,
    nomor_invoice TEXT NOT NULL,
    customer TEXT NOT NULL REFERENCES master_customers(name) ON UPDATE CASCADE,
    item_name TEXT NOT NULL REFERENCES master_items(name) ON UPDATE CASCADE,
    harga NUMERIC DEFAULT 0,
    total NUMERIC DEFAULT 0,
    transfer NUMERIC DEFAULT 0,
    cash NUMERIC DEFAULT 0,
    qty_diterima NUMERIC DEFAULT 0,
    keterangan TEXT,
    invoice_status TEXT DEFAULT 'Unpaid',
    timestamp TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS stock_logs (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), item_name TEXT NOT NULL, tipe TEXT NOT NULL, stok_awal NUMERIC, perubahan NUMERIC, stok_akhir NUMERIC, keterangan TEXT, timestamp TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS ledger_entries (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), customer_id TEXT NOT NULL, tanggal DATE NOT NULL, keterangan TEXT, debit NUMERIC DEFAULT 0, credit NUMERIC DEFAULT 0, balance NUMERIC DEFAULT 0, metode_bayar TEXT, timestamp TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS expenses (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), tanggal DATE NOT NULL, kategori TEXT, jumlah NUMERIC, description TEXT, proof_image_url TEXT, created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS salaries (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), tanggal DATE NOT NULL, nama_karyawan TEXT, gaji_harian NUMERIC, hari_kerja INTEGER, kasbon NUMERIC, total_gaji NUMERIC, catatan TEXT, created_at TIMESTAMPTZ DEFAULT now());

-- 4. OPTIMASI INDEX
CREATE INDEX IF NOT EXISTS idx_prod_tanggal ON production_logs(tanggal_produksi);
CREATE INDEX IF NOT EXISTS idx_trading_tanggal ON trading_purchases(tanggal);
CREATE INDEX IF NOT EXISTS idx_disposal_tanggal ON stock_disposals(tanggal);
CREATE INDEX IF NOT EXISTS idx_do_tanggal ON delivery_orders(tanggal);
CREATE INDEX IF NOT EXISTS idx_inv_tanggal ON invoices(tanggal);
CREATE INDEX IF NOT EXISTS idx_stock_logs_time ON stock_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_ledger_time ON ledger_entries(timestamp);

-- 5. PERMISSION FIX
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') 
    LOOP
        EXECUTE 'ALTER TABLE public.' || quote_ident(r.tablename) || ' DISABLE ROW LEVEL SECURITY';
    END LOOP;
END $$;

GRANT USAGE ON SCHEMA public TO anon, authenticated, postgres;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, postgres;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, postgres;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, postgres;

-- 6. ENABLE REALTIME UNTUK LIVE UPDATE
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime;
COMMIT;
ALTER PUBLICATION supabase_realtime ADD TABLE 
  production_logs, 
  delivery_orders, 
  invoices, 
  current_stock, 
  expenses, 
  salaries, 
  ledger_entries, 
  master_items, 
  master_coops, 
  master_customers, 
  master_plates;
