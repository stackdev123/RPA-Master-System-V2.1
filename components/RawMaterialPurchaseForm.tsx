import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import type { RawMaterialPurchase, MasterItem } from '../types';
import CurrencyInput from './CurrencyInput';
import { DownloadIcon, TrashIcon, PlusIcon } from './icons';

interface RawMaterialPurchaseFormProps {
  purchases: RawMaterialPurchase[];
  masterItems: MasterItem[];
  onAddPurchase: (purchase: Omit<RawMaterialPurchase, 'id' | 'timestamp'>) => Promise<void>;
  onDeletePurchase?: (id: string) => Promise<void>;
  currentUserName?: string;
  canEdit?: boolean;
}

export const RawMaterialPurchaseForm: React.FC<RawMaterialPurchaseFormProps> = ({
  purchases = [],
  masterItems = [],
  onAddPurchase,
  onDeletePurchase,
  currentUserName = 'Admin',
  canEdit = true
}) => {
  const [tanggal, setTanggal] = useState(new Date().toISOString().slice(0, 10));
  const [supplier, setSupplier] = useState('');
  const [nomorFaktur, setNomorFaktur] = useState('');
  const [itemName, setItemName] = useState(masterItems[0]?.name || 'Karkas');
  const [qtyKg, setQtyKg] = useState<number | ''>('');
  const [qtyEkor, setQtyEkor] = useState<number | ''>('');
  const [hargaPerKg, setHargaPerKg] = useState<number>(0);
  const [catatan, setCatatan] = useState('');
  const [autoAddStock, setAutoAddStock] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Auto calculate total
  const totalHarga = useMemo(() => {
    const k = typeof qtyKg === 'number' ? qtyKg : 0;
    return k * hargaPerKg;
  }, [qtyKg, hargaPerKg]);

  // Unique list of suppliers from history for autocomplete/quick pick
  const supplierSuggestions = useMemo(() => {
    const s = new Set<string>();
    purchases.forEach(p => {
      if (p.supplier) s.add(p.supplier.trim());
    });
    return Array.from(s).sort();
  }, [purchases]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplier.trim()) {
      alert('Nama Supplier harus diisi!');
      return;
    }
    const k = typeof qtyKg === 'number' ? qtyKg : 0;
    if (k <= 0) {
      alert('Kuantitas (Kg) harus lebih besar dari 0!');
      return;
    }
    if (hargaPerKg <= 0) {
      alert('Harga beli per kg harus lebih besar dari Rp 0!');
      return;
    }

    setIsSubmitting(true);
    try {
      await onAddPurchase({
        tanggal,
        supplier: supplier.trim(),
        item_name: itemName,
        qty_kg: k,
        qty_ekor: typeof qtyEkor === 'number' && qtyEkor > 0 ? qtyEkor : undefined,
        harga_per_kg: hargaPerKg,
        total_harga: totalHarga,
        nomor_faktur: nomorFaktur.trim() || undefined,
        catatan: catatan.trim() || undefined,
        auto_add_stock: autoAddStock,
        created_by: currentUserName
      });

      // Reset form
      setSupplier('');
      setNomorFaktur('');
      setQtyKg('');
      setQtyEkor('');
      setHargaPerKg(0);
      setCatatan('');
      alert('Data pembelian raw material berhasil disimpan!');
    } catch (err: any) {
      console.error(err);
      alert('Gagal menyimpan pembelian: ' + (err.message || 'Error tidak diketahui'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtered purchases
  const filteredPurchases = useMemo(() => {
    return purchases.filter(p => {
      const matchSearch = !searchQuery || 
        p.supplier.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.item_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.nomor_faktur && p.nomor_faktur.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchStart = !startDate || p.tanggal >= startDate;
      const matchEnd = !endDate || p.tanggal <= endDate;

      return matchSearch && matchStart && matchEnd;
    });
  }, [purchases, searchQuery, startDate, endDate]);

  // Statistics
  const stats = useMemo(() => {
    let totalRp = 0;
    let totalKg = 0;
    purchases.forEach(p => {
      totalRp += Number(p.total_harga) || 0;
      totalKg += Number(p.qty_kg) || 0;
    });
    const avgPrice = totalKg > 0 ? totalRp / totalKg : 0;
    return {
      totalRp,
      totalKg,
      avgPrice,
      count: purchases.length
    };
  }, [purchases]);

  // Export to Excel
  const handleExportExcel = () => {
    if (!filteredPurchases.length) {
      alert('Tidak ada data pembelian untuk diekspor!');
      return;
    }
    const exportData = filteredPurchases.map(p => ({
      'Tanggal': p.tanggal,
      'No. Faktur / Nota': p.nomor_faktur || '-',
      'Supplier': p.supplier,
      'Item Bahan Baku': p.item_name,
      'Qty (Kg)': p.qty_kg,
      'Qty (Ekor/Pcs)': p.qty_ekor || '-',
      'Harga / Kg (Rp)': p.harga_per_kg,
      'Total Pembelian (Rp)': p.total_harga,
      'Auto Masuk Stok': p.auto_add_stock ? 'Ya' : 'Tidak',
      'Catatan': p.catatan || '-',
      'Dibuat Oleh': p.created_by || '-'
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Pembelian Raw Material');
    XLSX.writeFile(wb, `Pembelian_Raw_Material_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 rounded-3xl p-6 md:p-8 text-white shadow-xl shadow-red-500/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <span className="text-[10px] font-black uppercase tracking-widest bg-white/20 px-3 py-1 rounded-full backdrop-blur-md">
            Modul Logistik & Pengadaan
          </span>
          <h1 className="text-2xl md:text-3xl font-black mt-2 tracking-tight">
           Trading
          </h1>
        </div>
        <button
          onClick={handleExportExcel}
          className="flex items-center gap-2 bg-white text-red-600 hover:bg-red-50 px-5 py-3 rounded-2xl font-black text-xs uppercase tracking-wider transition-all shadow-md active:scale-95 cursor-pointer shrink-0"
        >
          <DownloadIcon />
          <span>Export Excel</span>
        </button>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Belanja Raw Material</p>
          <p className="text-xl md:text-2xl font-black text-slate-900 mt-1">
            Rp {stats.totalRp.toLocaleString('id-ID')}
          </p>
          <p className="text-[10px] text-slate-400 mt-1">{stats.count} Transaksi Tercatat</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Tonase Dibeli</p>
          <p className="text-xl md:text-2xl font-black text-emerald-600 mt-1">
            {stats.totalKg.toLocaleString('id-ID', { minimumFractionDigits: 1 })} <span className="text-sm font-bold text-slate-500">Kg</span>
          </p>
          <p className="text-[10px] text-slate-400 mt-1">{(stats.totalKg / 1000).toFixed(2)} Ton</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Rata-Rata Harga Beli</p>
          <p className="text-xl md:text-2xl font-black text-indigo-600 mt-1">
            Rp {Math.round(stats.avgPrice).toLocaleString('id-ID')} <span className="text-sm font-bold text-slate-500">/Kg</span>
          </p>
          <p className="text-[10px] text-slate-400 mt-1">Across all raw cuts</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Jumlah Transaksi</p>
          <p className="text-xl md:text-2xl font-black text-amber-600 mt-1">
            {stats.count} <span className="text-sm font-bold text-slate-500">Nota</span>
          </p>
          <p className="text-[10px] text-slate-400 mt-1">Terintegrasi ke Stok</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Kolom Kiri: Form Input Pembelian */}
        <div className="lg:col-span-5 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-2 mb-6 border-b border-slate-100 pb-4">
            <div className="w-8 h-8 rounded-xl bg-red-100 text-red-600 flex items-center justify-center font-black">
              <PlusIcon />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                Input Pembelian Baru
              </h2>
              <p className="text-[10px] text-slate-400 font-bold">
                Masukkan detail pembelian karkas / boneless
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                  Tanggal Transaksi *
                </label>
                <input
                  type="date"
                  value={tanggal}
                  onChange={e => setTanggal(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500"
                  required
                />
              </div>
              <div>
                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                  No. Faktur / Nota
                </label>
                <input
                  type="text"
                  value={nomorFaktur}
                  onChange={e => setNomorFaktur(e.target.value)}
                  placeholder="Contoh: INV-SPL-001"
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                Nama Supplier *
              </label>
              <input
                type="text"
                list="supplier-list"
                value={supplier}
                onChange={e => setSupplier(e.target.value)}
                placeholder="Ketik atau pilih nama supplier..."
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500"
                required
              />
              <datalist id="supplier-list">
                {supplierSuggestions.map(s => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                Item Raw Material (Karkas / Potongan) *
              </label>
              <select
                value={itemName}
                onChange={e => setItemName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500 uppercase"
                required
              >
                {masterItems.map(m => (
                  <option key={m.name} value={m.name}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                  Kuantitas (Kg) *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={qtyKg}
                    onChange={e => setQtyKg(e.target.value === '' ? '' : parseFloat(e.target.value))}
                    placeholder="0.00"
                    className="w-full px-3 py-2.5 pr-8 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-900 text-right focus:outline-none focus:ring-2 focus:ring-red-500"
                    required
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-bold text-slate-400">
                    Kg
                  </span>
                </div>
              </div>
              <div>
                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                  Qty Ekor / Pack (Opsional)
                </label>
                <input
                  type="number"
                  min="0"
                  value={qtyEkor}
                  onChange={e => setQtyEkor(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                  placeholder="0"
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 text-right focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                Harga Beli Satuan (Rp / Kg) *
              </label>
              <CurrencyInput
                value={hargaPerKg}
                onChange={val => setHargaPerKg(val)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-900 text-right focus:outline-none focus:ring-2 focus:ring-red-500"
                placeholder="Rp 0"
              />
            </div>

            {/* Total Kalkulasi Box */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-4 rounded-2xl flex items-center justify-between shadow-inner">
              <div>
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">
                  Total Nilai Pembelian:
                </span>
                <span className="text-xs text-slate-300 font-bold">
                  {typeof qtyKg === 'number' ? qtyKg : 0} Kg × Rp {hargaPerKg.toLocaleString('id-ID')}
                </span>
              </div>
              <div className="text-right">
                <span className="text-lg md:text-xl font-black text-emerald-400">
                  Rp {totalHarga.toLocaleString('id-ID')}
                </span>
              </div>
            </div>

            {/* Opsi Auto Add Stock */}
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl">
              <input
                type="checkbox"
                id="auto-add-stock-check"
                checked={autoAddStock}
                onChange={e => setAutoAddStock(e.target.checked)}
                className="w-4 h-4 accent-red-600 cursor-pointer"
              />
              <label htmlFor="auto-add-stock-check" className="text-xs font-bold text-red-900 cursor-pointer">
                Otomatis tambahkan kuantitas ke Stok Gudang Cold Storage
              </label>
            </div>

            <div>
              <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                Catatan / Keterangan
              </label>
              <textarea
                value={catatan}
                onChange={e => setCatatan(e.target.value)}
                placeholder="Keterangan mutu karkas, kondisi barang, dll..."
                rows={2}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !canEdit}
              className={`w-full py-3.5 rounded-2xl font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-red-500/20 ${
                isSubmitting || !canEdit
                  ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                  : 'bg-red-600 hover:bg-red-700 text-white cursor-pointer active:scale-95'
              }`}
            >
              {isSubmitting ? 'Menyimpan...' : 'Simpan Pembelian Raw Material'}
            </button>
          </form>
        </div>

        {/* Kolom Kanan: Tabel Riwayat Pembelian */}
        <div className="lg:col-span-7 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                Riwayat Pembelian Raw Material
              </h2>
              <p className="text-[10px] text-slate-400 font-bold">
                {filteredPurchases.length} data ditemukan
              </p>
            </div>

            {/* Search Input */}
            <div className="w-full sm:w-64">
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Cari supplier / item / faktur..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
          </div>

          {/* Date Filter */}
          <div className="grid grid-cols-2 gap-3 pb-2">
            <div>
              <label className="block text-[8px] font-black text-slate-400 uppercase tracking-wider mb-1">Dari Tanggal</label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700"
              />
            </div>
            <div>
              <label className="block text-[8px] font-black text-slate-400 uppercase tracking-wider mb-1">Sampai Tanggal</label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700"
              />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-2xl border border-slate-100 max-h-[580px] overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[9px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-200 sticky top-0 z-10">
                <tr>
                  <th className="px-3.5 py-3">Tanggal / Faktur</th>
                  <th className="px-3.5 py-3">Supplier</th>
                  <th className="px-3.5 py-3">Item</th>
                  <th className="px-3.5 py-3 text-right">Qty (Kg)</th>
                  <th className="px-3.5 py-3 text-right">Harga / Kg</th>
                  <th className="px-3.5 py-3 text-right">Total (Rp)</th>
                  <th className="px-3.5 py-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredPurchases.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-400 font-bold">
                      Belum ada data pembelian raw material.
                    </td>
                  </tr>
                ) : (
                  filteredPurchases.map(p => (
                    <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-3.5 py-3 whitespace-nowrap">
                        <span className="font-bold text-slate-900 block">{p.tanggal}</span>
                        {p.nomor_faktur && (
                          <span className="text-[9px] text-slate-400 font-bold block">{p.nomor_faktur}</span>
                        )}
                      </td>
                      <td className="px-3.5 py-3 whitespace-nowrap font-bold text-slate-800">
                        {p.supplier}
                      </td>
                      <td className="px-3.5 py-3 whitespace-nowrap">
                        <span className="inline-block px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 font-black text-[10px] uppercase">
                          {p.item_name}
                        </span>
                        {p.qty_ekor ? (
                          <span className="text-[9px] text-slate-400 font-bold block mt-0.5">
                            {p.qty_ekor} ekor
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3.5 py-3 whitespace-nowrap text-right font-black text-slate-900">
                        {p.qty_kg.toLocaleString('id-ID', { minimumFractionDigits: 1 })}
                      </td>
                      <td className="px-3.5 py-3 whitespace-nowrap text-right text-slate-700">
                        Rp {p.harga_per_kg.toLocaleString('id-ID')}
                      </td>
                      <td className="px-3.5 py-3 whitespace-nowrap text-right font-black text-emerald-600">
                        Rp {p.total_harga.toLocaleString('id-ID')}
                      </td>
                      <td className="px-3.5 py-3 whitespace-nowrap text-center">
                        {canEdit && onDeletePurchase && (
                          <button
                            onClick={() => {
                              if (confirm(`Yakin ingin menghapus pembelian ${p.item_name} dari ${p.supplier}?`)) {
                                onDeletePurchase(p.id);
                              }
                            }}
                            className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                            title="Hapus Pembelian"
                          >
                            <TrashIcon />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RawMaterialPurchaseForm;
