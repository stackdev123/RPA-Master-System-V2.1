import React, { useState, useMemo } from 'react';
import type { ProductionRecord, DeliveryOrder, TradingPurchaseRecord, StockDisposalRecord, MasterItem, StockLog } from '../types';
import { sortChickenParts } from '../constants';

interface DailyRecapReportProps {
    productionHistory: ProductionRecord[];
    deliveryOrders: DeliveryOrder[];
    tradingPurchases: TradingPurchaseRecord[];
    stockDisposals: StockDisposalRecord[];
    masterItems: MasterItem[];
    stockLogs: StockLog[];
}

const DailyRecapReport: React.FC<DailyRecapReportProps> = ({
    productionHistory,
    deliveryOrders,
    tradingPurchases,
    stockDisposals,
    masterItems,
    stockLogs
}) => {
    const [filterType, setFilterType] = useState<'date' | 'range'>('date');
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
    const [dateRange, setDateRange] = useState({
        start: new Date().toISOString().slice(0, 10),
        end: new Date().toISOString().slice(0, 10),
    });
    const [hasSearched, setHasSearched] = useState(false);

    const handleSearch = () => {
        setHasSearched(true);
    };

    const reportData = useMemo(() => {
        if (!hasSearched) return [];

        let start: Date;
        let end: Date;

        if (filterType === 'date') {
            start = new Date(`${selectedDate}T00:00:00Z`);
            end = new Date(`${selectedDate}T23:59:59Z`);
        } else {
            start = new Date(`${dateRange.start}T00:00:00Z`);
            end = new Date(`${dateRange.end}T23:59:59Z`);
        }

        // We want to group by Date, then by Item
        const datesMap = new Map<string, Map<string, {
            stokAwal: number;
            produksi: number;
            pengiriman: number;
            retur: number;
            pemusnahan: number;
            trading: number;
            opname: number;
            stokAkhir: number;
            _firstLogTs: number;
            _lastLogTs: number;
        }>>();

        // Pre-initialize the map so the selected date/range always shows up with all items
        const initialGroupKey = filterType === 'range' ? `Periode: ${dateRange.start} s/d ${dateRange.end}` : selectedDate;
        const initialItemsMap = new Map();
        masterItems.forEach(mi => {
            initialItemsMap.set(mi.name.trim().toUpperCase(), {
                stokAwal: 0, produksi: 0, pengiriman: 0, retur: 0, pemusnahan: 0, trading: 0, opname: 0, stokAkhir: 0, _firstLogTs: 0, _lastLogTs: 0
            });
        });
        datesMap.set(initialGroupKey, initialItemsMap);

        const getOrCreateDateItem = (dateStr: string, itemName: string) => {
            const groupKey = filterType === 'range' ? `Periode: ${dateRange.start} s/d ${dateRange.end}` : dateStr;
            if (!datesMap.has(groupKey)) {
                const newItemsMap = new Map();
                masterItems.forEach(mi => {
                    newItemsMap.set(mi.name.trim().toUpperCase(), {
                        stokAwal: 0, produksi: 0, pengiriman: 0, retur: 0, pemusnahan: 0, trading: 0, opname: 0, stokAkhir: 0, _firstLogTs: 0, _lastLogTs: 0
                    });
                });
                datesMap.set(groupKey, newItemsMap);
            }
            const itemsMap = datesMap.get(groupKey)!;
            const normName = itemName.trim().toUpperCase();
            if (!itemsMap.has(normName)) {
                itemsMap.set(normName, { 
                    stokAwal: 0,
                    produksi: 0, 
                    pengiriman: 0, 
                    retur: 0, 
                    pemusnahan: 0, 
                    trading: 0,
                    opname: 0,
                    stokAkhir: 0,
                    _firstLogTs: 0,
                    _lastLogTs: 0
                });
            }
            return itemsMap.get(normName)!;
        };

        // Filter and aggregate Production
        productionHistory.forEach(prod => {
            const d = new Date(prod.date);
            if (d >= start && d <= end && prod.isApplied) {
                const dateStr = d.toISOString().slice(0, 10);
                Object.entries(prod.items).forEach(([itemName, qty]) => {
                    const data = getOrCreateDateItem(dateStr, itemName);
                    data.produksi += Number(qty) || 0;
                });
            }
        });

        // Filter and aggregate Delivery Orders (Pengiriman & Retur)
        deliveryOrders.forEach(do_ => {
            const d = new Date(do_.date);
            if (d >= start && d <= end) {
                const dateStr = d.toISOString().slice(0, 10);
                
                // Pengiriman (qty_kirim)
                do_.items.forEach(item => {
                    const data = getOrCreateDateItem(dateStr, item.name);
                    data.pengiriman += Number(item.quantity) || 0;
                });

                // Retur (rejectedItems)
                if (do_.rejectedItems) {
                    do_.rejectedItems.forEach(item => {
                        const data = getOrCreateDateItem(dateStr, item.name);
                        data.retur += Number(item.quantity) || 0;
                    });
                }
            }
        });

        // Filter and aggregate Trading Purchases
        tradingPurchases.forEach(tp => {
            const d = new Date(tp.tanggal);
            if (d >= start && d <= end) {
                const dateStr = d.toISOString().slice(0, 10);
                const data = getOrCreateDateItem(dateStr, tp.item_name);
                data.trading += Number(tp.kg) || 0;
            }
        });

        // Filter and aggregate Stock Disposals (Pemusnahan)
        stockDisposals.forEach(sd => {
            const d = new Date(sd.tanggal);
            if (d >= start && d <= end) {
                const dateStr = d.toISOString().slice(0, 10);
                const data = getOrCreateDateItem(dateStr, sd.item_name);
                data.pemusnahan += Number(sd.kg) || 0;
            }
        });

        // Filter and aggregate Stock Logs for Awal, Akhir, and Opname
        stockLogs.forEach(log => {
            const d = new Date(log.timestamp);
            if (d >= start && d <= end) {
                const dateStr = d.toISOString().slice(0, 10);
                const data = getOrCreateDateItem(dateStr, log.itemName);
                const ts = d.getTime();
                
                if (!data._firstLogTs || ts < data._firstLogTs) {
                    data._firstLogTs = ts;
                    data.stokAwal = Number(log.stockBefore) || 0;
                }
                if (!data._lastLogTs || ts >= data._lastLogTs) {
                    data._lastLogTs = ts;
                    data.stokAkhir = Number(log.stockAfter) || 0;
                }
                
                if (log.type === 'Opname') {
                    data.opname += Number(log.change) || 0;
                }
            }
        });

        // Convert to array and sort
        const result: { date: string; items: { name: string; metrics: any }[] }[] = [];
        
        const sortedDates = Array.from(datesMap.keys()).sort();
        sortedDates.forEach(dateStr => {
            const itemsMap = datesMap.get(dateStr)!;
            const itemsArr = Array.from(itemsMap.entries()).map(([name, metrics]) => ({ name, metrics }));
            itemsArr.sort((a, b) => sortChickenParts(a.name, b.name));
            result.push({ date: dateStr, items: itemsArr });
        });

        return result;
    }, [hasSearched, filterType, selectedDate, dateRange, productionHistory, deliveryOrders, tradingPurchases, stockDisposals, stockLogs]);

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 md:p-10 rounded-[2.5rem] border border-slate-100 shadow-sm">
                <div className="flex flex-col xl:flex-row xl:justify-between xl:items-end mb-10 gap-8">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-2 h-8 bg-indigo-600 rounded-full"></div>
                            <h2 className="text-3xl font-black text-slate-800 tracking-tighter uppercase">REKAP HARIAN</h2>
                        </div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-5">Detail Pergerakan per Item per Hari</p>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-3 bg-slate-50 p-3 rounded-[2rem] border border-slate-100 shadow-inner">
                        <div className="flex flex-col px-4 border-r border-slate-200">
                            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Tipe Filter</label>
                            <select 
                                value={filterType} 
                                onChange={(e) => { setFilterType(e.target.value as any); setHasSearched(false); }}
                                className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer"
                            >
                                <option value="date">Harian</option>
                                <option value="range">Rentang Tanggal</option>
                            </select>
                        </div>
                        
                        {filterType === 'date' && (
                            <div className="flex flex-col px-4">
                                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Pilih Tanggal</label>
                                <input 
                                    type="date" 
                                    value={selectedDate} 
                                    onChange={(e) => { setSelectedDate(e.target.value); setHasSearched(false); }}
                                    className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer"
                                />
                            </div>
                        )}
                        
                        {filterType === 'range' && (
                            <>
                                <div className="flex flex-col px-4 border-r border-slate-200">
                                    <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Dari</label>
                                    <input 
                                        type="date" 
                                        value={dateRange.start} 
                                        onChange={(e) => { setDateRange(prev => ({ ...prev, start: e.target.value })); setHasSearched(false); }}
                                        className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer"
                                    />
                                </div>
                                <div className="flex flex-col px-4">
                                    <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Sampai</label>
                                    <input 
                                        type="date" 
                                        value={dateRange.end} 
                                        onChange={(e) => { setDateRange(prev => ({ ...prev, end: e.target.value })); setHasSearched(false); }}
                                        className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer"
                                    />
                                </div>
                            </>
                        )}

                        <button 
                            onClick={handleSearch}
                            className="ml-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-md"
                        >
                            Search
                        </button>
                    </div>
                </div>

                {!hasSearched ? (
                    <div className="py-20 text-center border-2 border-dashed border-slate-200 rounded-3xl">
                        <p className="text-slate-400 font-bold text-sm">Silakan pilih tanggal dan klik Search untuk melihat data.</p>
                    </div>
                ) : reportData.length === 0 ? (
                    <div className="py-20 text-center border-2 border-dashed border-slate-200 rounded-3xl">
                        <p className="text-slate-400 font-bold text-sm">Tidak ada data untuk periode yang dipilih.</p>
                    </div>
                ) : (
                    <div className="space-y-10">
                        {reportData.map((dayData) => (
                            <div key={dayData.date} className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
                                <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
                                    <h3 className="text-lg font-black text-slate-800">
                                        {filterType === 'range' ? dayData.date : new Date(dayData.date).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                    </h3>
                                </div>
                                <div className="overflow-x-auto no-scrollbar">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-white border-b border-slate-100">
                                                <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Item</th>
                                                <th className="p-4 text-[10px] font-black text-black uppercase tracking-widest text-right whitespace-nowrap">Awal</th>
                                                <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right whitespace-nowrap">Produksi</th>
                                                <th className="p-4 text-[10px] font-black text-emerald-600 uppercase tracking-widest text-right whitespace-nowrap">Trading</th>
                                                <th className="p-4 text-[10px] font-black text-rose-600 uppercase tracking-widest text-right whitespace-nowrap">Kirim</th>
                                                <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right whitespace-nowrap">Retur</th>
                                                <th className="p-4 text-[10px] font-black text-orange-600 uppercase tracking-widest text-right whitespace-nowrap">Musnah</th>
                                                <th className="p-4 text-[10px] font-black text-amber-600 uppercase tracking-widest text-right whitespace-nowrap">Adj</th>
                                                <th className="p-4 text-[10px] font-black text-slate-900 uppercase tracking-widest text-right whitespace-nowrap">Akhir</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {dayData.items.map((item, idx) => (
                                                <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                                    <td className="p-4 text-xs font-bold text-slate-700 whitespace-nowrap">{item.name}</td>
                                                    <td className="p-4 text-xs font-mono font-bold text-black text-right">{item.metrics.stokAwal.toLocaleString('id-ID', { minimumFractionDigits: 1 })}</td>
                                                    <td className="p-4 text-xs font-mono font-medium text-slate-600 text-right">{item.metrics.produksi > 0 ? item.metrics.produksi.toFixed(1) : '-'}</td>
                                                    <td className="p-4 text-xs font-mono font-medium text-emerald-600 text-right">{item.metrics.trading > 0 ? item.metrics.trading.toFixed(1) : '-'}</td>
                                                    <td className="p-4 text-xs font-mono font-medium text-rose-600 text-right">{item.metrics.pengiriman > 0 ? item.metrics.pengiriman.toFixed(1) : '-'}</td>
                                                    <td className="p-4 text-xs font-mono font-medium text-slate-600 text-right">{item.metrics.retur > 0 ? item.metrics.retur.toFixed(1) : '-'}</td>
                                                    <td className="p-4 text-xs font-mono font-medium text-orange-600 text-right">{item.metrics.pemusnahan > 0 ? item.metrics.pemusnahan.toFixed(1) : '-'}</td>
                                                    <td className="p-4 text-xs font-mono font-bold text-amber-600 text-right">{item.metrics.opname !== 0 ? (item.metrics.opname > 0 ? `+${item.metrics.opname.toFixed(1)}` : item.metrics.opname.toFixed(1)) : '-'}</td>
                                                    <td className="p-4 text-xs font-mono font-black text-slate-900 text-right bg-slate-50/30">{item.metrics.stokAkhir.toLocaleString('id-ID', { minimumFractionDigits: 1 })}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot className="bg-slate-50 border-t border-slate-200">
                                            <tr>
                                                <td className="p-4 text-xs font-black text-slate-800 uppercase">Total</td>
                                                <td className="p-4 text-xs font-mono font-black text-black text-right">{dayData.items.reduce((sum, item) => sum + item.metrics.stokAwal, 0).toLocaleString('id-ID', { minimumFractionDigits: 1 })}</td>
                                                <td className="p-4 text-xs font-mono font-black text-indigo-600 text-right">{dayData.items.reduce((sum, item) => sum + item.metrics.produksi, 0).toFixed(1)}</td>
                                                <td className="p-4 text-xs font-mono font-black text-emerald-600 text-right">{dayData.items.reduce((sum, item) => sum + item.metrics.trading, 0).toFixed(1)}</td>
                                                <td className="p-4 text-xs font-mono font-black text-rose-600 text-right">{dayData.items.reduce((sum, item) => sum + item.metrics.pengiriman, 0).toFixed(1)}</td>
                                                <td className="p-4 text-xs font-mono font-black text-indigo-600 text-right">{dayData.items.reduce((sum, item) => sum + item.metrics.retur, 0).toFixed(1)}</td>
                                                <td className="p-4 text-xs font-mono font-black text-orange-600 text-right">{dayData.items.reduce((sum, item) => sum + item.metrics.pemusnahan, 0).toFixed(1)}</td>
                                                <td className="p-4 text-xs font-mono font-black text-amber-600 text-right">{dayData.items.reduce((sum, item) => sum + item.metrics.opname, 0).toFixed(1)}</td>
                                                <td className="p-4 text-xs font-mono font-black text-slate-900 text-right">{dayData.items.reduce((sum, item) => sum + item.metrics.stokAkhir, 0).toLocaleString('id-ID', { minimumFractionDigits: 1 })}</td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default DailyRecapReport;
