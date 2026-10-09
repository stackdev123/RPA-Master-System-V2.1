import React, { useState, useMemo, useEffect, useRef } from 'react';
import type { DeliveryOrder, Customer } from '../types';
import { TrashIcon, ChevronDownIcon, ShoppingCartIcon, ArrowUturnLeftIcon, CheckCircleIcon, FileTextIcon } from './icons';

interface DeliveryOrderListProps {
    deliveryOrders: DeliveryOrder[];
    onSelectOrder: (order: DeliveryOrder) => void;
    customers: Customer[];
    userRole?: string;
    onDeleteSJ?: (id: string) => void;
    onInputReturn?: (order: DeliveryOrder) => void;
    onCreateFromSO?: () => void;
    onStartReceiving?: (order: DeliveryOrder) => void;
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
                className="w-full flex items-center justify-between px-3 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-bold text-slate-700 outline-none hover:border-indigo-200 transition-all text-left h-[38px]"
            >
                <span className="truncate">{value === 'all' ? 'Semua Pelanggan' : value}</span>
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
                            className="w-full px-2 py-1.5 bg-slate-50 border border-slate-100 rounded-lg text-[10px] font-bold outline-none"
                            autoFocus
                        />
                    </div>
                    <div className="max-h-48 overflow-y-auto no-scrollbar py-1">
                        <button
                            onClick={() => { onChange('all'); setIsOpen(false); setSearch(''); }}
                            className={`w-full text-left px-3 py-1.5 text-[10px] font-bold uppercase transition-colors hover:bg-slate-50 ${value === 'all' ? 'text-indigo-600 bg-indigo-50/50' : 'text-slate-600'}`}
                        >
                            Semua Pelanggan
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

const DeliveryOrderList: React.FC<DeliveryOrderListProps> = ({ 
    deliveryOrders, 
    onSelectOrder, 
    customers, 
    userRole, 
    onDeleteSJ, 
    onInputReturn, 
    onCreateFromSO,
    onStartReceiving
}) => {
    // Filter states
    const [searchSJ, setSearchSJ] = useState('');
    const [filterCustomer, setFilterCustomer] = useState('all');
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterDate, setFilterDate] = useState('');
    
    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 20;

    // Reset to page 1 when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchSJ, filterCustomer, filterStatus, filterDate]);

    const handleReset = () => {
        setSearchSJ('');
        setFilterCustomer('all');
        setFilterStatus('all');
        setFilterDate('');
        setCurrentPage(1);
    };

    const filteredOrders = useMemo(() => {
        return deliveryOrders.filter(order => {
            const matchSJ = searchSJ === '' || order.id.toLowerCase().includes(searchSJ.toLowerCase()) || (order.invoiceId && order.invoiceId.toLowerCase().includes(searchSJ.toLowerCase()));
            const matchCust = filterCustomer === 'all' || order.customer === filterCustomer;
            const matchStatus = filterStatus === 'all' || order.status === filterStatus;
            
            let matchDate = true;
            if (filterDate) {
                const orderDateStr = new Date(order.date).toISOString().split('T')[0];
                matchDate = orderDateStr === filterDate;
            }

            return matchSJ && matchCust && matchStatus && matchDate;
        }).sort((a, b) => {
            const dateA = new Date(a.date).getTime();
            const dateB = new Date(b.date).getTime();
            if (dateA !== dateB) return dateB - dateA;
            return b.id.localeCompare(a.id);
        });
    }, [deliveryOrders, searchSJ, filterCustomer, filterStatus, filterDate]);

