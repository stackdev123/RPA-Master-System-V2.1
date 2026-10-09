
import React, { useState, useMemo } from 'react';
import type { ExpenseRecord } from '../types';
import { PlusIcon, TrashIcon, DownloadIcon } from './icons';

interface ExpenseViewProps {
    expenses: ExpenseRecord[];
    onAddExpense: () => void;
    onDeleteExpense: (id: string) => void;
}

type FilterType = 'month' | 'range' | 'all';

const ExpenseView: React.FC<ExpenseViewProps> = ({ expenses, onAddExpense, onDeleteExpense }) => {
    const [filterType, setFilterType] = useState<FilterType>('month');
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
    const [dateRange, setDateRange] = useState({ start: '', end: '' });

    const filteredExpenses = useMemo(() => {
        return expenses.filter(record => {
            const recordDate = new Date(record.date);
            if (filterType === 'month') {
                const [year, month] = selectedMonth.split('-').map(Number);
                return recordDate.getFullYear() === year && recordDate.getMonth() === month - 1;
            } else if (filterType === 'range') {
                if (!dateRange.start || !dateRange.end) return true;
                const start = new Date(dateRange.start);
                start.setHours(0, 0, 0, 0);
                const end = new Date(dateRange.end);
                end.setHours(23, 59, 59, 999);
                return recordDate >= start && recordDate <= end;
            }
            return true;
        }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [expenses, filterType, selectedMonth, dateRange]);

    const totalExpense = useMemo(() => {
        return filteredExpenses.reduce((sum, item) => sum + item.amount, 0);
    }, [filteredExpenses]);

    return (
        <div className="space-y-6">
            <div className="bg-white p-5 sm:p-6 rounded-3xl shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border border-slate-100">
                <div>
                    <h2 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tighter uppercase leading-none">Pengeluaran Harian</h2>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1.5">RECORD BIAYA OPERASIONAL</p>
                </div>
                <button
                    onClick={onAddExpense}
                    className="inline-flex items-center justify-center py-3 px-6 border border-transparent text-[10px] font-black rounded-2xl text-white bg-indigo-600 hover:bg-indigo-700 transition-all uppercase tracking-widest shadow-lg shadow-indigo-100 active:scale-95 shrink-0"
                >
                    <PlusIcon className="h-4 w-4 mr-2" />
                    CATAT PENGELUARAN
                </button>
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
                            <option value="range">RENTANG</option>
                            <option value="all">SEMUA</option>
                        </select>
                        {filterType === 'month' && (
                            <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold outline-none shadow-sm"/>
                        )}
                         {filterType === 'range' && (
                            <div className="flex items-center gap-2">
                                <input type="date" value={dateRange.start} onChange={(e) => setDateRange(p => ({...p, start: e.target.value}))} className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold outline-none w-32 shadow-sm"/>
                                <span className="text-slate-400 font-black">-</span>
                                <input type="date" value={dateRange.end} onChange={(e) => setDateRange(p => ({...p, end: e.target.value}))} className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold outline-none w-32 shadow-sm"/>
                            </div>
                        )}
                    </div>
                    
                    <div className="overflow-x-auto no-scrollbar border border-slate-50 rounded-2xl shadow-inner bg-slate-50/10">
                        <table className="min-w-full divide-y divide-slate-100 text-[11px] sm:text-[13px]">
                            <thead className="bg-white sticky top-0 z-10 shadow-sm">
                                <tr className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                    <th className="px-5 py-5 text-left">TGL</th>
                                    <th className="px-5 py-5 text-left">KATEGORI</th>
                                    <th className="px-5 py-5 text-right">JUMLAH (Rp)</th>
                                    <th className="px-5 py-5 text-center">X</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white/50">
                                {filteredExpenses.length === 0 ? (
                                     <tr><td colSpan={4} className="py-20 text-center text-slate-300 uppercase tracking-widest italic font-bold">Data tidak ditemukan</td></tr>
                                ) : (
                                    filteredExpenses.map(expense => (
                                        <tr key={expense.id} className="hover:bg-white transition-all group">
                                            <td className="px-5 py-5 whitespace-nowrap text-slate-500 font-bold">{new Date(expense.date).toLocaleDateString('id-ID', {day: '2-digit', month: 'short'})}</td>
                                            <td className="px-5 py-5">
                                                <p className="font-black text-slate-700 uppercase leading-none mb-1">{expense.category}</p>
                                                <p className="text-[9px] text-slate-400 truncate max-w-[200px]">{expense.description}</p>
                                            </td>
                                            <td className="px-5 py-5 text-right text-rose-600 font-black font-mono">
                                                {new Intl.NumberFormat('id-ID').format(expense.amount)}
                                            </td>
                                            <td className="px-5 py-5 text-center">
                                                <button onClick={() => onDeleteExpense(expense.id)} className="p-2 text-slate-200 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all active:scale-95">
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
                    <div className="bg-slate-900 p-8 rounded-[2.5rem] flex flex-col justify-center border border-slate-800 shadow-2xl shadow-slate-200/50">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3">Ringkasan Pengeluaran</p>
                        <p className="text-3xl sm:text-4xl font-black text-white tracking-tighter mb-2 overflow-hidden break-all">
                            {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(totalExpense)}
                        </p>
                        <div className="h-px bg-slate-800 w-full my-4"></div>
                        <div className="flex justify-between items-center text-[9px] font-black text-slate-500 uppercase tracking-widest">
                            <span>Status:</span>
                            <span className="text-emerald-500 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">Finalized</span>
                        </div>
                    </div>
                    
                    <div className="bg-blue-600 p-8 rounded-[2.5rem] flex flex-col justify-center border border-blue-500 shadow-2xl shadow-blue-200/50 text-white">
                         <p className="text-[10px] font-black text-blue-200 uppercase tracking-[0.2em] mb-1">Total Record</p>
                         <p className="text-3xl font-black tracking-tight">{filteredExpenses.length} <span className="text-xs font-bold text-blue-300">Transaksi</span></p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ExpenseView;
