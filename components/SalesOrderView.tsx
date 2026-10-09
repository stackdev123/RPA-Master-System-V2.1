import React, { useState, useMemo } from 'react';
import { 
  PlusIcon, SearchIcon, FilterIcon, TruckIcon, EyeIcon, 
  TrashIcon, ShoppingCartIcon, CheckCircleIcon, ClockIcon 
} from './icons';
import type { SalesOrder, Customer, MasterItem } from '../types';

interface SalesOrderViewProps {
  salesOrders: SalesOrder[];
  customers?: Customer[];
  masterItems?: MasterItem[];
  currentStock?: Record<string, number>;
  onAddOrder?: () => void;
  onCreateOrder?: () => void;
  onEditOrder?: (order: SalesOrder) => void;
  onDeleteOrder: (id: string) => Promise<void> | void;
  onSelectOrder?: (order: SalesOrder) => void;
  onViewDetail?: (order: SalesOrder) => void;
  onCreateDO: (order: SalesOrder) => void;
  userRole?: string;
  lockedSOs?: Record<string, string>;
}

export const SalesOrderView: React.FC<SalesOrderViewProps> = ({
  salesOrders,
  customers = [],
  masterItems = [],
  currentStock = {},
  onAddOrder,
  onCreateOrder,
  onEditOrder,
  onDeleteOrder,
  onSelectOrder,
  onViewDetail,
  onCreateDO,
  userRole,
  lockedSOs = {}
}) => {
  const handleAddOrder = onAddOrder || onCreateOrder || (() => {});
  const handleSelectOrder = onSelectOrder || onViewDetail || (() => {});
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'partial' | 'completed' | 'cancelled'>('all');
  const [dateFilter, setDateFilter] = useState('');

  const filteredOrders = useMemo(() => {
    return salesOrders.filter(so => {
      const matchSearch = so.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        so.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
        so.items.some(it => it.name.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchStatus = statusFilter === 'all' ? true : so.status === statusFilter;
      const matchDate = dateFilter ? so.date === dateFilter : true;

      return matchSearch && matchStatus && matchDate;
    });
  }, [salesOrders, searchTerm, statusFilter, dateFilter]);

  // Metrics
  const metrics = useMemo(() => {
    const totalOrders = salesOrders.length;
    const totalValue = salesOrders.reduce((acc, so) => acc + so.totalAmount, 0);
    const pendingOrders = salesOrders.filter(so => so.status === 'pending' || so.status === 'partial').length;
    const completedOrders = salesOrders.filter(so => so.status === 'completed').length;
    const totalKg = salesOrders.reduce((acc, so) => acc + so.totalQty, 0);

    return { totalOrders, totalValue, pendingOrders, completedOrders, totalKg };
  }, [salesOrders]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800">
            <CheckCircleIcon className="h-3.5 w-3.5" />
            Selesai
          </span>
        );
      case 'partial':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-100 text-blue-800">
            <ClockIcon className="h-3.5 w-3.5" />
            Sebagian
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-800">
            Batal
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800">
            <ClockIcon className="h-3.5 w-3.5" />
            Menunggu DO
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner & Action */}
      <div className="flex flex-row items-center justify-between gap-4 bg-white px-6 h-[60px] rounded-2xl md:rounded-[2.5rem] border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-teal-100 text-teal-800">
                Sales
              </span>
              <h1 className="text-lg md:text-xl font-black text-slate-800 tracking-tight">
                Sales Order
              </h1>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleAddOrder}
            className="flex items-center justify-center gap-1.5 h-[20px] w-[165px] text-[11px] bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-black uppercase tracking-wider shadow-sm active:scale-95 transition-all"
          >
            <PlusIcon className="h-3 w-3" />
            + Sales Order
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Total Sales Order</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-slate-800">{metrics.totalOrders}</span>
            <span className="text-xs font-bold text-slate-400">Order ({metrics.totalKg.toLocaleString('id-ID')} kg)</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm">
          <span className="text-[10px] font-black text-teal-600 uppercase tracking-wider">Total Nilai Pesanan</span>
          <div className="mt-1">
            <span className="text-2xl font-black text-teal-800">
              Rp {metrics.totalValue.toLocaleString('id-ID')}
            </span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm">
          <span className="text-[10px] font-black text-amber-600 uppercase tracking-wider">Menunggu Pengiriman</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-amber-700">{metrics.pendingOrders}</span>
            <span className="text-xs font-bold text-amber-600">Perlu Terbit DO</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm">
          <span className="text-[10px] font-black text-emerald-600 uppercase tracking-wider">Selesai Dikirim</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-emerald-700">{metrics.completedOrders}</span>
            <span className="text-xs font-bold text-emerald-600">Selesai Fulfill</span>
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <SearchIcon className="h-4 w-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Cari nomor SO, customer, atau nama item..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>

        {/* Status Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
          {[
            { id: 'all', label: 'Semua Status' },
            { id: 'pending', label: 'Menunggu DO' },
            { id: 'partial', label: 'Sebagian' },
            { id: 'completed', label: 'Selesai' },
            { id: 'cancelled', label: 'Batal' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id as any)}
              className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-colors whitespace-nowrap ${
                statusFilter === tab.id
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Date Filter */}
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-teal-500"
          />
          {dateFilter && (
            <button
              onClick={() => setDateFilter('')}
              className="text-[10px] font-bold text-slate-400 hover:text-slate-600 underline"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
        {filteredOrders.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400 mb-4">
              <ShoppingCartIcon className="h-8 w-8" />
            </div>
            <h3 className="text-base font-black text-slate-700">Belum Ada Sales Order</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
              Buat pesanan pertama dengan menekan tombol "+ Buat Sales Order" untuk memulai alur transaksi.
            </p>
            <button
              onClick={handleAddOrder}
              className="mt-4 px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md transition-all inline-flex items-center gap-2"
            >
              <PlusIcon className="h-4 w-4" />
              Buat Sales Order Baru
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="py-4 px-6">No. SO & Tanggal</th>
                  <th className="py-4 px-4">Customer & Alamat</th>
                  <th className="py-4 px-4">Ringkasan Item</th>
                  <th className="py-4 px-4">Pembayaran</th>
                  <th className="py-4 px-4">Progres Pengiriman</th>
                  <th className="py-4 px-4 text-right">Total Nilai</th>
                  <th className="py-4 px-4 text-center">Status</th>
                  <th className="py-4 px-6 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOrders.map((so) => {
                  const totalDelivered = so.items.reduce((acc, it) => acc + (it.fulfilledQty || 0), 0);
                  const percent = so.totalQty > 0 ? Math.min(100, Math.round((totalDelivered / so.totalQty) * 100)) : 0;
                  const canCreateDO = so.status !== 'completed' && so.status !== 'cancelled';
                  const lockedByUser = lockedSOs[so.id];

                  return (
                    <tr key={so.id} className={`transition-colors ${lockedByUser ? 'bg-amber-50/40' : 'hover:bg-slate-50/60'}`}>
                      {/* No. SO & Date */}
                      <td className="py-4 px-6">
                        <span className="font-black text-slate-900 block text-xs tracking-tight">
                          {so.id}
                        </span>
                        <span className="text-[10px] text-slate-400 font-bold uppercase mt-0.5 block">
                          {new Date(so.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      </td>

                      {/* Customer */}
                      <td className="py-4 px-4">
                        <span className="font-black text-slate-800 text-xs block">
                          {so.customer}
                        </span>
                        {so.customerAddress && (
                          <span className="text-[10px] text-slate-400 truncate max-w-xs block">
                            📍 {so.customerAddress}
                          </span>
                        )}
                      </td>

                      {/* Items */}
                      <td className="py-4 px-4">
                        <div className="space-y-0.5 max-w-xs">
                          {so.items.slice(0, 2).map((it, idx) => (
                            <div key={`${it.name}-${idx}`} className="text-[11px] text-slate-700 flex justify-between gap-2">
                              <span className="font-bold truncate">{it.name}</span>
                              <span className="text-slate-500 shrink-0">{it.quantity} kg</span>
                            </div>
                          ))}
                          {so.items.length > 2 && (
                            <span className="text-[10px] font-bold text-teal-600 block">
                              +{so.items.length - 2} item lainnya...
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Payment */}
                      <td className="py-4 px-4">
                        <span className="px-2.5 py-1 bg-slate-100 rounded-lg text-[10px] font-black text-slate-700 uppercase">
                          {so.paymentMethod}
                        </span>
                      </td>

                      {/* Delivery Progress */}
                      <td className="py-4 px-4 min-w-[140px]">
                        <div className="flex justify-between items-center text-[10px] mb-1 font-bold">
                          <span className="text-slate-500">{totalDelivered} / {so.totalQty} kg</span>
                          <span className="text-teal-700 font-black">{percent}%</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              percent >= 100 ? 'bg-emerald-500' : percent > 0 ? 'bg-blue-500' : 'bg-slate-300'
                            }`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                        {so.deliveryOrderIds && so.deliveryOrderIds.length > 0 && (
                          <span className="text-[9px] text-slate-400 font-bold block mt-1">
                            DO: {so.deliveryOrderIds.join(', ')}
                          </span>
                        )}
                      </td>

                      {/* Total Amount */}
                      <td className="py-4 px-4 text-right">
                        <span className="font-black text-slate-900 text-sm">
                          Rp {so.totalAmount.toLocaleString('id-ID')}
                        </span>
                        <span className="text-[10px] text-slate-400 block font-normal">
                          {so.totalQty} kg
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4 text-center">
                        <div className="flex flex-col items-center gap-1">
                          {getStatusBadge(so.status)}
                          {lockedByUser && (
                            <span className="px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 ring-1 ring-amber-300 animate-pulse">
                              🔒 Diproses: {lockedByUser}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-6 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Create DO Action Button */}
                          {canCreateDO && (
                            lockedByUser ? (
                              <button
                                type="button"
                                disabled
                                title={`Sedang dibuatkan Surat Jalan oleh ${lockedByUser}`}
                                className="px-3 py-1.5 bg-amber-100 text-amber-800 border border-amber-300 rounded-xl text-[10px] font-black uppercase tracking-wider cursor-not-allowed flex items-center gap-1"
                              >
                                🔒 {lockedByUser}
                              </button>
                            ) : (
                              <button
                                onClick={() => onCreateDO(so)}
                                title="Tarik ke Surat Jalan (DO)"
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider shadow-sm flex items-center gap-1 transition-all active:scale-95"
                              >
                                <TruckIcon className="h-3.5 w-3.5" />
                                Buat DO
                              </button>
                            )
                          )}

                          {/* View Detail Button */}
                          <button
                            onClick={() => handleSelectOrder(so)}
                            title="Lihat Detail & Cetak"
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-colors"
                          >
                            <EyeIcon className="h-4 w-4" />
                          </button>

                          {/* Delete Button (if pending or superadmin) */}
                          <button
                            onClick={() => {
                              if (window.confirm(`Hapus Sales Order ${so.id}?`)) {
                                onDeleteOrder(so.id);
                              }
                            }}
                            title="Hapus Order"
                            className="p-1.5 hover:bg-rose-50 text-slate-300 hover:text-rose-600 rounded-xl transition-colors"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};

export default SalesOrderView;
