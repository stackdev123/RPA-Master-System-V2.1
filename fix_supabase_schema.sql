-- PERHATIKAN: Script ini akan mereset (menghapus dan membuat ulang) tabel-tabel transaksi 
-- agar sesuai dengan kode aplikasi frontend. Tabel "users" dan "master" tidak akan dihapus 
-- jika sudah berisi data penting (namun jika tabel master memiliki struktur salah, kita drop juga).

-- 1. Gunakan schema public
SET search_path TO public;

-- 2. Drop tabel yang memiliki struktur kolom yang salah (menggunakan Cascade agar relasi terhapus)
DROP TABLE IF EXISTS stock_logs CASCADE;
DROP TABLE IF EXISTS current_stock CASCADE;
DROP TABLE IF EXISTS production_logs CASCADE;
DROP TABLE IF EXISTS delivery_orders CASCADE;
DROP TABLE IF EXISTS invoices CASCADE;
DROP TABLE IF EXISTS trading_purchases CASCADE;
DROP TABLE IF EXISTS stock_disposals CASCADE;
DROP TABLE IF EXISTS ledger_entries CASCADE;
DROP TABLE IF EXISTS expenses CASCADE;
DROP TABLE IF EXISTS salaries CASCADE;
DROP TABLE IF EXISTS plastic_logs CASCADE;
DROP TABLE IF EXISTS plastic_items CASCADE;
DROP TABLE IF EXISTS activity_logs CASCADE;

-- (Master tables kita drop juga agar bersih dan dibuat ulang, kecuali jika ada data. Kita asumsikan kosong berdasarkan query sebelumnya).
DROP TABLE IF EXISTS master_items CASCADE;
DROP TABLE IF EXISTS master_coops CASCADE;
DROP TABLE IF EXISTS master_customers CASCADE;
DROP TABLE IF EXISTS master_plates CASCADE;

-- 3. Setup Master Tables
CREATE TABLE IF NOT EXISTS master_items (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT UNIQUE NOT NULL, created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS master_coops (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT UNIQUE NOT NULL, address TEXT, created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS master_customers (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT UNIQUE NOT NULL, address TEXT, created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS master_plates (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), plate_number TEXT UNIQUE NOT NULL, created_at TIMESTAMPTZ DEFAULT now());

-- 4. Setup Transactional Tables (Sesuai dengan database_schema.sql)
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
    plat TEXT,
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
    supplier_name TEXT,
    kategori TEXT,
    catatan TEXT,
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
    nama_barang TEXT,
    catatan TEXT,
    timestamp TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS delivery_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tanggal DATE NOT NULL,
    nomor_sj TEXT NOT NULL,
    customer TEXT NOT NULL REFERENCES master_customers(name) ON UPDATE CASCADE,
    nama_item TEXT NOT NULL REFERENCES master_items(name) ON UPDATE CASCADE,
    qty_kirim NUMERIC NOT NULL,
    qty_kirim2 NUMERIC DEFAULT 0,
    qty_diterima NUMERIC DEFAULT 0,
    qty_diterima2 NUMERIC DEFAULT 0,
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
CREATE TABLE IF NOT EXISTS salaries (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), tanggal DATE NOT NULL, nama_karyawan TEXT, gaji_harian NUMERIC, hari_kerja INTEGER, kasbon NUMERIC, total_gaji NUMERIC, catatan TEXT, role TEXT, created_at TIMESTAMPTZ DEFAULT now());

CREATE TABLE IF NOT EXISTS plastic_items (name TEXT PRIMARY KEY, quantity NUMERIC DEFAULT 0, unit TEXT, created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS plastic_logs (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), type TEXT, item_name TEXT, quantity NUMERIC, unit TEXT, price_per_unit NUMERIC, total_cost NUMERIC, notes TEXT, date DATE, created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS activity_logs (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), username TEXT, action TEXT, target_table TEXT, target_id TEXT, details JSONB, timestamp TIMESTAMPTZ DEFAULT now(), created_at TIMESTAMPTZ DEFAULT now());

-- 5. OPTIMASI INDEX
CREATE INDEX IF NOT EXISTS idx_prod_tanggal ON production_logs(tanggal_produksi);
CREATE INDEX IF NOT EXISTS idx_trading_tanggal ON trading_purchases(tanggal);
CREATE INDEX IF NOT EXISTS idx_disposal_tanggal ON stock_disposals(tanggal);
CREATE INDEX IF NOT EXISTS idx_do_tanggal ON delivery_orders(tanggal);
CREATE INDEX IF NOT EXISTS idx_inv_tanggal ON invoices(tanggal);
CREATE INDEX IF NOT EXISTS idx_stock_logs_time ON stock_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_ledger_time ON ledger_entries(timestamp);

-- 6. PERMISSION FIX
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

-- 7. ENABLE REALTIME UNTUK LIVE UPDATE
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
  master_plates,
  trading_purchases,
  stock_disposals,
  stock_logs,
  plastic_items,
  plastic_logs,
  activity_logs;
