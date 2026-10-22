# Rencana Implementasi: Pembelian Raw Material, Daily Stock Valuation, & Manajemen Packing Material

## 1. Ringkasan Kebutuhan
Berdasarkan kebutuhan operasional PT Mitra Karya Chicken dan hasil konfirmasi:
1. **Pembelian Raw Material Langsung (Boneless / Karkas)**:
   - Ditempatkan di **Modul Logistik** (berdampingan dengan Stok Gudang).
   - Form & tabel pencatatan: Tanggal, Supplier, Item (Karkas, Boneless Dada, Boneless Paha, Sayap, dll), Qty (Kg & Ekor/Pack jika ada), Harga Satuan (Rp/Kg), Total Pembelian, Nomor Faktur/Nota, dan status penerimaan.
   - Otomatis menambah saldo stok fisik karkas/boneless di gudang penyimpanan.
2. **Penentuan Harga Value Stock Harian (Daily Stock Valuation by Item)**:
   - Mengakomodasi fluktuasi harga pasar ayam yang berubah setiap hari meskipun kuantitas fisik stok gudang sama.
   - User dapat menginput harga pasar / harga valuation per kg untuk setiap item produk per tanggal tertentu.
   - Sistem mengkalkulasikan: `Nilai Stock Harian = Σ (Qty Stok Fisik Item × Harga Input Harian Item)`.
   - Dilengkapi riwayat penetapan harga harian dan laporan perbandingan nilai stock antar hari.
3. **Stok & Stock Opname Packing Material (Harian)**:
   - Ditempatkan di Modul Logistik (sub-tab atau bagian khusus "Bahan Kemasan / Packing").
   - Master data packing material (misal: Plastik PE 1kg, Plastik HD 2kg, Plastik Curah, Karung 25kg, Lakban/Seal, Tali Rafia).
   - Form Stock Opname Harian: Tanggal opname, Stok Sistem, Hasil Fisik Lapangan, Selisih (Qty & %), Alasan Selisih, dan Status Rekonsiliasi.
4. **Pencatatan Pemakaian Packing Material di Produksi & Integrasi HPP**:
   - Di form **Input Hasil Produksi**, ditambahkan seksi *"Pemakaian Packing Material"* (Item plastik, Qty lembar/kg/roll yang dipakai, Estimasi biaya).
   - Saat produksi disimpan:
     - **Stok Packing Material otomatis terpotong** sesuai jumlah yang dipakai.
     - Biaya pemakaian packing material otomatis dimasukkan ke dalam komponen **HPP Produksi** (selain biaya bahan baku ayam hidup / LB).
   - Laporan HPP & Laba Rugi langsung menampilkan breakdown biaya packing material per batch dan per hari.

---

## 2. Struktur Data & Backend API (`server.ts`)

### A. Data Stores (Persistent JSON Stores)
1. `raw_material_purchases.json`:
   ```ts
   interface RawMaterialPurchase {
     id: string;
     date: string;
     supplier: string;
     item_name: string; // Karkas, BLD, BLP, dll
     sku?: string;
     qty_kg: number;
     qty_pcs?: number;
     price_per_kg: number;
     total_price: number;
     invoice_no: string;
     notes?: string;
     created_at: string;
     created_by: string;
   }
   ```
2. `daily_stock_prices.json`:
   ```ts
   interface DailyStockPriceEntry {
     id: string;
     date: string; // YYYY-MM-DD
     item_name: string;
     valuation_price_per_kg: number;
     updated_at: string;
     updated_by: string;
   }
   ```
3. `packing_materials.json`:
   ```ts
   interface PackingMaterial {
     id: string;
     name: string; // Plastik 1kg, Plastik Curah, Karung, dll
     unit: string; // Lembar, Roll, Kg, Pack
     current_stock: number;
     min_stock_alert: number;
     unit_cost: number; // Harga per lembar/unit untuk kalkulasi HPP
     category: string;
   }
   ```
4. `packing_opname.json`:
   ```ts
   interface PackingOpnameLog {
     id: string;
     date: string;
     material_id: string;
     material_name: string;
     system_stock: number;
     physical_stock: number;
     difference: number;
     unit: string;
     notes: string;
     operator: string;
     created_at: string;
   }
   ```
5. `packing_usages.json`:
   ```ts
   interface PackingUsageLog {
     id: string;
     production_id?: string;
     date: string;
     material_id: string;
     material_name: string;
     qty_used: number;
     unit: string;
     unit_cost: number;
     total_cost: number;
     notes?: string;
     created_at: string;
   }
   ```

