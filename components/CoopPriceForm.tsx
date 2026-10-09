
import React, { useState, useMemo, useEffect } from 'react';
import type { ProductionRecord } from '../types';
import { XIcon } from './icons';
import CurrencyInput from './CurrencyInput';

interface CoopPriceFormProps {
    productionHistory: any[]; 
    onUpdatePrices: (updates: { recordId: string, pricePerKg: number }[]) => void;
    onCancel: () => void;
}

const CoopPriceForm: React.FC<CoopPriceFormProps> = ({ productionHistory, onUpdatePrices, onCancel }) => {
    const [selectedDate, setSelectedDate] = useState(new Date().toLocaleDateString('en-CA'));
    const [prices, setPrices] = useState<{ [recordId: string]: number }>({});

    const recordsForDate = useMemo(() => {
        if (!selectedDate) return [];
        return productionHistory.filter(record => {
            const recordDate = record.dateStr || (record.date instanceof Date ? record.date.toISOString().slice(0, 10) : new Date(record.date).toISOString().slice(0, 10));
            return recordDate === selectedDate;
        }).sort((a, b) => a.truckNumber - b.truckNumber);
    }, [productionHistory, selectedDate]);

    useEffect(() => {
        const initialPrices = recordsForDate.reduce((acc, record) => {
            acc[record.id] = record.pricePerKg || 0;
            return acc;
        }, {} as { [recordId: string]: number });
        setPrices(initialPrices);
    }, [recordsForDate]);

    const handlePriceChange = (recordId: string, value: string) => {
        const price = parseFloat(value);
        setPrices(prev => ({
            ...prev,
            [recordId]: isNaN(price) ? 0 : price
        }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const updates = Object.entries(prices)
            .map(([recordId, pricePerKg]) => ({ recordId, pricePerKg }));

        if (updates.length > 0) {
            onUpdatePrices(updates);
        } else {
            alert('Tidak ada data produksi untuk tanggal ini.');
        }
    };
    
    return (
        <div className="bg-white p-5 md:p-8 rounded-2xl md:rounded-[2.5rem] border border-slate-100 shadow-sm animate-in fade-in duration-500">
            <div className="flex items-center gap-3 mb-5">
                <div className="w-1 h-8 bg-blue-600 rounded-full" />
                <h3 className="text-base md:text-xl font-black text-slate-900 tracking-tight uppercase">UPDATE HARGA BELI LB</h3>
            </div>
            
            <div className="flex flex-wrap items-center gap-4 mb-6 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                <div className="flex-1 min-w-[180px]">
                    <label className="block text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5">Tanggal Produksi</label>
                    <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="w-full px-3 py-2 md:px-5 md:py-4 bg-white border border-slate-200 rounded-xl md:rounded-2xl text-[10px] md:text-sm font-bold outline-none"
                        required
                    />
                </div>
                <div className="text-slate-300 text-[8px] font-bold uppercase tracking-widest pt-5">
                    {recordsForDate.length} MOBIL
                </div>
            </div>

            <div className="overflow-hidden border border-slate-100 rounded-2xl">
                 {recordsForDate.length === 0 ? (
                    <div className="text-center py-10 bg-slate-50/30">
                        <p className="text-slate-300 font-bold text-[9px] uppercase tracking-widest italic">Tidak ada data produksi</p>
                    </div>
                 ) : (
                    <table className="min-w-full divide-y divide-slate-100">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-[8px] font-black text-slate-400 uppercase tracking-widest">Truk</th>
                                <th className="px-4 py-3 text-left text-[8px] font-black text-slate-400 uppercase tracking-widest">Kandang</th>
                                <th className="px-4 py-3 text-right text-[8px] font-black text-slate-400 uppercase tracking-widest">Kg</th>
                                <th className="px-4 py-3 text-center text-[8px] font-black text-slate-400 uppercase tracking-widest">Harga / Kg</th>
                            </tr>
                        </thead>
                         <tbody className="bg-white divide-y divide-slate-50">
                            {recordsForDate.map(record => (
                                <tr key={record.id} className="hover:bg-slate-50">
                                    <td className="px-4 py-3 font-black text-slate-900 text-[10px] uppercase whitespace-nowrap">Mobil {record.truckNumber}</td>
                                    <td className="px-4 py-3 text-[9px] font-bold text-slate-500 uppercase truncate max-w-[100px]">{record.coopName}</td>
                                    <td className="px-4 py-3 text-right font-mono text-[10px] font-black text-slate-700">{record.initialKg.toLocaleString('id-ID')}</td>
                                    <td className="px-4 py-3">
                                        <CurrencyInput
                                            value={prices[record.id] === 0 ? '' : prices[record.id]}
                                            onChange={val => handlePriceChange(record.id, val.toString())}
                                            className="w-full px-2 py-1 bg-slate-50 border border-slate-100 rounded-lg text-right font-black text-slate-900 text-[10px] focus:ring-1 focus:ring-blue-500 outline-none"
                                            placeholder="0"
                                        />
                                    </td>
                                </tr>
                            ))}
                         </tbody>
                    </table>
                 )}
            </div>

            <div className="flex justify-end mt-6">
                <button
                    onClick={handleSubmit}
                    disabled={recordsForDate.length === 0}
                    className="w-full sm:w-auto py-3 px-8 bg-slate-900 text-white rounded-xl font-black text-[9px] uppercase tracking-widest transition-all disabled:bg-slate-200"
                >
                    SIMPAN PERUBAHAN
                </button>
            </div>
        </div>
    );
};

export default CoopPriceForm;
