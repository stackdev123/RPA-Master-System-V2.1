import React, { useState, useMemo } from 'react';
import type { ProductionRecord } from '../types';

interface BelanjaLBReportProps {
    productionHistory: any[];
}

type FilterType = 'all' | 'month' | 'range';

const BelanjaLBReport: React.FC<BelanjaLBReportProps> = ({ productionHistory }) => {
    const [filterType, setFilterType] = useState<FilterType>('month');
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
    const [dateRange, setDateRange] = useState({
        start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10),
        end: new Date().toISOString().slice(0, 10),
    });

    const filteredData = useMemo(() => {
        let start: Date;
        let end: Date;

        if (filterType === 'month') {
            const [year, month] = selectedMonth.split('-').map(Number);
            start = new Date(year, month - 1, 1, 0, 0, 0, 0);
            end = new Date(year, month, 0, 23, 59, 59, 999);
        } else if (filterType === 'range') {
            start = new Date(dateRange.start);
            start.setHours(0, 0, 0, 0);
            end = new Date(dateRange.end);
            end.setHours(23, 59, 59, 999);
        } else {
            start = new Date(2000, 0, 1);
            end = new Date(2100, 0, 1);
        }

        return productionHistory
            .filter(rec => {
                const d = new Date(rec.date);
                return d >= start && d <= end;
            })
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [productionHistory, filterType, selectedMonth, dateRange]);

    const stats = useMemo(() => {
        return filteredData.reduce((acc, curr) => {
            const kg = Number(curr.initialKg) || 0;
            const price = Number(curr.pricePerKg) || 0;
            acc.totalKg += kg;
            acc.totalCost += (kg * price);
            return acc;
        }, { totalKg: 0, totalCost: 0 });
    }, [filteredData]);

    const formatIDR = (val: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val);

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl md:text-2xl font-black text-slate-800 uppercase tracking-tighter">Laporan Belanja LB</h2>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Otomatis dari Data Produksi</p>
                </div>

                <div className="flex flex-wrap items-center gap-2 bg-slate-50 p-2 rounded-2xl border border-slate-200">
                    <select 
                        value={filterType} 
                        onChange={(e) => setFilterType(e.target.value as FilterType)}
                        className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest outline-none"
                    >
                        <option value="month">Per Bulan</option>
                        <option value="range">Rentang</option>
                        <option value="all">Semua</option>
                    </select>
                    {filterType === 'month' && (
                        <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold outline-none" />
                    )}
                    {filterType === 'range' && (
                        <div className="flex items-center gap-1">
                            <input type="date" value={dateRange.start} onChange={(e) => setDateRange(p => ({...p, start: e.target.value}))} className="bg-white border border-slate-200 rounded-xl px-2 py-1 text-[10px] font-bold outline-none" />
                            <input type="date" value={dateRange.end} onChange={(e) => setDateRange(p => ({...p, end: e.target.value}))} className="bg-white border border-slate-200 rounded-xl px-2 py-1 text-[10px] font-bold outline-none" />
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-indigo-600 p-6 rounded-3xl text-white shadow-lg shadow-indigo-100">
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">Total Tonase LB</p>
                    <p className="text-3xl font-black">{stats.totalKg.toLocaleString('id-ID')} <span className="text-sm opacity-60">Kg</span></p>
                </div>
                <div className="bg-slate-900 p-6 rounded-3xl text-white shadow-lg shadow-slate-200">
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-1">Total Nilai Belanja</p>
                    <p className="text-3xl font-black text-emerald-400">{formatIDR(stats.totalCost)}</p>
                </div>
            </div>

            <div className="bg-white rounded-[2rem] border border-slate-100 overflow-hidden shadow-sm">
                <div className="overflow-x-auto no-scrollbar">
                    <table className="min-w-full divide-y divide-slate-100">
                        <thead className="bg-slate-50">
                            <tr className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">
                                <th className="px-6 py-5 text-left">Tanggal</th>
                                <th className="px-6 py-5 text-left">Mobil</th>
                                <th className="px-6 py-5 text-left">Kandang</th>
                                <th className="px-6 py-5 text-left">Driver / Plat</th>
                                <th className="px-6 py-5 text-right">Berat (Kg)</th>
                                <th className="px-6 py-5 text-right">Harga/Kg</th>
                                <th className="px-6 py-5 text-right">Total (Rp)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 bg-white">
                            {filteredData.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-20 text-center text-slate-300 font-bold uppercase tracking-widest italic">Belum ada data belanja LB</td>
                                </tr>
                            ) : (
                                filteredData.map((rec, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50 transition-colors group">
                                        <td className="px-6 py-4 whitespace-nowrap text-[11px] font-bold text-slate-500">
                                            {new Date(rec.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-[11px] font-black text-slate-900">
                                            Mobil #{rec.truckNumber}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-[11px] font-black text-slate-700 uppercase">
                                            {rec.coopName}
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="text-[10px] font-bold text-slate-600 uppercase">{rec.driver}</p>
                                            <p className="text-[8px] font-black text-slate-400 uppercase">{rec.licensePlate}</p>
                                        </td>
                                        <td className="px-6 py-4 text-right font-mono font-black text-slate-900 text-xs">
                                            {Number(rec.initialKg || 0).toLocaleString('id-ID')}
                                        </td>
                                        <td className="px-6 py-4 text-right font-mono font-bold text-indigo-600 text-[11px]">
                                            {formatIDR(Number(rec.pricePerKg || 0))}
                                        </td>
                                        <td className="px-6 py-4 text-right font-mono font-black text-emerald-600 text-xs">
                                            {formatIDR((Number(rec.initialKg) || 0) * (Number(rec.pricePerKg) || 0))}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default BelanjaLBReport;