### B. Endpoint API Tambahan
- `GET /api/raw-material-purchases` & `POST /api/raw-material-purchases` (tambah pembelian & update saldo stok karkas).
- `GET /api/daily-stock-prices?date=YYYY-MM-DD` & `POST /api/daily-stock-prices` (bulk save harga harian per item).
- `GET /api/packing-materials` & `POST /api/packing-materials` (master bahan packing).
- `GET /api/packing-opname` & `POST /api/packing-opname` (stock opname harian packing).
- `GET /api/packing-usages` & `POST /api/packing-usages` (catatan pemakaian packing di produksi).

---

## 3. Desain Antarmuka Pengguna (UI/UX)

### A. Modul Logistik: Sub-tab "Pembelian Raw Material"
- Tab switcher di Logistik: `[Stok Gudang] [Pembelian Raw Material] [Stok & Opname Packing] [Penerimaan LB] [Surat Jalan/DO]`.
- Formulir cepat input pembelian raw material:
  - Input Tanggal, Supplier (dengan autocomplete), Item Karkas/Boneless, Qty (Kg), Harga per Kg.
  - Auto-kalkulasi Total Rupiah.
  - Opsi *"Langsung Tambahkan ke Stok Gudang"* (default aktif).
- Riwayat tabel pembelian raw material dengan filter tanggal, supplier, dan fitur export ringkasan.

### B. Modul Keuangan / Laporan: Sub-tab "Valuasi Stok Harian" (Daily Stock Value)
- Matrix tabel interaktif per tanggal yang dipilih:
  - Kolom: Nama Produk, Qty Stok Fisik Saat Ini (Kg), Input Harga Pasar Hari Ini (Rp/Kg), Nilai Valuasi (Qty × Harga Input), Catatan Tren (+/- vs kemarin).
  - Tombol *"Simpan Nilai Valuasi Hari Ini"*.
  - Ringkasan kartu metrik: Total Nilai Valuasi Stok Hari Ini (Rp), Selisih vs Kemarin, Rata-rata Nilai per Kg.

### C. Modul Logistik: Sub-tab "Stok & Opname Packing Material"
- Kartu ringkasan stok plastik: Stok kritis (hampir habis), Total stok fisik, Pemakaian hari ini.
- Form Stock Opname Harian:
  - Tabel semua jenis plastik dengan kolom input *"Hasil Hitung Fisik Lapangan"*.
  - Menampilkan otomatis selisih (+/-) secara real-time berwarna hijau/merah.
  - Tombol simpan opname yang memperbarui saldo sistem dan mencatat histori audit.

### D. Form Produksi: Seksi "Pemakaian Packing Material"
- Pada formulir input hasil produksi harian, ditambahkan kartu *"Bahan Kemasan / Plastik Digunakan"*:
  - Pemilihan jenis packing (e.g., Plastik 1 Kg, Plastik Curah, Karung).
  - Input jumlah lembar/pcs yang dipakai.
  - Otomatis menghitung `Biaya Packing = Qty × Harga Satuan Plastik`.
  - Tombol *"Tambah Jenis Kemasan Lain"*.
  - Saat simpan produksi: stok packing langsung terpotong, dan biaya pemakaian tersimpan di relasi produksi.

### E. Integrasi HPP & Laba Rugi
- Update pada tampilan **HPPView** dan **ProfitLossView**:
  - Breakdown HPP:
    1. Biaya Bahan Baku Ayam Hidup (LB) / Karkas Beli.
    2. Biaya Kemasan / Packing Material (dari log pemakaian batch).
    3. Biaya Operasional / Overhead.
  - Menghasilkan perhitungan HPP per kg karkas/boneless yang jauh lebih akurat dan presisi.

---

## 4. Rencana Tahapan Eksekusi

| Tahap | Aktivitas |
|---|---|
| **1. Data Layer & Backend** | Buat file store data JSON & implementasikan endpoints Express di `server.ts` untuk raw materials, daily pricing, packing materials, opname, dan usage. |
| **2. Modul Pembelian Raw Material** | Buat komponen `RawMaterialPurchaseForm.tsx` & pasang di modul Logistik; integrasikan penambahan kuantitas ke stok gudang. |
| **3. Fitur Daily Stock Valuation** | Kembangkan komponen `DailyStockValuationForm.tsx` untuk input harga satuan harian per kg dan kalkulasi total nilai stok harian. |
| **4. Fitur Stok & Opname Packing Material** | Buat komponen `PackingStockOpnameView.tsx` di modul Logistik untuk kontrol stok kemasan harian. |
| **5. Integrasi Produksi & HPP** | Tambahkan seksi pemakaian packing pada `ProductionForm.tsx`, implementasikan pemotongan otomatis stok plastik, dan integrasikan biaya kemasan ke dalam kalkulasi `HPPView.tsx`. |
| **6. Pengujian & Verifikasi** | Verifikasi integritas kompilasi (`compile_applet`), pengujian alur input pembelian, opname plastik, dan akurasi nilai HPP. |
