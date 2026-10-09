
import React, { useState, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import type { SalaryRecord } from '../types';
import { PlusIcon, TrashIcon, PrintIcon, DownloadIcon } from './icons';

interface SalaryViewProps {
    salaries: SalaryRecord[];
    onAddSalary: () => void;
    onDeleteSalary: (id: string) => void;
    onImportSalaries: (data: Omit<SalaryRecord, 'id'>[]) => void;
}

type FilterType = 'month' | 'range' | 'all';

const SalaryView: React.FC<SalaryViewProps> = ({ salaries, onAddSalary, onDeleteSalary, onImportSalaries }) => {
    const [filterType, setFilterType] = useState<FilterType>('month');
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
    const [dateRange, setDateRange] = useState({ start: '', end: '' });
    const [isImporting, setIsImporting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const filteredSalaries = useMemo(() => {
        return salaries.filter(record => {
            const d = new Date(record.date);
            const year = d.getUTCFullYear();
            const month = d.getUTCMonth();
            const dateStr = d.toISOString().split('T')[0];

            if (filterType === 'month') {
                const [fYear, fMonth] = selectedMonth.split('-').map(Number);
                return year === fYear && month === fMonth - 1;
            } else if (filterType === 'range') {
                if (!dateRange.start || !dateRange.end) return true;
                return dateStr >= dateRange.start && dateStr <= dateRange.end;
            }
            return true;
        }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [salaries, filterType, selectedMonth, dateRange]);

    const totalPayout = useMemo(() => {
        return filteredSalaries.reduce((sum, item) => sum + item.totalSalary, 0);
    }, [filteredSalaries]);

    const handlePrint = () => {
        window.print();
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsImporting(true);
        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary', cellDates: true });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws);

                // Map Excel columns to our format
                // Expected columns: Tanggal (YYYY-MM-DD), Nama Karyawan, Gaji Harian, Hari Kerja, Kasbon, Catatan
                const formattedData = data.map((row: any) => {
                    const dailyRate = Number(row['Gaji Harian']) || 0;
                    const daysWorked = Number(row['Hari Kerja']) || 0;
                    const cashBon = Number(row['Kasbon']) || 0;
                    const totalSalary = (dailyRate * daysWorked) - cashBon;

                    let rowDate = new Date();
                    const rawDate = row['Tanggal'];
                    if (rawDate) {
                        if (rawDate instanceof Date) {
                            // Explicitly add 1 day to compensate for the shift
                            rowDate = new Date(rawDate.getFullYear(), rawDate.getMonth(), rawDate.getDate() + 1);
                        } else {
                            const parsed = new Date(rawDate);
                            if (!isNaN(parsed.getTime())) {
                                rowDate = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate() + 1);
                            }
                        }
                    }

                    return {
                        date: rowDate,
                        employeeName: row['Nama Karyawan'] || 'Unknown',
                        dailyRate,
                        daysWorked,
                        cashBon,
                        totalSalary,
                        notes: row['Catatan'] || '',
                        role: row['Role'] || ''
                    };
                });

                if (formattedData.length > 0) {
                    onImportSalaries(formattedData);
                }
            } catch (err) {
                console.error(err);
                alert('Gagal mengimpor file. Pastikan format kolom sesuai.');
            } finally {
                setIsImporting(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        };
        reader.readAsBinaryString(file);
    };

    return (
        <div className="space-y-6">
            <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                accept=".xlsx, .xls" 
                className="hidden" 
            />
            <div className="bg-white p-5 sm:p-6 rounded-3xl shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border border-slate-100">
                <div>
                    <h2 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tighter uppercase leading-none">Gaji Karyawan</h2>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1.5">PAYROLL MANAGEMENT SYSTEM</p>
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <button
                        onClick={handlePrint}
                        className="p-3.5 bg-slate-50 text-slate-400 hover:text-slate-900 border border-slate-200 rounded-2xl transition-all active:scale-95"
                        title="Print Payroll"
                    >
                        <PrintIcon className="h-5 w-5" />
                    </button>
                    <button
                        onClick={handleImportClick}
                        disabled={isImporting}
                        className="p-3.5 bg-emerald-50 text-emerald-600 hover:text-emerald-900 border border-emerald-100 rounded-2xl transition-all active:scale-95 disabled:opacity-50"
                        title="Import XLSX"
                    >
                        <DownloadIcon className="h-5 w-5 rotate-180" />
                    </button>
                    <button
                        onClick={onAddSalary}
                        className="flex-1 sm:flex-none inline-flex items-center justify-center py-3.5 px-8 border border-transparent text-[10px] font-black rounded-2xl text-white bg-blue-600 hover:bg-blue-700 transition-all uppercase tracking-widest shadow-lg shadow-blue-100 active:scale-95"
                    >
                        <PlusIcon className="h-4 w-4 mr-2" />
                        INPUT GAJI
                    </button>
                </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-6 items-start">
                <div className="flex-grow w-full lg:w-2/3 bg-white p-4 sm:p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
                     <div className="flex flex-wrap items-center gap-4 mb-6 border-b border-slate-50 pb-6">
                        <select
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value as FilterType)}
                            className="px-4 py-2 border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm outline-none transition-all hover:border-slate-300"
                        >
                            <option value="month">PER BULAN</option>
                            <option value="range">RENTANG TANGGAL</option>
                            <option value="all">SEMUA</option>
                        </select>
                        {filterType === 'month' && (
                            <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold outline-none shadow-sm"/>
                        )}
                        {filterType === 'range' && (
                            <div className="flex items-center gap-2">
                                <input type="date" value={dateRange.start} onChange={(e) => setDateRange(p => ({ ...p, start: e.target.value }))} className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold outline-none shadow-sm"/>
                                <span className="text-[10px] font-black text-slate-400">S/D</span>
                                <input type="date" value={dateRange.end} onChange={(e) => setDateRange(p => ({ ...p, end: e.target.value }))} className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold outline-none shadow-sm"/>
                            </div>
                        )}
                    </div>
                    
                    <div className="overflow-x-auto no-scrollbar border border-slate-50 rounded-2xl shadow-inner bg-slate-50/10">
                        <table className="min-w-full divide-y divide-slate-100 text-[11px] sm:text-[13px]">
                            <thead className="bg-white sticky top-0 z-10 shadow-sm">
                                <tr className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                    <th className="px-5 py-5 text-left">TGL</th>
                                    <th className="px-5 py-5 text-left">KARYAWAN</th>
                                    <th className="px-5 py-5 text-right">PAYOUT (Rp)</th>
                                    <th className="px-5 py-5 text-center">PRESENSI</th>
                                    <th className="px-5 py-5 text-center print:hidden">AKSI</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white/50">
                                {filteredSalaries.length === 0 ? (
                                     <tr><td colSpan={5} className="py-20 text-center text-slate-300 uppercase tracking-widest italic font-bold">Belum ada data gaji</td></tr>
                                ) : (
                                    filteredSalaries.map(record => (
                                        <tr key={record.id} className="hover:bg-white transition-all group">
                                            <td className="px-5 py-5 whitespace-nowrap text-slate-500 font-bold">{new Date(record.date).toLocaleDateString('id-ID', {day: '2-digit', month: 'short', timeZone: 'UTC'})}</td>
                                            <td className="px-5 py-5">
                                                <p className="font-black text-slate-700 uppercase leading-none truncate max-w-[150px]">{record.employeeName}</p>
                                                {record.notes && <p className="text-[9px] text-slate-400 truncate max-w-[150px] mt-1">{record.notes}</p>}
                                            </td>
                                            <td className="px-5 py-5 text-right text-emerald-700 font-black font-mono">
                                                {new Intl.NumberFormat('id-ID').format(record.totalSalary)}
                                            </td>
                                            <td className="px-5 py-5 text-center">
                                                <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 font-black text-[10px]">{record.daysWorked} HARI</span>
                                            </td>
                                            <td className="px-5 py-5 text-center print:hidden">
                                                <button onClick={() => onDeleteSalary(record.id)} className="p-2 text-slate-200 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all active:scale-95">
                                                    <TrashIcon className="h-4 w-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="w-full lg:w-1/3 space-y-4 lg:sticky lg:top-20">
                    <div className="bg-indigo-600 p-8 rounded-[2.5rem] flex flex-col justify-center border border-indigo-500 shadow-2xl shadow-indigo-100 text-white">
                        <p className="text-[10px] font-black text-indigo-200 uppercase tracking-[0.2em] mb-3">Total Payroll Payout</p>
                        <p className="text-3xl sm:text-4xl font-black tracking-tighter mb-2 overflow-hidden break-all">
                            {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(totalPayout)}
                        </p>
                        <div className="h-px bg-indigo-500 w-full my-4 opacity-50"></div>
                        <div className="flex justify-between items-center text-[9px] font-black text-indigo-200 uppercase tracking-widest">
                            <span>Periode:</span>
                            <span className="font-bold">{filterType === 'month' ? selectedMonth : 'Custom Range'}</span>
                        </div>
                    </div>
                    
                    <div className="bg-slate-100 p-8 rounded-[2.5rem] border border-slate-200 flex flex-col justify-center">
                         <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Total Entri</p>
                         <p className="text-3xl font-black text-slate-900 tracking-tight">{filteredSalaries.length} <span className="text-xs font-bold text-slate-400">Karyawan</span></p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SalaryView;
