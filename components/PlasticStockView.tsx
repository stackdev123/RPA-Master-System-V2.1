
import React from 'react';
import type { PlasticItem, PlasticLog } from '../types';
import { PlusIcon, ShoppingCartIcon } from './icons';

interface PlasticStockViewProps {
    stock: PlasticItem[];
    logs: PlasticLog[];
    onStartTransaction: () => void;
}

const PlasticStockView: React.FC<PlasticStockViewProps> = ({ stock, logs, onStartTransaction }) => {
    
    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow-md">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
                    <h2 className="text-2xl font-bold text-gray-800">Stok Plastik & Lain-lain</h2>
                    <button
                        onClick={onStartTransaction}
                        className="inline-flex items-center justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                        <PlusIcon />
                        Catat Transaksi
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nama Item</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kuantitas</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Satuan</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {stock.length === 0 ? (
                                <tr>
                                    <td colSpan={3} className="px-6 py-4 text-center text-gray-500">Belum ada item stok. Klik "Catat Transaksi" untuk menambah.</td>
                                </tr>
                            ) : (
                                stock.map((item) => (
                                    <tr key={item.name} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.name}</td>
                                        <td className={`px-6 py-4 whitespace-nowrap text-sm ${item.quantity > 0 ? 'text-gray-700' : 'text-red-500 font-bold'}`}>
                                            {item.quantity.toLocaleString('id-ID')}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.unit}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md">
                <h3 className="text-xl font-bold text-gray-800 mb-4">Riwayat Transaksi Terakhir</h3>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-2 text-left font-medium text-gray-500">Tanggal</th>
                                <th className="px-4 py-2 text-left font-medium text-gray-500">Tipe</th>
                                <th className="px-4 py-2 text-left font-medium text-gray-500">Item</th>
                                <th className="px-4 py-2 text-right font-medium text-gray-500">Jumlah</th>
                                <th className="px-4 py-2 text-left font-medium text-gray-500">Satuan</th>
                                <th className="px-4 py-2 text-right font-medium text-gray-500">Harga/Unit</th>
                                <th className="px-4 py-2 text-right font-medium text-gray-500">Total Biaya</th>
                                <th className="px-4 py-2 text-left font-medium text-gray-500">Catatan</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {logs.slice(0, 10).map((log) => (
                                <tr key={log.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-2 text-gray-500">{new Date(log.date).toLocaleDateString('id-ID')}</td>
                                    <td className="px-4 py-2">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                            log.type === 'Pembelian' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                        }`}>
                                            {log.type}
                                        </span>
                                    </td>
                                    <td className="px-4 py-2 font-medium text-gray-900">{log.itemName}</td>
                                    <td className="px-4 py-2 text-right">{log.quantity.toLocaleString('id-ID')}</td>
                                    <td className="px-4 py-2 text-gray-500">{log.unit}</td>
                                    <td className="px-4 py-2 text-right">
                                        {log.pricePerUnit ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(log.pricePerUnit) : '-'}
                                    </td>
                                    <td className="px-4 py-2 text-right">
                                         {log.totalCost ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(log.totalCost) : '-'}
                                    </td>
                                    <td className="px-4 py-2 text-gray-500">{log.notes}</td>
                                </tr>
                            ))}
                            {logs.length === 0 && (
                                <tr>
                                    <td colSpan={8} className="px-4 py-4 text-center text-gray-500">Belum ada riwayat transaksi.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default PlasticStockView;
