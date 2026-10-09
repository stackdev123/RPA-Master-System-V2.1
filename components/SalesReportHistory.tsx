import React, { useState, useMemo, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import type { DeliveryOrder, Invoice } from '../types';
import { CHICKEN_PARTS, sortChickenParts } from '../constants';
import { ChevronDownIcon, DownloadIcon } from './icons';

interface SalesReportHistoryProps {
    deliveryOrders: DeliveryOrder[];
    invoices: Invoice[];
    onSelectSJ: (order: DeliveryOrder) => void;
    onSelectInvoice: (invoice: Invoice) => void;
}

const SearchableCustomerFilter = ({ options, value, onChange }: { options: string[], value: string, onChange: (val: string) => void }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredOptions = useMemo(() => {
        return options.filter(opt => opt.toLowerCase().includes(search.toLowerCase()));
    }, [options, search]);

    return (
        <div className="relative w-full" ref={containerRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-bold text-slate-700 outline-none hover:border-indigo-200 transition-all text-left h-[29px]"
            >
                <span className="truncate">{value === 'all' ? 'SEMUA PELANGGAN' : value}</span>
                <ChevronDownIcon className={`h-3 w-3 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-100 shadow-xl rounded-xl z-[150] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                    <div className="p-2 border-b border-slate-50">
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Cari..."
                            className="w-full px-2 py-1 bg-slate-50 border border-slate-100 rounded-lg text-[10px] font-bold outline-none"
                            autoFocus
                        />
                    </div>
                    <div className="max-h-48 overflow-y-auto no-scrollbar py-1">
                        <button
                            onClick={() => { onChange('all'); setIsOpen(false); setSearch(''); }}
                            className={`w-full text-left px-3 py-1.5 text-[10px] font-bold uppercase transition-colors hover:bg-slate-50 ${value === 'all' ? 'text-indigo-600 bg-indigo-50/50' : 'text-slate-600'}`}
                        >
                            SEMUA PELANGGAN
                        </button>
                        {filteredOptions.map((opt) => (
                            <button
                                key={opt}
                                onClick={() => { onChange(opt); setIsOpen(false); setSearch(''); }}
                                className={`w-full text-left px-3 py-1.5 text-[10px] font-bold uppercase transition-colors hover:bg-slate-50 ${value === opt ? 'text-indigo-600 bg-indigo-50/50' : 'text-slate-600'}`}
                            >
                                {opt}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

const SalesReportHistory: React.FC<SalesReportHistoryProps> = ({ deliveryOrders, invoices, onSelectSJ, onSelectInvoice }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selCustomer, setSelCustomer] = useState('all');
    const [selItem, setSelItem] = useState('all');
    const [selStatus, setSelStatus] = useState('all');
    
    // Default: Kosong agar tidak langsung load database dan lebih ringan
    const [dateRange, setDateRange] = useState({
        start: '',
        end: '',
    });

    // Extract unique options for filters
    const filterOptions = useMemo(() => {
        const customers = Array.from(new Set(deliveryOrders.map(o => o.customer).filter(Boolean))).sort();
        const dynamicItems = new Set<string>(CHICKEN_PARTS);
        deliveryOrders.forEach(o => {
            (o.items || []).forEach(i => { if (i.name) dynamicItems.add(i.name); });
            (o.receivedItems || []).forEach(i => { if (i.name) dynamicItems.add(i.name); });
        });
        const items = Array.from(dynamicItems).sort(sortChickenParts);
        return { customers, items };
    }, [deliveryOrders]);

    const historyData = useMemo(() => {
        let start: Date | null = null;
        let end: Date | null = null;
        
        if (dateRange.start) {
            start = new Date(dateRange.start);
            start.setHours(0, 0, 0, 0);
        }
        if (dateRange.end) {
            end = new Date(dateRange.end);
            end.setHours(23, 59, 59, 999);
        }

        const rows: any[] = [];

        deliveryOrders.forEach(order => {
            const orderDate = new Date(order.date);
            
            if (start && orderDate < start) return;
            if (end && orderDate > end) return;

            // Filter Pelanggan
            if (selCustomer !== 'all' && order.customer !== selCustomer) return;
            
            // Filter Status
            const displayStatus = (order.status === 'received' || order.status === 'revised') ? 'DITERIMA' : 'DIKIRIM';
            if (selStatus !== 'all' && displayStatus !== selStatus) return;

            // Cari invoice terkait (termasuk Combine SJ yang dipisahkan koma)
            const orderIdNorm = order.id.trim().toLowerCase();
            const associatedInv = invoices.find(inv => {
                if (order.invoiceId && inv.id === order.invoiceId) return true;
                return String(inv.deliveryOrderId || '')
                    .split(',')
                    .map(s => s.trim().toLowerCase())
                    .includes(orderIdNorm);
            });
            
            // Gunakan item diterima jika ada, jika tidak gunakan item kirim
            const displayItems = (order.receivedItems && order.receivedItems.length > 0) 
                ? order.receivedItems 
                : order.items;

            displayItems.forEach(item => {
                // Filter Item
                if (selItem !== 'all' && item.name !== selItem) return;

                const q = searchTerm.trim().toLowerCase();
                const matchesSearch = !q ||
                    order.id.toLowerCase().includes(q) ||
                    (order.salesOrderId || '').toLowerCase().includes(q) ||
                    order.customer.toLowerCase().includes(q) ||
                    item.name.toLowerCase().includes(q) ||
                    (associatedInv?.id || '').toLowerCase().includes(q);

                if (matchesSearch) {
                    rows.push({
                        date: orderDate,
                        sjNumber: order.id,
                        invNumber: associatedInv ? associatedInv.id : (order.invoiceId || '-'),
                        customer: order.customer,
                        itemName: item.name,
                        quantity: item.quantity,
                        status: displayStatus,
                        orderObj: order,
                        invoiceObj: associatedInv
                    });
                }
            });
        });

        // Urutan tanggal dari TERLAMA (Ascending) sesuai permintaan
        return rows.sort((a, b) => a.date.getTime() - b.date.getTime());
    }, [deliveryOrders, invoices, searchTerm, dateRange, selCustomer, selItem, selStatus]);

    const totalVolume = useMemo(() => historyData.reduce((sum, r) => sum + r.quantity, 0), [historyData]);

    const handleDownloadXlsx = () => {
        if (historyData.length === 0) return;

        const exportRows = historyData.map((row, index) => ({
            'NO': index + 1,
            'TGL SJ': row.date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }),
            'NOMOR SJ': row.sjNumber,
            'NOMOR SO': row.orderObj?.salesOrderId || '-',
            'NOMOR INVOICE': row.invNumber,
            'PELANGGAN': row.customer,
            'ITEM': row.itemName,
            'QUANTITY (KG)': Number(row.quantity) || 0,
            'STATUS': row.status,
        }));

        exportRows.push({
            'NO': '' as any,
            'TGL SJ': '',
            'NOMOR SJ': '',
            'NOMOR SO': '',
            'NOMOR INVOICE': '',
            'PELANGGAN': '',
            'ITEM': 'TOTAL VOLUME TERFILTER',
            'QUANTITY (KG)': Number(totalVolume) || 0,
            'STATUS': '',
        });

        const worksheet = XLSX.utils.json_to_sheet(exportRows);
        worksheet['!cols'] = [
            { wch: 6 },
            { wch: 15 },
            { wch: 18 },
            { wch: 18 },
            { wch: 20 },
            { wch: 24 },
            { wch: 24 },
            { wch: 16 },
            { wch: 14 },
        ];

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Riwayat Penjualan');

        const dateSuffix = dateRange.start || dateRange.end
            ? `${dateRange.start || 'Awal'}_sd_${dateRange.end || 'Akhir'}`
            : new Date().toISOString().slice(0, 10);

        XLSX.writeFile(workbook, `Riwayat_Penjualan_${dateSuffix}.xlsx`);
    };

    const labelStyle = "block text-[7px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1";
    const inputStyle = "w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-bold outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all uppercase";

    return (
        <div className="space-y-4">
            {/* Even More Compact Advanced Filter Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5 bg-white p-3 rounded-[1rem] border border-slate-200 items-end">
                <div className="lg:col-span-2 min-w-0">
                    <label className={labelStyle}>Cari Data</label>
                    <input 
                        type="text"
                        placeholder="SJ / Invoice / Nama..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className={inputStyle}
                    />
                </div>
                <div className="lg:col-span-2 min-w-0">
                    <label className={labelStyle}>Pelanggan</label>
                    <SearchableCustomerFilter 
                        options={filterOptions.customers}
                        value={selCustomer}
                        onChange={setSelCustomer}
                    />
                </div>
                <div className="lg:col-span-2 min-w-0">
                    <label className={labelStyle}>Bagian Ayam</label>
                    <select 
                        value={selItem}
                        onChange={(e) => setSelItem(e.target.value)}
                        className={inputStyle}
                    >
                        <option value="all">SEMUA BAGIAN</option>
                        {filterOptions.items.map(i => <option key={i} value={i}>{i}</option>)}
                    </select>
                </div>
                <div className="lg:col-span-2 min-w-0">
                    <label className={labelStyle}>Status</label>
                    <select 
                        value={selStatus}
                        onChange={(e) => setSelStatus(e.target.value)}
                        className={inputStyle}
                    >
                        <option value="all">SEMUA STATUS</option>
                        <option value="DIKIRIM">DIKIRIM</option>
                        <option value="DITERIMA">DITERIMA</option>
                    </select>
                </div>
                <div className="sm:col-span-2 lg:col-span-4 min-w-0">
                    <label className={labelStyle}>Periode</label>
                    <div className="flex items-center gap-1.5">
                        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1 flex-1 min-w-0">
                            <input 
                                type="date" 
                                value={dateRange.start}
                                onChange={(e) => setDateRange(p => ({...p, start: e.target.value}))}
                                className={`${inputStyle} min-w-0 px-2`}
                            />
                            <span className="text-slate-300 font-bold text-xs">-</span>
                            <input 
                                type="date" 
                                value={dateRange.end}
                                onChange={(e) => setDateRange(p => ({...p, end: e.target.value}))}
                                className={`${inputStyle} min-w-0 px-2`}
                            />
                        </div>
                        <button
                            type="button"
                            onClick={handleDownloadXlsx}
                            disabled={historyData.length === 0}
                            title="Download XLSX"
                            aria-label="Download XLSX"
                            className="h-[31px] w-[31px] shrink-0 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-lg flex items-center justify-center shadow-sm transition-all active:scale-95"
                        >
                            <DownloadIcon className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Table Container with Sticky Header */}
            <div className="overflow-x-auto no-scrollbar border border-slate-100 rounded-2xl shadow-inner bg-slate-50/10 max-h-[600px] overflow-y-auto">
                <table className="min-w-full border-separate border-spacing-0">
                    <thead className="sticky top-0 z-20">
                        <tr className="bg-slate-900 text-white">
                            <th className="px-6 py-3.5 text-left text-[9px] font-black uppercase tracking-widest border-b border-slate-800">TGL SJ</th>
                            <th className="px-6 py-3.5 text-left text-[9px] font-black uppercase tracking-widest border-b border-slate-800">NOMOR SJ</th>
                            <th className="px-6 py-3.5 text-left text-[9px] font-black uppercase tracking-widest border-b border-slate-800">NOMOR INVOICE</th>
                            <th className="px-6 py-3.5 text-left text-[9px] font-black uppercase tracking-widest border-b border-slate-800">PELANGGAN</th>
                            <th className="px-6 py-3.5 text-left text-[9px] font-black uppercase tracking-widest border-b border-slate-800">ITEM</th>
                            <th className="px-6 py-3.5 text-right text-[9px] font-black uppercase tracking-widest border-b border-slate-800">QUANTITY</th>
                            <th className="px-6 py-3.5 text-center text-[9px] font-black uppercase tracking-widest border-b border-slate-800">STATUS</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-50">
                        {historyData.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="px-8 py-20 text-center">
                                    <p className="text-slate-300 font-black uppercase tracking-widest text-xs italic">Data transaksi tidak ditemukan</p>
                                </td>
                            </tr>
                        ) : (
                            historyData.map((row, idx) => (
                                <tr key={idx} className="hover:bg-slate-50 transition-all group">
                                    <td className="px-6 py-3 text-[11px] font-bold text-slate-500 whitespace-nowrap">
                                        {row.date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                                    </td>
                                    <td className="px-6 py-3 text-[11px] font-black">
                                        <button 
                                            onClick={() => onSelectSJ(row.orderObj)}
                                            className="text-slate-900 hover:text-indigo-600 transition-colors uppercase tracking-tight"
                                        >
                                            {row.sjNumber}
                                        </button>
                                    </td>
                                    <td className="px-6 py-3 text-[11px] font-bold">
                                        {row.invoiceObj ? (
                                            <button 
                                                onClick={() => onSelectInvoice(row.invoiceObj)}
                                                className="text-indigo-600 hover:text-indigo-800 transition-colors uppercase tracking-tight"
                                            >
                                                {row.invNumber}
                                            </button>
                                        ) : (
                                            <span className="text-slate-300">{row.invNumber}</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-3 text-[11px] font-black text-slate-700 uppercase truncate max-w-[150px]">
                                        {row.customer}
                                    </td>
                                    <td className="px-6 py-3 text-[11px] font-black text-slate-600 uppercase">
                                        {row.itemName}
                                    </td>
                                    <td className="px-6 py-3 text-right font-mono font-black text-slate-900 text-[12px]">
                                        {row.quantity.toLocaleString('id-ID')} <span className="text-[9px] text-slate-400 ml-0.5">Kg</span>
                                    </td>
                                    <td className="px-6 py-3 text-center">
                                        <span className={`px-2.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border ${
                                            row.status === 'DITERIMA' 
                                            ? 'bg-emerald-50 text-emerald-600 border-emerald-100' 
                                            : 'bg-amber-50 text-amber-600 border-amber-100'
                                        }`}>
                                            {row.status}
                                        </span>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                    {historyData.length > 0 && (
                        <tfoot className="sticky bottom-0 z-20 bg-slate-100 font-black">
                            <tr>
                                <td colSpan={5} className="px-6 py-4 text-[10px] uppercase tracking-[0.2em] text-slate-500 border-t border-slate-200">TOTAL VOLUME TERFILTER:</td>
                                <td className="px-6 py-4 text-right font-mono text-sm text-indigo-700 border-t border-slate-200">
                                    {totalVolume.toLocaleString('id-ID')} <span className="text-[10px] uppercase ml-0.5">Kg</span>
                                </td>
                                <td className="px-6 py-4 border-t border-slate-200"></td>
                            </tr>
                        </tfoot>
                    )}
                </table>
            </div>
            
            <div className="flex justify-between items-center px-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                <p>TOTAL DATA DITAMPILKAN: {historyData.length} BARIS</p>
                <p className="italic">Urutan: Terlama ke Terbaru</p>
            </div>
        </div>
    );
};

export default SalesReportHistory;