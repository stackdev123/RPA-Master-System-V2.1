import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import JSZip from 'jszip';

const TABLES = [
    'master_items', 'master_coops', 'master_customers', 'master_plates',
    'current_stock', 'production_logs', 'trading_purchases', 'stock_disposals',
    'delivery_orders', 'invoices', 'stock_logs', 'ledger_entries',
    'expenses', 'salaries', 'early_stock', 'activity_logs'
];

const DatabaseBackup: React.FC = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [downloadStatus, setDownloadStatus] = useState<string>('');

    const downloadJson = (data: any, filename: string) => {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const createCsvContent = (data: any[]) => {
        if (!data || data.length === 0) return '';
        const headers = Object.keys(data[0]);
        const csvRows = [];
        csvRows.push(headers.join(','));

        for (const row of data) {
            const values = headers.map(header => {
                const val = row[header];
                if (val === null || val === undefined) return '""';
                const str = String(val).replace(/"/g, '""');
                return `"${str}"`;
            });
            csvRows.push(values.join(','));
        }
        return csvRows.join('\n');
    };

    const downloadCsv = (data: any[], filename: string) => {
        const csvContent = createCsvContent(data);
        if (!csvContent) {
            alert('Tidak ada data untuk ' + filename);
            return;
        }
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const fetchAllDataFromTable = async (table: string) => {
        let allData: any[] = [];
        let from = 0;
        const step = 1000;
        while (true) {
            const { data, error } = await supabase.from(table).select('*').range(from, from + step - 1);
            if (error) throw error;
            if (!data || data.length === 0) break;
            allData = allData.concat(data);
            if (data.length < step) break;
            from += step;
        }
        return allData;
    };

    const handleDownloadAllZip = async () => {
        setIsLoading(true);
        setDownloadStatus('Mengambil dan menyiapkan zip...');
        try {
            const zip = new JSZip();
            for (const table of TABLES) {
                setDownloadStatus(`Mengambil tabel ${table}...`);
                const tableData = await fetchAllDataFromTable(table);
                if (tableData && tableData.length > 0) {
                    const csvContent = createCsvContent(tableData);
                    zip.file(`${table}.csv`, csvContent);
                }
            }
            setDownloadStatus('Membuat file ZIP...');
            const zipBlob = await zip.generateAsync({ type: 'blob' });
            const dateStr = new Date().toISOString().slice(0, 10);
            const url = URL.createObjectURL(zipBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `full_database_backup_${dateStr}.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            setDownloadStatus('Backup selesai!');
        } catch (e: any) {
            alert('Gagal mengambil data: ' + e.message);
            setDownloadStatus('Gagal');
        } finally {
            setIsLoading(false);
            setTimeout(() => setDownloadStatus(''), 3000);
        }
    };

    const handleDownloadTable = async (table: string, format: 'json' | 'csv') => {
        setIsLoading(true);
        setDownloadStatus(`Mengambil tabel ${table}...`);
        try {
            const tableData = await fetchAllDataFromTable(table);
            const dateStr = new Date().toISOString().slice(0, 10);
            const filename = `${table}_backup_${dateStr}.${format}`;
            if (format === 'json') {
                downloadJson(tableData, filename);
            } else {
                downloadCsv(tableData, filename);
            }
            setDownloadStatus('Selesai!');
        } catch (e: any) {
            alert('Gagal mengambil data: ' + e.message);
            setDownloadStatus('Gagal');
        } finally {
            setIsLoading(false);
            setTimeout(() => setDownloadStatus(''), 3000);
        }
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-md border border-slate-200">
            <h3 className="text-xl font-bold text-slate-800 mb-4 uppercase tracking-wider border-b pb-2">Backup & Download Database</h3>
            <p className="text-sm text-slate-600 mb-6">
                Unduh seluruh isi database sebagai file ZIP (berisi CSV) untuk keperluan backup. Anda juga bisa mengunduh per-tabel secara individual ke dalam format CSV atau JSON.
            </p>

            <div className="mb-8 flex gap-4 flex-col md:flex-row">
                <button
                    onClick={handleDownloadAllZip}
                    disabled={isLoading}
                    className="flex-1 px-6 py-4 bg-indigo-600 text-white rounded-xl font-bold uppercase hover:bg-indigo-700 transition-all shadow-md active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                    {isLoading && downloadStatus.includes('zip') ? (
                        <span className="animate-pulse">{downloadStatus}</span>
                    ) : (
                        <>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                            Download Seluruh Database (ZIP)
                        </>
                    )}
                </button>
            </div>

            <h4 className="font-bold text-slate-700 mb-3 border-b pb-2">Download Per-Tabel</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[400px] overflow-y-auto pr-2">
                {TABLES.map(table => (
                    <div key={table} className="flex flex-col bg-slate-50 p-4 rounded-xl border border-slate-100 shadow-sm">
                        <span className="font-bold text-slate-700 mb-3 uppercase text-xs tracking-wider break-words">{table.replace(/_/g, ' ')}</span>
                        <div className="flex gap-2 mt-auto">
                            <button
                                onClick={() => handleDownloadTable(table, 'csv')}
                                disabled={isLoading}
                                className="flex-1 px-3 py-2 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 hover:text-emerald-800 rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
                            >
                                CSV
                            </button>
                            <button
                                onClick={() => handleDownloadTable(table, 'json')}
                                disabled={isLoading}
                                className="flex-1 px-3 py-2 bg-slate-200 text-slate-700 hover:bg-slate-300 hover:text-slate-800 rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
                            >
                                JSON
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {isLoading && downloadStatus && !downloadStatus.includes('zip') && (
                <div className="fixed bottom-6 right-6 bg-slate-800 text-white px-4 py-3 rounded-xl shadow-2xl animate-bounce flex items-center gap-3 z-50">
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="text-sm font-bold">{downloadStatus}</span>
                </div>
            )}
        </div>
    );
};

export default DatabaseBackup;
