
import React, { useState, useMemo, Fragment } from 'react';
import type { ProductionRecord } from '../types';
import { sortChickenParts } from '../constants';
import { ChevronDownIcon, SwitchVerticalIcon } from './icons';

interface ProductionHistoryTableProps {
    records: ProductionRecord[];
}

type SortKey = 'truckNumber' | 'date' | 'coopName' | 'licensePlate' | 'initialKg' | 'totalResult' | 'yield' | 'totalCost';

interface SortConfig {
    key: SortKey | null;
    direction: 'ascending' | 'descending';
}

const ProductionHistoryTable: React.FC<ProductionHistoryTableProps> = ({ records }) => {
    const [filter, setFilter] = useState('');
    const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'date', direction: 'descending' });
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

    const toggleRow = (id: string) => {
        setExpandedRows(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    };
    
    const processedRecords = useMemo(() => {
        return records.map(record => {
            // FIX: Ensure both the accumulator (sum) and the value (qty) are treated as numbers in the reduce operation.
            const totalResult = Object.values(record.items).reduce((sum, qty) => Number(sum) + Number(qty), 0);
            // FIX: Ensure totalResult is treated as a number for the division operation.
            const yieldValue = record.initialKg > 0 ? (Number(totalResult) / record.initialKg) * 100 : 0;
            const totalCost = (record.initialKg || 0) * (record.pricePerKg || 0);
            return {
                ...record,
                totalResult,
                yield: yieldValue,
                totalCost,
            };
        });
    }, [records]);

    const filteredAndSortedRecords = useMemo(() => {
        let sortableItems = [...processedRecords];

        if (filter) {
            const lowercasedFilter = filter.toLowerCase();
            sortableItems = sortableItems.filter(record =>
                record.truckNumber.toString().includes(lowercasedFilter) ||
                (record.coopName && record.coopName.toLowerCase().includes(lowercasedFilter)) ||
                (record.licensePlate && record.licensePlate.toLowerCase().includes(lowercasedFilter))
            );
        }

        if (sortConfig.key !== null) {
            sortableItems.sort((a, b) => {
                const aValue = a[sortConfig.key as keyof typeof a];
                const bValue = b[sortConfig.key as keyof typeof b];

                // Handle undefined or null values
                if (aValue == null && bValue == null) return 0;
                if (aValue == null) return sortConfig.direction === 'ascending' ? -1 : 1;
                if (bValue == null) return sortConfig.direction === 'ascending' ? 1 : -1;

                if (aValue < bValue) {
                    return sortConfig.direction === 'ascending' ? -1 : 1;
                }
                if (aValue > bValue) {
                    return sortConfig.direction === 'ascending' ? 1 : -1;
                }
                return 0;
            });
        }
        return sortableItems;
    }, [processedRecords, filter, sortConfig]);

    const requestSort = (key: SortKey) => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };
    
    const getSortIcon = (key: SortKey) => {
        if (sortConfig.key !== key) {
            return <SwitchVerticalIcon className="h-4 w-4 text-gray-400" />;
        }
        if (sortConfig.direction === 'ascending') {
            return <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" /></svg>;
        }
        return <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>;
    };

    if (records.length === 0) {
        return (
            <div className="bg-white p-6 rounded-lg shadow-md text-center">
                <h3 className="text-xl font-bold text-gray-800 mb-2">Riwayat Produksi</h3>
                <p className="text-gray-500">Belum ada data produksi yang tersimpan.</p>
            </div>
        );
    }

    return (
        <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="flex justify-between items-center mb-4 flex-wrap gap-4">
                <h3 className="text-2xl font-bold text-gray-800">Riwayat Produksi</h3>
                <input
                    type="text"
                    placeholder="Filter No. Truk, Kandang, Plat..."
                    className="block w-full max-w-xs px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                />
            </div>
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-4 py-3"></th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                <button onClick={() => requestSort('truckNumber')} className="flex items-center gap-2">Truk Ke- {getSortIcon('truckNumber')}</button>
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                <button onClick={() => requestSort('date')} className="flex items-center gap-2">Tanggal {getSortIcon('date')}</button>
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                <button onClick={() => requestSort('coopName')} className="flex items-center gap-2">Nama Kandang {getSortIcon('coopName')}</button>
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                <button onClick={() => requestSort('licensePlate')} className="flex items-center gap-2">Plat Nomor {getSortIcon('licensePlate')}</button>
                            </th>
                             <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                <button onClick={() => requestSort('initialKg')} className="flex items-center gap-2">Berat Awal (Kg) {getSortIcon('initialKg')}</button>
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                <button onClick={() => requestSort('totalCost')} className="flex items-center gap-2">Total Pembelian {getSortIcon('totalCost')}</button>
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                <button onClick={() => requestSort('totalResult')} className="flex items-center gap-2">Total Hasil (Kg) {getSortIcon('totalResult')}</button>
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                <button onClick={() => requestSort('yield')} className="flex items-center gap-2">Yield (%) {getSortIcon('yield')}</button>
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {filteredAndSortedRecords.map(record => (
                            <Fragment key={record.id}>
                                <tr className="hover:bg-gray-50">
                                    <td className="px-4 py-4 whitespace-nowrap">
                                        <button onClick={() => toggleRow(record.id)} className="p-1 rounded-full hover:bg-gray-200" aria-label="Toggle details">
                                            <ChevronDownIcon className={`h-5 w-5 transition-transform ${expandedRows.has(record.id) ? 'rotate-180' : ''}`} />
                                        </button>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{record.truckNumber}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{record.date.toLocaleDateString('id-ID', {day: '2-digit', month: 'short', year: 'numeric'})}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{record.coopName}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{record.licensePlate}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{record.initialKg.toLocaleString('id-ID')}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{record.totalCost > 0 ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(record.totalCost) : '-'}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{record.totalResult.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-700">{record.yield.toFixed(2)}%</td>
                                </tr>
                                {expandedRows.has(record.id) && (
                                    <tr>
                                        <td colSpan={9} className="p-4 bg-gray-50">
                                            <div className="mb-2 text-sm">
                                                <span className="font-semibold text-gray-700">Harga Beli: </span>
                                                <span className="text-gray-800">{record.pricePerKg ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(record.pricePerKg) : '-'} / Kg</span>
                                            </div>
                                            <h4 className="text-md font-semibold text-gray-700 mb-2">Rincian Hasil Produksi:</h4>
                                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-4 gap-y-2 text-sm">
                                                {Object.entries(record.items)
                                                    // Fix: Cast qty to Number for correct comparison.
                                                    .filter(([, qty]) => Number(qty) > 0)
                                                    .sort(([partA], [partB]) => sortChickenParts(partA, partB))
                                                    .map(([part, qty]) => (
                                                        <div key={part} className="flex justify-between border-b py-1">
                                                            <span className="font-medium text-gray-600">{part}:</span>
                                                            {/* Fix: Cast qty to Number to ensure toLocaleString can be called with arguments. */}
                                                            <span className="text-gray-800">{Number(qty).toLocaleString('id-ID')} Kg</span>
                                                        </div>
                                                ))}
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </Fragment>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default ProductionHistoryTable;