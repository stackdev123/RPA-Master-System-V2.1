import React, { useState } from 'react';
import type { Coop, LBArrivalRecord } from '../types';
import CurrencyInput from './CurrencyInput';

interface LBArrivalFormProps {
    onSubmit: (arrivalData: {
        date: string;
        truckNumber: number;
        noDo: string;
        coopName: string;
        driver: string;
        licensePlate: string;
        initialEkor: number;
        initialKg: number;
        mortality: number;
        mortalityKg: number;
        pricePerKg: number;
    }) => Promise<void>;
    coops: Coop[];
    licensePlates: string[];
    existingArrivals?: LBArrivalRecord[];
    onGoToProduction?: (arrival: LBArrivalRecord) => void;
    onDeleteArrival?: (id: string) => Promise<void>;
}

export const LBArrivalForm: React.FC<LBArrivalFormProps> = ({ 
    onSubmit, 
    coops, 
    licensePlates,
    existingArrivals = [],
    onGoToProduction,
    onDeleteArrival
}) => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
    const [truckNumber, setTruckNumber] = useState(1);
    const [noDo, setNoDo] = useState('');
    const [coopName, setCoopName] = useState('');
    const [driver, setDriver] = useState('');
    const [licensePlate, setLicensePlate] = useState('');
    const [initialEkor, setInitialEkor] = useState(0);
    const [initialKg, setInitialKg] = useState(0);
    const [mortality, setMortality] = useState(0);
    const [mortalityKg, setMortalityKg] = useState(0);
    const [pricePerKg, setPricePerKg] = useState(0);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!coopName.trim()) { alert('Pilih Supplier / Kandang!'); return; }
        if (!noDo.trim()) { alert('Masukkan Nomor DO Truk!'); return; }

        setIsSubmitting(true);
        try {
            await onSubmit({
                date,
                truckNumber,
                noDo,
                coopName,
                driver,
                licensePlate,
                initialEkor,
                initialKg,
                mortality,
                mortalityKg,
                pricePerKg
            });
            alert('Kedatangan Live Bird (LB) berhasil dicatat dan masuk antrian!');
            setTruckNumber(prev => prev + 1);
            setNoDo('');
            setCoopName('');
            setDriver('');
            setLicensePlate('');
            setInitialEkor(0);
            setInitialKg(0);
            setMortality(0);
            setMortalityKg(0);
            setPricePerKg(0);
        } catch (error: any) {
            console.error("LB Arrival Submit Error:", error);
            alert('Gagal menyimpan kedatangan LB: ' + error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const inputClasses = "mt-1 block w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold placeholder:text-slate-300 focus:outline-none focus:ring-4 focus:ring-red-500/10 focus:border-red-500/40 transition-all duration-200 text-sm";
    const labelClasses = "block text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1";

    return (
        <div className="space-y-8 max-w-5xl mx-auto">
            <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 md:p-10 rounded-[2.5rem] border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
                    <div>
                        <h3 className="text-base font-black text-slate-900 tracking-tight uppercase flex items-center gap-2">
                            <div className="w-1.5 h-6 bg-red-600 rounded-full" />
                            Form Kedatangan Live Bird (Timbangan Masuk LB)
                        </h3>
                        <p className="text-xs text-slate-400 mt-1">Catat kedatangan truk, supplier, nomor DO, dan timbangan awal ayam hidup sebelum diproses.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                    <div>
                        <label className={labelClasses}>Tanggal Kedatangan</label>
                        <input 
                            type="date" 
                            value={date} 
                            onChange={e => setDate(e.target.value)} 
                            className={inputClasses} 
                            required 
                        />
                    </div>
                    <div>
                        <label className={labelClasses}>Nomor DO Truk</label>
                        <input 
                            type="text" 
                            value={noDo} 
                            onChange={e => setNoDo(e.target.value)} 
                            className={inputClasses} 
                            placeholder="Contoh: DO/2026/001" 
                            required 
                        />
                    </div>
                    <div>
                        <label className={labelClasses}>Mobil Ke-</label>
                        <input 
                            type="number" 
                            value={truckNumber} 
                            onChange={e => setTruckNumber(parseInt(e.target.value) || 1)} 
                            onWheel={(e) => (e.target as HTMLInputElement).blur()}
                            className={inputClasses} 
                            required 
                        />
                    </div>
                    <div>
                        <label className={labelClasses}>Plat Nomor (Input Manual)</label>
                        <input 
                            type="text" 
                            value={licensePlate} 
                            onChange={e => setLicensePlate(e.target.value)} 
                            className={inputClasses}
                            list="plate-options"
                            placeholder="Contoh: B 1234 XYZ"
                            required
                        />
                        <datalist id="plate-options">
                            {licensePlates.map(plate => (
                                <option key={plate} value={plate} />
                            ))}
                        </datalist>
                    </div>
                    <div>
                        <label className={labelClasses}>Supplier / Kandang (Master Data)</label>
                        <input 
                            type="text" 
                            value={coopName} 
                            onChange={e => setCoopName(e.target.value)} 
                            className={inputClasses} 
                            list="coop-names" 
                            placeholder="Pilih atau ketik Kandang/Supplier..." 
                            required 
                        />
                        <datalist id="coop-names">{coops.map(coop => <option key={coop.name} value={coop.name} />)}</datalist>
                    </div>
                    <div>
                        <label className={labelClasses}>Driver / Supir (Input Manual)</label>
                        <input 
                            type="text" 
                            value={driver} 
                            onChange={e => setDriver(e.target.value)} 
                            className={inputClasses} 
                            placeholder="Nama Supir..." 
                        />
                    </div>
                </div>

                <div className="bg-slate-900 p-6 rounded-[2rem] shadow-xl text-white space-y-4">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Detail Timbangan Ayam Hidup (LB)</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                            <label className="block text-[7px] md:text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Total Ekor (Pcs)</label>
                            <input 
                                type="number" 
                                value={initialEkor || ''} 
                                onChange={e => setInitialEkor(parseInt(e.target.value) || 0)} 
                                onWheel={(e) => (e.target as HTMLInputElement).blur()}
                                className="w-full bg-slate-800 border-none rounded-xl py-2.5 px-4 text-white font-black text-sm outline-none focus:ring-2 focus:ring-red-500" 
                                placeholder="0"
                            />
                        </div>
                        <div>
                            <label className="block text-[7px] md:text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Total Kg (Berat LB)</label>
                            <input 
                                type="number" 
                                value={initialKg || ''} 
                                onChange={e => setInitialKg(parseFloat(e.target.value) || 0)} 
                                onWheel={(e) => (e.target as HTMLInputElement).blur()}
                                className="w-full bg-slate-800 border-none rounded-xl py-2.5 px-4 text-white font-black text-sm outline-none focus:ring-2 focus:ring-red-500" 
                                placeholder="0.00" 
                                step="0.01"
                            />
                        </div>
                        <div>
                            <label className="block text-[7px] md:text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Kematian (Ekor)</label>
                            <input 
                                type="number" 
                                value={mortality || ''} 
                                onChange={e => setMortality(parseInt(e.target.value) || 0)} 
                                onWheel={(e) => (e.target as HTMLInputElement).blur()}
                                className="w-full bg-slate-800 border-none rounded-xl py-2.5 px-4 text-white font-black text-sm outline-none focus:ring-2 focus:ring-red-500" 
                                placeholder="0"
                            />
                        </div>
                        <div>
                            <label className="block text-[7px] md:text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Kematian (Kg)</label>
                            <input 
                                type="number" 
                                value={mortalityKg || ''} 
                                onChange={e => setMortalityKg(parseFloat(e.target.value) || 0)} 
                                onWheel={(e) => (e.target as HTMLInputElement).blur()}
                                className="w-full bg-slate-800 border-none rounded-xl py-2.5 px-4 text-white font-black text-sm outline-none focus:ring-2 focus:ring-red-500" 
                                placeholder="0.00" 
                                step="0.01"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-[7px] md:text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Harga Beli / Kg (Rp)</label>
                        <CurrencyInput 
                            value={pricePerKg === 0 ? '' : pricePerKg} 
                            onChange={val => setPricePerKg(parseFloat(val) || 0)} 
                            className="w-full bg-indigo-950/80 border-none rounded-xl py-2.5 px-4 text-indigo-200 font-black text-sm outline-none focus:ring-2 focus:ring-indigo-400" 
                            placeholder="0" 
                        />
                    </div>
                </div>

                <div className="flex justify-end pt-4">
                    <button type="submit" disabled={isSubmitting} className="px-8 py-4 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-red-200 cursor-pointer">
                        {isSubmitting ? 'Menyimpan...' : 'Simpan Kedatangan LB'}
                    </button>
                </div>
            </form>

            {/* Daftar Truk Kedatangan LB */}
            {existingArrivals.length > 0 && (
                <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                        <h4 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                            Daftar Truk Kedatangan LB Terdaftar ({existingArrivals.length})
                        </h4>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {existingArrivals.map((arr) => {
                            const isPending = arr.status !== 'completed';
                            return (
                                <div key={arr.id} className="p-4 rounded-2xl border border-slate-100 bg-slate-50/70 hover:bg-white hover:border-slate-300 transition-all flex flex-col justify-between space-y-3">
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase bg-slate-200 text-slate-700">
                                                Mobil #{arr.truckNumber}
                                            </span>
                                            <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase ${
                                                isPending ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                                            }`}>
                                                {isPending ? 'Menunggu Produksi' : 'Selesai Diproduksi'}
                                            </span>
                                        </div>
                                        <h5 className="font-black text-slate-900 text-sm">{arr.coopName}</h5>
                                        <div className="text-[10px] text-slate-500 space-y-0.5 mt-1">
                                            <p><span className="font-semibold text-slate-600">No. DO:</span> {arr.noDo || '-'}</p>
                                            <p><span className="font-semibold text-slate-600">Plat:</span> {arr.licensePlate || '-'} | <span className="font-semibold text-slate-600">Driver:</span> {arr.driver || '-'}</p>
                                            <p><span className="font-semibold text-slate-600">Berat LB:</span> <strong className="text-slate-800">{Number(arr.initialKg || 0).toLocaleString('id-ID')} Kg</strong> ({Number(arr.initialEkor || 0).toLocaleString('id-ID')} Ekor)</p>
                                            {arr.mortality > 0 && (
                                                <p className="text-rose-600 font-semibold">Mortalitas: {arr.mortality} Ekor ({arr.mortalityKg || 0} Kg)</p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                                        {isPending && onGoToProduction && (
                                            <button
                                                type="button"
                                                onClick={() => onGoToProduction(arr)}
                                                className="flex-1 py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-black uppercase rounded-xl transition-all cursor-pointer text-center"
                                            >
                                                ➔ Input Hasil Produksi
                                            </button>
                                        )}
                                        {onDeleteArrival && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (window.confirm(`Hapus kedatangan truk #${arr.truckNumber} (${arr.coopName})?`)) {
                                                        onDeleteArrival(arr.id);
                                                    }
                                                }}
                                                className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer text-xs"
                                                title="Hapus"
                                            >
                                                ✕
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};
