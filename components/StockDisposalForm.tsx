
import React, { useState, useEffect } from 'react';
import type { StockItem, MasterItem, StockDisposalRecord } from '../types';
import { XIcon } from './icons';

interface StockDisposalFormProps {
    stock: StockItem[];
    masterItems: MasterItem[];
    onSubmit: (data: { date: Date; itemName: string; quantity: number; notes: string; pricePerKg: number }) => void;
    onCancel: () => void;
    initialData?: StockDisposalRecord;
}

const StockDisposalForm: React.FC<StockDisposalFormProps> = ({ stock, masterItems, onSubmit, onCancel, initialData }) => {
    const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
    const [itemName, setItemName] = useState(masterItems[0]?.name || '');
    const [quantity, setQuantity] = useState(0);
    const [pricePerKg, setPricePerKg] = useState(0);
    const [notes, setNotes] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        if (initialData) {
            setDate(new Date(initialData.tanggal).toISOString().slice(0, 10));
            setItemName(initialData.item_name);
            setQuantity(initialData.kg);
            setPricePerKg(initialData.harga_valuasi_kg || 0);
            setNotes(initialData.keterangan || '');
        }
    }, [initialData]);

    const currentStock = stock.find(item => item.name === itemName)?.quantity || 0;

    const handleQuantityChange = (value: string) => {
        const qty = parseFloat(value) || 0;
        // If editing, allow quantity up to currentStock + initialData.kg
        const maxStock = initialData && initialData.item_name === itemName 
            ? currentStock + initialData.kg 
            : currentStock;
            
        if (qty > maxStock) {
            setError(`Stok tidak cukup. Maksimal: ${maxStock} Kg`);
        } else {
            setError('');
        }
        setQuantity(qty);
    };
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!itemName || quantity <= 0) {
            alert('Mohon pilih item dan isi kuantitas lebih dari nol.');
            return;
        }
        const maxStock = initialData && initialData.item_name === itemName 
            ? currentStock + initialData.kg 
            : currentStock;
        if (quantity > maxStock) {
            alert('Kuantitas pemusnahan melebihi stok yang ada.');
            return;
        }
        if (pricePerKg <= 0) {
            alert('Mohon isi harga per Kg untuk estimasi kerugian.');
            return;
        }
        onSubmit({
            date: new Date(date),
            itemName,
            quantity,
            notes,
            pricePerKg
        });
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex justify-center items-center p-4">
            <form onSubmit={handleSubmit} className="bg-white p-8 rounded-[2.5rem] shadow-2xl w-full max-w-lg border border-slate-100">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h2 className="text-2xl font-black text-slate-900 tracking-tighter uppercase">{initialData ? 'Edit Pemusnahan' : 'Pemusnahan Stok'}</h2>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Input Data Kerugian</p>
                    </div>
                    <button onClick={onCancel} type="button" className="p-2 hover:bg-slate-50 rounded-full transition-colors">
                        <XIcon/>
                    </button>
                </div>

                <div className="space-y-5">
                     <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2">Tanggal Kejadian</label>
                        <input
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-slate-900 font-bold outline-none focus:ring-4 focus:ring-red-500/10 transition-all"
                            required
                        />
                    </div>
                     <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2">Nama Item</label>
                        <select
                            value={itemName}
                            onChange={e => {
                                setItemName(e.target.value);
                                setQuantity(0);
                                setError('');
                            }}
                             className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-slate-900 font-bold outline-none focus:ring-4 focus:ring-red-500/10 transition-all"
                        >
                            {stock.filter(s => s.quantity > 0 || (initialData && initialData.item_name === s.name)).map(part => <option key={part.name} value={part.name}>{part.name}</option>)}
                        </select>
                         <p className="text-[10px] font-bold text-slate-400 mt-2 ml-1">STOK TERSEDIA: <span className="text-slate-900">{(initialData && initialData.item_name === itemName ? currentStock + initialData.kg : currentStock).toLocaleString('id-ID')} Kg</span></p>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2">Jumlah (Kg)</label>
                            <input
                                type="number"
                                value={quantity === 0 ? '' : quantity}
                                onChange={e => handleQuantityChange(e.target.value)}
                                className={`w-full px-5 py-4 bg-slate-50 border ${error ? 'border-red-500' : 'border-slate-100'} rounded-2xl text-slate-900 font-bold outline-none transition-all`}
                                placeholder="0"
                                step="0.01"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2">Harga/Kg (Rp)</label>
                            <input
                                type="number"
                                value={pricePerKg === 0 ? '' : pricePerKg}
                                onChange={e => setPricePerKg(parseFloat(e.target.value) || 0)}
                                className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-slate-900 font-bold outline-none transition-all"
                                placeholder="0"
                                required
                            />
                        </div>
                    </div>

                    {quantity > 0 && pricePerKg > 0 && (
                        <div className="bg-rose-50 p-4 rounded-2xl border border-rose-100">
                            <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-1">Estimasi Kerugian:</p>
                            <p className="text-xl font-black text-rose-600">{(quantity * pricePerKg).toLocaleString('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 })}</p>
                        </div>
                    )}

                     <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2">Alasan Pemusnahan</label>
                        <textarea
                            rows={2}
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-slate-900 font-bold outline-none focus:ring-4 focus:ring-red-500/10 transition-all"
                            placeholder="Contoh: Barang Rusak / Expired"
                            required
                        />
                    </div>
                </div>
                
                <div className="flex gap-3 mt-8">
                    <button type="button" onClick={onCancel} className="flex-1 py-4 bg-slate-100 text-slate-500 font-black text-xs rounded-2xl uppercase tracking-widest hover:bg-slate-200 transition-all">
                        Batal
                    </button>
                    <button
                        type="submit"
                        disabled={!!error || quantity <= 0 || pricePerKg <= 0}
                        className="flex-1 py-4 bg-red-600 text-white font-black text-xs rounded-2xl uppercase tracking-widest hover:bg-red-700 shadow-lg shadow-red-100 transition-all disabled:bg-slate-200 disabled:shadow-none"
                    >
                        {initialData ? 'Simpan Perubahan' : 'Konfirmasi'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default StockDisposalForm;
