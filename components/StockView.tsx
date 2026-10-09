
import React, { useMemo } from 'react';
import type { StockItem, StockLog } from '../types';
import { PlusIcon, HistoryIcon, ShoppingCartIcon, FireIcon } from './icons';
import { sortChickenParts } from '../constants';

interface StockViewProps {
    stock: StockItem[];
    stockLogs: StockLog[];
    onStartAllocation: () => void;
    onStartOpname: () => void;
    onViewHistory: () => void;
    onViewTradingHistory: () => void;
    onViewDisposalHistory: () => void;
    onStartTradingPurchase: () => void;
    onStartDisposal: () => void;
    canAllocate?: boolean;
    canOpname?: boolean;
    canTrade?: boolean;
    canDisposal?: boolean;
    canViewHistory?: boolean;
}

const StockView: React.FC<StockViewProps> = ({ 
    stock, 
    stockLogs, 
    onStartAllocation, 
    onStartOpname, 
    onViewHistory, 
    onViewTradingHistory,
    onViewDisposalHistory,
    onStartTradingPurchase, 
    onStartDisposal,
    canAllocate = true,
    canOpname = true,
    canTrade = true,
    canDisposal = true,
    canViewHistory = true
}) => {
    
    // Calculate metrics for TODAY
    const dailyMetrics = useMemo(() => {
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        
        const metricsMap = new Map<string, {
            awal: number;
            in: number;
            out: number;
            adj: number;
        }>();

        // Group today's logs
        stockLogs.forEach(log => {
            const logDate = new Date(log.timestamp);
            if (logDate >= startOfToday) {
                const name = log.itemName.trim().toUpperCase();
                if (!metricsMap.has(name)) {
                    metricsMap.set(name, { awal: 0, in: 0, out: 0, adj: 0 });
                }
                const m = metricsMap.get(name)!;
                const change = Number(log.change) || 0;

                if (log.type === 'Produksi' || log.type === 'Pembelian' || (log.type === 'Alokasi' && change > 0)) {
                    m.in += Math.abs(change);
                } else if (log.type === 'Pemusnahan' || (log.type === 'Alokasi' && change < 0)) {
                    m.out += Math.abs(change);
                } else if (log.type === 'Opname') {
                    m.adj += change;
                } else {
                    // Other types as adjustment
                    m.adj += change;
                }
            }
        });

        return metricsMap;
    }, [stockLogs]);

    const totalQty = stock.reduce((sum, item) => sum + item.quantity, 0);
    const lowStockCount = stock.filter(i => i.quantity > 0 && i.quantity < 20).length;

    const todayStr = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' });

    return (
        <div className="space-y-4 md:space-y-6">
            {/* Stats Cards - Adaptive Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
                <div className="bg-indigo-600 p-5 md:p-6 rounded-2xl md:rounded-[2rem] border border-indigo-400 shadow-lg shadow-indigo-100 relative overflow-hidden">
                    <p className="text-[7px] md:text-[8px] font-black text-indigo-200 uppercase tracking-widest mb-1">Total Stok Gudang</p>
                    <div className="flex items-baseline gap-1.5">
                        <p className="text-2xl md:text-3xl font-black text-white tracking-tight">{totalQty.toLocaleString('id-ID', { maximumFractionDigits: 1 })}</p>
                        <span className="text-[8px] md:text-[10px] font-bold text-indigo-200 uppercase">Kg</span>
                    </div>
                </div>

                <div className="bg-white p-5 md:p-6 rounded-2xl md:rounded-[2rem] border border-slate-200 shadow-sm flex flex-col justify-center">
                    <p className="text-[7px] md:text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Alert Stok Menipis</p>
                    <div className="flex items-center gap-2.5 md:gap-3">
                        <p className="text-2xl md:text-3xl font-black text-orange-500 tracking-tight">{lowStockCount}</p>
                        <span className="text-[7px] md:text-[8px] font-black text-slate-500 uppercase tracking-widest bg-slate-100 px-2.5 py-1 rounded-full border border-slate-50">Perlu Restok</span>
                    </div>
                </div>

                {canOpname ? (
                    <div className="bg-slate-900 p-2 md:p-2.5 rounded-2xl md:rounded-[2rem] flex flex-row md:flex-col justify-center gap-2">
                        <button onClick={onStartOpname} className="flex-1 md:w-full py-3 md:py-3.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl md:rounded-2xl font-black text-[8px] md:text-[9px] uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-95">
                            Opname Stok
                        </button>
                    </div>
                ) : (
                    <div className="bg-slate-50 p-5 md:p-6 rounded-2xl md:rounded-[2rem] border border-slate-200 shadow-sm flex flex-col justify-center items-center text-center">
                        <span className="text-xl">👁️</span>
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">Mode Lihat Saja</p>
                        <p className="text-[10px] text-slate-500 font-bold mt-0.5">Hanya Memantau Stok</p>
                    </div>
                )}
            </div>

            {/* Table Area - Full Desktop Layout */}
            <div className="bg-white rounded-2xl md:rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-4 py-4 md:px-6 md:py-5 border-b border-slate-100 flex items-center justify-between">
                    <div>
                        <h3 className="text-xs md:text-sm font-black text-slate-900 tracking-tight uppercase">Inventaris Real-Time</h3>
                        <p className="text-[7px] md:text-[8px] text-slate-400 font-bold tracking-widest uppercase mt-0.5">Hari ini: {todayStr}</p>
                    </div>
                    <div className="flex gap-1 md:gap-1.5 bg-slate-50 p-1 rounded-lg md:rounded-xl">
                        {canTrade && (
                            <>
                                <button onClick={onStartTradingPurchase} title="Beli Trading" className="p-1.5 md:p-2 bg-white text-emerald-600 rounded-md md:rounded-lg hover:shadow-sm transition-all"><ShoppingCartIcon className="h-3.5 w-3.5 md:h-5 md:w-5" /></button>
                                <button onClick={onViewTradingHistory} title="Riwayat Beli Trading" className="p-1.5 md:p-2 bg-emerald-50 text-emerald-600 rounded-md md:rounded-lg hover:shadow-sm transition-all"><HistoryIcon className="h-3.5 w-3.5 md:h-5 md:w-5" /></button>
                                {(canDisposal || canViewHistory) && <div className="w-px h-5 bg-slate-200 self-center mx-0.5" />}
                            </>
                        )}
                        {canDisposal && (
                            <>
                                <button onClick={onStartDisposal} title="Musnahkan Stok" className="p-1.5 md:p-2 bg-white text-rose-600 rounded-md md:rounded-lg hover:shadow-sm transition-all"><FireIcon className="h-3.5 w-3.5 md:h-5 md:w-5" /></button>
                                <button onClick={onViewDisposalHistory} title="Riwayat Pemusnahan" className="p-1.5 md:p-2 bg-rose-50 text-rose-600 rounded-md md:rounded-lg hover:shadow-sm transition-all"><HistoryIcon className="h-3.5 w-3.5 md:h-5 md:w-5" /></button>
                                {canViewHistory && <div className="w-px h-5 bg-slate-200 self-center mx-0.5" />}
                            </>
                        )}
                        {canViewHistory && (
                            <button onClick={onViewHistory} title="Log Mutasi Stok" className="p-1.5 md:p-2 bg-white text-indigo-600 rounded-md md:rounded-lg hover:shadow-sm transition-all"><HistoryIcon className="h-3.5 w-3.5 md:h-5 md:w-5" /></button>
                        )}
                    </div>
                </div>
                
                <div className="overflow-x-auto no-scrollbar">
                    <table className="min-w-full">
                        <thead className="bg-slate-50 border-b border-slate-100">
                            <tr>
                                <th className="px-4 py-2.5 md:px-6 md:py-3 text-left text-[7px] md:text-[8px] font-black text-slate-400 uppercase tracking-widest">Produk</th>
                                <th className="px-4 py-2.5 md:px-6 md:py-3 text-right text-[7px] md:text-[8px] font-black text-black uppercase tracking-widest">Stok Awal</th>
                                <th className="px-4 py-2.5 md:px-6 md:py-3 text-right text-[7px] md:text-[8px] font-black text-emerald-600 uppercase tracking-widest">In</th>
                                <th className="px-4 py-2.5 md:px-6 md:py-3 text-right text-[7px] md:text-[8px] font-black text-rose-600 uppercase tracking-widest">Out</th>
                                <th className="px-4 py-2.5 md:px-6 md:py-3 text-right text-[7px] md:text-[8px] font-black text-amber-600 uppercase tracking-widest text-center">Adj</th>
                                <th className="px-4 py-2.5 md:px-6 md:py-3 text-right text-[7px] md:text-[8px] font-black text-slate-900 uppercase tracking-widest">Sisa Real</th>
                                <th className="px-4 py-2.5 md:px-6 md:py-3 text-center text-[7px] md:text-[8px] font-black text-black uppercase tracking-widest hidden sm:table-cell">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {[...stock].sort((a, b) => sortChickenParts(a.name, b.name)).map((item) => {
                                const normName = item.name.trim().toUpperCase();
                                const metrics = dailyMetrics.get(normName) || { awal: 0, in: 0, out: 0, adj: 0 };
                                // beginning stock = current - changes today
                                const totalTodayChange = metrics.in - metrics.out + metrics.adj;
                                const beginningStock = Math.max(0, item.quantity - totalTodayChange);

                                return (
                                    <tr key={item.name} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-4 py-2.5 md:px-6 md:py-3.5 text-[10px] md:text-[11px] font-black text-slate-700 uppercase whitespace-nowrap">{item.name}</td>
                                        
                                        <td className="px-4 py-2.5 md:px-6 md:py-3.5 text-right text-[10px] md:text-xs font-bold text-black font-mono">
                                            {beginningStock > 0 ? beginningStock.toLocaleString('id-ID', { minimumFractionDigits: 1 }) : '-'}
                                        </td>

                                        <td className="px-4 py-2.5 md:px-6 md:py-3.5 text-right text-[10px] md:text-xs font-black text-emerald-600 font-mono">
                                            {metrics.in > 0 ? `+${metrics.in.toLocaleString('id-ID', { minimumFractionDigits: 1 })}` : '-'}
                                        </td>

                                        <td className="px-4 py-2.5 md:px-6 md:py-3.5 text-right text-[10px] md:text-xs font-black text-rose-600 font-mono">
                                            {metrics.out > 0 ? `-${metrics.out.toLocaleString('id-ID', { minimumFractionDigits: 1 })}` : '-'}
                                        </td>

                                        <td className="px-4 py-2.5 md:px-6 md:py-3.5 text-right text-[10px] md:text-xs font-black text-amber-500 font-mono text-center">
                                            {metrics.adj !== 0 ? (metrics.adj > 0 ? `+${metrics.adj.toLocaleString('id-ID', { minimumFractionDigits: 1 })}` : metrics.adj.toLocaleString('id-ID', { minimumFractionDigits: 1 })) : '-'}
                                        </td>

                                        <td className="px-4 py-2.5 md:px-6 md:py-3.5 text-right text-xs md:text-sm font-black text-slate-900 font-mono tracking-tighter bg-slate-50/30">
                                            {item.quantity.toLocaleString('id-ID', { minimumFractionDigits: 1 })}
                                        </td>

                                        <td className="px-4 py-2.5 md:px-6 md:py-3.5 text-center hidden sm:table-cell">
                                            {item.quantity > 50 ? (
                                                <span className="px-2 md:px-3 py-0.5 md:py-1 rounded-full bg-emerald-50 text-emerald-600 text-[6px] md:text-[8px] font-black uppercase tracking-widest border border-emerald-100">Optimal</span>
                                            ) : item.quantity > 0 ? (
                                                <span className="px-2 md:px-3 py-0.5 md:py-1 rounded-full bg-amber-50 text-amber-600 text-[6px] md:text-[8px] font-black uppercase tracking-widest border border-amber-100">Kritis</span>
                                            ) : (
                                                <span className="px-2 md:px-3 py-0.5 md:py-1 rounded-full bg-rose-50 text-rose-600 text-[6px] md:text-[8px] font-black uppercase tracking-widest border border-rose-100">Kosong</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Info Legend for Mobile */}
            <div className="p-4 bg-slate-900 rounded-2xl flex flex-wrap gap-4 justify-between items-center sm:hidden">
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Legenda:</p>
                <div className="flex gap-4">
                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 bg-emerald-500 rounded-full" /><span className="text-[7px] font-bold text-white uppercase">In</span></div>
                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 bg-rose-500 rounded-full" /><span className="text-[7px] font-bold text-white uppercase">Out</span></div>
                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 bg-amber-500 rounded-full" /><span className="text-[7px] font-bold text-white uppercase">Adj</span></div>
                </div>
            </div>
        </div>
    );
};

export default StockView;
