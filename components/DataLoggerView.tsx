
import React, { useState, Fragment } from 'react';
import type { ProductionLog } from '../types';
import { CHICKEN_PARTS, sortChickenParts } from '../constants';
import { DownloadIcon, ChevronDownIcon } from './icons';

interface DataLoggerViewProps {
    logs: ProductionLog[];
}

const DataLoggerView: React.FC<DataLoggerViewProps> = ({ logs }) => {
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

    const handleDownload = () => {
        const headers = [
            'Timestamp', 'Action', 'Truck Number', 'Coop Name', 'License Plate',
            'Initial Ekor', 'Initial Kg', 'Price Per Kg', 'Total Cost', 'Total Result (Kg)', 'Yield (%)',
            ...CHICKEN_PARTS
        ];

        const escapeCsvCell = (cellData: any) => {
            const stringData = String(cellData);
            if (stringData.includes(',') || stringData.includes('"') || stringData.includes('\n')) {
                return `"${stringData.replace(/"/g, '""')}"`;
            }
            return stringData;
        };

        const rows = logs.map(log => {
            const { record } = log;
            // FIX: Explicitly specify the generic type for `reduce` to fix incorrect type inference for `totalResult`.
            const totalResult = Object.values(record.items).reduce<number>((sum, qty) => sum + (Number(qty) || 0), 0);
            const yieldValue = record.initialKg > 0 ? (totalResult / record.initialKg) * 100 : 0;
            const totalCost = (record.initialKg || 0) * (record.pricePerKg || 0);

            const baseData = [
                log.timestamp.toISOString(),
                log.action,
                record.truckNumber,
                record.coopName,
                record.licensePlate,
                record.initialEkor,
                record.initialKg,
                record.pricePerKg || 0,
                totalCost,
                totalResult.toFixed(2),
                yieldValue.toFixed(2),
            ];

            const itemData = CHICKEN_PARTS.map(part => record.items[part] || 0);

            return [...baseData, ...itemData].map(escapeCsvCell).join(',');
        });

        const csvContent = [headers.join(','), ...rows].join('\n');
        
        const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', 'production_logger.csv');
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="flex justify-between items-center mb-4 flex-wrap gap-4">
                <h2 className="text-2xl font-bold text-gray-800">Data Logger Produksi</h2>
                <button
                    onClick={handleDownload}
                    disabled={logs.length === 0}
                    className="inline-flex items-center justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400"
                >
                    <DownloadIcon />
                    <span className="ml-2">Download Data Logger as Excel</span>
                </button>
            </div>
            {logs.length === 0 ? (
                <p className="text-gray-500">Belum ada aktivitas produksi yang tercatat.</p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 w-12"></th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Timestamp</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Aktivitas</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Detail</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {logs.map(log => {
                                const { record } = log;
                                // FIX: Explicitly specify the generic type for `reduce` to fix incorrect type inference for `totalResult`.
                                const totalResult = Object.values(record.items).reduce<number>((sum, qty) => sum + (Number(qty) || 0), 0);
                                const totalCost = (record.initialKg || 0) * (record.pricePerKg || 0);
                                const detailsString = `Truk #${record.truckNumber} (${record.coopName}). Berat Awal: ${record.initialKg.toLocaleString('id-ID')} Kg, Total Hasil: ${totalResult.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Kg. Total Beli: ${totalCost.toLocaleString('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0})}.`;

                                return (
                                <Fragment key={log.id}>
                                    <tr className="hover:bg-gray-50">
                                        <td className="px-4 py-4 whitespace-nowrap">
                                            <button onClick={() => toggleRow(log.id)} className="p-1 rounded-full hover:bg-gray-200" aria-label="Toggle details">
                                                <ChevronDownIcon className={`h-5 w-5 transition-transform ${expandedRows.has(log.id) ? 'rotate-180' : ''}`} />
                                            </button>
                                        </td>
                                        {/* FIX: Ensure timestamp is a Date object before calling toLocaleString with arguments. */}
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(log.timestamp).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                                {log.action}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-normal text-sm text-gray-600">{detailsString}</td>
                                    </tr>
                                    {expandedRows.has(log.id) && (
                                        <tr>
                                            <td colSpan={4} className="p-4 bg-gray-50">
                                                <div className="mb-2 text-sm">
                                                    <span className="font-semibold text-gray-700">Harga Beli: </span>
                                                    <span className="text-gray-800">{record.pricePerKg ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(record.pricePerKg) : '-'} / Kg</span>
                                                </div>
                                                <h4 className="text-md font-semibold text-gray-700 mb-2">Rincian Hasil Produksi:</h4>
                                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-4 gap-y-2 text-sm">
                                                    {Object.entries(record.items)
                                                        .filter(([, qty]) => Number(qty) > 0)
                                                        .sort(([partA], [partB]) => sortChickenParts(partA, partB))
                                                        .map(([part, qty]) => (
                                                            <div key={part} className="flex justify-between border-b py-1">
                                                                <span className="font-medium text-gray-600">{part}:</span>
                                                                <span className="text-gray-800">{Number(qty).toLocaleString('id-ID')} Kg</span>
                                                            </div>
                                                    ))}
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </Fragment>
                            )})}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default DataLoggerView;