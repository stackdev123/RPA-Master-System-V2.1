import React, { useState, useMemo } from 'react';
import { SearchIcon, ArrowUturnLeftIcon, TrashIcon } from './icons';
import type { DOReturnRecord } from '../types';

interface DOReturnsListViewProps {
  returns: DOReturnRecord[];
  onDeleteReturn?: (id: string) => Promise<void>;
  userRole?: string;
}

export const DOReturnsListView: React.FC<DOReturnsListViewProps> = ({
  returns,
  onDeleteReturn,
  userRole
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState<'all' | 'restock' | 'disposal'>('all');

  const filteredReturns = useMemo(() => {
    return returns.filter(r => {
      const matchSearch = r.deliveryOrderId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.itemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.reason.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchAction = actionFilter === 'all' ? true : r.action === actionFilter;

      return matchSearch && matchAction;
    });
  }, [returns, searchTerm, actionFilter]);

  const totalReturnKg = useMemo(() => {
    return returns.reduce((acc, r) => acc + (Number(r.quantity) || 0), 0);
  }, [returns]);

  const totalRestockedKg = useMemo(() => {
    return returns.filter(r => r.action === 'restock').reduce((acc, r) => acc + (Number(r.quantity) || 0), 0);
  }, [returns]);

  const totalDisposedKg = useMemo(() => {
    return returns.filter(r => r.action === 'disposal').reduce((acc, r) => acc + (Number(r.quantity) || 0), 0);
  }, [returns]);

  return (
    <div className="space-y-4">
      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Kuantitas Retur</span>
          <p className="text-xl font-black text-slate-800 mt-1">
            {totalReturnKg.toLocaleString('id-ID')} <span className="text-xs font-normal text-slate-500">kg</span>
          </p>
        </div>
        <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
          <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700">Masuk Kembali ke Gudang</span>
          <p className="text-xl font-black text-emerald-800 mt-1">
            {totalRestockedKg.toLocaleString('id-ID')} <span className="text-xs font-normal text-emerald-600">kg</span>
          </p>
        </div>
        <div className="bg-rose-50 p-4 rounded-2xl border border-rose-100">
          <span className="text-[10px] font-black uppercase tracking-wider text-rose-700">Dimusnahkan / Afkir</span>
          <p className="text-xl font-black text-rose-800 mt-1">
            {totalDisposedKg.toLocaleString('id-ID')} <span className="text-xs font-normal text-rose-600">kg</span>
          </p>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <SearchIcon className="h-4 w-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Cari DO, customer, item, alasan..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto">
          {[
            { id: 'all', label: 'Semua Tindakan' },
            { id: 'restock', label: 'Restock Gudang' },
            { id: 'disposal', label: 'Dimusnahkan (Afkir)' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActionFilter(tab.id as any)}
              className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-colors ${
                actionFilter === tab.id
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        {filteredReturns.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            <ArrowUturnLeftIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-xs font-bold">Tidak ada riwayat retur/tolakan ditemukan.</p>
          </div>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-500">
              <tr>
                <th className="py-3 px-4">Tanggal & No. DO</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Item Produk</th>
                <th className="py-3 px-4 text-right">Kuantitas</th>
                <th className="py-3 px-4">Alasan Tolakan</th>
                <th className="py-3 px-4 text-center">Tindakan Fisik</th>
                {onDeleteReturn && <th className="py-3 px-4 text-center">Aksi</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredReturns.map(r => (
                <tr key={r.id} className="hover:bg-slate-50/50">
                  <td className="py-3 px-4">
                    <span className="font-black text-slate-800 block text-xs">{r.deliveryOrderId}</span>
                    <span className="text-[10px] text-slate-400 font-bold">
                      {new Date(r.date).toLocaleDateString('id-ID')}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-bold text-slate-800">
                    {r.customer}
                  </td>
                  <td className="py-3 px-4 font-black text-slate-800">
                    {r.itemName}
                  </td>
                  <td className="py-3 px-4 text-right font-black text-amber-700">
                    {r.quantity} kg
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-bold text-slate-700 block">{r.reason}</span>
                    {r.notes && <span className="text-[10px] text-slate-400">{r.notes}</span>}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {r.action === 'restock' ? (
                      <span className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase bg-emerald-100 text-emerald-800">
                        Restock Gudang
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase bg-rose-100 text-rose-800">
                        Dimusnahkan
                      </span>
                    )}
                  </td>
                  {onDeleteReturn && (
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => {
                          if (window.confirm('Hapus pencatatan retur ini?')) {
                            onDeleteReturn(r.id);
                          }
                        }}
                        className="p-1 text-slate-300 hover:text-rose-600 rounded-lg"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default DOReturnsListView;
