import React, { useRef } from 'react';
import { XIcon, PrintIcon, TruckIcon } from './icons';
import type { SalesOrder } from '../types';

interface SalesOrderDetailModalProps {
  order: SalesOrder;
  onClose: () => void;
  onCreateDO?: (order: SalesOrder) => void;
  lockedSOs?: Record<string, string>;
}

export const SalesOrderDetailModal: React.FC<SalesOrderDetailModalProps> = ({
  order,
  onClose,
  onCreateDO,
  lockedSOs = {}
}) => {
  const lockedByUser = lockedSOs[order.id];
  const printAreaRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800">Selesai Dikirim</span>;
      case 'partial':
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-100 text-blue-800">Terkirim Sebagian</span>;
      case 'cancelled':
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-800">Dibatalkan</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800">Menunggu Pengiriman</span>;
    }
  };

  const totalDelivered = order.items.reduce((acc, it) => acc + (it.fulfilledQty || 0), 0);
  const percentFulfilled = order.totalQty > 0 ? Math.min(100, Math.round((totalDelivered / order.totalQty) * 100)) : 0;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-3 md:p-6 overflow-y-auto print:p-0 print:bg-white">
      <div className="bg-white rounded-[2.5rem] w-full max-w-3xl shadow-2xl border border-slate-100 flex flex-col max-h-[92vh] overflow-hidden my-auto print:max-h-none print:shadow-none print:border-none print:rounded-none">
        
        {/* Header (hidden when printing) */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 print:hidden">
          <div className="flex items-center gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-lg text-[9px] font-black bg-slate-200 text-slate-700">
                  {order.id}
                </span>
                {getStatusBadge(order.status)}
              </div>
              <h2 className="text-xl font-black text-slate-800 tracking-tight mt-1">
                Detail Sales Order
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black transition-colors"
            >
              <PrintIcon className="h-4 w-4" />
              Cetak SO
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
            >
              <XIcon className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Printable Body */}
        <div ref={printAreaRef} className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
          
          {/* Company & SO Title Header */}
          <div className="flex justify-between items-start border-b border-slate-200 pb-6">
            <div className="flex items-center gap-3">
              <img src="/logo trial.png" alt="Logo" className="w-12 h-12 object-contain" />
              <div>
                <h1 className="font-black text-slate-900 text-base uppercase tracking-tight">PT Mitra Karya Foodindo</h1>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Rumah Potong Ayam (RPA)</p>
                <p className="text-[10px] text-slate-400">Jl. Industri Unggas Sejahtera, Bogor</p>
              </div>
            </div>
            <div className="text-right">
              <h2 className="text-xl font-black text-teal-700 uppercase tracking-tight">SALES ORDER</h2>
              <p className="text-xs font-black text-slate-800 mt-1">{order.id}</p>
              <p className="text-[11px] text-slate-500 font-medium">
                Tanggal: {new Date(order.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>

          {/* Customer & Payment Info */}
          <div className="grid grid-cols-2 gap-6 bg-slate-50 p-4 rounded-2xl border border-slate-100 text-xs">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                Tujuan Pelanggan / Customer
              </span>
              <p className="font-black text-slate-800 text-sm">{order.customer}</p>
              {order.customerAddress && (
                <p className="text-slate-500 mt-0.5 leading-relaxed">{order.customerAddress}</p>
              )}
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                Syarat & Pembayaran
              </span>
              <p className="font-bold text-slate-700">Metode: <strong className="text-teal-700">{order.paymentMethod}</strong></p>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-slate-400">Status SO:</span>
                {getStatusBadge(order.status)}
              </div>
            </div>
          </div>

          {/* Fulfillment Progress Bar */}
          {order.deliveryOrderIds && order.deliveryOrderIds.length > 0 && (
            <div className="bg-blue-50/60 border border-blue-100 p-4 rounded-2xl print:border-slate-200">
              <div className="flex justify-between items-center text-xs mb-2">
                <span className="font-black text-blue-900 uppercase text-[10px] tracking-wider">
                  Progres Pengiriman ({percentFulfilled}% Terpenuhi)
                </span>
                <span className="font-bold text-blue-800">
                  {totalDelivered.toLocaleString('id-ID')} / {order.totalQty.toLocaleString('id-ID')} kg
                </span>
              </div>
              <div className="w-full bg-blue-200/50 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-blue-600 h-full rounded-full transition-all duration-300"
                  style={{ width: `${percentFulfilled}%` }}
                />
              </div>
              <div className="mt-2.5 flex items-center gap-2 flex-wrap text-[11px]">
                <span className="text-blue-700 font-bold">Surat Jalan Terkait:</span>
                {order.deliveryOrderIds.map((sj, sIdx) => (
                  <span key={`${sj}-${sIdx}`} className="px-2 py-0.5 bg-white border border-blue-200 text-blue-800 font-black rounded-lg text-[10px]">
                    {sj}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Items Table */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-600">
                <tr>
                  <th className="py-3 px-4">No.</th>
                  <th className="py-3 px-4">Nama Produk / Item</th>
                  <th className="py-3 px-4 text-right">Kuantitas</th>
                  <th className="py-3 px-4 text-right">Harga Satuan (Kg)</th>
                  <th className="py-3 px-4 text-right">Subtotal</th>
                  <th className="py-3 px-4 text-right print:hidden">Terkirim</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {order.items.map((it, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="py-3 px-4 text-slate-400 font-bold">{idx + 1}</td>
                    <td className="py-3 px-4 font-black text-slate-800">
                      {it.name}
                      {it.notes && <span className="block text-[10px] text-slate-400 font-normal">{it.notes}</span>}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-slate-700">
                      {it.quantity.toLocaleString('id-ID')} kg
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-slate-700">
                      Rp {it.price.toLocaleString('id-ID')}
                    </td>
                    <td className="py-3 px-4 text-right font-black text-slate-900">
                      Rp {it.total.toLocaleString('id-ID')}
                    </td>
                    <td className="py-3 px-4 text-right text-blue-600 font-bold print:hidden">
                      {it.fulfilledQty || 0} kg
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 border-t-2 border-slate-200 font-black">
                <tr>
                  <td colSpan={2} className="py-3 px-4 uppercase text-slate-600 text-[10px] tracking-wider">
                    Total Kuantitas & Nilai
                  </td>
                  <td className="py-3 px-4 text-right text-slate-800">
                    {order.totalQty.toLocaleString('id-ID')} kg
                  </td>
                  <td className="py-3 px-4"></td>
                  <td className="py-3 px-4 text-right text-base text-teal-800">
                    Rp {order.totalAmount.toLocaleString('id-ID')}
                  </td>
                  <td className="print:hidden"></td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Notes */}
          {order.notes && (
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-xs">
              <span className="font-black text-slate-500 uppercase text-[10px] block mb-1">Catatan Tambahan:</span>
              <p className="text-slate-700 leading-relaxed">{order.notes}</p>
            </div>
          )}

          {/* Signatures for Print */}
          <div className="hidden print:grid grid-cols-3 gap-8 pt-8 text-center text-xs">
            <div>
              <p className="font-bold text-slate-500 mb-16">Dibuat Oleh (Sales)</p>
              <p className="font-black border-t border-slate-300 pt-1 text-slate-800">{order.createdBy || 'Staff Sales'}</p>
            </div>
            <div>
              <p className="font-bold text-slate-500 mb-16">Disetujui (Gudang/Logistik)</p>
              <p className="font-black border-t border-slate-300 pt-1 text-slate-800">( .................................... )</p>
            </div>
            <div>
              <p className="font-bold text-slate-500 mb-16">Penerima (Customer)</p>
              <p className="font-black border-t border-slate-300 pt-1 text-slate-800">{order.customer}</p>
            </div>
          </div>

        </div>

        {/* Footer Actions (hidden on print) */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between print:hidden">
          <div className="text-xs text-slate-400">
            Dibuat: {new Date(order.timestamp).toLocaleString('id-ID')}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-slate-600 hover:bg-slate-200 transition-colors"
            >
              Tutup
            </button>
            {order.status !== 'completed' && order.status !== 'cancelled' && onCreateDO && (
              lockedByUser ? (
                <button
                  type="button"
                  disabled
                  className="flex items-center gap-2 px-6 py-2.5 bg-amber-100 text-amber-800 border border-amber-300 rounded-xl text-xs font-black uppercase tracking-wider cursor-not-allowed"
                >
                  🔒 Sedang Dibuat DO oleh {lockedByUser}
                </button>
              ) : (
                <button
                  onClick={() => onCreateDO(order)}
                  className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
                >
                  <TruckIcon className="h-4 w-4" />
                  Terbitkan Surat Jalan (DO)
                </button>
              )
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default SalesOrderDetailModal;
