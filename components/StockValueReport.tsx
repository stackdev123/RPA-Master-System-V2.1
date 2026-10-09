import React, { useMemo } from 'react';
import type { StockLog, Invoice, MasterItem, StockItem, DeliveryOrder } from '../types';
import { INITIAL_VALUATION_OCT_18, CHICKEN_PARTS, sortChickenParts } from '../constants';
import { calculateStockValuation } from '../valuationService';

interface StockValueReportProps {
    stockLogs: StockLog[];
    invoices: Invoice[];
    masterItems: MasterItem[];
    stock: StockItem[];
    productionHistory: any[];
    deliveryOrders: DeliveryOrder[];
    onInputEarlyStock?: (date: string, value: number) => Promise<void>;
}

const StockValueReport: React.FC<StockValueReportProps> = ({ 
    invoices = [], 
    stock = [],
    stockLogs = [],
    masterItems = [],
    onInputEarlyStock
}) => {
    const [selectedDate, setSelectedDate] = React.useState<string>(new Date().toISOString().slice(0, 10));
    const [isSaving, setIsSaving] = React.useState(false);

    // Kalkulasi Harga Rata-rata dan Stok sesuai tanggal filter
    const reportData = useMemo(() => {
        const filterDate = new Date(selectedDate);
        filterDate.setHours(23, 59, 59, 999); // End of the selected day

        const filterMonth = filterDate.getMonth();
        const filterYear = filterDate.getFullYear();

        // 1. Calculate Average Price for the filtered month
        const priceAggregator: { [key: string]: { sumPrices: number, count: number } } = {};
        invoices.forEach(inv => {
            if (!inv.date) return;
            const invDate = new Date(inv.date);
            if (invDate.getMonth() === filterMonth && invDate.getFullYear() === filterYear) {
                inv.items?.forEach(item => {
                    if (!item.name) return;
                    const normName = item.name.trim().toUpperCase();
                    const price = Number(item.price) || 0;
                    if (price > 0) {
                        if (!priceAggregator[normName]) priceAggregator[normName] = { sumPrices: 0, count: 0 };
                        priceAggregator[normName].sumPrices += price;
                        priceAggregator[normName].count += 1;
                    }
                });
            }
        });

        const filterMonthAvgPrices: { [key: string]: number } = {};
        masterItems.forEach(item => {
            const normName = item.name.trim().toUpperCase();
            const data = priceAggregator[normName];
            filterMonthAvgPrices[normName] = (data && data.count > 0) ? data.sumPrices / data.count : 22000;
        });

        // 2. Calculate Stock at the filtered date
        const isToday = new Date(selectedDate).toDateString() === new Date().toDateString();
        const historicalStockMap = new Map<string, number>();

        masterItems.forEach(item => {
            const normName = item.name.trim().toUpperCase();
            
            if (isToday) {
                // For today, use actual current stock
                const liveItem = stock.find(s => s.name.trim().toUpperCase() === normName);
                historicalStockMap.set(normName, liveItem ? liveItem.quantity : 0);
            } else {
                // For past dates, find the last log entry
                const itemLogs = stockLogs
                    .filter(log => log.itemName && log.itemName.trim().toUpperCase() === normName && new Date(log.timestamp) <= filterDate)
                    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
                
                if (itemLogs.length > 0) {
                    historicalStockMap.set(normName, itemLogs[0].stockAfter);
                } else {
                    historicalStockMap.set(normName, 0);
                }
            }
        });

        let totalEndValue = 0;
        const rows = masterItems.map(item => {
            const normName = item.name.trim().toUpperCase();
            const historicalQty = historicalStockMap.get(normName) || 0;
            const avgPrice = filterMonthAvgPrices[normName] || 22000;
            const endingValue = historicalQty * avgPrice;
            totalEndValue += endingValue;

            return {
                name: item.name,
                endingStock: historicalQty,
                avgPrice,
                endingValue
            };
        }).sort((a, b) => sortChickenParts(a.name, b.name));

        return {
            rows,
            totalEndValue
        };

    }, [invoices, stock, stockLogs, selectedDate, masterItems]);

    const formattedFilterDate = new Date(selectedDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    const formattedFilterMonth = new Date(selectedDate).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow-md">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 flex-wrap gap-4">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800">Laporan Nilai Stok (Valuasi Inventaris)</h2>
                        <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mt-1">
                            Metode: Simple Average ({formattedFilterMonth})
                        </p>
                    </div>
                    <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-2xl border border-slate-100">
                        {onInputEarlyStock && (
                            <button
                                disabled={isSaving}
                                onClick={async () => {
                                    setIsSaving(true);
                                    try {
                                        await onInputEarlyStock(selectedDate, reportData.totalEndValue);
                                    } finally {
                                        setIsSaving(false);
                                    }
                                }}
                                className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-sm active:scale-95 disabled:opacity-50"
                            >
                                {isSaving ? 'Menyimpan...' : 'Simpan sebagai Saldo Awal'}
                            </button>
                        )}
                        <span className="text-[10px] font-black text-slate-400 uppercase ml-2">Filter Tanggal:</span>
                        <input 
                            type="date" 
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="bg-white border-none rounded-xl px-4 py-2 text-xs font-black text-slate-700 focus:ring-2 focus:ring-indigo-500 shadow-sm"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    <div className="bg-slate-900 p-6 rounded-3xl text-white shadow-lg shadow-slate-100">
                        <h3 className="text-[10px] font-black uppercase tracking-widest opacity-60">Valuasi Saldo Awal</h3>
                        <p className="mt-2 text-xl md:text-3xl font-black">
                            {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(INITIAL_VALUATION_OCT_18)}
                        </p>
                    </div>
                    <div className="bg-emerald-600 p-6 rounded-3xl text-white shadow-lg shadow-emerald-100">
                        <h3 className="text-[10px] font-black uppercase tracking-widest opacity-60">Valuasi Stok Tersedia ({formattedFilterDate})</h3>
                        <p className="mt-2 text-xl md:text-3xl font-black">
                            {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(reportData.totalEndValue)}
                        </p>
                    </div>
                </div>

                <div className="overflow-x-auto no-scrollbar border border-slate-100 rounded-2xl shadow-inner">
                    <table className="min-w-full divide-y divide-slate-100 text-[11px] sm:text-[13px]">
                        <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                            <tr className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                <th className="px-5 py-4 text-left sticky left-0 bg-slate-50">Item</th>
                                <th className="px-5 py-4 text-right">QTY Stok (Kg)</th>
                                <th className="px-5 py-4 text-right">Avg Harga (Rp/Kg)</th>
                                <th className="px-5 py-4 text-right font-black text-emerald-700 bg-emerald-50/30">Total Valuasi</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-50 font-bold">
                            {reportData.rows.map(row => (
                                <tr key={row.name} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-5 py-3 text-slate-700 uppercase font-black sticky left-0 bg-white border-r border-slate-50">{row.name}</td>
                                    <td className="px-5 py-3 text-right font-black text-slate-900 font-mono">
                                        {row.endingStock.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                                    </td>
                                    <td className="px-5 py-3 text-right text-indigo-400 font-mono text-[10px] italic">
                                        {new Intl.NumberFormat('id-ID').format(row.avgPrice)}
                                    </td>
                                    <td className="px-5 py-3 text-right font-black text-emerald-600 bg-emerald-50/10 font-mono">
                                        {new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(row.endingValue)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl flex items-center gap-3">
                <div className="w-1.5 h-10 bg-blue-400 rounded-full" />
                <p className="text-[10px] text-blue-700 font-bold uppercase tracking-wide">
                    INFO: Avg Harga dihitung dengan metode Rata-rata Sederhana: (Jumlah Nilai Harga / Frekuensi Transaksi) pada bulan berjalan. Valuasi Stok Tersedia menjumlahkan seluruh nilai barang fisik di gudang.
                </p>
            </div>
        </div>
    );
};

export default StockValueReport;