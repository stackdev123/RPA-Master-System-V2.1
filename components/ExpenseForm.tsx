
import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import type { ExpenseRecord } from '../types';
import { XIcon, UploadIcon, PlusIcon, TrashIcon } from './icons';
import CurrencyInput from './CurrencyInput';

interface ExpenseFormProps {
    onSubmit: (data: Omit<ExpenseRecord, 'id'> | Omit<ExpenseRecord, 'id'>[]) => void;
    onCancel: () => void;
}

const CATEGORIES = [
    'BELANJA LB (MOBIL KE)',
    'BORONGAN POTONG',
    'BORONGAN BONELESS',
    'BIAYA NGEPOK',
    'BENSIN MOBIL NGEPOK',
    'ES BATU',
    'LISTRIK',
    'GAS (TABUNG)',
    'PLASTIK',
    'GAJI KARYAWAN OPERASIONAL',
    'OPERASIONAL PENGIRIMAN'
];

const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });
};

interface BatchItem {
    date: string;
    category: string;
    customCategory: string;
    isCustom: boolean;
    amount: string;
    description: string;
}

const ExpenseForm: React.FC<ExpenseFormProps> = ({ onSubmit, onCancel }) => {
    const [isBatch, setIsBatch] = useState(false);
    
    // Single mode state
    const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
    const [selectedCategory, setSelectedCategory] = useState(CATEGORIES[0]);
    const [customCategory, setCustomCategory] = useState('');
    const [isCustom, setIsCustom] = useState(false);
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [proofImage, setProofImage] = useState<string | undefined>(undefined);
    const [fileName, setFileName] = useState('');

    // Batch mode state
    const [batchItems, setBatchItems] = useState<BatchItem[]>([
        { date: new Date().toISOString().slice(0, 10), category: CATEGORIES[0], customCategory: '', isCustom: false, amount: '', description: '' }
    ]);

    const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value;
        if (val === 'NEW') {
            setIsCustom(true);
            setSelectedCategory('');
        } else {
            setIsCustom(false);
            setSelectedCategory(val);
        }
    };

    const handleBatchCategoryChange = (index: number, val: string) => {
        const newItems = [...batchItems];
        if (val === 'NEW') {
            newItems[index].isCustom = true;
            newItems[index].category = '';
        } else {
            newItems[index].isCustom = false;
            newItems[index].category = val;
        }
        setBatchItems(newItems);
    };

    const updateBatchItem = (index: number, field: keyof BatchItem, value: any) => {
        const newItems = [...batchItems];
        newItems[index] = { ...newItems[index], [field]: value };
        setBatchItems(newItems);
    };

    const addBatchRow = () => {
        setBatchItems([...batchItems, { 
            date: batchItems[batchItems.length - 1]?.date || new Date().toISOString().slice(0, 10), 
            category: CATEGORIES[0], 
            customCategory: '', 
            isCustom: false, 
            amount: '', 
            description: '' 
        }]);
    };

    const removeBatchRow = (index: number) => {
        if (batchItems.length > 1) {
            setBatchItems(batchItems.filter((_, i) => i !== index));
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent, rowIndex: number, field: string) => {
        if (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            // For select, we only want Enter to move down, arrows should still change selection
            if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && (e.target as HTMLElement).tagName === 'SELECT') {
                return;
            }

            const isDown = e.key === 'Enter' || e.key === 'ArrowDown';
            const targetRow = isDown ? rowIndex + 1 : rowIndex - 1;
            
            if (targetRow >= 0 && targetRow < batchItems.length) {
                e.preventDefault();
                let nextInput = document.querySelector(`[data-row="${targetRow}"][data-field="${field}"]`) as HTMLElement;
                
                // Special handling for category/customCategory transition
                if (!nextInput && field === 'customCategory') {
                    nextInput = document.querySelector(`[data-row="${targetRow}"][data-field="category"]`) as HTMLElement;
                }
                if (!nextInput && field === 'category') {
                    nextInput = document.querySelector(`[data-row="${targetRow}"][data-field="customCategory"]`) as HTMLElement;
                }
                
                nextInput?.focus();
            }
        }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 2 * 1024 * 1024) { // 2MB limit
                alert("Ukuran file terlalu besar. Maksimal 2MB.");
                return;
            }
            try {
                const base64 = await fileToBase64(file);
                setProofImage(base64);
                setFileName(file.name);
            } catch (error) {
                console.error("Error converting file to base64", error);
                alert("Gagal memproses file.");
            }
        }
    };

    const handleXlsxImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary', cellDates: true });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws) as any[];

                const importedItems: BatchItem[] = data.map(row => {
                    let rowDate = new Date().toISOString().slice(0, 10);
                    if (row.Tanggal) {
                        const d = new Date(row.Tanggal);
                        if (!isNaN(d.getTime())) {
                            rowDate = d.toISOString().slice(0, 10);
                        }
                    }

                    const category = String(row.Kategori || '').trim();
                    const isCustom = category && !CATEGORIES.includes(category);

                    return {
                        date: rowDate,
                        category: isCustom ? '' : (category || CATEGORIES[0]),
                        customCategory: isCustom ? category : '',
                        isCustom: !!isCustom,
                        amount: String(row.Jumlah || ''),
                        description: String(row.Keterangan || '')
                    };
                });

                if (importedItems.length > 0) {
                    setBatchItems(importedItems);
                } else {
                    alert('File XLSX kosong atau format tidak sesuai.');
                }
            } catch (error) {
                console.error("Error parsing XLSX", error);
                alert('Gagal membaca file XLSX. Pastikan formatnya benar.');
            }
        };
        reader.readAsBinaryString(file);
        // Reset input so the same file can be uploaded again
        e.target.value = '';
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (isBatch) {
            const finalBatch = batchItems.map(item => {
                const amountNum = parseFloat(item.amount);
                const finalCategory = item.isCustom ? item.customCategory.trim() : item.category;
                
                if (isNaN(amountNum) || amountNum <= 0 || !finalCategory || !item.description.trim()) {
                    return null;
                }

                return {
                    date: new Date(item.date),
                    category: finalCategory,
                    amount: amountNum,
                    description: item.description,
                    proofImage: undefined
                };
            }).filter(Boolean) as Omit<ExpenseRecord, 'id'>[];

            if (finalBatch.length === 0) {
                alert('Mohon isi setidaknya satu baris pengeluaran dengan benar.');
                return;
            }

            onSubmit(finalBatch);
        } else {
            const amountNum = parseFloat(amount);
            if (isNaN(amountNum) || amountNum <= 0) {
                alert('Jumlah harus lebih dari 0.');
                return;
            }
            
            const finalCategory = isCustom ? customCategory.trim() : selectedCategory;

            if (!finalCategory) {
                alert('Kategori harus diisi.');
                return;
            }

            if (!description.trim()) {
                alert('Keterangan harus diisi.');
                return;
            }

            onSubmit({
                date: new Date(date),
                category: finalCategory,
                amount: amountNum,
                description,
                proofImage
            });
        }
    };

    return (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex justify-center items-center p-4">
            <div className={`bg-white p-6 rounded-lg shadow-xl w-full ${isBatch ? 'max-w-6xl' : 'max-w-lg'} max-h-[90vh] flex flex-col`}>
                <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-4">
                        <h2 className="text-2xl font-bold text-gray-800">
                            {isBatch ? 'Input Pengeluaran Batch' : 'Catat Pengeluaran Baru'}
                        </h2>
                        <button 
                            type="button"
                            onClick={() => setIsBatch(!isBatch)}
                            className="text-xs font-bold px-3 py-1 bg-blue-50 text-blue-600 rounded-full hover:bg-blue-100 transition-colors"
                        >
                            {isBatch ? 'Kembali ke Input Tunggal' : 'Pindah ke Mode Batch'}
                        </button>
                    </div>
                    <button onClick={onCancel} type="button" className="text-gray-400 hover:text-gray-600">
                        <XIcon/>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex-grow overflow-y-auto flex flex-col">
                    {isBatch ? (
                        <div className="flex-grow overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-40">Tanggal</th>
                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-64">Kategori</th>
                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-48">Jumlah (Rp)</th>
                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Keterangan</th>
                                        <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-16">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {batchItems.map((item, index) => (
                                        <tr key={index}>
                                            <td className="px-2 py-2 align-top">
                                                <input
                                                    type="date"
                                                    value={item.date}
                                                    onChange={(e) => updateBatchItem(index, 'date', e.target.value)}
                                                    className="block w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                                                    required
                                                    data-row={index}
                                                    data-field="date"
                                                    onKeyDown={(e) => handleKeyDown(e, index, 'date')}
                                                />
                                            </td>
                                            <td className="px-2 py-2 align-top">
                                                <select
                                                    value={item.isCustom ? 'NEW' : item.category}
                                                    onChange={(e) => handleBatchCategoryChange(index, e.target.value)}
                                                    className="block w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                                                    data-row={index}
                                                    data-field="category"
                                                    onKeyDown={(e) => handleKeyDown(e, index, 'category')}
                                                >
                                                    {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                                    <option value="NEW">+ Kategori Baru</option>
                                                </select>
                                                {item.isCustom && (
                                                    <input
                                                        type="text"
                                                        value={item.customCategory}
                                                        onChange={(e) => updateBatchItem(index, 'customCategory', e.target.value)}
                                                        className="mt-1 block w-full px-2 py-1 text-xs border border-blue-300 rounded focus:ring-blue-500 focus:border-blue-500"
                                                        placeholder="Nama kategori..."
                                                        required
                                                        data-row={index}
                                                        data-field="customCategory"
                                                        onKeyDown={(e) => handleKeyDown(e, index, 'customCategory')}
                                                    />
                                                )}
                                            </td>
                                            <td className="px-2 py-2 align-top">
                                                <CurrencyInput
                                                    value={item.amount}
                                                    onChange={(val) => updateBatchItem(index, 'amount', val)}
                                                    className="block w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                                                    placeholder="0"
                                                    required
                                                    data-row={index}
                                                    data-field="amount"
                                                    onKeyDown={(e) => handleKeyDown(e, index, 'amount')}
                                                />
                                            </td>
                                            <td className="px-2 py-2 align-top">
                                                <textarea
                                                    value={item.description}
                                                    onChange={(e) => updateBatchItem(index, 'description', e.target.value)}
                                                    rows={1}
                                                    className="block w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                                                    placeholder="Keterangan..."
                                                    required
                                                    data-row={index}
                                                    data-field="description"
                                                    onKeyDown={(e) => handleKeyDown(e, index, 'description')}
                                                />
                                            </td>
                                            <td className="px-2 py-2 text-center align-top">
                                                <button
                                                    type="button"
                                                    onClick={() => removeBatchRow(index)}
                                                    className="text-red-500 hover:text-red-700 p-1"
                                                    disabled={batchItems.length === 1}
                                                >
                                                    <TrashIcon className="h-4 w-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <div className="mt-4 flex items-center space-x-4">
                                <button
                                    type="button"
                                    onClick={addBatchRow}
                                    className="flex items-center text-sm font-bold text-blue-600 hover:text-blue-700"
                                >
                                    <PlusIcon className="h-4 w-4 mr-1" /> Tambah Baris
                                </button>
                                <label className="flex items-center text-sm font-bold text-green-600 hover:text-green-700 cursor-pointer">
                                    <UploadIcon className="h-4 w-4 mr-1" /> Import XLSX
                                    <input
                                        type="file"
                                        accept=".xlsx, .xls"
                                        className="hidden"
                                        onChange={handleXlsxImport}
                                    />
                                </label>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div>
                                <label htmlFor="date" className="block text-sm font-medium text-gray-700">Tanggal</label>
                                <input
                                    type="date"
                                    id="date"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                    required
                                />
                            </div>
                            <div>
                                <label htmlFor="category" className="block text-sm font-medium text-gray-700">Kategori</label>
                                <select
                                    id="category"
                                    value={isCustom ? 'NEW' : selectedCategory}
                                    onChange={handleCategoryChange}
                                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                >
                                    {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                    <option value="NEW">+ Tambah Kategori Baru</option>
                                </select>
                                
                                {isCustom && (
                                    <div className="mt-2 animate-fade-in">
                                        <label htmlFor="customCategory" className="block text-xs font-medium text-gray-500 mb-1">Nama Kategori Baru</label>
                                        <input
                                            type="text"
                                            id="customCategory"
                                            value={customCategory}
                                            onChange={(e) => setCustomCategory(e.target.value)}
                                            className="block w-full px-3 py-2 border border-blue-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                            placeholder="Ketik nama kategori..."
                                            autoFocus
                                            required
                                        />
                                    </div>
                                )}
                            </div>
                            <div>
                                <label htmlFor="amount" className="block text-sm font-medium text-gray-700">Jumlah (Rp)</label>
                                <CurrencyInput
                                    id="amount"
                                    value={amount}
                                    onChange={(val) => setAmount(val)}
                                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="0"
                                    required
                                />
                            </div>
                            <div>
                                <label htmlFor="description" className="block text-sm font-medium text-gray-700">Keterangan</label>
                                <textarea
                                    id="description"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    rows={3}
                                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="Contoh: Detail item yang dibeli"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Bukti / Nota (Opsional)</label>
                                <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
                                    <div className="space-y-1 text-center">
                                        <UploadIcon />
                                        <div className="flex text-sm text-gray-600 justify-center mt-2">
                                            <label htmlFor="file-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500">
                                                <span>Unggah file</span>
                                                <input id="file-upload" name="file-upload" type="file" className="sr-only" accept="image/*" onChange={handleFileChange} />
                                            </label>
                                        </div>
                                        <p className="text-xs text-gray-500">PNG, JPG hingga 2MB</p>
                                        {fileName && <p className="text-xs text-green-600 mt-2 font-semibold">{fileName}</p>}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="flex justify-end pt-4 border-t mt-4">
                        <button type="button" onClick={onCancel} className="bg-gray-200 text-gray-800 py-2 px-4 rounded-md mr-2 hover:bg-gray-300">
                            Batal
                        </button>
                        <button
                            type="submit"
                            className="py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                            {isBatch ? `Simpan ${batchItems.length} Pengeluaran` : 'Simpan Pengeluaran'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ExpenseForm;
