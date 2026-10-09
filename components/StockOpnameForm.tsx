
import React, { useState, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import type { StockItem, MasterItem, StockLog } from '../types';
import { XIcon, UploadIcon } from './icons';
import { sortChickenParts } from '../constants';

interface StockOpnameFormProps {
    stockLogs: StockLog[];
    currentStock: StockItem[];
    masterItems: MasterItem[];
    onSubmit: (opnameData: { [itemName: string]: number }, date: string) => void;
    onCancel: () => void;
}

const StockOpnameForm: React.FC<StockOpnameFormProps> = ({ stockLogs, currentStock, masterItems, onSubmit, onCancel }) => {
    const [selectedDate, setSelectedDate] = useState<string>(new Date().toLocaleDateString('en-CA'));
    const fileInputRef = useRef<HTMLInputElement>(null);

    const initialQuantities = useMemo(() => {
        const filterDate = new Date(selectedDate);
        filterDate.setHours(23, 59, 59, 999);
        
        const todayStr = new Date().toLocaleDateString('en-CA');
        const isToday = selectedDate === todayStr;
        const stockMap = new Map<string, number>();

        masterItems.forEach(item => {
            const normName = item.name.trim().toUpperCase();
            if (isToday) {
                const liveItem = currentStock.find(s => s.name && s.name.trim().toUpperCase() === normName);
                stockMap.set(item.name, liveItem ? liveItem.quantity : 0);
            } else {
                const itemLogs = stockLogs
                    .filter(log => log.itemName && log.itemName.trim().toUpperCase() === normName)
                    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
                
                const logsOnDate = itemLogs.filter(log => new Date(log.timestamp) <= filterDate);
                
                if (logsOnDate.length > 0) {
                    stockMap.set(item.name, logsOnDate[0].stockAfter);
                } else if (itemLogs.length > 0) {
                    // Falls back to the earliest known state if date is before all logs
                    const oldestLog = itemLogs[itemLogs.length - 1];
                    stockMap.set(item.name, oldestLog.stockBefore);
                } else {
                    // Check current stock as a last resort if it's very recent or no logs exist
                    const liveItem = currentStock.find(s => s.name && s.name.trim().toUpperCase() === normName);
                    stockMap.set(item.name, liveItem ? liveItem.quantity : 0);
                }
            }
        });

        return masterItems.reduce((acc, item) => {
            acc[item.name] = stockMap.get(item.name) || 0;
            return acc;
        }, {} as { [key: string]: number });
    }, [selectedDate, stockLogs, currentStock, masterItems]);

    const [opnameQuantities, setOpnameQuantities] = useState<{ [itemName: string]: number }>(initialQuantities);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [importPreview, setImportPreview] = useState<{
        items: { name: string; systemQty: number; excelQty: number; diff: number }[];
        newQuantities: { [key: string]: number };
    } | null>(null);

    // Update opname quantities when initial quantities change (due to date change)
    React.useEffect(() => {
        setOpnameQuantities(initialQuantities);
    }, [initialQuantities]);

    const handleQuantityChange = (itemName: string, value: string) => {
        const quantity = parseFloat(value);
        setOpnameQuantities(prev => ({
            ...prev,
            [itemName]: isNaN(quantity) ? 0 : quantity
        }));
    };

    const handleExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws) as any[];

                const newQuantities = { ...opnameQuantities };
                const previewItems: { name: string; systemQty: number; excelQty: number; diff: number }[] = [];

                data.forEach(row => {
                    const possibleNameKeys = ['nama', 'Nama', 'ITEM', 'item', 'Name', 'name', 'NAMA', 'PRODUK', 'Produk', 'produk'];
                    const possibleStockKeys = ['stock', 'Stock', 'STOK', 'stok', 'jumlah', 'Jumlah', 'qty', 'Qty', 'JUMLAH', 'REAL', 'Real', 'real', 'FISIK', 'Fisik', 'fisik'];
                    
                    const nameKey = Object.keys(row).find(k => possibleNameKeys.some(pk => k.toLowerCase() === pk.toLowerCase()));
                    const stockKey = Object.keys(row).find(k => possibleStockKeys.some(pk => k.toLowerCase() === pk.toLowerCase()));

                    const itemName = nameKey ? row[nameKey] : undefined;
                    const stockVal = stockKey ? row[stockKey] : undefined;

                    if (itemName !== undefined && itemName !== null && stockVal !== undefined && stockVal !== null) {
                        const normExcelName = String(itemName).trim().toUpperCase();
                        // Find matching master item
                        const masterItem = masterItems.find(m => m.name.trim().toUpperCase() === normExcelName);
                        if (masterItem) {
                            const sysQty = initialQuantities[masterItem.name] || 0;
                            
                            // Clean number: handle dots as thousands and commas as decimals
                            let cleanedVal = String(stockVal).trim();
                            if (cleanedVal.includes('.') && cleanedVal.includes(',')) {
                                // Assume Indonesian Format 1.000,50
                                cleanedVal = cleanedVal.replace(/\./g, '').replace(',', '.');
                            } else if (cleanedVal.includes(',')) {
                                // If only comma exists, check if it looks like thousands (Indo) or decimal
                                // safest is to replace comma with dot for JS
                                cleanedVal = cleanedVal.replace(',', '.');
                            } 
                            
                            const excelQty = parseFloat(cleanedVal);
                            
                            if (!isNaN(excelQty)) {
                                newQuantities[masterItem.name] = excelQty;
                                
                                previewItems.push({
                                    name: masterItem.name,
                                    systemQty: sysQty,
                                    excelQty: excelQty,
                                    diff: excelQty - sysQty
                                });
                            }
                        }
                    }
                });

                if (previewItems.length > 0) {
                    setImportPreview({
                        items: previewItems,
                        newQuantities: newQuantities
                    });
                } else {
                    alert('Tidak ada item yang cocok ditemukan di file Excel.');
                }
                
                if (fileInputRef.current) fileInputRef.current.value = '';
            } catch (err) {
                console.error(err);
                alert('Gagal mengimport Excel. Pastikan format kolom adalah "nama" dan "stock".');
            }
        };
        reader.readAsBinaryString(file);
    };

    const confirmImport = () => {
        if (importPreview) {
            setOpnameQuantities(importPreview.newQuantities);
            setImportPreview(null);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSubmitting) return;
        setIsSubmitting(true);
        try {
            await onSubmit(opnameQuantities, selectedDate);
        } catch (err) {
            console.error('Submit error:', err);
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex justify-center items-center p-4">
            <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col relative">
                {/* Full Overlay Preview if importPreview is active */}
                {importPreview && (
                    <div className="absolute inset-0 bg-white z-10 rounded-lg flex flex-col p-6 animate-in fade-in zoom-in duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h3 className="text-xl font-bold text-emerald-800">Preview Import Excel</h3>
                                <p className="text-sm text-gray-500">Berikut adalah data yang akan diimport ke form opname.</p>
                            </div>
                            <button 
                                type="button" 
                                onClick={() => setImportPreview(null)}
                                className="text-gray-400 hover:text-red-500 transition-colors"
                            >
                                <XIcon className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="flex-grow overflow-auto border rounded-xl">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 sticky top-0">
                                    <tr>
                                        <th className="px-4 py-3 text-left font-bold text-gray-700">Nama Item</th>
                                        <th className="px-4 py-3 text-center font-bold text-gray-700">Stok Sistem</th>
                                        <th className="px-4 py-3 text-center font-bold text-gray-700">Stok Excel</th>
                                        <th className="px-4 py-3 text-center font-bold text-gray-700">Selisih</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {importPreview.items.map((item, idx) => (
                                        <tr key={idx} className="hover:bg-emerald-50/30 transition-colors">
                                            <td className="px-4 py-3 font-medium text-gray-800">{item.name}</td>
                                            <td className="px-4 py-3 text-center text-gray-600">{item.systemQty.toLocaleString('id-ID')} Kg</td>
                                            <td className="px-4 py-3 text-center font-bold text-emerald-700 bg-emerald-50/50">{item.excelQty.toLocaleString('id-ID')} Kg</td>
                                            <td className={`px-4 py-3 text-center font-bold ${item.diff > 0 ? 'text-blue-600' : item.diff < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                                                {item.diff.toLocaleString('id-ID', { signDisplay: 'always' })} Kg
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="flex justify-between items-center mt-6 p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                            <div className="text-sm">
                                <span className="text-emerald-800 font-bold">Total item ditemukan: </span>
                                <span className="bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded-full text-xs font-black">{importPreview.items.length}</span>
                            </div>
                            <div className="flex gap-3">
                                <button 
                                    type="button" 
                                    onClick={() => setImportPreview(null)}
                                    className="px-6 py-2 bg-white text-gray-700 font-bold rounded-lg border hover:bg-gray-50 transition-colors"
                                >
                                    Batalkan Import
                                </button>
                                <button 
                                    type="button" 
                                    onClick={confirmImport}
                                    className="px-6 py-2 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 shadow-lg shadow-emerald-200 transition-all active:scale-95"
                                >
                                    Terapkan ke Form
                                </button>
                            </div>
                        </div>
                    </div>
                )}
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800">Stock Opname</h2>
                        <p className="text-xs text-gray-500 italic mt-1">* Melakukan penyesuaian stok sistem dengan stok fisik real.</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <input 
                            type="file" 
                            ref={fileInputRef}
                            onChange={handleExcelImport}
                            className="hidden"
                            accept=".xlsx, .xls, .csv"
                        />
                        <button 
                            type="button" 
                            onClick={() => fileInputRef.current?.click()}
                            className="flex items-center gap-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-3 py-2 rounded-lg text-sm font-bold border border-emerald-200 transition-colors"
                        >
                            <UploadIcon className="w-4 h-4"/>
                            Import Excel
                        </button>
                        <button onClick={onCancel} type="button" className="text-gray-400 hover:text-gray-600 p-2">
                            <XIcon/>
                        </button>
                    </div>
                </div>

                <div className="bg-blue-50 p-4 rounded-lg mb-4 flex items-center justify-between border border-blue-100">
                    <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-blue-800">Tanggal Opname:</span>
                        <input 
                            type="date" 
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            max={new Date().toLocaleDateString('en-CA')}
                            className="bg-white border border-blue-200 rounded-md px-3 py-1 text-sm font-bold text-blue-700 focus:ring-2 focus:ring-blue-500 shadow-sm"
                        />
                    </div>
                    <div className="flex flex-col items-end">
                        <p className="text-[10px] text-blue-600 font-medium max-w-xs text-right">
                            Jika memilih tanggal lampau, sistem stok yang ditampilkan adalah saldo akhir pada tanggal tersebut.
                        </p>
                        <p className="text-[9px] text-emerald-600 font-bold mt-1">
                            Excel: pastikan kolom bernama "nama" & "stock"
                        </p>
                    </div>
                </div>
                
                <div className="flex-grow overflow-y-auto pr-2">
                    <div className="grid grid-cols-4 gap-x-4 gap-y-2 font-bold text-sm mb-2 px-2 pb-2 border-b">
                        <span>Item</span>
                        <span className="text-center">Stok Sistem</span>
                        <span className="text-center">Stok Real</span>
                        <span className="text-center">Selisih</span>
                    </div>
                    <div className="space-y-2">
                        {/* Fix: Use masterItems instead of CHICKEN_PARTS constant */}
                        {masterItems.slice().sort((a, b) => sortChickenParts(a.name, b.name)).map(item => {
                            const partName = item.name;
                            const systemStock = initialQuantities[partName] || 0;
                            const realStock = opnameQuantities[partName];
                            const variance = realStock - systemStock;

                            return (
                                <div key={partName} className="grid grid-cols-4 items-center gap-4 p-2 rounded hover:bg-gray-100">
                                    <label className="text-sm font-medium">{partName}</label>
                                    <span className="text-sm text-gray-700 text-center">{systemStock.toLocaleString('id-ID')} Kg</span>
                                    <div>
                                        <input 
                                            type="number" 
                                            value={realStock}
                                            onChange={(e) => handleQuantityChange(partName, e.target.value)} 
                                            step="0.001"
                                            placeholder="0"
                                            className="block w-full px-2 py-1 border border-gray-300 rounded-md text-sm text-center focus:ring-blue-500 focus:border-blue-500"
                                        />
                                    </div>
                                    <span className={`text-sm text-center font-bold ${variance > 0 ? 'text-green-600' : variance < 0 ? 'text-red-600' : 'text-gray-700'}`}>
                                        {variance.toLocaleString('id-ID', { signDisplay: 'always' })} Kg
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="flex justify-end pt-4 border-t mt-4">
                    <button type="button" onClick={onCancel} className="bg-gray-200 text-gray-800 py-2 px-4 rounded-md mr-2 hover:bg-gray-300">
                        Batal
                    </button>
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className={`py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white ${isSubmitting ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
                    >
                        {isSubmitting ? 'Menyimpan...' : 'Simpan Penyesuaian'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default StockOpnameForm;
