


import React, { useState, useEffect } from 'react';
import type { SalaryRecord } from '../types';
import { XIcon, PlusIcon, TrashIcon } from './icons';
import CurrencyInput from './CurrencyInput';

interface SalaryFormProps {
    onSubmit: (data: Omit<SalaryRecord, 'id'>[]) => void;
    onCancel: () => void;
    initialData?: Omit<SalaryRecord, 'id'>[];
}

interface SalaryRow {
    id: number;
    date: string;
    employeeName: string;
    dailyRate: string;
    daysWorked: string;
    cashBon: string;
    notes: string;
}

const formatLocalDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const SalaryForm: React.FC<SalaryFormProps> = ({ onSubmit, onCancel, initialData }) => {
    const [rows, setRows] = useState<SalaryRow[]>(() => {
        if (initialData && initialData.length > 0) {
            return initialData.map((d, index) => ({
                id: index + 1,
                date: formatLocalDate(new Date(d.date)),
                employeeName: d.employeeName,
                dailyRate: d.dailyRate.toString(),
                daysWorked: d.daysWorked.toString(),
                cashBon: d.cashBon.toString(),
                notes: d.notes || ''
            }));
        }
        return [{ id: 1, date: formatLocalDate(new Date()), employeeName: '', dailyRate: '', daysWorked: '', cashBon: '', notes: '' }];
    });

    const addRow = () => {
        setRows(prev => [
            ...prev,
            { id: Date.now(), date: formatLocalDate(new Date()), employeeName: '', dailyRate: '', daysWorked: '', cashBon: '', notes: '' }
        ]);
    };

    const removeRow = (id: number) => {
        if (rows.length > 1) {
            setRows(prev => prev.filter(row => row.id !== id));
        }
    };

    const updateRow = (id: number, field: keyof SalaryRow, value: string) => {
        setRows(prev => prev.map(row => 
            row.id === id ? { ...row, [field]: value } : row
        ));
    };

    const calculateRowTotal = (row: SalaryRow) => {
        const rate = parseFloat(row.dailyRate) || 0;
        const days = parseFloat(row.daysWorked) || 0;
        const bon = parseFloat(row.cashBon) || 0;
        const total = (rate * days) - bon;
        return total > 0 ? total : 0;
    };

    const grandTotal = rows.reduce((sum, row) => sum + calculateRowTotal(row), 0);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        const cleanData: Omit<SalaryRecord, 'id'>[] = [];
        let hasError = false;

        rows.forEach((row, index) => {
            if (!row.employeeName.trim()) {
                alert(`Baris ke-${index + 1}: Nama karyawan harus diisi.`);
                hasError = true;
                return;
            }

            if (!row.date) {
                alert(`Baris ke-${index + 1}: Tanggal harus diisi.`);
                hasError = true;
                return;
            }

            const rate = parseFloat(row.dailyRate);
            const days = parseFloat(row.daysWorked);
            const bon = parseFloat(row.cashBon) || 0;

            if (isNaN(rate) || rate <= 0) {
                alert(`Baris ke-${index + 1}: Gaji per hari tidak valid.`);
                hasError = true;
                return;
            }

            if (isNaN(days) || days <= 0) {
                alert(`Baris ke-${index + 1}: Hari kerja tidak valid.`);
                hasError = true;
                return;
            }

            cleanData.push({
                date: new Date(row.date),
                employeeName: row.employeeName,
                dailyRate: rate,
                daysWorked: days,
                cashBon: bon,
                totalSalary: (rate * days) - bon,
                notes: row.notes,
                role: ''
            });
        });

        if (!hasError && cleanData.length > 0) {
            onSubmit(cleanData);
        }
    };

    return (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex justify-center items-center p-4">
            <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-xl w-full max-w-7xl max-h-[95vh] flex flex-col">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold text-gray-800">Input Gaji Karyawan (Batch)</h2>
                    <button onClick={onCancel} type="button" className="text-gray-400 hover:text-gray-600">
                        <XIcon/>
                    </button>
                </div>

                <div className="flex-grow overflow-auto border rounded-lg mb-4">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50 sticky top-0 z-10">
                            <tr>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-10">No</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">Tanggal</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nama Karyawan</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">Gaji/Hari (Rp)</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">Hari Masuk</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">Kasbon (Rp)</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Catatan</th>
                                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-40">Total Gaji</th>
                                <th className="px-3 py-2 w-10"></th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {rows.map((row, index) => (
                                <tr key={row.id}>
                                    <td className="px-3 py-2 text-center text-sm text-gray-500">{index + 1}</td>
                                    <td className="px-3 py-2">
                                        <input
                                            type="date"
                                            value={row.date}
                                            onChange={(e) => updateRow(row.id, 'date', e.target.value)}
                                            className="w-full px-2 py-1 border border-gray-300 rounded-md text-sm"
                                            required
                                        />
                                    </td>
                                    <td className="px-3 py-2">
                                        <input
                                            type="text"
                                            value={row.employeeName}
                                            onChange={(e) => updateRow(row.id, 'employeeName', e.target.value)}
                                            className="w-full px-2 py-1 border border-gray-300 rounded-md text-sm"
                                            placeholder="Nama"
                                        />
                                    </td>
                                    <td className="px-3 py-2">
                                        <CurrencyInput
                                            value={row.dailyRate}
                                            onChange={(val) => updateRow(row.id, 'dailyRate', val.toString())}
                                            className="w-full px-2 py-1 border border-gray-300 rounded-md text-sm text-right"
                                            placeholder="0"
                                        />
                                    </td>
                                    <td className="px-3 py-2">
                                        <input
                                            type="number"
                                            value={row.daysWorked}
                                            onChange={(e) => updateRow(row.id, 'daysWorked', e.target.value)}
                                            className="w-full px-2 py-1 border border-gray-300 rounded-md text-sm text-center"
                                            placeholder="0"
                                        />
                                    </td>
                                    <td className="px-3 py-2">
                                        <CurrencyInput
                                            value={row.cashBon}
                                            onChange={(val) => updateRow(row.id, 'cashBon', val.toString())}
                                            className="w-full px-2 py-1 border border-gray-300 rounded-md text-sm text-right text-red-600"
                                            placeholder="0"
                                        />
                                    </td>
                                    <td className="px-3 py-2">
                                        <input
                                            type="text"
                                            value={row.notes}
                                            onChange={(e) => updateRow(row.id, 'notes', e.target.value)}
                                            className="w-full px-2 py-1 border border-gray-300 rounded-md text-sm"
                                            placeholder="Opsional"
                                        />
                                    </td>
                                    <td className="px-3 py-2 text-right font-bold text-sm text-gray-800">
                                        {new Intl.NumberFormat('id-ID').format(calculateRowTotal(row))}
                                    </td>
                                    <td className="px-3 py-2 text-center">
                                        {rows.length > 1 && (
                                            <button type="button" onClick={() => removeRow(row.id)} className="text-red-500 hover:text-red-700">
                                                <TrashIcon />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="flex justify-between items-center pt-4 border-t">
                    <button
                        type="button"
                        onClick={addRow}
                        className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                        <PlusIcon /> Tambah Karyawan
                    </button>

                    <div className="flex items-center gap-4">
                        <div className="text-right">
                             <span className="block text-sm text-gray-500">Total Estimasi Pengeluaran:</span>
                             <span className="block text-xl font-bold text-blue-600">
                                 {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(grandTotal)}
                             </span>
                        </div>
                        <div className="flex gap-2">
                            <button type="button" onClick={onCancel} className="bg-gray-200 text-gray-800 py-2 px-4 rounded-md hover:bg-gray-300">
                                Batal
                            </button>
                            <button
                                type="submit"
                                className="py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                            >
                                Simpan Semua
                            </button>
                        </div>
                    </div>
                </div>
            </form>
        </div>
    );
};

export default SalaryForm;