    // Calculate pagination
    const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
    const paginatedOrders = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return filteredOrders.slice(start, start + itemsPerPage);
    }, [filteredOrders, currentPage]);

    const getStatusBadge = (status: DeliveryOrder['status']) => {
        switch (status) {
            case 'pending':
                return <span className="px-2 py-0.5 text-[7px] md:text-[9px] font-black uppercase tracking-widest rounded-full bg-amber-50 text-amber-700 ring-1 ring-amber-200">Belum Terima</span>;
            case 'received':
                return <span className="px-2 py-0.5 text-[7px] md:text-[9px] font-black uppercase tracking-widest rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">Diterima</span>;
            case 'revised':
                return <span className="px-2 py-0.5 text-[7px] md:text-[9px] font-black uppercase tracking-widest rounded-full bg-blue-50 text-blue-700 ring-1 ring-blue-200">Revisi</span>;
            default:
                return null;
        }
    };
    
    return (
        <div className="bg-white p-5 md:p-8 rounded-2xl md:rounded-[2.5rem] border border-slate-100 shadow-sm space-y-5 md:space-y-8 animate-in fade-in duration-500">
            {/* Header & Filter Bar */}
            <div className="flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                        <h2 className="text-base md:text-xl font-black text-slate-900 tracking-tighter uppercase leading-none">Daftar Surat Jalan</h2>
                        <p className="text-[7px] md:text-[9px] text-slate-400 font-bold tracking-[0.2em] uppercase mt-1">Manajemen Pengiriman Barang</p>
                    </div>
                    <div className="flex items-center gap-2">
                        {onCreateFromSO && (
                            <button
                                onClick={onCreateFromSO}
                                className="flex items-center gap-1.5 px-3 py-1.5 md:px-4 md:py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg md:rounded-xl text-[8px] md:text-[10px] font-black uppercase tracking-widest transition-all shadow-md shadow-teal-500/20 active:scale-95"
                            >
                                <ShoppingCartIcon className="h-3.5 w-3.5" />
                                + Delivery Order
                            </button>
                        )}
                        <button 
                            onClick={handleReset}
                            className="px-3 py-1.5 md:px-5 md:py-2.5 bg-slate-50 border border-slate-200 text-slate-400 hover:text-slate-600 rounded-lg md:rounded-xl text-[8px] md:text-[10px] font-black uppercase tracking-widest transition-all"
                        >
                            RESET FILTER
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 md:p-5 bg-slate-50/50 rounded-2xl md:rounded-3xl border border-slate-100">
                    <div className="col-span-2 md:col-span-1">
                        <label className="block text-[7px] md:text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1">Cari SJ</label>
                        <input 
                            type="text" 
                            value={searchSJ}
                            onChange={(e) => setSearchSJ(e.target.value)}
                            placeholder="Cari SJ..."
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-bold focus:ring-4 focus:ring-indigo-500/5 outline-none transition-all h-[38px]"
                        />
                    </div>
                    <div>
                        <label className="block text-[7px] md:text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1">Pelanggan</label>
                        <SearchableCustomerFilter 
                            options={customers.map(c => c.name)}
                            value={filterCustomer}
                            onChange={setFilterCustomer}
                        />
                    </div>
                    <div>
                        <label className="block text-[7px] md:text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1">Tanggal</label>
                        <input 
                            type="date" 
                            value={filterDate}
                            onChange={(e) => setFilterDate(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-bold outline-none h-[38px]"
                        />
                    </div>
                    <div className="col-span-2 md:col-span-1">
                        <label className="block text-[7px] md:text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1">Status</label>
                        <select 
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-bold outline-none h-[38px]"
                        >
                            <option value="all">Semua Status</option>
                            <option value="pending">Pending</option>
                            <option value="received">Diterima</option>
                            <option value="revised">Revisi</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto no-scrollbar border border-slate-50 rounded-2xl">
                <table className="min-w-full divide-y divide-slate-100">
                    <thead className="bg-slate-50">
                        <tr>
                            <th className="px-4 py-3 text-left text-[8px] font-black text-slate-400 uppercase tracking-widest">Nomor SJ</th>
                            <th className="px-4 py-3 text-left text-[8px] font-black text-slate-400 uppercase tracking-widest">Tanggal</th>
                            <th className="px-4 py-3 text-left text-[8px] font-black text-slate-400 uppercase tracking-widest">Customer</th>
                            <th className="px-4 py-3 text-center text-[8px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                            <th className="px-4 py-3 text-right text-[8px] font-black text-slate-400 uppercase tracking-widest">Aksi</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-50">
                        {paginatedOrders.length === 0 ? (
                            <tr><td colSpan={5} className="px-4 py-12 text-center text-[9px] font-black text-slate-300 uppercase tracking-widest italic">Data tidak ditemukan</td></tr>
                        ) : (
                            paginatedOrders.map((order) => {
                                const totalKirim = order.items.reduce((acc, it) => acc + (it.quantity || 0), 0);
                                const receivedItems = order.receivedItems && order.receivedItems.length > 0 ? order.receivedItems : [];
                                const totalTerima = receivedItems.reduce((acc, it) => acc + (it.quantity || 0), 0);
                                const totalRetur = order.rejectedItems?.reduce((acc, it) => acc + (it.quantity || 0), 0) || 0;
                                const susut = Math.max(0, totalKirim - totalRetur - totalTerima);

                                return (
                                <tr key={order.id} className="hover:bg-slate-50 transition-all group">
                                    <td className="px-4 py-4 whitespace-nowrap">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-black text-slate-900 uppercase">{order.id}</span>
                                            {order.salesOrderId && (
                                                <span className="text-[8px] font-bold text-teal-600 uppercase tracking-tighter mt-0.5">SO: {order.salesOrderId}</span>
                                            )}
                                            {order.invoiceId ? (
                                                <span className="text-[8px] font-bold text-indigo-500 uppercase tracking-tighter mt-0.5">INV: {order.invoiceId}</span>
                                            ) : order.status === 'received' ? (
                                                <span className="text-[8px] font-bold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded w-fit mt-1">Siap Di-Invoice</span>
                                            ) : null}
                                            <div className="flex flex-wrap gap-1 mt-1">
                                                {order.status === 'received' ? (
                                                    <>
                                                        <span className="text-[8px] font-black text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                                                            Terima: {totalTerima} kg
                                                        </span>
                                                        {totalRetur > 0 && (
                                                            <span className="text-[8px] font-black text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded">
                                                                Retur: {totalRetur} kg
                                                            </span>
                                                        )}
                                                        {susut > 0 && (
                                                            <span className="text-[8px] font-black text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                                                                Susut: {susut} kg
                                                            </span>
                                                        )}
                                                    </>
                                                ) : (
                                                    <span className="text-[8px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                                        Kirim: {totalKirim} kg
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 whitespace-nowrap text-[9px] font-bold text-slate-500">{new Date(order.date).toLocaleDateString('id-ID', {day: '2-digit', month: 'short', timeZone: 'UTC'})}</td>
                                    <td className="px-4 py-4 whitespace-nowrap text-[10px] font-black text-slate-700 uppercase">{order.customer}</td>
                                    <td className="px-4 py-4 whitespace-nowrap text-center">{getStatusBadge(order.status)}</td>
                                    <td className="px-4 py-4 whitespace-nowrap text-right">
                                        <div className="flex items-center justify-end gap-1.5">
                                            {order.status === 'pending' && onStartReceiving && (
                                                <button 
                                                    onClick={() => onStartReceiving(order)} 
                                                    className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[8px] font-black uppercase tracking-widest transition-all active:scale-95 flex items-center gap-1 shadow-sm"
                                                    title="Input Penerimaan & Tolakan untuk DO ini"
                                                >
                                                    <CheckCircleIcon className="h-3 w-3" />
                                                    INPUT TERIMA
                                                </button>
                                            )}
                                            {onInputReturn && (
                                                <button 
                                                    onClick={() => onInputReturn(order)} 
                                                    className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all active:scale-95 flex items-center gap-1 border border-amber-200"
                                                    title="Input Retur / Tolakan untuk DO ini"
                                                >
                                                    <ArrowUturnLeftIcon className="h-3 w-3" />
                                                    RETUR
                                                </button>
                                            )}
                                            <button 
                                                onClick={() => onSelectOrder(order)} 
                                                className="px-2.5 py-1.5 bg-slate-900 text-white rounded-lg text-[8px] font-black uppercase tracking-widest transition-all active:scale-95"
                                            >
                                                DETAIL
                                            </button>
                                            {userRole?.toLowerCase().trim() === 'superadmin' && (
                                                <button 
                                                    onClick={(e) => { 
                                                        e.stopPropagation(); 
                                                        if (window.confirm(`Apakah Anda yakin ingin MENGHAPUS Surat Jalan ${order.id}? Seluruh barang akan dikembalikan ke stok gudang.`)) {
                                                             onDeleteSJ?.(order.id); 
                                                        }
                                                    }}
                                                    className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                                    title="Hapus SJ"
                                                >
                                                    <TrashIcon className="h-4 w-4" />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                            })
                        )}
                    </tbody>
                </table>
            </div>
            
            {/* Pagination Controls */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-4 border-t border-slate-50">
                <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                    MENAMPILKAN {paginatedOrders.length} DARI {filteredOrders.length} DATA
                </div>
                
                {totalPages > 1 && (
                    <div className="flex items-center gap-1.5">
                        <button 
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(prev => prev - 1)}
                            className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 disabled:opacity-30 transition-all active:scale-95"
                        >
                            PREV
                        </button>
                        <div className="bg-slate-900 text-white px-4 py-2 rounded-xl text-[10px] font-black min-w-[60px] text-center shadow-lg shadow-slate-100">
                            {currentPage} / {totalPages}
                        </div>
                        <button 
                            disabled={currentPage === totalPages}
                            onClick={() => setCurrentPage(prev => prev + 1)}
                            className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 disabled:opacity-30 transition-all active:scale-95"
                        >
                            NEXT
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DeliveryOrderList;