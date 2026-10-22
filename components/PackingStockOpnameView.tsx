import React, { useState, useEffect, useMemo } from 'react';
import type { PackingMaterial, PackingOpnameLog, PackingUsageLog } from '../types';
import { PlusIcon, TrashIcon, DownloadIcon } from './icons';
import CurrencyInput from './CurrencyInput';
import * as XLSX from 'xlsx';

interface PackingStockOpnameViewProps {
  currentUserName?: string;
  canEdit?: boolean;
}

export const PackingStockOpnameView: React.FC<PackingStockOpnameViewProps> = ({
  currentUserName = 'Admin Gudang',
  canEdit = true
}) => {
  const [activeTab, setActiveTab] = useState<'opname' | 'history' | 'usages'>('opname');
  const [materials, setMaterials] = useState<PackingMaterial[]>([]);
  const [opnameLogs, setOpnameLogs] = useState<PackingOpnameLog[]>([]);
  const [usageLogs, setUsageLogs] = useState<PackingUsageLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Opname form state
  const [opnameDate, setOpnameDate] = useState(new Date().toISOString().slice(0, 10));
  const [physicalCounts, setPhysicalCounts] = useState<{ [materialId: string]: number | '' }>({});
  const [opnameNotes, setOpnameNotes] = useState<{ [materialId: string]: string }>({});
  const [isSubmittingOpname, setIsSubmittingOpname] = useState(false);

  // New material modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newMatName, setNewMatName] = useState('');
  const [newMatCategory, setNewMatCategory] = useState<'plastik' | 'karung' | 'lainnya'>('plastik');
  const [newMatUnit, setNewMatUnit] = useState('lembar');
  const [newMatCurrentStock, setNewMatCurrentStock] = useState<number | ''>('');
  const [newMatMinStock, setNewMatMinStock] = useState<number | ''>(500);
  const [newMatUnitCost, setNewMatUnitCost] = useState<number>(150);
  const [newMatNotes, setNewMatNotes] = useState('');
  const [isAddingMaterial, setIsAddingMaterial] = useState(false);

  // Fetch all packing data
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [resMat, resOpname, resUsage] = await Promise.all([
        fetch('/api/packing-materials'),
        fetch('/api/packing-opname'),
        fetch('/api/packing-usages')
      ]);

      if (resMat.ok) {
        const matData: PackingMaterial[] = await resMat.json();
        setMaterials(matData);
        // Pre-fill physical counts with current system stock as initial suggestion
        const counts: { [id: string]: number | '' } = {};
        matData.forEach(m => {
          counts[m.id] = m.current_stock;
        });
        setPhysicalCounts(counts);
      }
      if (resOpname.ok) {
        setOpnameLogs(await resOpname.json());
      }
      if (resUsage.ok) {
        setUsageLogs(await resUsage.json());
      }
    } catch (err) {
      console.error('Failed to load packing data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handlePhysicalCountChange = (id: string, val: string) => {
    setPhysicalCounts(prev => ({
      ...prev,
      [id]: val === '' ? '' : parseFloat(val)
    }));
  };

  const handleNoteChange = (id: string, val: string) => {
    setOpnameNotes(prev => ({
      ...prev,
      [id]: val
    }));
  };

  const handleSubmitOpname = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!materials.length) {
      alert('Belum ada bahan kemasan yang terdaftar.');
      return;
    }

    setIsSubmittingOpname(true);
    try {
      const payload = materials.map(mat => {
        const physical = typeof physicalCounts[mat.id] === 'number' ? (physicalCounts[mat.id] as number) : mat.current_stock;
        return {
          date: opnameDate,
          material_id: mat.id,
          material_name: mat.name,
          system_stock: mat.current_stock,
          physical_stock: physical,
          difference: physical - mat.current_stock,
          unit: mat.unit,
          notes: opnameNotes[mat.id] || '',
          operator: currentUserName
        };
      });

      const res = await fetch('/api/packing-opname', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('Gagal menyimpan hasil stock opname');

      alert(`Stock opname tanggal ${opnameDate} berhasil disimpan dan saldo stok telah disesuaikan!`);
      await fetchData();
    } catch (err: any) {
      console.error(err);
      alert('Gagal menyimpan opname: ' + (err.message || 'Error tidak diketahui'));
    } finally {
      setIsSubmittingOpname(false);
    }
  };

  const handleCreateMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMatName.trim()) {
      alert('Nama bahan kemasan harus diisi!');
      return;
    }

    setIsAddingMaterial(true);
    try {
      const res = await fetch('/api/packing-materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newMatName.trim(),
          category: newMatCategory,
          unit: newMatUnit.trim(),
          current_stock: typeof newMatCurrentStock === 'number' ? newMatCurrentStock : 0,
          min_stock_alert: typeof newMatMinStock === 'number' ? newMatMinStock : 100,
          unit_cost: newMatUnitCost,
          notes: newMatNotes.trim()
        })
      });

      if (!res.ok) throw new Error('Gagal menambah bahan kemasan');

      alert('Bahan kemasan baru berhasil ditambahkan!');
      setShowAddModal(false);
      setNewMatName('');
      setNewMatCurrentStock('');
      setNewMatNotes('');
      await fetchData();
    } catch (err: any) {
      console.error(err);
      alert('Error: ' + (err.message || 'Gagal menyimpan'));
    } finally {
      setIsAddingMaterial(false);
    }
  };

  const handleDeleteMaterial = async (id: string, name: string) => {
    if (!confirm(`Hapus bahan kemasan "${name}" dari master?`)) return;
    try {
      const res = await fetch(`/api/packing-materials/${id}`, { method: 'DELETE' });
      if (res.ok) {
        alert('Material berhasil dihapus!');
        await fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleExportOpnameExcel = () => {
    if (!opnameLogs.length) {
      alert('Belum ada data riwayat opname.');
      return;
    }
    const exportData = opnameLogs.map(l => ({
      'Tanggal Opname': l.date,
      'Nama Material': l.material_name,
      'Stok Sistem': l.system_stock,
      'Hasil Fisik': l.physical_stock,
      'Selisih (+/-)': l.difference,
      'Satuan': l.unit,
      'Keterangan / Alasan': l.notes || '-',
      'Petugas': l.operator,
      'Waktu Catat': l.timestamp
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Riwayat Opname Packing');
    XLSX.writeFile(wb, `Stock_Opname_Packing_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // Metrics
  const totalValuePackingStock = useMemo(() => {
    return materials.reduce((sum, m) => sum + (m.current_stock * (m.unit_cost || 0)), 0);
  }, [materials]);

  const criticalStockCount = useMemo(() => {
    return materials.filter(m => m.current_stock <= m.min_stock_alert).length;
  }, [materials]);

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
      {/* Banner */}
      <div className="bg-gradient-to-r from-emerald-700 via-teal-600 to-cyan-600 rounded-3xl p-6 md:p-8 text-white shadow-xl shadow-emerald-500/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <span className="text-[10px] font-black uppercase tracking-widest bg-white/20 px-3 py-1 rounded-full backdrop-blur-md">
            Modul Logistik & Pengemasan
          </span>
          <h1 className="text-2xl md:text-3xl font-black mt-2 tracking-tight">
            Stok & Opname Packing Material
          </h1>
      
        </div>

        <div className="flex items-center gap-3 shrink-0 flex-wrap">
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 bg-white text-emerald-700 hover:bg-emerald-50 px-5 py-3 rounded-2xl font-black text-xs uppercase tracking-wider transition-all shadow-md active:scale-95 cursor-pointer"
          >
            <PlusIcon />
            <span>Tambah Bahan Kemasan</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Jenis Material</p>
          <p className="text-xl md:text-2xl font-black text-slate-900 mt-1">
            {materials.length} <span className="text-sm font-bold text-slate-500">Jenis</span>
          </p>
          <p className="text-[10px] text-slate-400 mt-1">Plastik, Karung & Lainnya</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Nilai Persediaan Packing</p>
          <p className="text-xl md:text-2xl font-black text-emerald-600 mt-1">
            Rp {totalValuePackingStock.toLocaleString('id-ID')}
          </p>
          <p className="text-[10px] text-slate-400 mt-1">Berdasarkan HPP satuan</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Status Stok Kritis</p>
          <p className={`text-xl md:text-2xl font-black mt-1 ${criticalStockCount > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
            {criticalStockCount} <span className="text-sm font-bold text-slate-500">Item Kritis</span>
          </p>
          <p className="text-[10px] text-slate-400 mt-1">Di bawah batas aman</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Riwayat Pemakaian Produksi</p>
          <p className="text-xl md:text-2xl font-black text-indigo-600 mt-1">
            {usageLogs.length} <span className="text-sm font-bold text-slate-500">Log Batch</span>
          </p>
          <p className="text-[10px] text-slate-400 mt-1">Otomatis terpotong</p>
        </div>
      </div>

      {/* Tabs Selector */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('opname')}
          className={`px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
            activeTab === 'opname'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20'
              : 'bg-white text-slate-600 hover:bg-slate-100'
          }`}
        >
          Form Stock Opname Harian
        </button>
        <button
          onClick={() => setActiveTab('usages')}
          className={`px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
            activeTab === 'usages'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20'
              : 'bg-white text-slate-600 hover:bg-slate-100'
          }`}
        >
          Riwayat Pemakaian di Produksi ({usageLogs.length})
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
            activeTab === 'history'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20'
              : 'bg-white text-slate-600 hover:bg-slate-100'
          }`}
        >
          Riwayat Log Opname ({opnameLogs.length})
        </button>
      </div>

      {/* TAB 1: FORM STOCK OPNAME HARIAN */}
      {activeTab === 'opname' && (
        <div className="space-y-6">
          {/* Kartu Status Persediaan Saat Ini */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {materials.map(mat => {
              const isLow = mat.current_stock <= mat.min_stock_alert;
              return (
                <div key={mat.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden">
                  {isLow && (
                    <div className="absolute top-0 right-0 bg-rose-500 text-white text-[8px] font-black uppercase px-3 py-1 rounded-bl-xl tracking-wider">
                      Stok Menipis
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                        {mat.category}
                      </span>
                      <h3 className="text-sm font-black text-slate-900 mt-1 uppercase">
                        {mat.name}
                      </h3>
                    </div>
                    {canEdit && (
                      <button
                        onClick={() => handleDeleteMaterial(mat.id, mat.name)}
                        className="text-slate-300 hover:text-rose-500 p-1 rounded transition-colors"
                        title="Hapus Material"
                      >
                        <TrashIcon />
                      </button>
                    )}
                  </div>

                  <div className="mt-4 flex items-baseline justify-between">
                    <div>
                      <span className="text-2xl font-black text-slate-900">
                        {mat.current_stock.toLocaleString('id-ID')}
                      </span>
                      <span className="text-xs font-bold text-slate-400 ml-1">
                        {mat.unit}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block font-medium">Biaya Satuan:</span>
                      <span className="text-xs font-bold text-emerald-700">
                        Rp {mat.unit_cost.toLocaleString('id-ID')}
                      </span>
                    </div>
                  </div>

                  <div className="mt-2 text-[10px] text-slate-400 flex justify-between border-t border-slate-50 pt-2">
                    <span>Min Alert: {mat.min_stock_alert} {mat.unit}</span>
                    <span>Nilai: Rp {(mat.current_stock * mat.unit_cost).toLocaleString('id-ID')}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Form Input Opname Fisik */}
          <form onSubmit={handleSubmitOpname} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-base font-black text-slate-900 uppercase tracking-tight">
                  Formulir Stock Opname Harian Bahan Kemasan
                </h2>
                <p className="text-xs text-slate-400 font-medium">
                  Bandingkan stok fisik lapangan dengan stok sistem. Selisih akan otomatis dihitung dan saldo stok diperbarui setelah disimpan.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <label className="text-xs font-black text-slate-700 uppercase">
                  Tanggal Opname:
                </label>
                <input
                  type="date"
                  value={opnameDate}
                  onChange={e => setOpnameDate(e.target.value)}
                  className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[9px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Nama Bahan Kemasan</th>
                    <th className="px-4 py-3">Satuan</th>
                    <th className="px-4 py-3 text-right">Stok Sistem (Saat Ini)</th>
                    <th className="px-4 py-3 text-right w-44">Hasil Hitung Fisik (Lapangan)</th>
                    <th className="px-4 py-3 text-right">Selisih (+/-)</th>
                    <th className="px-4 py-3">Catatan / Alasan Selisih</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {materials.map(mat => {
                    const physical = typeof physicalCounts[mat.id] === 'number' ? (physicalCounts[mat.id] as number) : mat.current_stock;
                    const diff = physical - mat.current_stock;
                    const isDiff = diff !== 0;

                    return (
                      <tr key={mat.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-4 py-3 font-black text-slate-900 uppercase">
                          {mat.name}
                        </td>
                        <td className="px-4 py-3 text-slate-500 uppercase text-[10px] font-bold">
                          {mat.unit}
                        </td>
                        <td className="px-4 py-3 text-right font-black text-slate-700">
                          {mat.current_stock.toLocaleString('id-ID')}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <input
                            type="number"
                            min="0"
                            value={physicalCounts[mat.id] ?? ''}
                            onChange={e => handlePhysicalCountChange(mat.id, e.target.value)}
                            className="w-36 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-right font-black text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            placeholder="0"
                            required
                          />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-black ${
                            diff === 0 
                              ? 'bg-slate-100 text-slate-600'
                              : diff > 0
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                          }`}>
                            {diff > 0 ? `+${diff.toLocaleString('id-ID')}` : diff.toLocaleString('id-ID')} {mat.unit}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            value={opnameNotes[mat.id] || ''}
                            onChange={e => handleNoteChange(mat.id, e.target.value)}
                            placeholder={isDiff ? 'Wajib isi alasan selisih (rusak/robek/hitung ulang)...' : 'Catatan opsional...'}
                            className={`w-full px-3 py-1.5 bg-slate-50 border rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                              isDiff ? 'border-amber-300' : 'border-slate-200'
                            }`}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-100">
              <button
                type="submit"
                disabled={isSubmittingOpname || !canEdit}
                className={`px-8 py-3.5 rounded-2xl font-black text-xs uppercase tracking-wider transition-all shadow-lg ${
                  isSubmittingOpname || !canEdit
                    ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer active:scale-95 shadow-emerald-500/20'
                }`}
              >
                {isSubmittingOpname ? 'Menyimpan & Menyesuaikan Stok...' : 'Simpan Hasil Stock Opname Harian'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 2: RIWAYAT PEMAKAIAN PRODUKSI */}
      {activeTab === 'usages' && (
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                Log Pemakaian Packing Material di Produksi
              </h2>
              <p className="text-[10px] text-slate-400 font-bold">
                Data pemakaian plastik & karung yang diinput bersamaan dengan proses pemotongan ayam harian.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-100">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[9px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Tanggal / Batch</th>
                  <th className="px-4 py-3">Nomor DO / Truk</th>
                  <th className="px-4 py-3">Detail Item Kemasan Terpakai</th>
                  <th className="px-4 py-3 text-right">Total Biaya Kemasan</th>
                  <th className="px-4 py-3">Operator</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {usageLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-400 font-bold">
                      Belum ada pemakaian packing material yang dicatat dari formulir produksi.
                    </td>
                  </tr>
                ) : (
                  usageLogs.map(log => (
                    <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap font-bold text-slate-900">
                        {log.date}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-700">
                        {log.truck_number ? `Mobil #${log.truck_number}` : '-'} {log.no_do ? `(DO: ${log.no_do})` : ''}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          {log.items?.map((item, idx) => (
                            <span key={idx} className="inline-block px-2.5 py-1 bg-slate-100 rounded-lg text-[10px] font-bold text-slate-800">
                              {item.material_name}: <strong className="text-emerald-700">{item.qty_used} {item.unit}</strong> (Rp {item.total_cost.toLocaleString('id-ID')})
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-black text-emerald-600 whitespace-nowrap">
                        Rp {log.total_cost.toLocaleString('id-ID')}
                      </td>
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap text-[10px]">
                        {log.operator || '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: RIWAYAT LOG OPNAME */}
      {activeTab === 'history' && (
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                Riwayat Log Stock Opname Fisik
              </h2>
              <p className="text-[10px] text-slate-400 font-bold">
                Jejak audit seluruh penyesuaian fisik vs sistem persediaan kemasan.
              </p>
            </div>
            <button
              onClick={handleExportOpnameExcel}
              className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-800 px-4 py-2 rounded-xl font-bold text-xs cursor-pointer"
            >
              <DownloadIcon />
              <span>Export Opname Excel</span>
            </button>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-100 max-h-[500px] overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[9px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-200 sticky top-0">
                <tr>
                  <th className="px-4 py-3">Tanggal Opname</th>
                  <th className="px-4 py-3">Nama Material</th>
                  <th className="px-4 py-3 text-right">Stok Sistem</th>
                  <th className="px-4 py-3 text-right">Hasil Fisik</th>
                  <th className="px-4 py-3 text-right">Selisih (+/-)</th>
                  <th className="px-4 py-3">Keterangan / Alasan</th>
                  <th className="px-4 py-3">Petugas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {opnameLogs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-400 font-bold">
                      Belum ada riwayat stock opname.
                    </td>
                  </tr>
                ) : (
                  opnameLogs.map(l => (
                    <tr key={l.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap font-bold text-slate-900">{l.date}</td>
                      <td className="px-4 py-3 font-bold text-slate-800">{l.material_name}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{l.system_stock.toLocaleString('id-ID')}</td>
                      <td className="px-4 py-3 text-right font-black text-slate-900">{l.physical_stock.toLocaleString('id-ID')}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-black ${
                          l.difference === 0 ? 'bg-slate-100 text-slate-600' : l.difference > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}>
                          {l.difference > 0 ? `+${l.difference}` : l.difference} {l.unit}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{l.notes || '-'}</td>
                      <td className="px-4 py-3 text-slate-500 text-[10px]">{l.operator}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Tambah Bahan Kemasan Baru */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                Tambah Jenis Bahan Kemasan
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateMaterial} className="space-y-3.5">
              <div>
                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                  Nama Bahan Kemasan *
                </label>
                <input
                  type="text"
                  value={newMatName}
                  onChange={e => setNewMatName(e.target.value)}
                  placeholder="Contoh: Plastik PE 5 Kg"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                    Kategori
                  </label>
                  <select
                    value={newMatCategory}
                    onChange={e => setNewMatCategory(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
                  >
                    <option value="plastik">Plastik</option>
                    <option value="karung">Karung</option>
                    <option value="lainnya">Lain-lain</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                    Satuan
                  </label>
                  <select
                    value={newMatUnit}
                    onChange={e => setNewMatUnit(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
                  >
                    <option value="lembar">Lembar</option>
                    <option value="pcs">Pcs</option>
                    <option value="roll">Roll</option>
                    <option value="pack">Pack</option>
                    <option value="kg">Kg</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                    Stok Awal
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={newMatCurrentStock}
                    onChange={e => setNewMatCurrentStock(e.target.value === '' ? '' : parseFloat(e.target.value))}
                    placeholder="0"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-900 text-right"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                    Min Stock Alert
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={newMatMinStock}
                    onChange={e => setNewMatMinStock(e.target.value === '' ? '' : parseFloat(e.target.value))}
                    placeholder="100"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-900 text-right"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                  Biaya Satuan / HPP (Rp / Unit)
                </label>
                <CurrencyInput
                  value={newMatUnitCost}
                  onChange={val => setNewMatUnitCost(val)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-900 text-right"
                  placeholder="Rp 0"
                />
              </div>

              <div>
                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                  Catatan
                </label>
                <input
                  type="text"
                  value={newMatNotes}
                  onChange={e => setNewMatNotes(e.target.value)}
                  placeholder="Keterangan ukuran/supplier plastik..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isAddingMaterial}
                  className="px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider bg-emerald-600 hover:bg-emerald-700 text-white shadow-md cursor-pointer"
                >
                  {isAddingMaterial ? 'Menyimpan...' : 'Tambah Material'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PackingStockOpnameView;
