import React, { useState, useMemo, useCallback, useEffect } from 'react';
import type { ProductionItems, Coop, MasterItem, LBArrivalRecord } from '../types';
import CurrencyInput from './CurrencyInput';

interface ProductionFormProps {
    onSubmit: (
        truckNumber: number, 
        coopName: string, 
        driver: string, 
        licensePlate: string, 
        noDo: string, 
        initialEkor: number, 
        initialKg: number, 
        mortality: number, 
        mortalityKg: number, 
        items: ProductionItems, 
        pricePerKg: number, 
        autoApply: boolean, 
        date: string,
        arrivalId?: string
    ) => Promise<void> | void;
    coops: Coop[];
    licensePlates: string[];
    masterItems: MasterItem[];
    existingLogs: any[];
    pendingLogs?: any[]; 
    lbArrivals?: LBArrivalRecord[];
    selectedArrival?: LBArrivalRecord | null;
    onClearSelectedArrival?: () => void;
}

interface FormRow {
    id: string;
    name: string;
    qty: string;
}

// Komponen Baris di-memo agar input terasa sangat cepat (tidak re-render semua baris saat mengetik)
const ProductionRow = React.memo(({ 
    row, 
    index, 
    onUpdate,
    onKeyDown
}: { 
    row: FormRow, 
    index: number, 
    onUpdate: (id: string, field: keyof FormRow, value: string) => void,
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>) => void
}) => {
    return (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 bg-slate-50/50 p-3 sm:p-4 rounded-2xl sm:rounded-3xl border border-slate-100 group hover:border-emerald-200 transition-all">
            <div className="flex items-center justify-between sm:justify-start gap-2">
                <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-[9px] sm:text-[10px] font-black text-slate-400">
                    {index + 1}
                </div>
            </div>
            <div className="flex flex-row items-center gap-2 flex-1">
                <div className="flex-1">
                    <div className="w-full px-3 py-2.5 md:px-4 md:py-3 bg-white border border-slate-200 rounded-xl md:rounded-2xl text-[10px] md:text-[11px] font-black uppercase tracking-tight text-slate-700">
                        {row.name}
                    </div>
                </div>
                <div className="w-28 sm:w-36 relative">
                    <input 
                        type="number" 
                        value={row.qty} 
                        onChange={e => onUpdate(row.id, 'qty', e.target.value)} 
                        onKeyDown={onKeyDown}
                        onWheel={(e) => (e.target as HTMLInputElement).blur()}
                        className="production-qty-input w-full px-3 py-2.5 pr-8 md:px-4 md:py-3 md:pr-10 bg-white border border-slate-200 rounded-xl md:rounded-2xl text-right font-black text-slate-900 text-xs md:text-sm outline-none focus:ring-4 focus:ring-emerald-500/5 transition-all" 
                        placeholder="0.00" 
                        step="0.01" 
                    />
                    <span className="absolute right-3 md:right-4 top-1/2 -translate-y-1/2 text-[8px] md:text-[9px] font-black text-slate-300">Kg</span>
                </div>
            </div>
        </div>
    );
});

