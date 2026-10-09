import React, { useState } from 'react';
import { XIcon, ArrowUturnLeftIcon } from './icons';
import type { DeliveryOrder, DOReturnRecord } from '../types';

interface DOReturnModalProps {
  deliveryOrder: DeliveryOrder;
  onSubmit: (records: DOReturnRecord[]) => Promise<void>;
  onCancel: () => void;
}

const RETURN_REASONS = [
  'Kualitas Rusak / Memar',
  'Bau / Tidak Segar',
  'Ukuran / Spek Tidak Sesuai',
  'Kelebihan Kirim',
  'Ditolak Pembeli',
  'Kemasan Pecah / Rusak',
  'Lainnya'
];

export const DOReturnModal: React.FC<DOReturnModalProps> = ({
  deliveryOrder,
  onSubmit,
  onCancel
}) => {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  
  // State per item in the DO
  const [returnRows, setReturnRows] = useState<Record<string, {
    quantity: number | '';
    reason: string;
    action: 'restock' | 'disposal';
    notes: string;
  }>>(() => {
    const map: any = {};
    deliveryOrder.items.forEach(it => {
      map[it.name] = {
        quantity: '',
        reason: RETURN_REASONS[0],
        action: 'restock',
        notes: ''
      };
    });
    return map;
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRowChange = (itemName: string, field: string, value: any) => {
    setReturnRows(prev => ({
      ...prev,
      [itemName]: {
        ...prev[itemName],
        [field]: value
      }
    }));
  };

  const totalReturnQty = Object.values(returnRows).reduce((acc, row) => {
    return acc + (Number(row.quantity) || 0);
  }, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validRecords: DOReturnRecord[] = [];

    deliveryOrder.items.forEach(it => {
      const row = returnRows[it.name];
      const q = Number(row?.quantity) || 0;
      if (q > 0) {
        validRecords.push({
          id: `RET/${deliveryOrder.id.replace(/\//g, '-')}/${it.name}/${Date.now().toString().slice(-4)}`,
          date,
          deliveryOrderId: deliveryOrder.id,
          customer: deliveryOrder.customer,
          itemName: it.name,
          quantity: q,
          reason: row.reason || 'Tolakan Customer',
          action: row.action || 'restock',
          notes: row.notes || '',
          timestamp: new Date().toISOString()
        });
      }
    });

    if (validRecords.length === 0) {
      alert('Masukkan kuantitas retur/tolakan minimal pada satu item.');
      return;
    }

    // Verify quantity does not exceed shipped quantity
    for (const rec of validRecords) {
      const it = deliveryOrder.items.find(i => i.name === rec.itemName);
      const shipped = it ? it.quantity : 0;
      const prevRetur = deliveryOrder.rejectedItems?.find(r => r.name === rec.itemName)?.quantity || 0;
      if (rec.quantity + prevRetur > shipped) {
        alert(`Kuantitas retur ${rec.itemName} (${rec.quantity + prevRetur} kg) melebihi kuantitas kirim (${shipped} kg).`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      await onSubmit(validRecords);
    } catch (err: any) {
      alert('Gagal mencatat retur/tolakan: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[220] flex items-center justify-center p-3 md:p-6 overflow-y-auto">
      <div className="bg-white rounded-[2.5rem] w-full max-w-3xl shadow-2xl border border-slate-100 flex flex-col max-h-[92vh] overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-amber-50/50">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-500 text-white rounded-2xl shadow-md shadow-amber-500/20">
              <ArrowUturnLeftIcon className="h-6 w-6" />
            </div>
            <div>
              <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-100 text-amber-800">
                Input Retur / Tolakan
              </span>
              <h2 className="text-xl font-black text-slate-800 tracking-tight">
                Surat Jalan: {deliveryOrder.id}
              </h2>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
          >
            <XIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          
          {/* DO Summary Info */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase">Customer</span>
              <p className="font-black text-slate-800 truncate">{deliveryOrder.customer}</p>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase">Tanggal DO</span>
              <p className="font-bold text-slate-700">
                {new Date(deliveryOrder.date).toLocaleDateString('id-ID')}
              </p>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase">Total Kirim DO</span>
              <p className="font-black text-slate-800">
                {deliveryOrder.items.reduce((acc, it) => acc + it.quantity, 0).toLocaleString('id-ID')} kg
              </p>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase">Tanggal Input Retur</span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-0.5 px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 outline-none w-full"
              />
            </div>
          </div>

          {/* Table of items */}
          <div className="space-y-2">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">
              Item Pengiriman & Form Tolakan
            </h3>

            <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm divide-y divide-slate-100">
              {deliveryOrder.items.map(it => {
                const prevRetur = deliveryOrder.rejectedItems?.find(r => r.name === it.name)?.quantity || 0;
                const netReceived = Math.max(0, it.quantity - prevRetur);
                const row = returnRows[it.name] || { quantity: '', reason: RETURN_REASONS[0], action: 'restock', notes: '' };

                return (
                  <div key={it.name} className="p-4 space-y-3 bg-white hover:bg-slate-50/50 transition-colors">
                    {/* Top Row: Item Details & Shipped Info */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <span className="font-black text-slate-800 text-sm">{it.name}</span>
                        <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-0.5">
                          <span>Kirim: <strong className="text-slate-700">{it.quantity} kg</strong></span>
                          <span>•</span>
                          <span>Sudah Retur: <strong className="text-amber-600">{prevRetur} kg</strong></span>
                          <span>•</span>
                          <span>Diterima Bersih: <strong className="text-emerald-700">{netReceived} kg</strong></span>
                        </div>
                      </div>

                      {/* Retur Input Qty */}
                      <div className="flex items-center gap-2">
                        <label className="text-[10px] font-black uppercase text-slate-500">
                          Qty Retur Baru:
                        </label>
                        <div className="relative w-28">
                          <input
                            type="number"
                            step="any"
                            min="0"
                            placeholder="0.0"
                            value={row.quantity}
                            onChange={(e) => handleRowChange(it.name, 'quantity', e.target.value)}
                            className="w-full px-3 py-1.5 text-right font-black text-xs border border-amber-200 bg-amber-50/50 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 text-amber-900"
                          />
                          <span className="absolute right-2 top-2 text-[10px] font-bold text-slate-400 pointer-events-none">kg</span>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Row (shown only if quantity entered > 0) */}
                    {Number(row.quantity) > 0 && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-slate-100 bg-amber-50/30 p-3 rounded-xl animate-in fade-in duration-150">
                        {/* Alasan Retur */}
                        <div>
                          <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                            Alasan Tolakan
                          </label>
                          <select
                            value={row.reason}
                            onChange={(e) => handleRowChange(it.name, 'reason', e.target.value)}
                            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-amber-500"
                          >
                            {RETURN_REASONS.map(r => (
                              <option key={r} value={r}>{r}</option>
                            ))}
                          </select>
                        </div>

                        {/* Tindakan Stok */}
                        <div>
                          <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                            Tindakan Fisik Barang
                          </label>
                          <select
                            value={row.action}
                            onChange={(e) => handleRowChange(it.name, 'action', e.target.value as any)}
                            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-800 outline-none focus:ring-2 focus:ring-amber-500"
                          >
                            <option value="restock">🟢 Masuk Kembali ke Gudang (Restock)</option>
                            <option value="disposal">🔴 Dimusnahkan / Afkir (Kerugian)</option>
                          </select>
                        </div>

                        {/* Catatan */}
                        <div>
                          <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                            Catatan Tambahan
                          </label>
                          <input
                            type="text"
                            placeholder="Keterangan kondisi..."
                            value={row.notes}
                            onChange={(e) => handleRowChange(it.name, 'notes', e.target.value)}
                            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:ring-2 focus:ring-amber-500"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Info Card */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs text-slate-600 space-y-1">
            <span className="font-black text-slate-700 block uppercase text-[10px] tracking-wider">
              ℹ️ Mekanisme Retur / Tolakan:
            </span>
            <p className="leading-relaxed">
              1. <strong>Tagihan Invoice</strong> akan otomatis memperhitungkan kuantitas bersih yang diterima (Kirim dikurangi Retur).
            </p>
            <p className="leading-relaxed">
              2. Jika dipilih <strong>Kembali ke Gudang</strong>, kuantitas akan otomatis ditambahkan kembali ke stok gudang. Jika <strong>Dimusnahkan/Afkir</strong>, stok tidak kembali dan dicatat sebagai afkir.
            </p>
          </div>

          {/* Return Total */}
          <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200 flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-amber-900">
              Total Kuantitas Retur yang Diinput
            </span>
            <div className="text-right">
              <span className="text-2xl font-black text-amber-900">
                {totalReturnQty.toLocaleString('id-ID')}
              </span>
              <span className="text-xs font-bold text-amber-700 ml-1">kg</span>
            </div>
          </div>

        </form>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-slate-500 hover:bg-slate-200 transition-colors"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || totalReturnQty <= 0}
            className="px-8 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-amber-500/20 active:scale-95 transition-all flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Menyimpan Data Retur...
              </>
            ) : (
              'Simpan Retur / Tolakan'
            )}
          </button>
        </div>

      </div>
    </div>
  );
};

export default DOReturnModal;
