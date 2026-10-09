import React, { useState, useMemo } from 'react';
import download from 'downloadjs';
import html2canvas from 'html2canvas';
import type { ProductionRecord } from '../types';
import { DownloadIcon, TrashIcon, ChevronDownIcon } from './icons';

declare const jspdf: any;

interface ProductionReportProps {
    productionHistory: ProductionRecord[];
    userRole?: string;
    onDeleteRecord?: (date: string, truckNumber: string) => void;
    onEditRecord?: (record: any) => void;
}

const BarChart = ({ data }: { data: { name: string; quantity: number }[] }) => {
    const maxValue = Math.max(...data.map(item => item.quantity), 0);
    const colors = ['#3b82f6', '#10b981', '#f97316', '#8b5cf6', '#ec4899', '#6366f1', '#f59e0b', '#14b8a6', '#d946ef', '#ef4444'];

    return (
        <div className="space-y-4 p-6 border border-slate-100 rounded-[2rem] bg-slate-50/50">
            <h4 className="font-black text-lg text-slate-800 uppercase tracking-tight mb-6">Produksi per Item (Top 10)</h4>
            <div className="space-y-3">
                {data.slice(0, 10).map((item, index) => (
                    <div key={item.name} className="flex flex-col gap-1.5">
                        <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-wider text-slate-500">
                            <span className="truncate">{item.name}</span>
                            <span className="text-slate-900 font-mono">{item.quantity.toLocaleString('id-ID', { maximumFractionDigits: 1 })} Kg</span>
                        </div>
                        <div className="w-full bg-slate-200/50 rounded-full h-2 overflow-hidden shadow-inner">
                            <div
                                className="h-full rounded-full transition-all duration-1000 ease-out shadow-sm"
                                style={{
                                    width: `${maxValue > 0 ? (item.quantity / maxValue) * 100 : 0}%`,
                                    backgroundColor: colors[index % colors.length],
                                }}
                            />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

type FilterType = 'month' | 'date' | 'range' | 'all';

const ProductionReport: React.FC<ProductionReportProps> = ({ productionHistory, userRole, onDeleteRecord, onEditRecord }) => {
    const [filterType, setFilterType] = useState<FilterType>('month');
    const [selectedMonth, setSelectedMonth] = useState(''); // YYYY-MM
    const [selectedDate, setSelectedDate] = useState(''); // YYYY-MM-DD
    const [dateRange, setDateRange] = useState({
        start: '',
        end: '',
    });
    const [isDownloading, setIsDownloading] = useState(false);
    
    const handleDateRangeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setDateRange(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const reportData = useMemo(() => {
        if (filterType === 'month' && !selectedMonth) return null;
        if (filterType === 'date' && !selectedDate) return null;
        if (filterType === 'range' && (!dateRange.start || !dateRange.end)) return null;

        const filteredRecords = productionHistory.filter(record => {
            const recordDateStr = record.dateStr || (typeof record.date === 'string' ? (record.date as string).slice(0, 10) : new Date(record.date).toISOString().slice(0, 10));
            
            switch (filterType) {
                case 'month': {
                    if (!selectedMonth) return false;
                    return recordDateStr.startsWith(selectedMonth);
                }
                case 'date': {
                    if (!selectedDate) return false;
                    return recordDateStr === selectedDate;
                }
                case 'range': {
                    if (!dateRange.start || !dateRange.end) return false;
                    return recordDateStr >= dateRange.start && recordDateStr <= dateRange.end;
                }
                case 'all':
                default:
                    return true;
            }
        });

        if (filteredRecords.length === 0) return null;

        const totals = {
            initialKg: 0,
            initialEkor: 0,
            totalResultKg: 0,
            totalCost: 0,
            items: {} as { [key: string]: number },
        };

        // Helper to adjust quantity - Conversion removed (Hati Ampela raw Kg)
        const adjustQty = (n: string, q: number) => q || 0;

        for (const record of filteredRecords) {
            totals.initialKg += Number(record.initialKg) || 0;
            totals.initialEkor += Number(record.initialEkor) || 0;
            totals.totalCost += (Number(record.initialKg) || 0) * (Number(record.pricePerKg) || 0);
            for (const [itemName, quantity] of Object.entries(record.items)) {
                const convertedQty = adjustQty(itemName, Number(quantity) || 0);
                totals.items[itemName] = (totals.items[itemName] || 0) + convertedQty;
                totals.totalResultKg += convertedQty;
            }
        }

        const averageYield = totals.initialKg > 0 ? (totals.totalResultKg / totals.initialKg) * 100 : 0;
        
        const kpis = {
            totalProduction: totals.totalResultKg,
            avgYield: averageYield,
            totalInitialKg: totals.initialKg,
            totalInitialEkor: totals.initialEkor,
            totalCost: totals.totalCost,
        };

        const itemData = Object.entries(totals.items)
            .map(([name, quantity]) => ({
                name,
                quantity,
                percentage: totals.totalResultKg > 0 ? (quantity / totals.totalResultKg) * 100 : 0
            }))
            .filter(item => item.quantity > 0)
            .sort((a, b) => b.quantity - a.quantity);
        
        const truckDetails = filteredRecords.map(record => {
             const totalResult = Object.entries(record.items).reduce((sum, [name, qty]) => sum + adjustQty(name, Number(qty)), 0);
             const yieldValue = record.initialKg > 0 ? (Number(totalResult) / record.initialKg) * 100 : 0;
             const totalCost = (record.initialKg || 0) * (record.pricePerKg || 0);
             return {
                 ...record,
                 totalResult,
                 yield: yieldValue,
                 totalCost,
             };
         }).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        return { kpis, itemData, truckDetails };
    }, [productionHistory, filterType, selectedMonth, selectedDate, dateRange]);

     const getReportTitle = () => {
        switch (filterType) {
            case 'month':
                return `Laporan-Produksi-${selectedMonth}`;
            case 'date':
                return `Laporan-Produksi-${selectedDate}`;
            case 'range':
                return `Laporan-Produksi-dari-${dateRange.start}-sampai-${dateRange.end}`;
            case 'all':
            default:
                return `Laporan-Produksi-Semua-Waktu`;
        }
    };

    const handleDownload = async () => {
        const reportContent = document.getElementById('report-content');
        if (!reportContent) return;

        setIsDownloading(true);
        try {
            const canvas = await html2canvas(reportContent, { 
                scale: 4,
                useCORS: true,
                backgroundColor: "#ffffff",
                width: reportContent.offsetWidth,
                height: reportContent.offsetHeight,
                windowWidth: reportContent.offsetWidth,
                windowHeight: reportContent.offsetHeight,
                scrollX: 0,
                scrollY: 0,
                onclone: (clonedDoc) => {
                    const images = clonedDoc.getElementsByTagName('img');
                    for (let i = 0; i < images.length; i++) {
                        images[i].style.display = 'inline-block';
                    }
                }
            });
            const imgData = canvas.toDataURL('image/png');
            const { jsPDF } = jspdf;
            const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const imgProps = pdf.getImageProperties(imgData);
            
            const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;
            let heightLeft = imgHeight;
            let position = 0;

            pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
            heightLeft -= pdfHeight;

            while (heightLeft > 0) {
              position = heightLeft - imgHeight;
              pdf.addPage();
              pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
              heightLeft -= pdfHeight;
            }
            const pdfBlob = pdf.output('blob');
            download(pdfBlob, `${getReportTitle()}.pdf`, "application/pdf");
        } catch (error) {
            console.error("Error generating PDF:", error);
            alert("Gagal mengunduh PDF.");
        } finally {
            setIsDownloading(false);
        }
    };
    
    const KpiCard = ({ title, value, unit }: { title: string; value: string; unit: string }) => (
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col items-start h-full hover:border-slate-300 transition-all overflow-hidden min-h-[110px]">
            <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-[0.15em] mb-3 truncate w-full">{title}</h3>
            <div className="flex flex-col gap-1 w-full overflow-hidden">
                <span className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-none truncate break-all">{value}</span>
                {unit && <span className="text-[10px] font-bold text-slate-500 tracking-wide uppercase">{unit}</span>}
            </div>
        </div>
    );

    return (
        <div className="bg-white p-6 sm:p-10 rounded-[2.5rem] sm:rounded-[3rem] border border-slate-100 shadow-sm space-y-10">
            <div className="flex justify-between items-center flex-wrap gap-4">
                <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight uppercase">Laporan Produksi</h2>
                <div className="flex items-center gap-4">
                    <button
                        onClick={handleDownload}
                        disabled={!reportData || isDownloading}
                        className="inline-flex items-center justify-center py-3 px-6 sm:py-4 sm:px-8 border border-transparent text-sm font-black rounded-2xl text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 transition-all shadow-lg shadow-blue-100"
                    >
                        <DownloadIcon className="h-4 w-4 shrink-0" />
                        <span className="ml-3 uppercase tracking-wider whitespace-nowrap">{isDownloading ? '...' : 'Download'}</span>
                    </button>
                </div>
            </div>

            <div className="p-4 sm:p-6 bg-slate-50/50 border border-slate-100 rounded-[2rem] flex flex-wrap items-center gap-4 sm:gap-6">
                 <div className="flex items-center gap-3">
                    <label htmlFor="filterType" className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Filter:</label>
                    <select
                        id="filterType"
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value as FilterType)}
                        className="px-4 py-2 sm:px-5 sm:py-3 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-bold shadow-sm outline-none"
                    >
                        <option value="month">Bulan</option>
                        <option value="date">Tanggal</option>
                        <option value="range">Range</option>
                        <option value="all">Semua</option>
                    </select>
                </div>
                {filterType === 'month' && (
                    <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="px-4 py-2 sm:px-5 sm:py-3 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-bold shadow-sm outline-none"/>
                )}
                 {filterType === 'date' && (
                    <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="px-4 py-2 sm:px-5 sm:py-3 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-bold shadow-sm outline-none"/>
                )}
                 {filterType === 'range' && (
                    <div className="flex items-center gap-3">
                        <input type="date" name="start" value={dateRange.start} onChange={handleDateRangeChange} className="px-4 py-2 sm:px-5 sm:py-3 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-bold shadow-sm outline-none w-32 sm:w-auto"/>
                        <span className="text-slate-400 font-black">-</span>
                        <input type="date" name="end" value={dateRange.end} onChange={handleDateRangeChange} className="px-4 py-2 sm:px-5 sm:py-3 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-bold shadow-sm outline-none w-32 sm:w-auto"/>
                    </div>
                )}
            </div>

            {!reportData ? (
                <div className="text-center py-20 bg-slate-50/30 rounded-[2rem]">
                    <p className="text-slate-400 font-black uppercase tracking-widest text-xs sm:text-sm">Tidak ada data untuk periode ini.</p>
                </div>
            ) : (
                <div id="report-content" className="bg-white space-y-12">
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-6">
                        <KpiCard title="Total Produksi" value={reportData.kpis.totalProduction.toLocaleString('id-ID', { maximumFractionDigits: 1 })} unit="Kg" />
                        <KpiCard title="Total Pembelian" value={new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(reportData.kpis.totalCost)} unit="" />
                        <KpiCard title="Avg Yield" value={reportData.kpis.avgYield.toFixed(2)} unit="%" />
                        <KpiCard title="Ayam Masuk" value={reportData.kpis.totalInitialKg.toLocaleString('id-ID', { maximumFractionDigits: 1 })} unit="Kg" />
                        <KpiCard title="Ayam Masuk" value={reportData.kpis.totalInitialEkor.toLocaleString('id-ID')} unit="Ekor" />
                    </div>
                    
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 sm:gap-10">
                        <BarChart data={reportData.itemData} />

                        <div className="p-6 sm:p-8 border border-slate-100 rounded-[2rem] bg-slate-50/30 flex flex-col h-full">
                            <h4 className="text-lg font-black text-slate-800 uppercase tracking-tight mb-6 shrink-0">Rincian Produksi per Item</h4>
                            <div className="flex-grow overflow-y-auto no-scrollbar border border-slate-100 rounded-2xl bg-white shadow-sm max-h-[400px]">
                                <table className="min-w-full divide-y divide-slate-100 text-xs sm:text-sm">
                                    <thead className="bg-slate-50 sticky top-0 z-10">
                                        <tr>
                                            <th className="px-4 py-4 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">Nama Item</th>
                                            <th className="px-4 py-4 text-right text-[9px] font-black text-slate-400 uppercase tracking-widest">Total (Kg)</th>
                                            <th className="px-4 py-4 text-right text-[9px] font-black text-slate-400 uppercase tracking-widest">% Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {reportData.itemData.map(item => (
                                            <tr key={item.name} className="hover:bg-slate-50 transition-all group">
                                                <td className="px-4 py-4 font-black text-slate-700 uppercase group-hover:text-blue-600 transition-colors">{item.name}</td>
                                                <td className="px-4 py-4 text-right font-mono font-bold text-slate-900">{item.quantity.toLocaleString('id-ID', { maximumFractionDigits: 2 })}</td>
                                                <td className="px-4 py-4 text-right text-slate-500 font-bold">{(item.percentage || 0).toFixed(2)}%</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-6 sm:p-8 rounded-[2rem] border border-slate-100">
                        <h3 className="text-lg sm:text-xl font-black text-slate-900 uppercase tracking-tight mb-6">Rincian Data per Truk</h3>
                        <div className="max-h-[400px] overflow-y-auto border border-slate-50 rounded-2xl no-scrollbar shadow-inner bg-slate-50/10">
                            <table className="min-w-full divide-y divide-slate-100 text-xs sm:text-sm">
                                <thead className="bg-white sticky top-0 z-10 shadow-sm">
                                    <tr>
                                        <th className="px-6 py-5 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">Tanggal</th>
                                        <th className="px-6 py-5 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">Unit</th>
                                        <th className="px-6 py-5 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">Kandang</th>
                                        <th className="px-6 py-5 text-right text-[9px] font-black text-slate-400 uppercase tracking-widest">LB (Kg)</th>
                                        <th className="px-6 py-5 text-right text-[9px] font-black text-slate-400 uppercase tracking-widest">Mati (E/K)</th>
                                        <th className="px-6 py-5 text-right text-[9px] font-black text-slate-400 uppercase tracking-widest">Beli (Rp)</th>
                                        <th className="px-6 py-5 text-right text-[9px] font-black text-slate-400 uppercase tracking-widest">Hasil (Kg)</th>
                                        <th className="px-6 py-5 text-right text-[9px] font-black text-slate-400 uppercase tracking-widest">Yield</th>
                                        {userRole?.toLowerCase().trim() === 'superadmin' && <th className="px-6 py-5 text-center text-[9px] font-black text-slate-400 uppercase tracking-widest">Aksi</th>}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {reportData.truckDetails.map(truck => (
                                        <tr key={truck.id} className="hover:bg-white transition-all bg-white/50">
                                            <td className="px-6 py-5 text-slate-500 font-bold whitespace-nowrap">{new Date(truck.date).toLocaleDateString('id-ID', {day: '2-digit', month: 'short'})}</td>
                                            <td className="px-6 py-5 font-black text-slate-900 whitespace-nowrap">Mobil {truck.truckNumber}</td>
                                            <td className="px-6 py-5 text-slate-600 font-bold uppercase truncate max-w-[120px]">{truck.coopName}</td>
                                            <td className="px-6 py-5 text-right font-mono text-slate-700 font-bold">{truck.initialKg.toLocaleString('id-ID')}</td>
                                            <td className="px-6 py-5 text-right font-mono text-rose-600 text-[10px] font-bold">
                                                {(truck as any).kematian_ekor || 0} / {((truck as any).kematian_kg || 0).toFixed(1)}
                                            </td>
                                            <td className="px-6 py-5 text-right font-mono text-slate-500 text-[10px] font-bold">
                                                {truck.totalCost > 0 ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(truck.totalCost) : '-'}
                                            </td>
                                            <td className="px-6 py-5 text-right font-mono font-black text-slate-900">{truck.totalResult.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</td>
                                            <td className="px-6 py-5 text-right font-black text-emerald-600">{(truck.yield || 0).toFixed(1)}%</td>
                                            {userRole?.toLowerCase().trim() === 'superadmin' && (
                                                <td className="px-6 py-5 text-center">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <button 
                                                            onClick={() => {
                                                                if (window.confirm('Apakah Anda yakin ingin mengedit data produksi ini? Tindakan ini akan memicu kalkulasi ulang stok secara otomatis.')) {
                                                                    onEditRecord?.(truck);
                                                                }
                                                            }}
                                                            className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                            title="Edit Produksi"
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                                        </button>
                                                        <button 
                                                            onClick={() => {
                                                                if (window.confirm(`PERINGATAN: Menghapus data Mobil #${truck.truckNumber} tgl ${new Date(truck.date).toLocaleDateString('id-ID')} akan mengurangi stok barang terkait. Lanjutkan?`)) {
                                                                    onDeleteRecord?.(new Date(truck.date).toISOString().slice(0, 10), truck.truckNumber.toString());
                                                                }
                                                            }}
                                                            className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                                            title="Hapus Produksi"
                                                        >
                                                            <TrashIcon className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProductionReport;