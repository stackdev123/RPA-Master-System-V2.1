import React, { useState } from 'react';
import { XIcon, TrashIcon, EditIcon, HistoryIcon, PlusIcon } from './icons';

interface EndingInventoryFormProps {
    earlyStock: any[];
    currentUserName: string;
    onSubmit: (date: string, amount: number) => Promise<void>;
    onDelete: (date: string) => Promise<void>;
    onCancel: () => void;
}

const EndingInventoryForm: React.FC<EndingInventoryFormProps> = ({ earlyStock, currentUserName, onSubmit, onDelete, onCancel }) => {
    const [view, setView] = useState<'form' | 'history'>('form');
    const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
    const [amount, setAmount] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [filterMonth, setFilterMonth] = useState<string>('');
    const [filterYear, setFilterYear] = useState<string>('');
    
    const handleFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!date || !amount) return;
        if (!window.confirm(`Konfirmasi: Update Ending Inventory untuk tanggal ${new Date(date).toLocaleDateString('id-ID')} dengan nilai ${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(Number(amount))}?`)) return;

        setIsSubmitting(true);
        try {
            await onSubmit(date, Number(amount));
            onCancel(); 
        } catch (error: any) {
            alert('Kesalahan: ' + error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteClick = async (dateToDelete: string) => {
        if (!window.confirm(`PERINGATAN: Hapus riwayat input stok manual untuk tanggal ${new Date(dateToDelete).toLocaleDateString('id-ID')}?`)) return;

        setIsSubmitting(true);
        try {
            await onDelete(dateToDelete);
        } catch (error: any) {
            alert('Kesalahan penghapusan: ' + error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const sortedHistory = [...earlyStock]
        .filter(item => {
            if (!item.tanggal) return false;
            const itemDate = new Date(item.tanggal);
            const matchesMonth = filterMonth ? (itemDate.getMonth() + 1).toString() === filterMonth : true;
            const matchesYear = filterYear ? itemDate.getFullYear().toString() === filterYear : true;
            return matchesMonth && matchesYear;
        })
        .sort((a, b) => b.tanggal.localeCompare(a.tanggal));

    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/50 shrink-0">
                    <div>
                        <h2 className="text-xl font-black text-slate-800 tracking-tight uppercase">Manajemen Stok Manual</h2>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                            {view === 'form' ? 'Update Ending Inventory database' : 'Riwayat Input Stok Manual'}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={() => setView(view === 'form' ? 'history' : 'form')}
                            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
                        >
                            {view === 'form' ? <><HistoryIcon className="w-4 h-4" /> Riwayat</> : <><PlusIcon className="w-4 h-4" /> Input Baru</>}
                        </button>
                        <button onClick={onCancel} className="p-2 hover:bg-white rounded-full transition-colors text-slate-400">
                            <XIcon className="w-6 h-6" />
                        </button>
                    </div>
                </div>
                
                <div className="overflow-y-auto p-6 md:p-8 flex-1 scrollbar-hide">
                    {view === 'form' ? (
                        <form onSubmit={handleFormSubmit} className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Tanggal</label>
                                <input
                                    type="date"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Ending Inventory (Rp)</label>
                                <div className="relative">
                                    <span className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 font-black text-xs">Rp</span>
                                    <input
                                        type="number"
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        className="w-full pl-14 pr-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                                        placeholder="0"
                                        required
                                    />
                                </div>
                                <p className="text-[9px] text-slate-400 font-medium italic mt-2 ml-1">* Nilai ini akan menggantikan hasil kalkulasi otomatis di laporan P&L harian.</p>
                            </div>

                            <div className="flex gap-4 pt-4">
                                <button
                                    type="button"
                                    onClick={onCancel}
                                    className="flex-1 px-6 py-4 border border-slate-100 rounded-2xl text-xs font-black uppercase text-slate-400 hover:bg-slate-50 transition-all"
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-6 py-4 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase shadow-lg shadow-slate-200 hover:bg-slate-800 transition-all active:scale-95"
                                >
                                    Konfirmasi & Simpan
                                </button>
                            </div>
                        </form>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex gap-2">
                                <select 
                                    value={filterMonth}
                                    onChange={e => setFilterMonth(e.target.value)}
                                    className="px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-600"
                                >
                                    <option value="">Semua Bulan</option>
                                    <option value="1">Januari</option>
                                    <option value="2">Februari</option>
                                    <option value="3">Maret</option>
                                    <option value="4">April</option>
                                    <option value="5">Mei</option>
                                    <option value="6">Juni</option>
                                    <option value="7">Juli</option>
                                    <option value="8">Agustus</option>
                                    <option value="9">September</option>
                                    <option value="10">Oktober</option>
                                    <option value="11">November</option>
                                    <option value="12">Desember</option>
                                </select>
                                <select 
                                    value={filterYear}
                                    onChange={e => setFilterYear(e.target.value)}
                                    className="px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-600"
                                >
                                    <option value="">Semua Tahun</option>
                                    {Array.from(new Set(earlyStock.map(item => new Date(item.tanggal).getFullYear()))).filter(y => !isNaN(y)).sort((a,b)=>a-b).map(year => (
                                        <option key={year} value={year}>{year}</option>
                                    ))}
                                </select>
                            </div>
                            {sortedHistory.length === 0 ? (
                                <div className="text-center py-12 bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-100">
                                    <p className="text-slate-400 font-bold text-xs">Belum ada riwayat input manual.</p>
                                </div>
                            ) : (
                                <div className="grid gap-3">
                                    {sortedHistory.map((item, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-5 bg-slate-50 border border-slate-100 rounded-2xl hover:bg-white hover:shadow-md transition-all group">
                                            <div className="flex items-center gap-4">
                                                <div className="bg-white p-3 rounded-xl shadow-sm text-center min-w-[70px]">
                                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter mb-0.5">{new Date(item.tanggal).toLocaleDateString('id-ID', { month: 'short' })}</p>
                                                    <p className="text-lg font-black text-slate-800 leading-none">{new Date(item.tanggal).getDate()}</p>
                                                    <p className="text-[8px] font-bold text-slate-400 mt-0.5">{new Date(item.tanggal).getFullYear()}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Nilai Stok Akhir</p>
                                                    <p className="text-base font-black text-slate-900">
                                                        {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(item.ending_stock || 0)}
                                                    </p>
                                                    <p className="text-[8px] font-bold text-indigo-400 italic">ID: {item.item_name || 'MANUAL'}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                                <button 
                                                    onClick={() => {
                                                        setDate(item.tanggal);
                                                        setAmount(item.ending_stock.toString());
                                                        setView('form');
                                                    }}
                                                    className="p-2.5 bg-white text-indigo-600 rounded-xl hover:bg-indigo-600 hover:text-white transition-all shadow-sm border border-slate-100"
                                                >
                                                    <EditIcon className="w-4 h-4" />
                                                </button>
                                                <button 
                                                    onClick={() => handleDeleteClick(item.tanggal)}
                                                    className="p-2.5 bg-white text-rose-500 rounded-xl hover:bg-rose-500 hover:text-white transition-all shadow-sm border border-slate-100"
                                                >
                                                    <TrashIcon className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default EndingInventoryForm;
