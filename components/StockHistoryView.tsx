
import React, { useState, useMemo } from 'react';
import type { StockLog } from '../types';
import { ArrowLeftIcon } from './icons';

interface StockHistoryViewProps {
    logs: StockLog[];
    onBack: () => void;
}

const StockHistoryView: React.FC<StockHistoryViewProps> = ({ logs, onBack }) => {
    const [filterItem, setFilterItem] = useState('');
    const [filterType, setFilterType] = useState('');

    const sortedLogs = useMemo(() => {
        return [...logs].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    }, [logs]);

    const filteredLogs = useMemo(() => {
        return sortedLogs.filter(log => {
            const itemMatch = filterItem ? log.itemName.toLowerCase().includes(filterItem.toLowerCase()) : true;
            const typeMatch = filterType ? log.type === filterType : true;
            return itemMatch && typeMatch;
        });
    }, [sortedLogs, filterItem, filterType]);

    const getTypeBadge = (type: StockLog['type']) => {
        switch (type) {
            case 'Produksi':
                return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">{type}</span>;
            case 'Alokasi':
                return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">{type}</span>;
            case 'Opname':
                return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">{type}</span>;
            case 'Pembelian':
                return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">{type}</span>;
            case 'Pemusnahan':
                return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">{type}</span>;
            default:
                return null;
        }
    };
    
    return (
        <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="flex items-center gap-4 mb-4">
                <button 
                    onClick={onBack}
                    className="p-2 rounded-full hover:bg-gray-100"
                    aria-label="Kembali ke Stok"
                >
                    <ArrowLeftIcon />
                </button>
                <h2 className="text-2xl font-bold text-gray-800">Riwayat Perubahan Stok</h2>
            </div>
            <div className="flex justify-between items-center mb-4 flex-wrap gap-4">
                <input
                    type="text"
                    placeholder="Filter Nama Item..."
                    className="block w-full max-w-xs px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    value={filterItem}
                    onChange={(e) => setFilterItem(e.target.value)}
                />
                <select
                    className="block w-full max-w-xs px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                >
                    <option value="">Semua Tipe</option>
                    <option value="Produksi">Produksi</option>
                    <option value="Alokasi">Alokasi</option>
                    <option value="Opname">Opname</option>
                    <option value="Pembelian">Pembelian</option>
                    <option value="Pemusnahan">Pemusnahan</option>
                </select>
            </div>
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Timestamp</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipe</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Stok Awal</th>
                            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Perubahan</th>
                            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Stok Akhir</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Keterangan</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {filteredLogs.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="px-6 py-4 text-center text-gray-500">Tidak ada data riwayat stok yang cocok.</td>
                            </tr>
                        ) : (
                            filteredLogs.map(log => (
                                <tr key={log.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(log.timestamp).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">{getTypeBadge(log.type)}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{log.itemName}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">{log.stockBefore.toLocaleString('id-ID')}</td>
                                    <td className={`px-6 py-4 whitespace-nowrap text-sm font-bold text-right ${log.change > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        {log.change.toLocaleString('id-ID', { signDisplay: 'always' })}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-medium">{log.stockAfter.toLocaleString('id-ID')}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{log.notes}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default StockHistoryView;