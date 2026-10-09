
import React, { useState } from 'react';
import type { ActivityLog } from '../types';
import { db } from '../supabaseClient';

const ActivityHistoryView: React.FC = () => {
    const [logs, setLogs] = useState<ActivityLog[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [filterType, setFilterType] = useState<'date' | 'month' | 'all'>('date');
    const [selectedDate, setSelectedDate] = useState('');
    const [selectedMonth, setSelectedMonth] = useState('');
    const [selectedAction, setSelectedAction] = useState('ALL');
    const [hasSearched, setHasSearched] = useState(false);

    const handleSearch = async () => {
        setIsLoading(true);
        setHasSearched(true);
        try {
            let start = '';
            let end = '';
            if (filterType === 'date' && selectedDate) {
                start = selectedDate;
                end = selectedDate;
            } else if (filterType === 'month' && selectedMonth) {
                const [year, month] = selectedMonth.split('-');
                start = `${year}-${month}-01`;
                const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
                end = `${year}-${month}-${lastDay}`;
            }
            const data = await db.fetchActivityLogs(start, end, selectedAction);
            setLogs(data);
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    const formatDetails = (details: any) => {
        if (!details) return '-';
        if (typeof details === 'string') return details;
        try {
            return JSON.stringify(details);
        } catch (e) {
            return String(details);
        }
    };

    const getActionColor = (action: string) => {
        switch (action.toUpperCase()) {
            case 'CREATE': return 'bg-green-100 text-green-800';
            case 'UPDATE': return 'bg-blue-100 text-blue-800';
            case 'DELETE': return 'bg-red-100 text-red-800';
            case 'LOGIN': return 'bg-purple-100 text-purple-800';
            case 'LOGOUT': return 'bg-orange-100 text-orange-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const sortedLogs = [...logs].sort((a, b) => {
        const dateA = new Date(a.timestamp || a.created_at || 0).getTime();
        const dateB = new Date(b.timestamp || b.created_at || 0).getTime();
        return dateB - dateA;
    });

    return (
        <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800">Riwayat Aktivitas Pengguna</h2>
            </div>
            
            <div className="flex flex-wrap gap-4 mb-6 items-end bg-gray-50 p-4 rounded-lg border border-gray-200">
                <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Filter Waktu</label>
                    <select value={filterType} onChange={(e) => setFilterType(e.target.value as any)} className="w-full p-2 border rounded-md text-sm">
                        <option value="date">Tanggal Tertentu</option>
                        <option value="month">Bulan Tertentu</option>
                        <option value="all">Semua Waktu</option>
                    </select>
                </div>
                {filterType === 'date' && (
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Pilih Tanggal</label>
                        <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-full p-2 border rounded-md text-sm" />
                    </div>
                )}
                {filterType === 'month' && (
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Pilih Bulan</label>
                        <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="w-full p-2 border rounded-md text-sm" />
                    </div>
                )}
                <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Aksi</label>
                    <select value={selectedAction} onChange={(e) => setSelectedAction(e.target.value)} className="w-full p-2 border rounded-md text-sm">
                        <option value="ALL">Semua Aksi</option>
                        <option value="LOGIN">LOGIN</option>
                        <option value="LOGOUT">LOGOUT</option>
                        <option value="CREATE">CREATE</option>
                        <option value="UPDATE">UPDATE</option>
                        <option value="DELETE">DELETE</option>
                    </select>
                </div>
                <button onClick={handleSearch} disabled={isLoading} className="bg-indigo-600 text-white px-6 py-2 rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
                    {isLoading ? 'Mencari...' : 'Cari Data'}
                </button>
            </div>

            {!hasSearched ? (
                <div className="text-center py-10 text-gray-500">
                    Silakan gunakan filter di atas dan klik "Cari Data" untuk melihat riwayat aktivitas.
                </div>
            ) : sortedLogs.length === 0 ? (
                <div className="text-center py-10 text-gray-500">
                    Data tidak ditemukan untuk filter yang dipilih.
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Waktu</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tabel</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Target ID</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Detail</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {sortedLogs.map((log) => (
                                <tr key={log.id || Math.random()} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {new Date(log.timestamp || log.created_at || new Date()).toLocaleString('id-ID', { 
                                            dateStyle: 'medium', 
                                            timeStyle: 'short' 
                                        })}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                        {log.username}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getActionColor(log.action)}`}>
                                            {log.action}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {log.target_table}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {log.target_id || '-'}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate" title={formatDetails(log.details)}>
                                        {formatDetails(log.details)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default ActivityHistoryView;
