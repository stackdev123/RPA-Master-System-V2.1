import React, { useState, useEffect } from 'react';
import type { ProductionItems, Coop, MasterItem } from '../types';
import { PlusIcon, TrashIcon, XIcon } from './icons';

interface ProductionEditModalProps {
    record: any;
    coops: Coop[];
    licensePlates: string[];
    masterItems: MasterItem[];
    onSubmit: (items: any[], isApplied: boolean) => void;
    onCancel: () => void;
}

const ProductionEditModal: React.FC<ProductionEditModalProps> = ({ record, coops, licensePlates, masterItems, onSubmit, onCancel }) => {
    const [truckNumber, setTruckNumber] = useState(record.truckNumber);
    const [coopName, setCoopName] = useState(record.coopName);
    const [driver, setDriver] = useState(record.driver);
    const [licensePlate, setLicensePlate] = useState(record.licensePlate || '');
    const [initialEkor, setInitialEkor] = useState(record.initialEkor);
    const [initialKg, setInitialKg] = useState(record.initialKg);
    const [pricePerKg, setPricePerKg] = useState(record.pricePerKg || 0);
    const [mortality, setMortality] = useState(record.mortality || 0);
    const [mortalityKg, setMortalityKg] = useState(record.mortalityKg || 0);
    const [date, setDate] = useState(new Date(record.date).toISOString().slice(0, 10));

    const [rows, setRows] = useState<{ id: string, name: string, qty: string }[]>(() => {
        return Object.entries(record.items).map(([name, qty]) => ({
            id: `row-${Math.random()}`,
            name,
            qty: String(qty)
        }));
    });

    const handleAddRow = () => setRows([...rows, { id: `row-${Date.now()}`, name: '', qty: '' }]);
    const handleRemoveRow = (id: string) => setRows(rows.filter(r => r.id !== id));
    const handleUpdateRow = (id: string, field: string, value: string) => {
        setRows(rows.map(r => r.id === id ? { ...r, [field]: value } : r));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const updates = rows
            .filter(r => r.name && parseFloat(r.qty) > 0)
            .map(r => ({
                tanggal_produksi: date,
                item_name: r.name,
                qty: parseFloat(r.qty),
                ekor: initialEkor,
                kg: initialKg,
                mobil: truckNumber.toString(),
                harga_beli_kg: pricePerKg,
                kematian_ekor: mortality,
                kematian_kg: mortalityKg,
                nama_kandang: coopName,
                driver: driver
            }));

        if (updates.length === 0) return alert('Input minimal satu item!');
        onSubmit(updates, record.isApplied || true);
    };

    return (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-[500] flex justify-center items-center p-4">
            <div className="bg-white w-full max-w-4xl rounded-[2.5rem] shadow-2xl flex flex-col max-h-[95vh] border border-slate-200 overflow-hidden">
                <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div>
                        <h2 className="text-2xl font-black text-slate-800 tracking-tighter uppercase leading-none">Edit Produksi</h2>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Update Data & Sinkronisasi Stok</p>
                    </div>
                    <button onClick={onCancel} className="p-2 text-slate-400 hover:text-slate-900 transition-colors"><XIcon /></button>
                </div>

                <form onSubmit={handleSubmit} className="flex-1 overflow-hidden flex flex-col p-8 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 overflow-y-auto no-scrollbar pr-2">
                        <div className="space-y-4">
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1 border-b border-slate-100 pb-2 mb-4">Informasi Unit</h3>
                            <div>
                                <label className="block text-[8px] font-black text-slate-400 uppercase mb-1 ml-1">Tanggal</label>
                                <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm" required />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-[8px] font-black text-slate-400 uppercase mb-1 ml-1">Mobil #</label>
                                    <input type="number" value={truckNumber} onChange={e => setTruckNumber(parseInt(e.target.value))} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm" />
                                </div>
                                <div>
                                    <label className="block text-[8px] font-black text-slate-400 uppercase mb-1 ml-1">Plat</label>
                                    <select 
                                        value={licensePlate} 
                                        onChange={e => setLicensePlate(e.target.value)} 
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm"
                                        required
                                    >
                                        <option value="">Pilih Plat...</option>
                                        {licensePlates.map(p => <option key={p} value={p}>{p}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-[8px] font-black text-slate-400 uppercase mb-1 ml-1">Kandang</label>
                                <select value={coopName} onChange={e => setCoopName(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm">
                                    {coops.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-[8px] font-black text-slate-400 uppercase mb-1 ml-1">Ekor (Kandang)</label>
                                    <input type="number" value={initialEkor} onChange={e => setInitialEkor(parseInt(e.target.value) || 0)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm" placeholder="0" />
                                </div>
                                <div>
                                    <label className="block text-[8px] font-black text-slate-400 uppercase mb-1 ml-1">Kg (Kandang)</label>
                                    <input type="number" step="0.01" value={initialKg} onChange={e => setInitialKg(parseFloat(e.target.value) || 0)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm" placeholder="0.00" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-[8px] font-black text-slate-400 uppercase mb-1 ml-1">Kematian (Ekor)</label>
                                    <input type="number" value={mortality} onChange={e => setMortality(parseInt(e.target.value) || 0)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm" placeholder="0" />
                                </div>
                                <div>
                                    <label className="block text-[8px] font-black text-slate-400 uppercase mb-1 ml-1">Kematian (Kg)</label>
                                    <input type="number" step="0.01" value={mortalityKg} onChange={e => setMortalityKg(parseFloat(e.target.value) || 0)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm" placeholder="0.00" />
                                </div>
                            </div>
                        </div>

                        <div className="md:col-span-2 space-y-4">
                            <div className="flex justify-between items-center border-b border-slate-100 pb-2 mb-4">
                                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Rincian Hasil (Kg)</h3>
                                <button type="button" onClick={handleAddRow} className="text-[9px] font-black text-indigo-600 uppercase hover:underline">+ Tambah Baris</button>
                            </div>
                            
                            <div className="space-y-2 max-h-[300px] overflow-y-auto no-scrollbar">
                                {rows.map((row) => (
                                    <div key={row.id} className="flex gap-2 items-center bg-slate-50/50 p-2 rounded-xl border border-slate-100 group">
                                        <select value={row.name} onChange={e => handleUpdateRow(row.id, 'name', e.target.value)} className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-black uppercase">
                                            <option value="">Pilih Part</option>
                                            {masterItems.map(m => <option key={m.name} value={m.name}>{m.name}</option>)}
                                        </select>
                                        <input type="number" value={row.qty} onChange={e => handleUpdateRow(row.id, 'qty', e.target.value)} className="w-24 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-black text-right" placeholder="0.00" />
                                        <button type="button" onClick={() => handleRemoveRow(row.id)} className="p-2 text-slate-300 hover:text-rose-500 transition-colors"><TrashIcon className="h-4 w-4"/></button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="pt-6 border-t border-slate-100 flex justify-end gap-3 mt-auto">
                        <button type="button" onClick={onCancel} className="px-8 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200">Batal</button>
                        <button type="submit" className="px-10 py-4 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all active:scale-95">Update Data</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ProductionEditModal;
