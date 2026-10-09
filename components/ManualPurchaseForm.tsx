import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { Customer, LedgerEntry } from '../types';
import { XIcon, ChevronDownIcon } from './icons';
import CurrencyInput from './CurrencyInput';

interface ManualPurchaseFormProps {
    customers: Customer[];
    onSubmit: (data: Omit<LedgerEntry, 'id' | 'balance' | 'credit' | 'timestamp'>) => void;
    onCancel: () => void;
}

const SearchableCustomerSelect = ({ options, value, onChange }: { options: string[], value: string, onChange: (val: string) => void }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredOptions = useMemo(() => {
        return options.filter(opt => opt.toLowerCase().includes(search.toLowerCase()));
    }, [options, search]);

    return (
        <div className="relative w-full" ref={containerRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-slate-900 font-bold outline-none hover:border-indigo-200 transition-all text-left"
            >
                <span className="truncate">{value || '-- Pilih Customer --'}</span>
                <ChevronDownIcon className={`h-5 w-5 text-slate-300 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-100 shadow-2xl rounded-2xl z-[150] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                    <div className="p-3 border-b border-slate-50">
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Cari pelanggan..."
                            className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/10"
                            autoFocus
                        />
                    </div>
                    <div className="max-h-60 overflow-y-auto no-scrollbar py-1">
                        {filteredOptions.length === 0 ? (
                            <p className="px-4 py-3 text-xs font-bold text-slate-400 text-center uppercase tracking-widest italic">Tidak ditemukan</p>
                        ) : (
                            filteredOptions.map((opt) => (
                                <button
                                    key={opt}
                                    type="button"
                                    onClick={() => { onChange(opt); setIsOpen(false); setSearch(''); }}
                                    className={`w-full text-left px-5 py-3 text-xs font-black uppercase transition-colors hover:bg-slate-50 ${value === opt ? 'text-indigo-600 bg-indigo-50/50' : 'text-slate-600'}`}
                                >
                                    {opt}
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

const ManualPurchaseForm: React.FC<ManualPurchaseFormProps> = ({ customers, onSubmit, onCancel }) => {
    const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
    const [customerId, setCustomerId] = useState('');
    const [amount, setAmount] = useState<number>(0);
    const [description, setDescription] = useState('Pembelian Lama / Manual');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!customerId || amount <= 0) {
            alert('Mohon pilih pelanggan dan isi nominal pembelian.');
            return;
        }
        onSubmit({
            customerId,
            date: new Date(date),
            description,
            debit: amount,
        });
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex justify-center items-center p-4">
            <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in duration-300">
                <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                    <div>
                        <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Input Pembelian Lama</h3>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Mencatat Hutang Manual</p>
                    </div>
                    <button onClick={onCancel} className="p-2 hover:bg-white rounded-full transition-colors"><XIcon /></button>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-6">
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Tanggal Transaksi</label>
                        <input
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-slate-900 font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Pilih Pelanggan</label>
                        <SearchableCustomerSelect 
                            options={customers.map(c => c.name)}
                            value={customerId}
                            onChange={setCustomerId}
                        />
                    </div>

                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Nominal Pembelian (Rp)</label>
                        <div className="relative">
                            <span className="absolute left-5 top-1/2 -translate-y-1/2 font-black text-slate-300">Rp</span>
                            <CurrencyInput
                                value={amount === 0 ? '' : amount}
                                onChange={(val) => setAmount(Number(val))}
                                className="w-full pl-14 pr-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-slate-900 font-black outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
                                placeholder="0"
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Keterangan (Opsional)</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-slate-900 font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
                            rows={2}
                        />
                    </div>

                    <div className="pt-4 flex gap-3">
                        <button type="button" onClick={onCancel} className="flex-1 py-4 bg-slate-100 text-slate-500 font-black text-xs rounded-2xl uppercase tracking-widest hover:bg-slate-200 transition-all">Batal</button>
                        <button type="submit" className="flex-1 py-4 bg-indigo-600 text-white font-black text-xs rounded-2xl uppercase tracking-widest hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all">Simpan Data</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ManualPurchaseForm;