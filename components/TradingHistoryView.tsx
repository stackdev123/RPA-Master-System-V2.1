
import React, { useState, useMemo } from 'react';
import type { TradingPurchaseRecord } from '../types';
import { HistoryIcon, ShoppingCartIcon, SearchIcon, FilterIcon, TrashIcon, EditIcon } from './icons';

interface TradingHistoryViewProps {
    logs: TradingPurchaseRecord[];
    onBack: () => void;
    userRole: string;
    onEdit?: (log: TradingPurchaseRecord) => void;
    onDelete?: (id: string, date: string, truckNumber?: string) => void;
}

const TradingHistoryView: React.FC<TradingHistoryViewProps> = ({ logs, onBack, userRole, onEdit, onDelete }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [dateRange, setDateRange] = useState({
        start: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().slice(0, 10),
        end: new Date().toISOString().slice(0, 10)
    });

    const isSuperAdmin = userRole?.toLowerCase().trim() === 'superadmin';

    // Filter and sort logs
    const filteredLogs = useMemo(() => {
        return logs
            .filter(log => {
                const logDate = log.tanggal.split('T')[0];
                const matchesDate = logDate >= dateRange.start && logDate <= dateRange.end;
                const matchesSearch = log.item_name.toLowerCase().includes(searchTerm.toLowerCase());
                return matchesDate && matchesSearch;
            })
            .sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime());
    }, [logs, dateRange, searchTerm]);

    return (
        <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/50">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-600 shadow-sm shadow-emerald-100">
                            <ShoppingCartIcon className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-slate-900 tracking-tight uppercase">Riwayat Pembelian Trading</h3>
                            <p className="text-[10px] text-slate-400 font-bold tracking-widest uppercase mt-0.5">Daftar transaksi pembelian barang jadi</p>
                        </div>
                    </div>
                    <button 
                        onClick={onBack}
                        className="w-full md:w-auto px-6 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all active:scale-95 shadow-sm"
                    >
                        Kembali
                    </button>
                </div>

                <div className="mt-6 flex flex-col md:flex-row gap-4 items-end">
                    <div className="flex-1 w-full">
                        <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-4 mb-1 block">Cari Item</label>
                        <div className="relative">
                            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input 
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Cari nama item..."
                                className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-[11px] font-bold focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all"
                            />
                        </div>
                    </div>
                    <div className="w-full md:w-auto">
                        <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-4 mb-1 block">Dari Tanggal</label>
                        <input 
                            type="date"
                            value={dateRange.start}
                            onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                            className="w-full px-4 py-2 bg-white border border-slate-200 rounded-2xl text-[11px] font-bold outline-none focus:ring-4 focus:ring-emerald-500/10 transition-all"
                        />
                    </div>
                    <div className="w-full md:w-auto">
                        <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-4 mb-1 block">Sampai Tanggal</label>
                        <input 
                            type="date"
                            value={dateRange.end}
                            onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                            className="w-full px-4 py-2 bg-white border border-slate-200 rounded-2xl text-[11px] font-bold outline-none focus:ring-4 focus:ring-emerald-500/10 transition-all"
                        />
                    </div>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-100">
                    <thead className="bg-slate-50/30">
                        <tr>
                            <th className="px-8 py-4 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">Tanggal</th>
                            <th className="px-8 py-4 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">Item</th>
                            <th className="px-8 py-4 text-right text-[9px] font-black text-slate-400 uppercase tracking-widest">Berat (Kg)</th>
                            <th className="px-8 py-4 text-right text-[9px] font-black text-slate-400 uppercase tracking-widest">Harga / Kg</th>
                            <th className="px-8 py-4 text-right text-[9px] font-black text-slate-400 uppercase tracking-widest">Total</th>
                            {isSuperAdmin && <th className="px-8 py-4 text-right text-[9px] font-black text-slate-400 uppercase tracking-widest">Aksi</th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {filteredLogs.length === 0 ? (
                            <tr>
                                <td colSpan={isSuperAdmin ? 6 : 5} className="px-8 py-12 text-center text-slate-400 font-bold uppercase text-[10px] tracking-widest">
                                    Tidak ada data pembelian trading ditemukan
                                </td>
                            </tr>
                        ) : (
                            filteredLogs.map((log) => (
                                <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-8 py-4 whitespace-nowrap">
                                        <div className="text-[11px] font-black text-slate-700">{new Date(log.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                                        <div className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">{new Date(log.timestamp || log.tanggal).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</div>
                                    </td>
                                    <td className="px-8 py-4 whitespace-nowrap">
                                        <span className="text-[11px] font-black text-slate-900 uppercase">{log.item_name}</span>
                                    </td>
                                    <td className="px-8 py-4 text-right whitespace-nowrap">
                                        <span className="text-[11px] font-black text-emerald-600 font-mono tracking-tighter">{log.kg.toLocaleString('id-ID', { minimumFractionDigits: 1 })} Kg</span>
                                    </td>
                                    <td className="px-8 py-4 text-right whitespace-nowrap">
                                        <span className="text-[11px] font-bold text-slate-500 font-mono tracking-tighter">Rp {log.harga_per_kg.toLocaleString('id-ID')}</span>
                                    </td>
                                    <td className="px-8 py-4 text-right whitespace-nowrap">
                                        <span className="text-[11px] font-black text-slate-900 font-mono tracking-tighter">Rp {(log.kg * log.harga_per_kg).toLocaleString('id-ID')}</span>
                                    </td>
                                    {isSuperAdmin && (
                                        <td className="px-8 py-4 text-right whitespace-nowrap">
                                            <div className="flex justify-end gap-2">
                                                {onEdit && <button onClick={() => onEdit(log)} className="w-8 h-8 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center hover:bg-orange-100 transition-colors"><EditIcon className="w-4 h-4" /></button>}
                                                {onDelete && <button onClick={() => onDelete(log.id, log.tanggal)} className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center hover:bg-rose-100 transition-colors"><TrashIcon className="w-4 h-4" /></button>}
                                            </div>
                                        </td>
                                    )}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default TradingHistoryView;
