
import React, { useState, useEffect } from 'react';
import type { StockItem, MasterItem, TradingPurchaseRecord } from '../types';
import { XIcon } from './icons';
import CurrencyInput from './CurrencyInput';

interface TradingPurchaseFormProps {
    stock: StockItem[];
    masterItems: MasterItem[];
    onSubmit: (data: { date: Date; itemName: string; quantity: number; pricePerKg: number }) => void;
    onCancel: () => void;
    initialData?: TradingPurchaseRecord;
}

const TradingPurchaseForm: React.FC<TradingPurchaseFormProps> = ({ stock, masterItems, onSubmit, onCancel, initialData }) => {
    const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
    const [itemName, setItemName] = useState(masterItems[0]?.name || '');
    const [quantity, setQuantity] = useState(0);
    const [pricePerKg, setPricePerKg] = useState(0);

    useEffect(() => {
        if (initialData) {
            setDate(new Date(initialData.tanggal).toISOString().slice(0, 10));
            setItemName(initialData.item_name);
            setQuantity(initialData.kg);
            setPricePerKg(initialData.harga_per_kg || 0);
        }
    }, [initialData]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!itemName || quantity <= 0 || pricePerKg <= 0) {
            alert('Mohon lengkapi data: Tanggal, Item, Kg, dan Harga.');
            return;
        }
        onSubmit({
            date: new Date(date),
            itemName,
            quantity,
            pricePerKg,
        });
    };

    const currentStock = stock.find(item => item.name === itemName)?.quantity || 0;

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex justify-center items-center p-4">
            <form onSubmit={handleSubmit} className="bg-white p-8 rounded-[2.5rem] shadow-2xl w-full max-w-lg border border-slate-100">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h2 className="text-2xl font-black text-slate-900 tracking-tighter uppercase">{initialData ? 'Edit Trading' : 'Pembelian Trading'}</h2>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Input Barang Masuk (Beli)</p>
                    </div>
                    <button onClick={onCancel} type="button" className="p-2 hover:bg-slate-50 rounded-full transition-colors">
                        <XIcon/>
                    </button>
                </div>

                <div className="space-y-5">
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2">Tanggal Pembelian</label>
                        <input
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-slate-900 font-bold outline-none focus:ring-4 focus:ring-emerald-500/10 transition-all"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2">Nama Produk / Item</label>
                        <select
                            value={itemName}
                            onChange={e => setItemName(e.target.value)}
                            className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-slate-900 font-bold outline-none focus:ring-4 focus:ring-emerald-500/10 transition-all"
                        >
                            {masterItems.map(item => <option key={item.name} value={item.name}>{item.name}</option>)}
                        </select>
                        <p className="text-[10px] font-bold text-slate-400 mt-2 ml-1">STOK SAAT INI: <span className="text-slate-900">{currentStock.toLocaleString('id-ID')} Kg</span></p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2">Jumlah (Kg)</label>
                            <input
                                type="number"
                                value={quantity === 0 ? '' : quantity}
                                onChange={e => setQuantity(parseFloat(e.target.value) || 0)}
                                className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-slate-900 font-bold outline-none transition-all"
                                placeholder="0"
                                step="0.01"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2">Harga Beli / Kg</label>
                            <CurrencyInput
                                value={pricePerKg === 0 ? '' : pricePerKg}
                                onChange={val => setPricePerKg(parseFloat(val) || 0)}
                                className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-slate-900 font-bold outline-none transition-all"
                                placeholder="0"
                                required
                            />
                        </div>
                    </div>

                    {quantity > 0 && pricePerKg > 0 && (
                        <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
                            <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">Total Biaya Belanja:</p>
                            <p className="text-xl font-black text-emerald-600">{(quantity * pricePerKg).toLocaleString('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 })}</p>
                        </div>
                    )}
                </div>
                
                <div className="flex gap-3 mt-8">
                    <button type="button" onClick={onCancel} className="flex-1 py-4 bg-slate-100 text-slate-500 font-black text-xs rounded-2xl uppercase tracking-widest hover:bg-slate-200 transition-all">
                        Batal
                    </button>
                    <button
                        type="submit"
                        disabled={quantity <= 0 || pricePerKg <= 0}
                        className="flex-1 py-4 bg-slate-900 text-white font-black text-xs rounded-2xl uppercase tracking-widest hover:bg-emerald-600 shadow-lg shadow-slate-100 transition-all disabled:bg-slate-200 disabled:shadow-none"
                    >
                        {initialData ? 'Simpan Perubahan' : 'Simpan Pembelian'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default TradingPurchaseForm;
