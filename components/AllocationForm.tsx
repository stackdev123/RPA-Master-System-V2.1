import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import type { StockItem, AllocationItem, Customer, MasterItem } from '../types';
import { XIcon, PlusIcon } from './icons';
import * as XLSX from 'xlsx';

interface AllocationFormProps {
    stock: StockItem[];
    customers: Customer[];
    masterItems: MasterItem[];
    onSubmit: (allocations: { customer: string; items: AllocationItem[] }[], date: string) => Promise<void>;
    onCancel: () => void;
}

interface MatrixAllocation {
    [itemName: string]: {
        [customerName: string]: number;
    };
}

const STORAGE_KEY_ALLOC = 'rpa_v2_alloc_matrix';
const STORAGE_KEY_CUST = 'rpa_v2_alloc_cust_list';

// SUB-KOMPONEN BARIS UNTUK OPTIMASI SPEED
const MatrixRow = React.memo(({ 
    item, 
    stockGudang, 
    itemAllocMap, 
    customerNames, 
    onChange,
    onKeyDown
}: { 
    item: string, 
    stockGudang: number, 
    itemAllocMap: { [cust: string]: number }, 
    customerNames: string[],
    onChange: (itemName: string, custName: string, val: string) => void,
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void
}) => {
    const totalAllocated = Object.values(itemAllocMap).reduce<number>((a, b) => a + (Number(b) || 0), 0);
    const sisa = stockGudang - totalAllocated;

    return (
        <tr className="hover:bg-slate-50 transition-colors">
            <td className="p-2.5 font-black uppercase border-r border-slate-200 sticky left-0 z-[110] bg-white text-slate-700 shadow-[1px_0_2px_rgba(0,0,0,0.02)] truncate text-[12px]">
                {item}
            </td>
            <td className="p-2.5 text-center font-bold border-r border-slate-200 font-mono text-slate-400 text-[14px]">
                {stockGudang.toLocaleString('id-ID')}
            </td>
            <td className={`p-2.5 text-center font-black border-r border-slate-200 font-mono text-[14px] ${totalAllocated > stockGudang ? 'text-rose-600' : 'text-slate-900'}`}>
                {totalAllocated > 0 ? totalAllocated.toLocaleString('id-ID') : '-'}
            </td>
            <td className={`p-2.5 text-center font-black border-r border-slate-200 font-mono text-[14px] ${sisa < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                {sisa.toLocaleString('id-ID')}
            </td>
            {customerNames.map((custName) => (
                <td key={custName} className="p-0 border-r border-slate-200">
                    <input 
                        type="number"
                        value={itemAllocMap[custName] || ''}
                        onChange={(e) => onChange(item, custName, e.target.value)}
                        onKeyDown={onKeyDown}
                        className="w-full h-full p-2.5 text-center font-black bg-transparent border-none focus:ring-1 focus:ring-inset focus:ring-indigo-500 outline-none font-mono text-[10px]"
                        placeholder="-"
                    />
                </td>
            ))}
        </tr>
    );
});

const AllocationForm: React.FC<AllocationFormProps> = ({ stock, customers, masterItems, onSubmit, onCancel }) => {
    const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
    const [selectedCustomerNames, setSelectedCustomerNames] = useState<string[]>(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY_CUST);
            if (!saved) return ['RETAIL'];
            return JSON.parse(saved);
        } catch { return ['RETAIL']; }
    });

    const [allocations, setAllocations] = useState<MatrixAllocation>(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY_ALLOC);
            if (!saved) return {};
            return JSON.parse(saved);
        } catch { return {}; }
    });
    
    const [zoom, setZoom] = useState(0.85);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY_CUST, JSON.stringify(selectedCustomerNames));
        localStorage.setItem(STORAGE_KEY_ALLOC, JSON.stringify(allocations));
    }, [selectedCustomerNames, allocations]);

    // Format XLSX yang diharapkan (Matrix):
    // Baris 1: [PRODUK, NAMA CUST 1, NAMA CUST 2, ...]
    // Baris 2: [NAMA PRODUK A, QTY CUST 1, QTY CUST 2, ...]
    // Baris 3: [NAMA PRODUK B, QTY CUST 1, QTY CUST 2, ...]
    const handleImportXLSX = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                
                // Ambil data sebagai array of arrays (header: 1)
                const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 });

                if (rows.length < 2) {
                    alert("File kosong atau format tidak sesuai!");
                    return;
                }

                // Baris pertama adalah header (PRODUK, CUST1, CUST2, ...)
                const headerRow = rows[0];
                const rawCustomerNames = headerRow.slice(1)
                    .map((c: any) => c?.toString().trim().toUpperCase())
                    .filter(Boolean);

                if (rawCustomerNames.length === 0) {
                    alert("Tidak ada nama pelanggan di baris pertama (header)!");
                    return;
                }

                // Validasi Nama Pelanggan & Item
                const validCustSet = new Set(customers.map(c => c.name.toUpperCase()));
                const validItemSet = new Set(masterItems.map(i => i.name.toUpperCase()));
                
                const invalidCustomers: string[] = [];
                const validCustomerNamesFromExcel = rawCustomerNames.filter((name: string) => {
                    if (validCustSet.has(name) || name === 'RETAIL') return true;
                    invalidCustomers.push(name);
                    return false;
                });

                const newAllocations: MatrixAllocation = { ...allocations };
                const newCustomerNames = [...selectedCustomerNames];

                // Tambahkan nama pelanggan baru ke list jika belum ada
                validCustomerNamesFromExcel.forEach((custName: string) => {
                    if (!newCustomerNames.includes(custName)) {
                        newCustomerNames.push(custName);
                    }
                });

                const invalidItems: string[] = [];
                let importedCount = 0;

                // Proses baris data produk
                for (let i = 1; i < rows.length; i++) {
                    const row = rows[i];
                    const itemName = row[0]?.toString().trim().toUpperCase();
                    if (!itemName) continue;

                    if (!validItemSet.has(itemName)) {
                        if (!invalidItems.includes(itemName)) invalidItems.push(itemName);
                        continue;
                    }

                    if (!newAllocations[itemName]) {
                        newAllocations[itemName] = {};
                    }

                    for (let j = 0; j < rawCustomerNames.length; j++) {
                        const custName = rawCustomerNames[j];
                        // Hanya proses jika pelanggan valid
                        if (!validCustomerNamesFromExcel.includes(custName)) continue;

                        // Kolom data mulai dari index 1 (setelah nama produk)
                        const qty = parseFloat(row[j + 1]?.toString() || '0');
                        
                        if (!isNaN(qty) && qty > 0) {
                            newAllocations[itemName][custName] = qty;
                            importedCount++;
                        }
                    }
                }

                setSelectedCustomerNames(newCustomerNames);
                setAllocations(newAllocations);

                let message = "Import Selesai!";
                if (invalidCustomers.length > 0 || invalidItems.length > 0) {
                    message += "\n\nPERINGATAN (Data dilewati):";
                    if (invalidCustomers.length > 0) message += `\n- Pelanggan tidak terdaftar: ${invalidCustomers.join(', ')}`;
                    if (invalidItems.length > 0) message += `\n- Produk tidak terdaftar: ${invalidItems.join(', ')}`;
                }
                
                if (importedCount === 0 && (invalidCustomers.length > 0 || invalidItems.length > 0)) {
                    alert("Gagal Impor: Tidak ada data valid yang ditemukan sesuai Master Data.\n" + message);
                } else {
                    alert(message);
                }

            } catch (err) {
                console.error("XLSX Import Error:", err);
                alert("Gagal mengimpor file. Pastikan format matrix: Baris 1 Header Pelanggan, Kolom 1 Nama Produk.");
            }
            // Reset file input
            if (fileInputRef.current) fileInputRef.current.value = '';
        };
        reader.readAsBinaryString(file);
    };

    const handleClear = () => {
        if (window.confirm('Hapus semua data alokasi dan daftar pelanggan di matrix ini?')) {
            setAllocations({});
            setSelectedCustomerNames(['RETAIL']);
            localStorage.removeItem(STORAGE_KEY_ALLOC);
            localStorage.removeItem(STORAGE_KEY_CUST);
        }
    };

    const stockMap = useMemo(() => {
        const map = new Map<string, number>();
        stock.forEach(s => map.set(s.name, s.quantity));
        return map;
    }, [stock]);

    const handleAllocationChange = useCallback((itemName: string, customerName: string, value: string) => {
        const qty = parseFloat(value);
        setAllocations(prev => ({
            ...prev,
            [itemName]: {
                ...(prev[itemName] || {}),
                [customerName]: isNaN(qty) ? 0 : qty
            }
        }));
    }, []);

    const handleMatrixKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            const currentInput = e.currentTarget;
            const currentTd = currentInput.closest('td') || currentInput.closest('th');
            const currentTr = currentInput.closest('tr');
            if (!currentTd || !currentTr) return;

            const tdIndex = Array.from(currentTr.children).indexOf(currentTd);
            const table = currentTr.closest('table');
            if (!table) return;

            const allRows = Array.from(table.querySelectorAll('tr'));
            const currentRowIndex = allRows.indexOf(currentTr);
            
            const targetRowIndex = e.key === 'ArrowUp' ? currentRowIndex - 1 : currentRowIndex + 1;

            if (targetRowIndex >= 0 && targetRowIndex < allRows.length) {
                const targetTr = allRows[targetRowIndex];
                const targetInput = targetTr.children[tdIndex]?.querySelector('input');
                if (targetInput) {
                    (targetInput as HTMLInputElement).focus();
                } 
            }
        }
    }, []);

    const addCustomerColumn = () => {
        const newName = `CUST ${selectedCustomerNames.length + 1}`;
        setSelectedCustomerNames([...selectedCustomerNames, newName]);
    };

    const removeCustomerColumn = (index: number) => {
        if (window.confirm('Hapus kolom pelanggan ini?')) {
            const custToRemove = selectedCustomerNames[index];
            setSelectedCustomerNames(prev => prev.filter((_, i) => i !== index));
            setAllocations(prev => {
                const next = { ...prev };
                Object.keys(next).forEach(item => {
                    const newItemMap = { ...next[item] };
                    delete newItemMap[custToRemove];
                    next[item] = newItemMap;
                });
                return next;
            });
        }
    };

    const handleCustomerNameChange = (index: number, newName: string) => {
        const oldName = selectedCustomerNames[index];
        const updated = [...selectedCustomerNames];
        updated[index] = newName.toUpperCase();
        setSelectedCustomerNames(updated);

        if (oldName !== updated[index]) {
            setAllocations(prev => {
                const next = { ...prev };
                Object.keys(next).forEach(item => {
                    if (next[item] && next[item][oldName] !== undefined) {
                        const newItemMap = { ...next[item] };
                        newItemMap[updated[index]] = newItemMap[oldName];
                        delete newItemMap[oldName];
                        next[item] = newItemMap;
                    }
                });
                return next;
            });
        }
    };

    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSubmitting) return;
        const finalData = selectedCustomerNames.map(custName => {
            const items: AllocationItem[] = [];
            Object.entries(allocations).forEach(([itemName, custAlloc]) => {
                const qty = custAlloc[custName] || 0;
                if (qty > 0) items.push({ name: itemName, quantity: qty });
            });
            return { customer: custName, items };
        }).filter(d => d.items.length > 0);

        if (finalData.length === 0) return alert("Belum ada alokasi!");
        
        setIsSubmitting(true);
        try {
            await onSubmit(finalData, date);
            localStorage.removeItem(STORAGE_KEY_ALLOC);
            localStorage.removeItem(STORAGE_KEY_CUST);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-md z-[300] flex flex-col p-1.5 md:p-4 overflow-hidden">
            <div className="bg-white rounded-2xl md:rounded-[1.5rem] shadow-2xl flex flex-col w-full h-full overflow-hidden border border-slate-200">
                
                <div className="px-3 py-3 md:px-6 md:py-3 border-b border-slate-100 flex justify-between items-center bg-white shrink-0 gap-2">
                    <div className="flex items-center gap-2 md:gap-4 overflow-hidden">
                        <div className="bg-indigo-600 p-1.5 rounded-lg shrink-0">
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 md:h-4 md:w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                            </svg>
                        </div>
                        <div className="truncate">
                            <h2 className="text-[10px] md:text-sm font-black text-slate-900 uppercase tracking-tighter leading-none">MATRIX DISTRIBUSI SJ</h2>
                            <div className="flex items-center gap-1.5 mt-1">
                                <input 
                                    type="date" 
                                    value={date} 
                                    onChange={(e) => setDate(e.target.value)}
                                    className="text-[9px] font-black text-indigo-600 bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-indigo-500"
                                />
                                <div className="flex items-center gap-0.5 bg-slate-100 px-1 py-0.5 rounded border border-slate-200 shrink-0">
                                    <button onClick={() => setZoom(z => Math.max(z-0.1, 0.5))} className="w-3 h-3 md:w-4 md:h-4 flex items-center justify-center bg-white border border-slate-200 rounded text-[8px] font-black">-</button>
                                    <span className="text-[8px] font-black text-indigo-600 w-5 md:w-7 text-center">{Math.round(zoom * 100)}%</span>
                                    <button onClick={() => setZoom(z => Math.min(z+0.1, 1.2))} className="w-3 h-3 md:w-4 md:h-4 flex items-center justify-center bg-white border border-slate-200 rounded text-[8px] font-black">+</button>
                                </div>
                                <span className="text-[7px] text-slate-400 font-bold uppercase tracking-widest hidden sm:inline italic">Autosave Active</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                        <button 
                            onClick={handleClear} 
                            className="px-2.5 py-2 md:px-4 md:py-2 bg-rose-50 text-rose-600 border border-rose-100 rounded-lg text-[8px] md:text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 active:scale-95 transition-all"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            <span className="hidden sm:inline">CLEAR MATRIX</span><span className="sm:hidden">CLEAR</span>
                        </button>
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            onChange={handleImportXLSX} 
                            accept=".xlsx, .xls" 
                            className="hidden" 
                        />
                        <button 
                            onClick={() => fileInputRef.current?.click()} 
                            className="px-2.5 py-2 md:px-4 md:py-2 bg-emerald-600 text-white rounded-lg text-[8px] md:text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 active:scale-95 transition-all"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                            </svg>
                            <span className="hidden sm:inline">IMPOR XLSX</span><span className="sm:hidden">IMPOR</span>
                        </button>
                        <button onClick={addCustomerColumn} className="px-2.5 py-2 md:px-4 md:py-2 bg-slate-900 text-white rounded-lg text-[8px] md:text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 active:scale-95 transition-all">
                            <PlusIcon className="h-3 w-3" /> <span className="hidden sm:inline">TAMBAH PELANGGAN</span><span className="sm:hidden">TAMBAH</span>
                        </button>
                        <button onClick={onCancel} className="p-2 text-slate-300 hover:text-slate-900 transition-all"><XIcon className="h-4 w-4" /></button>
                    </div>
                </div>

                <div className="flex-1 overflow-auto bg-slate-50 relative touch-pan-x no-scrollbar">
                    <div className="bg-white" style={{ fontSize: `${zoom * 11}px` }}>
                        <table className="border-collapse table-auto w-full min-w-max">
                            <thead className="sticky top-0 z-[120]">
                                <tr className="bg-slate-100 border-b border-slate-200">
                                    <th className="p-2 border-r border-slate-200 text-black font-bold w-[130px] sticky left-0 bg-slate-100 z-[130] text-[12px] uppercase">Produk</th>
                                    <th className="p-2 border-r border-slate-200 text-black font-bold w-[75px] text-[12px] uppercase">Gudang</th>
                                    <th className="p-2 border-r border-slate-200 text-black font-bold w-[75px] text-[12px] uppercase">Total SJ</th>
                                    <th className="p-2 border-r border-slate-200 text-black font-bold w-[75px] text-[12px] uppercase">Sisa</th>
                                    {selectedCustomerNames.map((name, idx) => (
                                        <th key={idx} className="p-0 border-r border-slate-200 bg-indigo-600 min-w-[100px] w-[110px] relative">
                                            <div className="flex items-center h-full">
                                                <input 
                                                    list="all-db-customers"
                                                    value={name}
                                                    onChange={(e) => handleCustomerNameChange(idx, e.target.value)}
                                                    onKeyDown={handleMatrixKeyDown}
                                                    className="w-full bg-indigo-600 text-white p-2.5 text-center border-none focus:ring-1 focus:ring-inset focus:ring-white/30 font-black uppercase placeholder:text-indigo-300 outline-none text-[9px] truncate"
                                                    placeholder="CUST..."
                                                />
                                                {selectedCustomerNames.length > 1 && (
                                                    <button onClick={() => removeCustomerColumn(idx)} className="absolute right-0.5 top-0.5 text-white/30 hover:text-white transition-colors">
                                                        <XIcon className="h-2 w-2" />
                                                    </button>
                                                )}
                                            </div>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {masterItems.map((item) => (
                                    <MatrixRow 
                                        key={item.name}
                                        item={item.name}
                                        stockGudang={stockMap.get(item.name) || 0}
                                        itemAllocMap={allocations[item.name] || {}}
                                        customerNames={selectedCustomerNames}
                                        onChange={handleAllocationChange}
                                        onKeyDown={handleMatrixKeyDown}
                                    />
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="px-4 py-3 md:px-8 md:py-4 border-t border-slate-100 flex justify-between items-center bg-white shrink-0">
                    <div className="flex gap-4 md:gap-10">
                        <div className="flex flex-col">
                            <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">PRODUK</span>
                            <span className="text-[10px] font-black text-slate-900">{masterItems.length}</span>
                        </div>
                        <div className="flex flex-col border-l border-slate-100 pl-4">
                            <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">CUST</span>
                            <span className="text-[10px] font-black text-emerald-600">{selectedCustomerNames.length}</span>
                        </div>
                         <div className="flex flex-col border-l border-slate-100 pl-4">
                            <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">TOTAL Kg</span>
                            <span className="text-[10px] font-black text-indigo-600">
                                {Object.values(allocations).reduce<number>((total, item) => {
                                    return total + Object.values(item).reduce<number>((sub, val) => sub + (Number(val) || 0), 0);
                                }, 0).toLocaleString('id-ID')}
                            </span>
                        </div>
                    </div>
                    <button onClick={handleSubmit} disabled={isSubmitting} className={`px-6 py-3 md:px-10 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg shadow-indigo-100 transition-all ${isSubmitting ? 'bg-indigo-400 text-white cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}>
                        {isSubmitting ? 'MENYIMPAN...' : 'SIMPAN & TUTUP'}
                    </button>
                </div>
            </div>
            <datalist id="all-db-customers">
                {customers.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
            </datalist>
        </div>
    );
};

export default AllocationForm;