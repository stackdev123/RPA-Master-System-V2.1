-- Mengaktifkan ekstensi UUID untuk generate ID otomatis
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Master Items
CREATE TABLE public.master_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Coops (Kandang)
CREATE TABLE public.coops (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Customers (Pelanggan)
CREATE TABLE public.customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Trading Purchase Records (Pembelian Barang)
CREATE TABLE public.trading_purchase_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supplier_name TEXT NOT NULL,
    nama_barang TEXT NOT NULL,
    kategori TEXT NOT NULL,
    catatan TEXT,
    tanggal DATE,
    timestamp TIMESTAMPTZ,
    item_name TEXT,
    kg NUMERIC,
    harga_per_kg NUMERIC,
    total_harga NUMERIC,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Stock Disposal Records (Pemusnahan Stok)
CREATE TABLE public.stock_disposal_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nama_barang TEXT NOT NULL,
    catatan TEXT,
    tanggal DATE,
    timestamp TIMESTAMPTZ,
    item_name TEXT,
    kg NUMERIC,
    harga_valuasi_kg NUMERIC,
    total_kerugian NUMERIC,
    keterangan TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Production Logs (Log Produksi / Potong Ayam)
CREATE TABLE public.production_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tanggal_produksi DATE,
    item_name TEXT,
    qty NUMERIC,
    ekor NUMERIC,
    kg NUMERIC,
    mobil TEXT,
    plat TEXT,
    harga_beli_kg NUMERIC,
    kematian_ekor NUMERIC,
    kematian_kg NUMERIC,
    nama_kandang TEXT,
    driver TEXT,
    is_applied BOOLEAN DEFAULT FALSE,
    timestamp TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Delivery Orders (Surat Jalan / Pengiriman)
CREATE TABLE public.delivery_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tanggal DATE,
    nomor_sj TEXT,
    customer TEXT,
    nama_item TEXT,
    qty_kirim NUMERIC,
    qty_kirim2 NUMERIC,
    qty_diterima NUMERIC,
    qty_diterima2 NUMERIC,
    retur NUMERIC,
    susut_selisih NUMERIC,
    timestamp TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Invoices (Faktur / Tagihan)
CREATE TABLE public.invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tanggal DATE,
    nomor_sj TEXT,
    nomor_invoice TEXT,
    harga NUMERIC,
    total NUMERIC,
    transfer NUMERIC,
    cash NUMERIC,
    qty_diterima NUMERIC,
    keterangan TEXT,
    invoice_status TEXT,
    item_name TEXT,
    customer TEXT,
    timestamp TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Stock Logs (Perubahan / Log Stok)
CREATE TABLE public.stock_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type TEXT NOT NULL,
    item_name TEXT NOT NULL,
    stock_before NUMERIC NOT NULL,
    change NUMERIC NOT NULL,
    stock_after NUMERIC NOT NULL,
    notes TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Ledger Entries (Buku Besar / Piutang / Pembayaran)
CREATE TABLE public.ledger_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id TEXT,
    description TEXT NOT NULL,
    debit NUMERIC DEFAULT 0,
    credit NUMERIC DEFAULT 0,
    balance NUMERIC DEFAULT 0,
    payment_method TEXT,
    payment_proof TEXT,
    date DATE,
    timestamp TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Expense Records (Pengeluaran Operasional)
CREATE TABLE public.expense_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE,
    category TEXT,
    amount NUMERIC,
    description TEXT,
    proof_image TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. Salary Records (Penggajian / Upah)
CREATE TABLE public.salary_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role TEXT,
    employee_name TEXT,
    daily_rate NUMERIC,
    days_worked NUMERIC,
    cash_bon NUMERIC,
    total_salary NUMERIC,
    notes TEXT,
    date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. Plastic Items (Stok Plastik / Packaging)
CREATE TABLE public.plastic_items (
    name TEXT PRIMARY KEY,
    quantity NUMERIC DEFAULT 0,
    unit TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14. Plastic Logs (Riwayat Keluar Masuk Plastik)
CREATE TABLE public.plastic_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type TEXT,
    item_name TEXT,
    quantity NUMERIC,
    unit TEXT,
    price_per_unit NUMERIC,
    total_cost NUMERIC,
    notes TEXT,
    date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 15. Activity Logs (Riwayat Aktivitas User)
CREATE TABLE public.activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username TEXT,
    action TEXT,
    target_table TEXT,
    target_id TEXT,
    details JSONB,
    timestamp TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 16. Sales Orders (Pesanan Penjualan)
CREATE TABLE IF NOT EXISTS public.sales_orders (
    id TEXT PRIMARY KEY,
    date DATE NOT NULL,
    customer TEXT NOT NULL,
    customer_address TEXT,
    payment_method TEXT,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    total_amount NUMERIC DEFAULT 0,
    total_qty NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'pending',
    notes TEXT,
    delivery_order_ids JSONB DEFAULT '[]'::jsonb,
    created_by TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 17. DO Returns (Retur Surat Jalan)
CREATE TABLE IF NOT EXISTS public.do_returns (
    id TEXT PRIMARY KEY,
    date DATE NOT NULL,
    delivery_order_id TEXT NOT NULL,
    customer TEXT NOT NULL,
    item_name TEXT NOT NULL,
    quantity NUMERIC NOT NULL DEFAULT 0,
    reason TEXT,
    action TEXT NOT NULL,
    notes TEXT,
    created_by TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
