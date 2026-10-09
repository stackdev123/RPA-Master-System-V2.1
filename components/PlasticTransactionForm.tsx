
import React, { useState, useEffect } from 'react';
import type { PlasticItem, PlasticLog } from '../types';
import { XIcon } from './icons';

interface PlasticTransactionFormProps {
    stock: PlasticItem[];
    onSubmit: (data: Omit<PlasticLog, 'id'>) => void;
    onCancel: () => void;
}

const PlasticTransactionForm: React.FC<PlasticTransactionFormProps> = ({ stock, onSubmit, onCancel }) => {
    const [type, setType] = useState<'Pembelian' | 'Pengeluaran'>('Pembelian');
    const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
    const [itemName, setItemName] = useState('');
    const [isNewItem, setIsNewItem] = useState(false);
    const [quantity, setQuantity] = useState(''); // Changed to string for better input handling
    const [unit, setUnit] = useState<'Pcs' | 'Kg'>('Pcs');
    const [pricePerUnit, setPricePerUnit] = useState(0);
    const [notes, setNotes] = useState('');

    // Reset fields when switching types
    useEffect(() => {
        if (type === 'Pengeluaran') {
            setIsNewItem(false);
            setPricePerUnit(0);
        }
    }, [type]);

    // Update unit based on selected existing item
    useEffect(() => {
        if (!isNewItem && itemName) {
            const item = stock.find(s => s.name === itemName);
            if (item) {
                setUnit(item.unit);
            }
        }
    }, [itemName, isNewItem, stock]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!itemName.trim()) {
            alert('Nama item harus diisi.');
            return;
        }
        
        const qtyNum = parseFloat(quantity);

        if (isNaN(qtyNum) || qtyNum <= 0) {
            alert('Jumlah harus lebih dari 0.');
            return;
        }
        
        if (type === 'Pengeluaran') {
            const item = stock.find(s => s.name === itemName);
            if (!item) {
                alert('Item tidak ditemukan di stok.');
                return;
            }
            if (qtyNum > item.quantity) {
                alert(`Stok tidak cukup. Sisa: ${item.quantity} ${item.unit}`);
                return;
            }
        }

        const totalCost = type === 'Pembelian' ? qtyNum * pricePerUnit : undefined;

        onSubmit({
            date: new Date(date),
            type,
            itemName,
            quantity: qtyNum,
            unit,
            pricePerUnit: type === 'Pembelian' ? pricePerUnit : undefined,
            totalCost,
            notes
        });
    };

    const qtyNum = parseFloat(quantity) || 0;

    return (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex justify-center items-center p-4">
            <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold text-gray-800">Transaksi Stok Plastik & Lainnya</h2>
                    <button onClick={onCancel} type="button" className="text-gray-400 hover:text-gray-600">
                        <XIcon/>
                    </button>
                </div>

                <div className="flex-grow overflow-y-auto pr-2 space-y-4">
                    {/* Transaction Type */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Jenis Transaksi</label>
                        <div className="flex gap-4">
                            <label className="inline-flex items-center">
                                <input
                                    type="radio"
                                    className="form-radio text-blue-600"
                                    name="type"
                                    value="Pembelian"
                                    checked={type === 'Pembelian'}
                                    onChange={() => setType('Pembelian')}
                                />
                                <span className="ml-2">Pembelian (Masuk)</span>
                            </label>
                            <label className="inline-flex items-center">
                                <input
                                    type="radio"
                                    className="form-radio text-red-600"
                                    name="type"
                                    value="Pengeluaran"
                                    checked={type === 'Pengeluaran'}
                                    onChange={() => setType('Pengeluaran')}
                                />
                                <span className="ml-2">Pengeluaran (Keluar)</span>
                            </label>
                        </div>
                    </div>

                    {/* Date */}
                    <div>
                        <label htmlFor="trans-date" className="block text-sm font-medium text-gray-700">Tanggal</label>
                        <input
                            type="date"
                            id="trans-date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                            required
                        />
                    </div>

                    {/* Item Selection */}
                    <div>
                        <label htmlFor="item-name" className="block text-sm font-medium text-gray-700">Nama Item</label>
                        {type === 'Pembelian' ? (
                             <div className="mt-1">
                                {isNewItem ? (
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={itemName}
                                            onChange={(e) => setItemName(e.target.value)}
                                            placeholder="Nama Item Baru..."
                                            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                            required
                                        />
                                        <button 
                                            type="button" 
                                            onClick={() => { setIsNewItem(false); setItemName(''); }}
                                            className="text-sm text-blue-600 hover:text-blue-800 whitespace-nowrap"
                                        >
                                            Pilih Lama
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex gap-2">
                                        <select
                                            value={itemName}
                                            onChange={(e) => setItemName(e.target.value)}
                                            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                        >
                                            <option value="">-- Pilih Item --</option>
                                            {stock.map(item => (
                                                <option key={item.name} value={item.name}>{item.name} (Stok: {item.quantity} {item.unit})</option>
                                            ))}
                                        </select>
                                        <button 
                                            type="button" 
                                            onClick={() => { setIsNewItem(true); setItemName(''); setUnit('Pcs'); }}
                                            className="text-sm text-blue-600 hover:text-blue-800 whitespace-nowrap"
                                        >
                                            + Baru
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <select
                                value={itemName}
                                onChange={(e) => setItemName(e.target.value)}
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                required
                            >
                                <option value="">-- Pilih Item --</option>
                                {stock.filter(s => s.quantity > 0).map(item => (
                                    <option key={item.name} value={item.name}>{item.name} (Stok: {item.quantity} {item.unit})</option>
                                ))}
                            </select>
                        )}
                    </div>

                    {/* Unit Selection (Only editable for new items) */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Satuan</label>
                        {isNewItem ? (
                            <div className="mt-1 flex gap-4">
                                <label className="inline-flex items-center">
                                    <input type="radio" name="unit" value="Pcs" checked={unit === 'Pcs'} onChange={() => setUnit('Pcs')} className="form-radio text-blue-600" />
                                    <span className="ml-2">Pcs</span>
                                </label>
                                <label className="inline-flex items-center">
                                    <input type="radio" name="unit" value="Kg" checked={unit === 'Kg'} onChange={() => setUnit('Kg')} className="form-radio text-blue-600" />
                                    <span className="ml-2">Kg</span>
                                </label>
                            </div>
                        ) : (
                            <input type="text" value={unit} disabled className="mt-1 block w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-md text-gray-500" />
                        )}
                    </div>

                    {/* Quantity */}
                    <div>
                        <label htmlFor="quantity" className="block text-sm font-medium text-gray-700">Jumlah ({unit})</label>
                        <input
                            type="number"
                            id="quantity"
                            value={quantity}
                            onChange={(e) => setQuantity(e.target.value)}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                            placeholder="0"
                            min="0"
                            step="any"
                            required
                        />
                    </div>

                    {/* Price (Purchase Only) */}
                    {type === 'Pembelian' && (
                        <div>
                            <label htmlFor="price" className="block text-sm font-medium text-gray-700">Harga Beli per {unit} (Rp)</label>
                            <input
                                type="number"
                                id="price"
                                value={pricePerUnit === 0 ? '' : pricePerUnit}
                                onChange={(e) => setPricePerUnit(parseFloat(e.target.value) || 0)}
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                placeholder="0"
                                min="0"
                            />
                            {qtyNum > 0 && pricePerUnit > 0 && (
                                <p className="text-sm text-gray-500 mt-1">Total: {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(qtyNum * pricePerUnit)}</p>
                            )}
                        </div>
                    )}

                    {/* Notes */}
                    <div>
                        <label htmlFor="notes" className="block text-sm font-medium text-gray-700">Catatan (Opsional)</label>
                        <textarea
                            id="notes"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={2}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>
                </div>

                <div className="flex justify-end pt-4 border-t mt-4">
                    <button type="button" onClick={onCancel} className="bg-gray-200 text-gray-800 py-2 px-4 rounded-md mr-2 hover:bg-gray-300">
                        Batal
                    </button>
                    <button
                        type="submit"
                        className="py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                        Simpan Transaksi
                    </button>
                </div>
            </form>
        </div>
    );
};

export default PlasticTransactionForm;
