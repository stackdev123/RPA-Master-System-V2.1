import React, { useState, useEffect, useMemo } from 'react';
import type { MasterItem, StockItem, StockLog, Invoice, DailyStockItemPrice } from '../types';
import { sortChickenParts } from '../constants';
import CurrencyInput from './CurrencyInput';
import { DownloadIcon } from './icons';
import * as XLSX from 'xlsx';

interface DailyStockValuationFormProps {
  masterItems: MasterItem[];
  currentStock: StockItem[];
  stockLogs: StockLog[];
  invoices: Invoice[];
  onSaveDailyValuation?: (date: string, totalValuation: number, itemPrices: DailyStockItemPrice[]) => Promise<void>;
  currentUserName?: string;
  canEdit?: boolean;
}

export const DailyStockValuationForm: React.FC<DailyStockValuationFormProps> = ({
  masterItems = [],
  currentStock = [],
  stockLogs = [],
  invoices = [],
  onSaveDailyValuation,
  currentUserName = 'Admin',
  canEdit = true
}) => {
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [pricesMap, setPricesMap] = useState<{ [itemName: string]: number }>({});
  const [savedRecords, setSavedRecords] = useState<DailyStockItemPrice[]>([]);
  const [isLoadingPrices, setIsLoadingPrices] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Load saved daily stock prices from API for selectedDate
  const fetchPricesForDate = async (targetDate: string) => {
    setIsLoadingPrices(true);
    try {
      const res = await fetch(`/api/daily-stock-prices?date=${targetDate}`);
      if (res.ok) {
        const data: DailyStockItemPrice[] = await res.json();
        setSavedRecords(data);
        const map: { [itemName: string]: number } = {};
        data.forEach(d => {
          if (d.item_name) map[d.item_name.toUpperCase()] = d.price_per_kg;
        });
        setPricesMap(map);
        setHasUnsavedChanges(false);
      }
    } catch (err) {
      console.error('Failed to fetch daily stock prices:', err);
    } finally {
      setIsLoadingPrices(false);
    }
  };

  useEffect(() => {
    fetchPricesForDate(selectedDate);
  }, [selectedDate]);

  // Calculate invoice average prices as a baseline / smart pre-fill
  const invoiceAveragePrices = useMemo(() => {
    const filterDate = new Date(selectedDate);
    const filterMonth = filterDate.getMonth();
    const filterYear = filterDate.getFullYear();

    const priceAggregator: { [key: string]: { sum: number; count: number } } = {};
    invoices.forEach(inv => {
      if (!inv.date) return;
      const invDate = new Date(inv.date);
      if (invDate.getMonth() === filterMonth && invDate.getFullYear() === filterYear) {
        inv.items?.forEach(item => {
          if (!item.name) return;
          const normName = item.name.trim().toUpperCase();
          const price = Number(item.price) || 0;
          if (price > 0) {
            if (!priceAggregator[normName]) priceAggregator[normName] = { sum: 0, count: 0 };
            priceAggregator[normName].sum += price;
            priceAggregator[normName].count += 1;
          }
        });
      }
    });

    const result: { [key: string]: number } = {};
    masterItems.forEach(item => {
      const norm = item.name.trim().toUpperCase();
      const entry = priceAggregator[norm];
      result[norm] = entry && entry.count > 0 ? Math.round(entry.sum / entry.count) : 22000;
    });
    return result;
  }, [selectedDate, invoices, masterItems]);

  // Calculate physical stock for the selected date
  const stockMapAtDate = useMemo(() => {
    const isToday = selectedDate === new Date().toISOString().slice(0, 10);
    const filterDate = new Date(selectedDate);
    filterDate.setHours(23, 59, 59, 999);

    const map = new Map<string, number>();
    masterItems.forEach(m => {
      const norm = m.name.trim().toUpperCase();
      if (isToday) {
        const live = currentStock.find(s => s.name.trim().toUpperCase() === norm);
        map.set(norm, live ? live.quantity : 0);
      } else {
        const logs = stockLogs
          .filter(log => log.itemName && log.itemName.trim().toUpperCase() === norm && new Date(log.timestamp) <= filterDate)
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        map.set(norm, logs.length > 0 ? logs[0].stockAfter : 0);
      }
    });
    return map;
  }, [selectedDate, masterItems, currentStock, stockLogs]);

  // Combined item rows
  const itemRows = useMemo(() => {
    let totalStockKg = 0;
    let totalValuationRp = 0;

    const list = masterItems.map(item => {
      const norm = item.name.trim().toUpperCase();
      const stockKg = stockMapAtDate.get(norm) || 0;
      const price = pricesMap[norm] ?? (invoiceAveragePrices[norm] || 22000);
      const subtotalVal = stockKg * price;

      totalStockKg += stockKg;
      totalValuationRp += subtotalVal;

      return {
        id: item.id || norm,
        name: item.name,
        normName: norm,
        stockKg,
        pricePerKg: price,
        subtotalVal,
        suggestedPrice: invoiceAveragePrices[norm] || 22000,
        isCustomPrice: pricesMap[norm] !== undefined
      };
    }).sort((a, b) => sortChickenParts(a.name, b.name));

    return {
      list,
      totalStockKg,
      totalValuationRp,
      avgPricePerKg: totalStockKg > 0 ? totalValuationRp / totalStockKg : 0
    };
  }, [masterItems, stockMapAtDate, pricesMap, invoiceAveragePrices]);

  const handlePriceChange = (normName: string, newPrice: number) => {
    setPricesMap(prev => ({
      ...prev,
      [normName]: newPrice
    }));
    setHasUnsavedChanges(true);
  };

  const handleApplySuggestedPrices = () => {
    if (confirm('Terapkan harga estimasi rata-rata invoice bulan ini untuk semua item yang belum diatur?')) {
      const newMap = { ...pricesMap };
      masterItems.forEach(m => {
        const norm = m.name.trim().toUpperCase();
        if (newMap[norm] === undefined || newMap[norm] === 0) {
          newMap[norm] = invoiceAveragePrices[norm] || 22000;
        }
      });
      setPricesMap(newMap);
      setHasUnsavedChanges(true);
    }
  };

  const handleSaveValuation = async () => {
    setIsSaving(true);
    try {
      const payload: DailyStockItemPrice[] = itemRows.list.map(row => ({
        id: `dsp_${selectedDate}_${row.normName.replace(/\s+/g, '_')}`,
        date: selectedDate,
        item_name: row.name,
        price_per_kg: row.pricePerKg,
        timestamp: new Date().toISOString(),
        updated_by: currentUserName
      }));

      // 1. Post to Express API
      const res = await fetch('/api/daily-stock-prices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('Gagal menyimpan harga harian ke server');

      // 2. Also sync to DB earlyStock via onSaveDailyValuation prop if supplied
      if (onSaveDailyValuation) {
        await onSaveDailyValuation(selectedDate, itemRows.totalValuationRp, payload);
      }

      setHasUnsavedChanges(false);
      setSavedRecords(payload);
      alert(`Valuasi stok tanggal ${selectedDate} sebesar Rp ${itemRows.totalValuationRp.toLocaleString('id-ID')} berhasil disimpan!`);
    } catch (err: any) {
      console.error(err);
      alert('Error saat menyimpan valuasi: ' + (err.message || 'Error tidak diketahui'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportExcel = () => {
    const exportData = itemRows.list.map(r => ({
      'Tanggal Valuasi': selectedDate,
      'Nama Partisi / Item': r.name,
      'Stok Fisik (Kg)': r.stockKg,
      'Harga Satuan Harian (Rp/Kg)': r.pricePerKg,
      'Subtotal Nilai Valuasi (Rp)': r.subtotalVal,
      'Sumber Harga': r.isCustomPrice ? 'Input Harian Khusus' : 'Estimasi Invoice'
    }));

    exportData.push({
      'Tanggal Valuasi': 'TOTAL',
      'Nama Partisi / Item': `${itemRows.list.length} Items`,
      'Stok Fisik (Kg)': itemRows.totalStockKg,
      'Harga Satuan Harian (Rp/Kg)': Math.round(itemRows.avgPricePerKg),
      'Subtotal Nilai Valuasi (Rp)': itemRows.totalValuationRp,
      'Sumber Harga': '-'
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Valuasi_${selectedDate}`);
    XLSX.writeFile(wb, `Daily_Stock_Valuation_${selectedDate}.xlsx`);
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
      {/* Banner */}
      <div className="bg-gradient-to-r from-indigo-700 via-blue-600 to-sky-600 rounded-3xl p-6 md:p-8 text-white shadow-xl shadow-indigo-500/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <span className="text-[10px] font-black uppercase tracking-widest bg-white/20 px-3 py-1 rounded-full backdrop-blur-md">
            Modul Keuangan & Valuasi Persediaan
          </span>
          <h1 className="text-2xl md:text-3xl font-black mt-2 tracking-tight">
            Daily Stock Valuation
          </h1>
        </div>

        <div className="flex items-center gap-3 shrink-0 flex-wrap">
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-3 rounded-2xl font-black text-xs uppercase tracking-wider transition-all border border-white/20 cursor-pointer active:scale-95"
          >
            <DownloadIcon />
            <span>Export Excel</span>
          </button>
          <button
            onClick={handleSaveValuation}
            disabled={isSaving || !canEdit}
            className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-wider transition-all shadow-lg active:scale-95 cursor-pointer ${
              hasUnsavedChanges
                ? 'bg-amber-400 text-slate-950 hover:bg-amber-300 ring-4 ring-amber-400/30 animate-pulse'
                : 'bg-white text-indigo-700 hover:bg-indigo-50'
            }`}
          >
            {isSaving ? 'Menyimpan...' : (hasUnsavedChanges ? 'Simpan Perubahan Valuasi' : 'Valuasi Tersimpan')}
          </button>
        </div>
      </div>

      {/* Control bar: Tanggal & Fast Actions */}
      <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <label className="text-xs font-black text-slate-700 uppercase tracking-wider shrink-0">
            Tanggal Valuasi:
          </label>
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            onClick={() => setSelectedDate(new Date().toISOString().slice(0, 10))}
            className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-3 py-2 rounded-lg cursor-pointer"
          >
            Hari Ini
          </button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleApplySuggestedPrices}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            Pre-fill dari Estimasi Rata-Rata Invoice
          </button>
          {savedRecords.length > 0 && (
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
              ✓ Harga tersimpan ({savedRecords.length} item)
            </span>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Fisik Stok ({selectedDate})</p>
          <p className="text-xl md:text-2xl font-black text-slate-900 mt-1">
            {itemRows.totalStockKg.toLocaleString('id-ID', { minimumFractionDigits: 1 })} <span className="text-sm font-bold text-slate-500">Kg</span>
          </p>
          <p className="text-[10px] text-slate-400 mt-1">Total seluruh item karkas</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Nilai Valuasi Aset</p>
          <p className="text-xl md:text-2xl font-black text-indigo-600 mt-1">
            Rp {itemRows.totalValuationRp.toLocaleString('id-ID')}
          </p>
          <p className="text-[10px] text-emerald-600 font-bold mt-1">
            {hasUnsavedChanges ? '⚠️ Belum disimpan ke database' : '✓ Nilai Aktif'}
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Rata-Rata Nilai per Kg</p>
          <p className="text-xl md:text-2xl font-black text-emerald-600 mt-1">
            Rp {Math.round(itemRows.avgPricePerKg).toLocaleString('id-ID')} <span className="text-sm font-bold text-slate-500">/Kg</span>
          </p>
          <p className="text-[10px] text-slate-400 mt-1">Weighted average price</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Item Tercover</p>
          <p className="text-xl md:text-2xl font-black text-amber-600 mt-1">
            {itemRows.list.length} <span className="text-sm font-bold text-slate-500">Master Item</span>
          </p>
          <p className="text-[10px] text-slate-400 mt-1">Semua kategori partisi</p>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-black text-slate-900 uppercase tracking-tight">
              Tabel Penetapan Harga Harian per Item
            </h2>
            <p className="text-[10px] text-slate-400 font-bold">
              Ubah harga pasar per kg untuk tanggal {selectedDate}. Subtotal akan langsung terhitung secara otomatis.
            </p>
          </div>
          {isLoadingPrices && (
            <span className="text-xs text-indigo-600 font-bold animate-pulse">
              Memuat data harga...
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-[9px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-200">
              <tr>
                <th className="px-5 py-4 w-12 text-center">No</th>
                <th className="px-5 py-4">Nama Item Produk</th>
                <th className="px-5 py-4 text-right">Stok Fisik Gudang (Kg)</th>
                <th className="px-5 py-4 text-right w-64">Harga Pasar Hari Ini (Rp / Kg)</th>
                <th className="px-5 py-4 text-right">Subtotal Nilai Valuasi (Rp)</th>
                <th className="px-5 py-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {itemRows.list.map((row, idx) => (
                <tr key={row.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-5 py-3 text-center text-slate-400 font-bold">{idx + 1}</td>
                  <td className="px-5 py-3">
                    <span className="font-bold text-slate-900 block uppercase tracking-tight text-xs">
                      {row.name}
                    </span>
                    <span className="text-[9px] text-slate-400 font-medium">
                      Estimasi Invoice: Rp {row.suggestedPrice.toLocaleString('id-ID')}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <span className="font-black text-slate-900 text-sm">
                      {row.stockKg.toLocaleString('id-ID', { minimumFractionDigits: 1 })}
                    </span>
                    <span className="text-[9px] text-slate-400 ml-1 font-bold">Kg</span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <span className="text-[10px] font-bold text-slate-400">Rp</span>
                      <input
                        type="number"
                        step="100"
                        min="0"
                        value={row.pricePerKg}
                        onChange={e => handlePriceChange(row.normName, parseFloat(e.target.value) || 0)}
                        className="w-36 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-right font-black text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <span className="font-black text-indigo-700 text-sm">
                      Rp {row.subtotalVal.toLocaleString('id-ID')}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-center">
                    {row.isCustomPrice ? (
                      <span className="inline-block px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[9px] font-black border border-indigo-200">
                        Input Harian
                      </span>
                    ) : (
                      <span className="inline-block px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[9px] font-bold">
                        Default
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-900 text-white font-black text-xs">
              <tr>
                <td colSpan={2} className="px-5 py-4 uppercase tracking-widest text-slate-300">
                  Total Valuasi Stok Persediaan ({selectedDate})
                </td>
                <td className="px-5 py-4 text-right text-sm text-emerald-400">
                  {itemRows.totalStockKg.toLocaleString('id-ID', { minimumFractionDigits: 1 })} Kg
                </td>
                <td className="px-5 py-4 text-right text-slate-300">
                  Rata-rata: Rp {Math.round(itemRows.avgPricePerKg).toLocaleString('id-ID')}/Kg
                </td>
                <td className="px-5 py-4 text-right text-base text-emerald-400">
                  Rp {itemRows.totalValuationRp.toLocaleString('id-ID')}
                </td>
                <td className="px-5 py-4 text-center">
                  <button
                    onClick={handleSaveValuation}
                    disabled={isSaving || !canEdit}
                    className="px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-[10px] uppercase tracking-wider font-black transition-colors cursor-pointer"
                  >
                    {isSaving ? '...' : 'Simpan'}
                  </button>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DailyStockValuationForm;