const ProductionForm: React.FC<ProductionFormProps> = ({ 
    onSubmit, 
    coops, 
    licensePlates, 
    masterItems, 
    existingLogs, 
    pendingLogs,
    lbArrivals = [],
    selectedArrival,
    onClearSelectedArrival
}) => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedArrivalId, setSelectedArrivalId] = useState<string>('');
    const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
    const [truckNumber, setTruckNumber] = useState(1);
    const [noDo, setNoDo] = useState("");
    const [coopName, setCoopName] = useState('');
    const [driver, setDriver] = useState('');
    const [licensePlate, setLicensePlate] = useState('');
    const [initialEkor, setInitialEkor] = useState(0);
    const [initialKg, setInitialKg] = useState(0);
    const [pricePerKg, setPricePerKg] = useState(0); 
    const [mortality, setMortality] = useState(0);
    const [mortalityKg, setMortalityKg] = useState(0);
    const [autoApply, setAutoApply] = useState(true);

    const [analysisDate, setAnalysisDate] = useState(new Date().toISOString().slice(0, 10));
    const [analysisCoop, setAnalysisCoop] = useState('all');

    const [rows, setRows] = useState<FormRow[]>([]);

    // Efek saat props selectedArrival dikirimkan (misal dari tombol "Input Hasil Produksi" di modul Kedatangan LB)
    useEffect(() => {
        if (selectedArrival) {
            setSelectedArrivalId(selectedArrival.id);
            if (selectedArrival.date) setDate(selectedArrival.date);
            if (selectedArrival.truckNumber) setTruckNumber(selectedArrival.truckNumber);
            if (selectedArrival.noDo) setNoDo(selectedArrival.noDo);
            if (selectedArrival.coopName) setCoopName(selectedArrival.coopName);
            if (selectedArrival.driver) setDriver(selectedArrival.driver);
            if (selectedArrival.licensePlate) setLicensePlate(selectedArrival.licensePlate);
            if (selectedArrival.initialEkor) setInitialEkor(Number(selectedArrival.initialEkor) || 0);
            if (selectedArrival.initialKg) setInitialKg(Number(selectedArrival.initialKg) || 0);
            if (selectedArrival.mortality) setMortality(Number(selectedArrival.mortality) || 0);
            if (selectedArrival.mortalityKg) setMortalityKg(Number(selectedArrival.mortalityKg) || 0);
            if (selectedArrival.pricePerKg) setPricePerKg(Number(selectedArrival.pricePerKg) || 0);
        }
    }, [selectedArrival]);

    const handleSelectArrival = useCallback((arrivalId: string) => {
        if (!arrivalId) {
            setSelectedArrivalId('');
            onClearSelectedArrival?.();
            return;
        }
        const found = lbArrivals.find(a => a.id === arrivalId);
        if (found) {
            setSelectedArrivalId(found.id);
            if (found.date) setDate(found.date);
            if (found.truckNumber) setTruckNumber(found.truckNumber);
            if (found.noDo) setNoDo(found.noDo);
            if (found.coopName) setCoopName(found.coopName);
            if (found.driver) setDriver(found.driver);
            if (found.licensePlate) setLicensePlate(found.licensePlate);
            if (found.initialEkor) setInitialEkor(Number(found.initialEkor) || 0);
            if (found.initialKg) setInitialKg(Number(found.initialKg) || 0);
            if (found.mortality) setMortality(Number(found.mortality) || 0);
            if (found.mortalityKg) setMortalityKg(Number(found.mortalityKg) || 0);
            if (found.pricePerKg) setPricePerKg(Number(found.pricePerKg) || 0);
        }
    }, [lbArrivals, onClearSelectedArrival]);

    const handleClearArrivalPull = () => {
        setSelectedArrivalId('');
        onClearSelectedArrival?.();
        setNoDo('');
        setCoopName('');
        setDriver('');
        setLicensePlate('');
        setInitialEkor(0);
        setInitialKg(0);
        setMortality(0);
        setMortalityKg(0);
        setPricePerKg(0);
    };

    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>) => {
        if (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            const inputs = Array.from(document.querySelectorAll('.production-qty-input')) as (HTMLInputElement | HTMLSelectElement)[];
            const currentIndex = inputs.indexOf(e.currentTarget);
            if (e.key === 'Enter' || e.key === 'ArrowDown') {
                if (currentIndex < inputs.length - 1) {
                    const nextInput = inputs[currentIndex + 1];
                    nextInput.focus();
                    if (nextInput instanceof HTMLInputElement && nextInput.type !== 'date') {
                        nextInput.select();
                    }
                }
            } else if (e.key === 'ArrowUp') {
                if (currentIndex > 0) {
                    const prevInput = inputs[currentIndex - 1];
                    prevInput.focus();
                    if (prevInput instanceof HTMLInputElement && prevInput.type !== 'date') {
                        prevInput.select();
                    }
                }
            }
        }
    }, []);

    const availableDates = useMemo(() => {
        const filtered = analysisCoop === 'all' 
            ? existingLogs 
            : existingLogs.filter(l => l.coopName === analysisCoop);
        
        const dates = Array.from(new Set(filtered.map(log => 
            log.dateStr || (typeof log.date === 'string' ? log.date.slice(0, 10) : new Date(log.date).toISOString().slice(0, 10))
        ))).sort((a, b) => b.localeCompare(a));
        
        return dates;
    }, [existingLogs, analysisCoop]);

    useEffect(() => {
        setAnalysisDate(date);
    }, [date]);

    useEffect(() => {
        if (analysisCoop !== 'all' && availableDates.length > 0 && analysisDate !== '') {
            if (!availableDates.includes(analysisDate)) {
                setAnalysisDate(availableDates[0]);
            }
        }
    }, [analysisCoop, availableDates, analysisDate]);

    useEffect(() => {
        if (masterItems.length > 0 && rows.length === 0) {
            setRows(masterItems.map(m => ({ id: m.name, name: m.name, qty: '' })));
        }
    }, [masterItems, rows.length]);

    const dailyStats = useMemo(() => {
        if (!existingLogs.length) return { truckCount: 0, totalLB: 0, totalOutput: 0, yield: 0, items: [] };
        const filtered = existingLogs.filter(log => {
            const logDate = log.dateStr || (typeof log.date === 'string' ? log.date.slice(0, 10) : new Date(log.date).toISOString().slice(0, 10));
            return logDate === date;
        });
        const totalLB = filtered.reduce((sum, log) => sum + (Number(log.initialKg) || 0), 0);
        const itemTotals: { [key: string]: number } = {};
        let totalOutput = 0;
        filtered.forEach(log => {
            Object.entries(log.items).forEach(([name, qty]) => {
                const q = Number(qty) || 0;
                itemTotals[name] = (itemTotals[name] || 0) + q;
                totalOutput += q;
            });
        });
        return {
            truckCount: filtered.length,
            totalLB,
            totalOutput,
            yield: totalLB > 0 ? (totalOutput / totalLB) * 100 : 0,
            items: Object.entries(itemTotals).map(([name, qty]) => ({ name, qty, itemYield: totalLB > 0 ? (qty / totalLB) * 100 : 0 })).sort((a, b) => b.qty - a.qty)
        };
    }, [existingLogs, date]);

    const bldAnalysis = useMemo(() => {
        if (!existingLogs.length) return { totalLB: 0, totalBLD: 0, yield: 0 };
        const filtered = existingLogs.filter(log => {
            const logDate = typeof log.date === 'string' ? log.date.slice(0, 10) : new Date(log.date).toISOString().slice(0, 10);
            const matchCoop = analysisCoop === 'all' || log.coopName === analysisCoop;
            const matchDate = !analysisDate || logDate === analysisDate;
            return matchDate && matchCoop;
        });
        const totalLB = filtered.reduce((sum, log) => sum + (Number(log.initialKg) || 0), 0);
        let totalBLD = 0;
        filtered.forEach(log => {
            Object.entries(log.items).forEach(([name, qty]) => {
                if (name.toUpperCase().includes('BLD')) totalBLD += Number(qty) || 0;
            });
        });
        return { totalLB, totalBLD, yield: totalLB > 0 ? (totalBLD / totalLB) * 100 : 0 };
    }, [existingLogs, analysisDate, analysisCoop]);

    const handleUpdateRow = useCallback((id: string, field: keyof FormRow, value: string) => {
        setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
    }, []);

    // Total output per truk saat ini dari baris yang diinput
    const currentTotalOutput = useMemo(() => rows.reduce((sum, r) => sum + (parseFloat(r.qty) || 0), 0), [rows]);

    // Kalkulasi yield & susut spesifik per truk
    const truckNetWeight = useMemo(() => Math.max(0, initialKg - mortalityKg), [initialKg, mortalityKg]);
    const grossYield = useMemo(() => initialKg > 0 ? (currentTotalOutput / initialKg) * 100 : 0, [currentTotalOutput, initialKg]);
    const netYield = useMemo(() => truckNetWeight > 0 ? (currentTotalOutput / truckNetWeight) * 100 : 0, [currentTotalOutput, truckNetWeight]);
    const lossKg = useMemo(() => Math.max(0, initialKg - currentTotalOutput), [initialKg, currentTotalOutput]);
    const lossPct = useMemo(() => initialKg > 0 ? (lossKg / initialKg) * 100 : 0, [lossKg, initialKg]);
    const avgWeightPerEkor = useMemo(() => initialEkor > 0 ? (initialKg / initialEkor) : 0, [initialKg, initialEkor]);

    // BLD khusus truk ini
    const currentTruckBLD = useMemo(() => {
        return rows
            .filter(r => r.name.toUpperCase().includes('BLD'))
            .reduce((sum, r) => sum + (parseFloat(r.qty) || 0), 0);
    }, [rows]);
    const currentTruckBLDYield = useMemo(() => initialKg > 0 ? (currentTruckBLD / initialKg) * 100 : 0, [currentTruckBLD, initialKg]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!coopName.trim()) { alert('Pilih Nama Kandang / Supplier!'); return; }
        const productionItems: ProductionItems = {};
        let hasValidItem = false;
        rows.forEach(row => {
            const qty = parseFloat(row.qty);
            if (row.name && !isNaN(qty) && qty > 0) {
                productionItems[row.name] = (productionItems[row.name] || 0) + qty;
                hasValidItem = true;
            }
        });
        if (!hasValidItem) { alert('Isi minimal satu item produksi!'); return; }
        
        setIsSubmitting(true);
        try {
            await onSubmit(
                truckNumber, 
                coopName, 
                driver, 
                licensePlate, 
                noDo, 
                initialEkor, 
                initialKg, 
                mortality, 
                mortalityKg, 
                productionItems, 
                pricePerKg, 
                autoApply, 
                date,
                selectedArrivalId || undefined
            );
            
            setSelectedArrivalId('');
            onClearSelectedArrival?.();
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
            setRows(masterItems.map(m => ({ id: m.name, name: m.name, qty: '' })));
        } catch (error) {
            console.error("Submit Error:", error);
            alert('Gagal menyimpan data produksi. Silakan coba lagi.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const pendingArrivals = useMemo(() => lbArrivals.filter(a => a.status !== 'completed'), [lbArrivals]);
    const completedArrivals = useMemo(() => lbArrivals.filter(a => a.status === 'completed'), [lbArrivals]);

    const activeArrival = useMemo(() => {
        if (!selectedArrivalId) return null;
        return lbArrivals.find(a => a.id === selectedArrivalId) || null;
    }, [selectedArrivalId, lbArrivals]);

    const inputClasses = "mt-1 block w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold placeholder:text-slate-300 focus:outline-none focus:ring-4 focus:ring-red-500/10 focus:border-red-500/40 transition-all duration-200 text-sm";
    const labelClasses = "block text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1";

    return (
        <form onSubmit={handleSubmit} className="space-y-6 max-w-[1600px] mx-auto">
            {/* Banner Tarikan Kedatangan LB Aktif */}
            

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6 items-start">
                {/* Kolom 1: Data Logistik & Tarik Kedatangan LB */}
                <div className="lg:col-span-3 space-y-4 md:space-y-6">
                    <div className="bg-white p-4 md:p-6 rounded-2xl md:rounded-[2rem] border border-slate-100 shadow-sm">
                        <div className="flex items-center justify-between mb-4 md:mb-6">
                            <h3 className="text-xs md:text-sm font-black text-slate-900 tracking-tight uppercase flex items-center gap-2">
                                <div className="w-1 h-4 md:h-5 bg-red-600 rounded-full" />
                                Data Logistik Truk
                            </h3>
                            <div className="flex items-center gap-2 px-2 py-1 md:px-3 md:py-1.5 bg-slate-50 rounded-lg border border-slate-100">
                                <input type="checkbox" id="auto-apply-check" checked={autoApply} onChange={(e) => setAutoApply(e.target.checked)} className="w-3.5 h-3.5 accent-red-600 cursor-pointer" />
                                <label className="text-[8px] md:text-[9px] font-black text-slate-500 uppercase tracking-tighter cursor-pointer" htmlFor="auto-apply-check">Auto Stok</label>
                            </div>
                        </div>

                        {/* FITUR UTAMA: TARIK DATA KEDATANGAN LB */}
                        <div className="mb-4 p-3.5 bg-gradient-to-br from-amber-50 to-orange-50/40 rounded-2xl border border-amber-200/80 shadow-sm">
                            <div className="flex items-center justify-between mb-1.5">
                                <label className="block text-[9px] font-black text-amber-800 uppercase tracking-widest flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                                    Tarik Kedatangan LB
                                </label>
                                <span className="text-[8px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                                    {pendingArrivals.length} Menunggu
                                </span>
                            </div>
                            <select 
                                value={selectedArrivalId}
                                onChange={(e) => handleSelectArrival(e.target.value)}
                                className="w-full bg-white border border-amber-300 rounded-xl py-2.5 px-3 text-[11px] font-black text-slate-800 outline-none focus:ring-2 focus:ring-amber-500 shadow-sm"
                            >
                                <option value="">-- Pilih Truk Kedatangan LB --</option>
                                {pendingArrivals.length > 0 && (
                                    <optgroup label="Truk Menunggu Produksi">
                                        {pendingArrivals.map((arr) => (
                                            <option key={arr.id} value={arr.id}>
                                                Mobil #{arr.truckNumber} - {arr.coopName} ({arr.initialKg || 0} Kg | DO: {arr.noDo || '-'} | {arr.licensePlate || 'Tanpa Plat'})
                                            </option>
                                        ))}
                                    </optgroup>
                                )}
                                {completedArrivals.length > 0 && (
                                    <optgroup label="✅ Truk Sudah Pernah Diproses">
                                        {completedArrivals.map((arr) => (
                                            <option key={arr.id} value={arr.id}>
                                                Mobil #{arr.truckNumber} - {arr.coopName} ({arr.initialKg || 0} Kg - Selesai)
                                            </option>
                                        ))}
                                    </optgroup>
                                )}
                                {pendingLogs && pendingLogs.length > 0 && (
                                    <optgroup label="📋 Antrian Draft Sebelumnya">
                                        {pendingLogs.map((log, idx) => (
                                            <option key={`draft_${idx}`} value={`draft_${idx}`}>
                                                Draft #{log.truckNumber} - {log.coopName} ({log.initialKg || 0} Kg)
                                            </option>
                                        ))}
                                    </optgroup>
                                )}
                            </select>
                            <p className="text-[8px] text-amber-700/80 font-bold mt-1.5 leading-tight">
                                Pilih truk yang sudah ditimbang di sub-modul "Kedatangan LB" untuk auto-fill dan hitung yield per truk.
                            </p>
                        </div>

                        <div className="space-y-3 md:space-y-4">
                            <div>
                                <label className={labelClasses}>Tanggal Produksi</label>
                                <input 
                                    type="date" 
                                    value={date} 
                                    onChange={e => setDate(e.target.value)} 
                                    onKeyDown={handleKeyDown}
                                    className={`production-qty-input ${inputClasses}`} 
                                    required 
                                />
                            </div>
                            <div>
                                <label className={labelClasses}>Nomor DO Truk</label>
                                <input 
                                    type="text" 
                                    value={noDo} 
                                    onChange={e => setNoDo(e.target.value)} 
                                    onKeyDown={handleKeyDown}
                                    className={`production-qty-input ${inputClasses}`} 
                                    placeholder="No. DO Truk..." 
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-2 md:gap-3">
                                <div>
                                    <label className={labelClasses}>Mobil Ke-</label>
                                    <input 
                                        type="number" 
                                        value={truckNumber} 
                                        onChange={e => setTruckNumber(parseInt(e.target.value) || 1)} 
                                        onKeyDown={handleKeyDown}
                                        onWheel={(e) => (e.target as HTMLInputElement).blur()}
                                        className={`production-qty-input ${inputClasses}`} 
                                    />
                                </div>
                                <div>
                                    <label className={labelClasses}>Plat Nomor</label>
                                    <input 
                                        type="text" 
                                        value={licensePlate} 
                                        onChange={e => setLicensePlate(e.target.value)} 
                                        onKeyDown={handleKeyDown}
                                        className={`production-qty-input ${inputClasses}`}
                                        list="plate-options"
                                        placeholder="No. Plat..."
                                        required
                                    />
                                    <datalist id="plate-options">
                                        {licensePlates.map(plate => (
                                            <option key={plate} value={plate} />
                                        ))}
                                    </datalist>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 md:gap-3">
                                <div className="col-span-1">
                                    <label className={labelClasses}>Nama Kandang</label>
                                    <input 
                                        type="text" 
                                        value={coopName} 
                                        onChange={e => setCoopName(e.target.value)} 
                                        onKeyDown={handleKeyDown}
                                        className={`production-qty-input ${inputClasses}`} 
                                        list="coop-names" 
                                        placeholder="Pilih Kandang..." 
                                        required 
                                    />
                                    <datalist id="coop-names">{coops.map(coop => <option key={coop.name} value={coop.name} />)}</datalist>
                                </div>
                                <div className="col-span-1">
                                    <label className={labelClasses}>Driver</label>
                                    <input 
                                        type="text" 
                                        value={driver} 
                                        onChange={e => setDriver(e.target.value)} 
                                        onKeyDown={handleKeyDown}
                                        className={`production-qty-input ${inputClasses}`} 
                                        placeholder="Nama Supir..." 
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-slate-900 p-4 md:p-6 rounded-2xl md:rounded-[2rem] shadow-xl shadow-slate-200">
                        <h3 className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 md:mb-4">Detail Timbangan LB Truk Ini</h3>
                        <div className="space-y-3 md:space-y-4">
                            <div className="grid grid-cols-2 gap-2 md:gap-3">
                                <div>
                                    <label className="block text-[7px] md:text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Total Ekor</label>
                                    <input 
                                        type="number" 
                                        value={initialEkor || ''} 
                                        onChange={e => setInitialEkor(parseFloat(e.target.value) || 0)} 
                                        onKeyDown={handleKeyDown}
                                        onWheel={(e) => (e.target as HTMLInputElement).blur()}
                                        className="production-qty-input w-full bg-slate-800 border-none rounded-xl py-2 px-3 md:py-2.5 md:px-4 text-white font-black text-xs md:text-sm outline-none focus:ring-2 focus:ring-red-500" 
                                    />
                                </div>
                                <div>
                                    <label className="block text-[7px] md:text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Total Kg (LB Masuk)</label>
                                    <input 
                                        type="number" 
                                        value={initialKg || ''} 
                                        onChange={e => setInitialKg(parseFloat(e.target.value) || 0)} 
                                        onKeyDown={handleKeyDown}
                                        onWheel={(e) => (e.target as HTMLInputElement).blur()}
                                        className="production-qty-input w-full bg-slate-800 border-none rounded-xl py-2 px-3 md:py-2.5 md:px-4 text-white font-black text-xs md:text-sm outline-none focus:ring-2 focus:ring-red-500" 
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 md:gap-3">
                                <div>
                                    <label className="block text-[7px] md:text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Kematian Ekor</label>
                                    <input 
                                        type="number" 
                                        value={mortality || ''} 
                                        onChange={e => setMortality(parseInt(e.target.value) || 0)} 
                                        onKeyDown={handleKeyDown}
                                        onWheel={(e) => (e.target as HTMLInputElement).blur()}
                                        className="production-qty-input w-full bg-slate-800 border-none rounded-xl py-2 px-3 md:py-2.5 md:px-4 text-white font-black text-xs md:text-sm outline-none focus:ring-2 focus:ring-red-500" 
                                        placeholder="0" 
                                    />
                                </div>
                                <div>
                                    <label className="block text-[7px] md:text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Kematian Kg</label>
                                    <input 
                                        type="number" 
                                        value={mortalityKg || ''} 
                                        onChange={e => setMortalityKg(parseFloat(e.target.value) || 0)} 
                                        onKeyDown={handleKeyDown}
                                        onWheel={(e) => (e.target as HTMLInputElement).blur()}
                                        className="production-qty-input w-full bg-slate-800 border-none rounded-xl py-2 px-3 md:py-2.5 md:px-4 text-white font-black text-xs md:text-sm outline-none focus:ring-2 focus:ring-red-500" 
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
                                    onKeyDown={handleKeyDown}
                                    className="production-qty-input w-full bg-indigo-900/50 border-none rounded-xl py-2 px-3 md:py-2.5 md:px-4 text-indigo-200 font-black text-xs md:text-sm outline-none focus:ring-2 focus:ring-indigo-400" 
                                    placeholder="0" 
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Kolom 2: Input Hasil Produksi & Kalkulasi Yield Hasil Produksi Per Truk */}
                <div className="lg:col-span-6 bg-white p-4 md:p-8 rounded-2xl md:rounded-[2rem] border border-slate-100 shadow-sm flex flex-col min-h-[500px] md:min-h-[600px] space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-xs md:text-sm font-black text-slate-900 tracking-tight uppercase flex items-center gap-2">
                                <div className="w-1 h-4 md:h-5 bg-emerald-500 rounded-full" />
                                Input Hasil Produksi Truk #{truckNumber}
                            </h3>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                                {coopName ? `Kandang: ${coopName} | Plat: ${licensePlate || '-'}` : 'Silakan tarik kedatangan LB di samping kiri'}
                            </p>
                        </div>
                        {selectedArrivalId && (
                            <span className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
                                Ditarik dari LB #{truckNumber}
                            </span>
                        )}
                    </div>

                    {/* KARTU HASIL PRODUKSI & YIELD PER TRUK */}
                    <div className="p-4 sm:p-5 rounded-2xl md:rounded-3xl bg-slate-900 text-white shadow-lg space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                                Hasil Produksi & Yield Mobil #{truckNumber} ({coopName || 'Tanpa Kandang'})
                            </span>
                            <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                                Rata-rata: {avgWeightPerEkor > 0 ? avgWeightPerEkor.toFixed(2) : '0.00'} Kg/Ekor
                            </span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                            <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/50">
                                <span className="block text-[8px] font-black text-slate-400 uppercase tracking-tight">Timbangan LB</span>
                                <span className="text-base sm:text-lg font-black text-white">
                                    {initialKg.toLocaleString('id-ID')} <span className="text-[9px] text-slate-400">Kg</span>
                                </span>
                                <span className="block text-[8px] text-slate-500 font-bold">
                                    Net: {truckNetWeight.toLocaleString('id-ID')} Kg
                                </span>
                            </div>

                            <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/50">
                                <span className="block text-[8px] font-black text-slate-400 uppercase tracking-tight">Hasil Potong</span>
                                <span className="text-base sm:text-lg font-black text-emerald-400">
                                    {currentTotalOutput.toLocaleString('id-ID', { minimumFractionDigits: 1 })} <span className="text-[9px] text-emerald-300">Kg</span>
                                </span>
                                <span className="block text-[8px] text-slate-500 font-bold">
                                    Susut: {lossKg.toLocaleString('id-ID', { minimumFractionDigits: 1 })} Kg
                                </span>
                            </div>

                            <div className="bg-emerald-950/60 p-2.5 rounded-xl border border-emerald-500/30">
                                <span className="block text-[8px] font-black text-emerald-300 uppercase tracking-tight">Yield Kotor</span>
                                <span className="text-base sm:text-lg font-black text-emerald-300">
                                    {grossYield.toFixed(1)}%
                                </span>
                                <span className="block text-[8px] text-emerald-400/80 font-bold">
                                    Output / LB Masuk
                                </span>
                            </div>

                            <div className="bg-indigo-950/60 p-2.5 rounded-xl border border-indigo-500/30">
                                <span className="block text-[8px] font-black text-indigo-300 uppercase tracking-tight">Yield Bersih</span>
                                <span className="text-base sm:text-lg font-black text-indigo-300">
                                    {netYield.toFixed(1)}%
                                </span>
                                <span className="block text-[8px] text-indigo-400/80 font-bold">
                                    Netto Bebas Kematian
                                </span>
                            </div>
                        </div>

                        {/* Indikator Bar Susut & Yield */}
                        <div className="space-y-1 pt-1">
                            <div className="flex justify-between text-[8px] font-black uppercase text-slate-400">
                                <span>Rasio Yield Truk</span>
                                <span className={grossYield >= 70 ? 'text-emerald-400' : grossYield >= 60 ? 'text-amber-400' : 'text-rose-400'}>
                                    {grossYield >= 70 ? 'Optimal (Target Tercapai)' : grossYield > 0 ? 'Sedang Diproses' : 'Belum Ada Input'}
                                </span>
                            </div>
                            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden flex">
                                <div 
                                    className="bg-emerald-500 h-full transition-all duration-300"
                                    style={{ width: `${Math.min(grossYield, 100)}%` }} 
                                    title={`Yield Output: ${grossYield.toFixed(1)}%`}
                                />
                                <div 
                                    className="bg-rose-500/60 h-full transition-all duration-300" 
                                    style={{ width: `${Math.min(lossPct, 100 - Math.min(grossYield, 100))}%` }}
                                    title={`Susut/Limbah: ${lossPct.toFixed(1)}%`}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 space-y-2 md:space-y-3 overflow-y-auto no-scrollbar max-h-[360px] md:max-h-[460px]">
                        {rows.map((row, index) => (
                            <ProductionRow 
                                key={row.id} 
                                row={row} 
                                index={index} 
                                onUpdate={handleUpdateRow} 
                                onKeyDown={handleKeyDown}
                            />
                        ))}
                    </div>

                    <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col items-stretch sm:items-center sm:flex-row justify-between gap-4">
                        <div className="flex items-center justify-between sm:justify-start gap-6 md:gap-8">
                            <div className="flex flex-col">
                                <span className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Output:</span>
                                <span className="text-base md:text-lg font-black text-slate-900">{currentTotalOutput.toLocaleString('id-ID', { minimumFractionDigits: 1 })} Kg</span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest">Yield Truk Ini:</span>
                                <span className="text-base md:text-lg font-black text-emerald-600">
                                    {grossYield.toFixed(1)}%
                                </span>
                            </div>
                            {currentTruckBLD > 0 && (
                                <div className="flex flex-col">
                                    <span className="text-[8px] md:text-[9px] font-black text-indigo-400 uppercase tracking-widest">BLD Truk Ini:</span>
                                    <span className="text-sm md:text-base font-black text-indigo-700">
                                        {currentTruckBLD.toLocaleString('id-ID')} Kg ({currentTruckBLDYield.toFixed(1)}%)
                                    </span>
                                </div>
                            )}
                        </div>
                        <button 
                            type="submit" 
                            disabled={isSubmitting} 
                            className={`w-full sm:w-auto px-6 md:px-10 py-4 md:py-5 rounded-2xl md:rounded-[1.8rem] font-black text-[10px] md:text-xs uppercase tracking-widest transition-all shadow-lg shadow-indigo-100 ${
                                isSubmitting 
                                    ? 'bg-slate-400 cursor-not-allowed' 
                                    : (autoApply ? 'bg-red-600 hover:bg-red-700 text-white cursor-pointer active:scale-95' : 'bg-slate-900 hover:bg-slate-800 text-white cursor-pointer active:scale-95')
                            }`}
                        >
                            {isSubmitting ? 'Memproses...' : (autoApply ? 'Simpan & Update Stok' : 'Simpan Draft')}
                        </button>
                    </div>
                </div>

                {/* Kolom 3: Monitor & Analisis Harian */}
                <div className="lg:col-span-3 space-y-4 md:space-y-6">
                    <div className="bg-white p-4 md:p-6 rounded-2xl md:rounded-[2rem] border border-slate-100 shadow-sm">
                        <div className="flex items-center gap-3 mb-4 md:mb-6">
                            <div className="w-1 h-5 md:w-1.5 md:h-6 bg-indigo-600 rounded-full" />
                            <h3 className="text-xs md:text-sm font-black text-slate-900 tracking-tight uppercase">Monitor Hari Ini</h3>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3 md:gap-4 mb-6">
                            <div className="bg-indigo-50 p-3 md:p-4 rounded-xl md:rounded-2xl border border-indigo-100">
                                <p className="text-[8px] md:text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-1">Total LB (Ayam Masuk)</p>
                                <p className="text-lg md:text-xl font-black text-indigo-700">{dailyStats.totalLB.toLocaleString('id-ID')} Kg</p>
                            </div>
                            <div className="bg-emerald-50 p-3 md:p-4 rounded-xl md:rounded-2xl border border-emerald-100">
                                <p className="text-[8px] md:text-[9px] font-black text-emerald-400 uppercase tracking-widest mb-1">Total Output (Produksi)</p>
                                <p className="text-lg md:text-xl font-black text-emerald-700">{dailyStats.totalOutput.toLocaleString('id-ID')} Kg</p>
                            </div>
                        </div>
                        <div className="bg-slate-900 p-4 md:p-5 rounded-[2rem] mb-6 shadow-xl shadow-slate-200">
                            <div className="flex flex-col gap-3 mb-4">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Analisis Yield BLD</h4>
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-1">
                                        <label className="text-[7px] font-black text-slate-500 uppercase tracking-tighter">Kandang</label>
                                        <select value={analysisCoop} onChange={(e) => setAnalysisCoop(e.target.value)} className="w-full bg-slate-800 border-none rounded-lg py-1.5 px-2 text-[9px] font-black text-indigo-400 uppercase outline-none focus:ring-1 focus:ring-indigo-500">
                                            <option value="all">SEMUA</option>
                                            {Array.from(new Set(existingLogs.map(l => l.coopName))).sort().map(c => (
                                                <option key={c} value={c}>{c}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[7px] font-black text-slate-500 uppercase tracking-tighter">Tanggal Cek</label>
                                        <select 
                                            value={analysisDate} 
                                            onChange={(e) => setAnalysisDate(e.target.value)}
                                            className="w-full bg-slate-800 border-none rounded-lg py-1.5 px-2 text-[9px] font-black text-white outline-none focus:ring-1 focus:ring-indigo-500"
                                        >
                                            <option value="">SEMUA TANGGAL</option>
                                            {availableDates.map(d => (
                                                <option key={d} value={d}>
                                                    {new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-3 pt-2 border-t border-slate-800">
                                <div className="flex justify-between items-end">
                                    <div>
                                        <p className="text-[7px] font-black text-slate-500 uppercase mb-0.5">Total BLD</p>
                                        <p className="text-lg font-black text-white leading-none">{bldAnalysis.totalBLD.toLocaleString('id-ID')} <span className="text-[8px] text-slate-500">Kg</span></p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[7px] font-black text-slate-500 uppercase mb-0.5">Yield BLD</p>
                                        <p className="text-lg font-black text-emerald-400 leading-none">{bldAnalysis.yield.toFixed(1)}%</p>
                                    </div>
                                </div>
                                <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                                    <div className="bg-emerald-500 h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(bldAnalysis.yield * 2, 100)}%` }} />
                                </div>
                            </div>
                        </div>
                        <div className="space-y-3">
                            <p className="text-[10px] md:text-[11px] font-black text-slate-800 uppercase tracking-[0.1em] border-b-2 border-slate-100 pb-2 md:pb-3 mb-3 md:mb-4">Rincian Per Item (Kg)</p>
                            <div className="max-h-[250px] md:max-h-[300px] overflow-y-auto pr-1 md:pr-2 space-y-2 md:space-y-2.5 no-scrollbar">
                                {dailyStats.items.length === 0 ? (
                                    <p className="text-[9px] md:text-[10px] font-bold text-slate-300 text-center py-6 md:py-10 uppercase tracking-widest italic">Belum ada data</p>
                                ) : (
                                    dailyStats.items.map(item => (
                                        <div key={item.name} className="flex justify-between items-center text-[10px] md:text-[11px] p-2 bg-slate-50 rounded-xl border border-slate-100">
                                            <span className="font-black text-slate-700 uppercase">{item.name}</span>
                                            <div className="text-right">
                                                <span className="font-black text-slate-900">{item.qty.toLocaleString('id-ID')} Kg</span>
                                                <span className="block text-[8px] font-bold text-slate-400">({item.itemYield.toFixed(1)}%)</span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </form>
    );
};

export default ProductionForm;