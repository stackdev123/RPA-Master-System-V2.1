import React, { useState, useMemo, useEffect, useRef } from 'react';
import type { Invoice, DeliveryOrder, SalesOrder } from '../types';
import { ChevronDownIcon, CheckCircleIcon, PlusIcon, ShoppingCartIcon, TruckIcon } from './icons';
import * as XLSX from 'xlsx';

interface InvoiceListProps {
    invoices: Invoice[];
    deliveryOrders?: DeliveryOrder[];
    salesOrders?: SalesOrder[];
    onSelectInvoice: (invoice: Invoice) => void;
    onStartInvoicing?: (order: DeliveryOrder) => void;
    onCombineInvoicing?: (orders: DeliveryOrder[], salesOrderId: string, mergeIntoInvoice?: Invoice) => void;
    onCloseSalesOrder?: (salesOrderId: string) => Promise<void>;
    customerDebts?: { [key: string]: number };
    lockedDOs?: Record<string, string>;
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

const InvoiceList: React.FC<InvoiceListProps> = ({ 
    invoices, 
    deliveryOrders = [], 
    salesOrders = [],
    onSelectInvoice, 
    onStartInvoicing, 
    onCombineInvoicing,
    onCloseSalesOrder,
    customerDebts,
    lockedDOs = {}
}) => {
    // Helper untuk mencari Nomor SO dari sebuah DeliveryOrder
    const getOrderSOId = (order: DeliveryOrder): string => {
        if (order.salesOrderId && order.salesOrderId.trim()) return order.salesOrderId.trim();
        const foundSO = salesOrders.find(so =>
            (so.deliveryOrderIds || []).some(id => id.trim().toLowerCase() === order.id.trim().toLowerCase())
        );
        return foundSO ? foundSO.id.trim() : '';
    };

    // Delivery Orders that are received and waiting to be invoiced
    const readyDeliveryOrders = useMemo(() => {
        return deliveryOrders.filter(order =>
            (order.status === 'received' || order.status === 'revised') && !order.invoiceId
        ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [deliveryOrders]);

    // Grouping berdasarkan Nomor SO untuk Menu Combine SJ
    const soCombineGroups = useMemo(() => {
        const map = new Map<string, {
            soId: string;
            salesOrder?: SalesOrder;
            customer: string;
            allDOs: DeliveryOrder[];
            uninvoicedDOs: DeliveryOrder[];
            readyDOs: DeliveryOrder[];
            invoicedDOs: DeliveryOrder[];
            existingInvoices: Invoice[];
        }>();

        deliveryOrders.forEach(d => {
            const soId = getOrderSOId(d);
            if (!soId) return;
            if (!map.has(soId)) {
                const soObj = salesOrders.find(s => s.id.trim().toLowerCase() === soId.toLowerCase());
                map.set(soId, {
                    soId,
                    salesOrder: soObj,
                    customer: soObj?.customer || d.customer,
                    allDOs: [],
                    uninvoicedDOs: [],
                    readyDOs: [],
                    invoicedDOs: [],
                    existingInvoices: []
                });
            }
            const grp = map.get(soId)!;
            grp.allDOs.push(d);
            if (d.invoiceId) {
                grp.invoicedDOs.push(d);
            } else {
                grp.uninvoicedDOs.push(d);
                if (d.status === 'received' || d.status === 'revised') {
                    grp.readyDOs.push(d);
                }
            }
        });

        // Hubungkan juga existing invoices untuk tiap SO
        map.forEach(grp => {
            grp.allDOs.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            const doIdSet = new Set(grp.allDOs.map(d => d.id.trim().toLowerCase()));
            grp.existingInvoices = invoices.filter(inv => {
                const invSJs = (inv.deliveryOrderId || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
                return invSJs.some(sj => doIdSet.has(sj));
            });
        });

        return Array.from(map.values()).sort((a, b) => {
            const dateA = a.salesOrder?.date ? new Date(a.salesOrder.date).getTime() : (a.allDOs[0] ? new Date(a.allDOs[0].date).getTime() : 0);
            const dateB = b.salesOrder?.date ? new Date(b.salesOrder.date).getTime() : (b.allDOs[0] ? new Date(b.allDOs[0].date).getTime() : 0);
            return dateB - dateA;
        });
    }, [deliveryOrders, salesOrders, invoices]);

    // SO yang bisa di-combine (memiliki > 1 SJ dan masih ada SJ yang belum di-invoice)
    const actionableCombineGroups = useMemo(() => {
        return soCombineGroups.filter(g => g.allDOs.length > 1 && g.uninvoicedDOs.length > 0);
    }, [soCombineGroups]);

    // Sub-tab selection: 'ready_dos' | 'invoices'
    const [activeSubTab, setActiveSubTab] = useState<'ready_dos' | 'invoices'>(() => {
        return readyDeliveryOrders.length > 0 ? 'ready_dos' : 'invoices';
    });

    // State untuk Dropdown Pilih SO / Combine SJ di tab DO Siap Di-Invoice
    const [selectedSOFilter, setSelectedSOFilter] = useState<string>('all');
    const [selectedSJsBySO, setSelectedSJsBySO] = useState<Record<string, string[]>>({});

    // Sinkronkan pilihan default SJ per SO (otomatis centang SJ yang siap / belum di-invoice)
    useEffect(() => {
        setSelectedSJsBySO(prev => {
            const next = { ...prev };
            soCombineGroups.forEach(grp => {
                const validUninvoicedIds = grp.uninvoicedDOs
                    .filter(d => !lockedDOs[d.id])
                    .map(d => d.id);
                const readyUnlockedIds = grp.readyDOs
                    .filter(d => !lockedDOs[d.id])
                    .map(d => d.id);

                const existingSel = (next[grp.soId] || []).filter(id => validUninvoicedIds.includes(id));
                if (existingSel.length === 0) {
                    // Prioritaskan yang sudah diterima (ready), jika belum ada yang diterima maka centang semua uninvoiced
                    next[grp.soId] = readyUnlockedIds.length > 0 ? readyUnlockedIds : validUninvoicedIds;
                } else {
                    next[grp.soId] = existingSel;
                }
            });
            return next;
        });
    }, [soCombineGroups, lockedDOs]);

    const handleToggleSJInSOGroup = (soId: string, doId: string) => {
        setSelectedSJsBySO(prev => {
            const current = prev[soId] || [];
            if (current.includes(doId)) {
                return { ...prev, [soId]: current.filter(id => id !== doId) };
            } else {
                return { ...prev, [soId]: [...current, doId] };
            }
        });
    };

    const handleSelectAllSJsInSOGroup = (soId: string, doIds: string[]) => {
        setSelectedSJsBySO(prev => ({ ...prev, [soId]: doIds }));
    };

    // Filters for Invoices
    const [search, setSearch] = useState('');
    const [filterCustomer, setFilterCustomer] = useState('all');
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterDate, setFilterDate] = useState('');

    // Filters for Ready DOs
    const [searchReadyDO, setSearchReadyDO] = useState('');
    const [filterReadyCust, setFilterReadyCust] = useState('all');

    // Pagination state for Invoices
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 20;

    useEffect(() => {
        setCurrentPage(1);
    }, [search, filterCustomer, filterStatus, filterDate]);

    const uniqueCustomers = useMemo(() => {
        return Array.from(new Set(invoices.map(inv => inv.customer))).sort();
    }, [invoices]);

    const uniqueReadyCustomers = useMemo(() => {
        return Array.from(new Set(readyDeliveryOrders.map(o => o.customer))).sort();
    }, [readyDeliveryOrders]);

    const availableSOGroupsForDropdown = useMemo(() => {
        return soCombineGroups
            .filter(g => g.uninvoicedDOs.length > 0 && (filterReadyCust === 'all' || g.customer === filterReadyCust))
            .sort((a, b) => {
                const aMulti = a.allDOs.length > 1 ? 1 : 0;
                const bMulti = b.allDOs.length > 1 ? 1 : 0;
                if (bMulti !== aMulti) return bMulti - aMulti;
                return 0;
            });
    }, [soCombineGroups, filterReadyCust]);

    const activeSelectedSOGroup = useMemo(() => {
        if (selectedSOFilter === 'all' || selectedSOFilter === 'multi_only') return undefined;
        return soCombineGroups.find(g => g.soId === selectedSOFilter);
    }, [soCombineGroups, selectedSOFilter]);

    const getInvoiceStatusType = (invoice: Invoice) => {
        if (invoice.newDebt <= 0) return 'Lunas';
        if (invoice.amountPaid > 0) return 'Sebagian';
        return 'Belum';
    };

    const handleReset = () => {
        setSearch('');
        setFilterCustomer('all');
        setFilterStatus('all');
        setFilterDate('');
        setCurrentPage(1);
    };

    const filteredInvoices = useMemo(() => {
        return invoices.filter(inv => {
            const q = search.toLowerCase();
            const matchSearch = search === '' || 
                inv.id.toLowerCase().includes(q) ||
                (inv.deliveryOrderId && inv.deliveryOrderId.toLowerCase().includes(q)) ||
                inv.customer.toLowerCase().includes(q);
            const matchCust = filterCustomer === 'all' || inv.customer === filterCustomer;
            const matchStatus = filterStatus === 'all' || getInvoiceStatusType(inv) === filterStatus;
            
            let matchDate = true;
            if (filterDate) {
                const invDateStr = new Date(inv.date).toISOString().split('T')[0];
                matchDate = invDateStr === filterDate;
            }

            return matchSearch && matchCust && matchStatus && matchDate;
        }).sort((a, b) => {
            const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
            const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
            if (timeA !== timeB) return timeB - timeA;
            return new Date(b.date).getTime() - new Date(a.date).getTime();
        });
    }, [invoices, search, filterCustomer, filterStatus, filterDate]);

    const filteredReadyDOs = useMemo(() => {
        return readyDeliveryOrders.filter(order => {
            const orderSOId = getOrderSOId(order);
            const matchSearch = searchReadyDO === '' || 
                order.id.toLowerCase().includes(searchReadyDO.toLowerCase()) || 
                (orderSOId && orderSOId.toLowerCase().includes(searchReadyDO.toLowerCase()));
            const matchCust = filterReadyCust === 'all' || order.customer === filterReadyCust;

            let matchSO = true;
            if (selectedSOFilter === 'multi_only') {
                const grp = orderSOId ? soCombineGroups.find(g => g.soId === orderSOId) : undefined;
                matchSO = !!grp && grp.allDOs.length > 1;
            } else if (selectedSOFilter !== 'all') {
                matchSO = orderSOId === selectedSOFilter;
            }

            return matchSearch && matchCust && matchSO;
        });
    }, [readyDeliveryOrders, searchReadyDO, filterReadyCust, selectedSOFilter, soCombineGroups]);

    // Calculate pagination for Invoices
    const totalPages = Math.ceil(filteredInvoices.length / itemsPerPage);
    const paginatedInvoices = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return filteredInvoices.slice(start, start + itemsPerPage);
    }, [filteredInvoices, currentPage]);

    const getStatusBadge = (invoice: Invoice) => {
        const statusType = getInvoiceStatusType(invoice);
        switch (statusType) {
            case 'Lunas':
                return <span className="px-2 py-0.5 text-[7px] md:text-[9px] font-black uppercase tracking-widest rounded-full bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100">Lunas</span>;
            case 'Sebagian':
                return <span className="px-2 py-0.5 text-[7px] md:text-[9px] font-black uppercase tracking-widest rounded-full bg-amber-50 text-amber-600 ring-1 ring-amber-100">Sebagian</span>;
            case 'Belum':
                return <span className="px-2 py-0.5 text-[7px] md:text-[9px] font-black uppercase tracking-widest rounded-full bg-rose-50 text-rose-600 ring-1 ring-rose-100">Belum Lunas</span>;
            default:
                return null;
        }
    };

    const handleDownloadXLSX = () => {
        const data = filteredInvoices.map(inv => {
            return {
                'Nomor Invoice': inv.id,
                'Nomor Surat Jalan': inv.deliveryOrderId || '-',
                'Tanggal': new Date(inv.date).toLocaleDateString('id-ID', {day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC'}),
                'Customer': inv.customer,
                'Total Tagihan': inv.subtotal,
                'Sudah Dibayar': inv.amountPaid || 0,
                'Sisa Tagihan': inv.newDebt || 0,
                'Status': getInvoiceStatusType(inv)
            };
        });

        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Invoices");
        
        const maxWidths = Object.keys(data[0] || {}).map(key => {
            return Math.max(key.length, ...data.map(row => String((row as any)[key]).length));
        });
        worksheet["!cols"] = maxWidths.map(w => ({ wch: w + 2 }));

        XLSX.writeFile(workbook, `Daftar_Invoice_${new Date().toISOString().slice(0,10)}.xlsx`);
    };
    
    return (
        <div className="bg-white p-5 md:p-8 rounded-2xl md:rounded-[2.5rem] border border-slate-100 shadow-sm space-y-5 md:space-y-6 animate-in fade-in duration-500">
            {/* Header & Sub-Tab Switcher */}
            <div className="flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                        <h2 className="text-base md:text-xl font-black text-slate-900 tracking-tighter uppercase leading-none">Modul Penagihan & Invoice</h2>
                        <p className="text-[7px] md:text-[9px] text-slate-400 font-bold tracking-[0.2em] uppercase mt-1">Surat Jalan Diterima, Riwayat Faktur & Penutupan SO</p>
                    </div>

                    {/* Sub-tab navigation */}
                    <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-2xl self-start sm:self-auto overflow-x-auto no-scrollbar">
                        <button
                            type="button"
                            onClick={() => setActiveSubTab('ready_dos')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                                activeSubTab === 'ready_dos'
                                    ? 'bg-purple-600 text-white shadow-md shadow-purple-500/20'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            <span>DO Siap Di-Invoice</span>
                            {readyDeliveryOrders.length > 0 && (
                                <span className={`px-1.5 py-0.5 rounded-full text-[8px] font-black ${
                                    activeSubTab === 'ready_dos'
                                        ? 'bg-white text-purple-700'
                                        : 'bg-purple-200 text-purple-800'
                                }`}>
                                    {readyDeliveryOrders.length}
                                </span>
                            )}
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveSubTab('invoices')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                                activeSubTab === 'invoices'
                                    ? 'bg-white text-slate-900 shadow-sm'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            <span>Daftar Invoice Terbit</span>
                            <span className="px-1.5 py-0.5 bg-slate-200 text-slate-700 rounded-full text-[8px] font-black">
                                {invoices.length}
                            </span>
                        </button>
                    </div>
                </div>
            </div>

            {/* TAB 1: DO SIAP DI-INVOICE */}
            {activeSubTab === 'ready_dos' && (
                <div className="space-y-4">
                    {/* Filter Bar for Ready DOs */}
                    <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-slate-50 p-3 rounded-2xl border border-slate-100">
                        <div className="w-full sm:w-72">
                            <input
                                type="text"
                                value={searchReadyDO}
                                onChange={(e) => setSearchReadyDO(e.target.value)}
                                placeholder="Cari No. DO atau SO..."
                                className="w-full px-3 py-2 bg-white border border-purple-200/80 rounded-xl text-[10px] font-bold outline-none focus:ring-2 focus:ring-purple-400 h-[38px]"
                            />
                        </div>
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                            <div className="w-full sm:w-60">
                                <select
                                    value={selectedSOFilter}
                                    onChange={(e) => setSelectedSOFilter(e.target.value)}
                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-bold text-slate-700 outline-none hover:border-teal-300 focus:ring-2 focus:ring-teal-400 transition-all h-[38px] cursor-pointer"
                                >
                                    <option value="all">Semua No. SO / Combine SJ</option>
                                    {actionableCombineGroups.length > 0 && (
                                        <option value="multi_only">⚡ Hanya SO &gt; 1 SJ ({actionableCombineGroups.length} SO)</option>
                                    )}
                                    {availableSOGroupsForDropdown.map(grp => (
                                        <option key={grp.soId} value={grp.soId}>
                                            {grp.soId} — {grp.customer} ({grp.uninvoicedDOs.length} SJ)
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="w-full sm:w-56">
                                <SearchableCustomerFilter
                                    options={uniqueReadyCustomers}
                                    value={filterReadyCust}
                                    onChange={setFilterReadyCust}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Baris Combine SJ saat memilih Nomor SO tertentu di dropdown */}
                    {activeSelectedSOGroup && (
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-teal-50/70 px-4 py-3 rounded-2xl border border-teal-200">
                            <div className="flex flex-col gap-1.5">
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black text-teal-800 uppercase tracking-wider">
                                        Combine SJ — {activeSelectedSOGroup.soId} ({activeSelectedSOGroup.customer})
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedSOFilter('all')}
                                        className="text-[9px] font-bold text-slate-400 hover:text-slate-600 underline"
                                    >
                                        Reset
                                    </button>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {activeSelectedSOGroup.allDOs.map(sj => {
                                        const isAlreadyInvoiced = !!sj.invoiceId;
                                        const lockedBy = lockedDOs[sj.id];
                                        const selectedIds = selectedSJsBySO[activeSelectedSOGroup.soId] || [];
                                        const isChecked = selectedIds.includes(sj.id);
                                        const isDisabled = isAlreadyInvoiced || !!lockedBy;
                                        const sjItems = sj.receivedItems && sj.receivedItems.length > 0 ? sj.receivedItems : sj.items;
                                        const sjTotalKg = sjItems.reduce((acc, it) => acc + (it.quantity || 0), 0);

                                        return (
                                            <label
                                                key={sj.id}
                                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-black uppercase transition-all select-none ${
                                                    isAlreadyInvoiced
                                                        ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-default'
                                                        : lockedBy
                                                        ? 'bg-amber-50 border-amber-200 text-amber-700 opacity-75 cursor-not-allowed'
                                                        : isChecked
                                                        ? 'bg-white border-teal-500 text-teal-900 cursor-pointer shadow-sm'
                                                        : 'bg-white/70 border-slate-200 text-slate-600 hover:border-teal-300 cursor-pointer'
                                                }`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    disabled={isDisabled}
                                                    onChange={() => handleToggleSJInSOGroup(activeSelectedSOGroup.soId, sj.id)}
                                                    className="w-3.5 h-3.5 accent-teal-600 rounded cursor-pointer"
                                                />
                                                <span>{sj.id}</span>
                                                <span className="text-[9px] font-bold text-slate-400">
                                                    ({sjTotalKg.toLocaleString('id-ID')} kg{isAlreadyInvoiced ? ` • ${sj.invoiceId}` : ''})
                                                </span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>
                            {onCombineInvoicing && (() => {
                                const selectedIds = selectedSJsBySO[activeSelectedSOGroup.soId] || [];
                                const selectedDOObjects = activeSelectedSOGroup.uninvoicedDOs.filter(d => selectedIds.includes(d.id));
                                const activeExistingInvoice = activeSelectedSOGroup.existingInvoices.find(inv => inv.status !== 'Lunas') || activeSelectedSOGroup.existingInvoices[0];
                                return (
                                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                                        {activeExistingInvoice && selectedDOObjects.length > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => onCombineInvoicing(selectedDOObjects, activeSelectedSOGroup.soId, activeExistingInvoice)}
                                                className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[9px] font-black uppercase tracking-wider transition-all shadow-sm active:scale-95"
                                            >
                                                + Gabung ke {activeExistingInvoice.id}
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            disabled={selectedDOObjects.length === 0}
                                            onClick={() => onCombineInvoicing(selectedDOObjects, activeSelectedSOGroup.soId)}
                                            className={`px-3.5 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all shadow-sm active:scale-95 ${
                                                selectedDOObjects.length === 0
                                                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                                    : 'bg-teal-600 hover:bg-teal-700 text-white'
                                            }`}
                                        >
                                            Buat Invoice Gabungan ({selectedDOObjects.length} SJ)
                                        </button>
                                    </div>
                                );
                            })()}
                        </div>
                    )}

                    {/* Table of Ready DOs */}
                    <div className="overflow-x-auto no-scrollbar border border-slate-100 rounded-2xl">
                        <table className="min-w-full divide-y divide-slate-100">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-[8px] font-black text-slate-400 uppercase tracking-widest">Nomor DO / SJ</th>
                                    <th className="px-4 py-3 text-left text-[8px] font-black text-slate-400 uppercase tracking-widest">Tanggal DO</th>
                                    <th className="px-4 py-3 text-left text-[8px] font-black text-slate-400 uppercase tracking-widest">Pelanggan</th>
                                    <th className="px-4 py-3 text-left text-[8px] font-black text-slate-400 uppercase tracking-widest">Rincian Barang Diterima</th>
                                    <th className="px-4 py-3 text-right text-[8px] font-black text-slate-400 uppercase tracking-widest">Kuantitas</th>
                                    <th className="px-4 py-3 text-right text-[8px] font-black text-slate-400 uppercase tracking-widest">Aksi Penagihan</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-slate-50">
                                {filteredReadyDOs.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-4 py-12 text-center text-xs font-bold text-slate-400 italic">
                                            {readyDeliveryOrders.length === 0 
                                                ? 'Tidak ada Surat Jalan (DO) yang sedang menunggu invoice. Semua DO sudah dibuatkan invoice atau belum diinput penerimaannya.'
                                                : 'Tidak ditemukan DO yang sesuai filter.'}
                                        </td>
                                    </tr>
                                ) : (
                                    filteredReadyDOs.map((order) => {
                                        const totalKirim = order.items.reduce((acc, it) => acc + (it.quantity || 0), 0);
                                        const receivedItems = order.receivedItems && order.receivedItems.length > 0 ? order.receivedItems : order.items;
                                        const totalTerima = receivedItems.reduce((acc, it) => acc + (it.quantity || 0), 0);
                                        const totalRetur = order.rejectedItems?.reduce((acc, it) => acc + (it.quantity || 0), 0) || 0;
                                        const susut = Math.max(0, totalKirim - totalRetur - totalTerima);
                                        const lockedByUser = lockedDOs[order.id];
                                        const orderSOId = getOrderSOId(order);
                                        const soGroup = orderSOId ? soCombineGroups.find(g => g.soId === orderSOId) : undefined;
                                        const canCombineSO = !!soGroup && soGroup.allDOs.length > 1;

                                        return (
                                            <tr key={order.id} className={`transition-all ${lockedByUser ? 'bg-amber-50/40' : 'hover:bg-purple-50/30'}`}>
                                                <td className="px-4 py-4 whitespace-nowrap">
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] font-black text-slate-900 uppercase">{order.id}</span>
                                                        {orderSOId && (
                                                            <span className="text-[8px] font-bold text-teal-600 uppercase tracking-tighter mt-0.5">
                                                                SO: {orderSOId} {soGroup && soGroup.allDOs.length > 1 ? `(${soGroup.allDOs.length} SJ)` : ''}
                                                            </span>
                                                        )}
                                                        <div className="flex flex-wrap items-center gap-1 mt-1">
                                                            <span className="px-2 py-0.5 text-[7px] font-black uppercase tracking-wider rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 w-fit">
                                                                Diterima
                                                            </span>
                                                            {lockedByUser && (
                                                                <span className="px-2 py-0.5 text-[7px] font-black uppercase tracking-wider rounded-full bg-amber-100 text-amber-800 ring-1 ring-amber-300 w-fit animate-pulse">
                                                                    🔒 Diproses: {lockedByUser}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4 whitespace-nowrap text-[9px] font-bold text-slate-500">
                                                    {new Date(order.date).toLocaleDateString('id-ID', {day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC'})}
                                                </td>
                                                <td className="px-4 py-4 whitespace-nowrap text-[10px] font-black text-slate-800 uppercase">
                                                    <span>{order.customer}</span>
                                                </td>
                                                <td className="px-4 py-4">
                                                    <div className="flex flex-wrap gap-1 max-w-xs">
                                                        {receivedItems.map((it, idx) => (
                                                            <span key={idx} className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded text-[9px] font-bold">
                                                                {it.name}: {it.quantity}kg
                                                            </span>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4 whitespace-nowrap text-right">
                                                    <div className="flex flex-col items-end">
                                                        <span className="text-xs font-black text-slate-900">
                                                            Terima: {totalTerima.toLocaleString('id-ID')} kg
                                                        </span>
                                                        <span className="text-[9px] text-slate-400 font-bold">
                                                            Kirim: {totalKirim} kg
                                                        </span>
                                                        {totalRetur > 0 && (
                                                            <span className="text-[9px] font-black text-rose-600">
                                                                Tolakan: {totalRetur} kg
                                                            </span>
                                                        )}
                                                        {susut > 0 && (
                                                            <span className="text-[9px] font-black text-amber-600">
                                                                Susut: {susut} kg
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4 whitespace-nowrap text-right">
                                                    {onStartInvoicing && (
                                                        lockedByUser ? (
                                                            <button
                                                                type="button"
                                                                disabled
                                                                title={`Sedang dibuatkan invoice oleh ${lockedByUser}`}
                                                                className="px-3.5 py-2 bg-amber-100 text-amber-800 border border-amber-300 rounded-xl text-[9px] font-black uppercase tracking-wider cursor-not-allowed flex items-center gap-1.5 ml-auto"
                                                            >
                                                                <span>🔒 Diproses {lockedByUser}</span>
                                                            </button>
                                                        ) : (
                                                            <div className="flex items-center justify-end gap-1.5">
                                                                {canCombineSO && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            if (onCombineInvoicing && soGroup && soGroup.uninvoicedDOs.length > 1) {
                                                                                const readyOrAll = soGroup.readyDOs.length > 1 ? soGroup.readyDOs : soGroup.uninvoicedDOs;
                                                                                onCombineInvoicing(readyOrAll, soGroup.soId);
                                                                            } else {
                                                                                setSelectedSOFilter(orderSOId);
                                                                            }
                                                                        }}
                                                                        title={`Combine ${soGroup?.allDOs.length} Surat Jalan dari Nomor SO ${orderSOId}`}
                                                                        className="px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-[9px] font-black uppercase tracking-wider transition-all shadow-sm active:scale-95 flex items-center gap-1"
                                                                    >
                                                                        <span>Combine ({soGroup?.uninvoicedDOs.length} SJ)</span>
                                                                    </button>
                                                                )}
                                                                <button
                                                                    type="button"
                                                                    onClick={() => onStartInvoicing(order)}
                                                                    className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-[9px] font-black uppercase tracking-wider transition-all shadow-md shadow-purple-500/20 active:scale-95 flex items-center gap-1.5"
                                                                >
                                                                    <span>+ Buat Invoice</span>
                                                                </button>
                                                            </div>
                                                        )
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* TAB 2: DAFTAR INVOICE TERBIT */}
            {activeSubTab === 'invoices' && (
                <div className="space-y-4">
                    {/* Action Bar & Filter Bar for Invoices */}
                    <div className="flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-black uppercase tracking-wider text-slate-600">
                                Filter Daftar Faktur
                            </span>
                            <div className="flex items-center gap-2">
                                <button 
                                    onClick={handleDownloadXLSX}
                                    className="px-3 py-1.5 md:px-5 md:py-2.5 bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg md:rounded-xl text-[8px] md:text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-emerald-100 flex items-center gap-2"
                                >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                                    DOWNLOAD XLSX
                                </button>
                                <button 
                                    onClick={handleReset}
                                    className="px-3 py-1.5 md:px-5 md:py-2.5 bg-slate-50 border border-slate-200 text-slate-400 hover:text-slate-600 rounded-lg md:rounded-xl text-[8px] md:text-[10px] font-black uppercase tracking-widest transition-all"
                                >
                                    RESET FILTER
                                </button>
                            </div>
                        </div>

                        {/* Search and Filters grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                            <div>
                                <label className="block text-[7px] md:text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1">Cari Invoice / No. SJ</label>
                                <input 
                                    type="text" 
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Cari INV/... atau DO/..."
                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-bold focus:ring-4 focus:ring-indigo-500/5 outline-none transition-all h-[38px]"
                                />
                            </div>
                            <div>
                                <label className="block text-[7px] md:text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1">Pelanggan</label>
                                <SearchableCustomerFilter 
                                    options={uniqueCustomers}
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
                                    <option value="Lunas">Lunas</option>
                                    <option value="Sebagian">Bayar Sebagian</option>
                                    <option value="Belum">Belum Lunas</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Table of Invoices */}
                    <div className="overflow-x-auto no-scrollbar border border-slate-50 rounded-2xl">
                        <table className="min-w-full divide-y divide-slate-100">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-[8px] font-black text-slate-400 uppercase tracking-widest">Nomor Invoice & Surat Jalan</th>
                                    <th className="px-4 py-3 text-left text-[8px] font-black text-slate-400 uppercase tracking-widest">Tanggal</th>
                                    <th className="px-4 py-3 text-left text-[8px] font-black text-slate-400 uppercase tracking-widest">Customer</th>
                                    <th className="px-4 py-3 text-right text-[8px] font-black text-slate-400 uppercase tracking-widest">Total Tagihan</th>
                                    <th className="px-4 py-3 text-right text-[8px] font-black text-slate-400 uppercase tracking-widest">Sudah Dibayar</th>
                                    <th className="px-4 py-3 text-center text-[8px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                                    <th className="px-4 py-3 text-right text-[8px] font-black text-slate-400 uppercase tracking-widest">Aksi & Penutupan SO</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-slate-50">
                                {paginatedInvoices.length === 0 ? (
                                    <tr><td colSpan={7} className="px-4 py-12 text-center text-[9px] font-black text-slate-300 uppercase tracking-widest italic">Data tidak ditemukan</td></tr>
                                ) : (
                                    paginatedInvoices.map((invoice) => {
                                        const invoiceSJNumbers = (invoice.deliveryOrderId || '').split(',').map(s => s.trim()).filter(Boolean);
                                        const relatedDOs = deliveryOrders.filter(d => invoiceSJNumbers.includes(d.id));
                                        const relatedSOIds = Array.from(new Set(relatedDOs.map(d => d.salesOrderId).filter(Boolean) as string[]));
                                        const relatedSOs = salesOrders.filter(so => relatedSOIds.includes(so.id));
                                        const openRelatedSOs = relatedSOs.filter(s => s.status !== 'completed');
                                        const closedRelatedSOs = relatedSOs.filter(s => s.status === 'completed');
                                        const customerOpenSOs = salesOrders.filter(so =>
                                            so.customer.trim().toLowerCase() === invoice.customer.trim().toLowerCase() &&
                                            so.status !== 'completed'
                                        );

                                        return (
                                            <tr key={invoice.id} className="hover:bg-slate-50 transition-all group">
                                                <td className="px-4 py-4 whitespace-nowrap">
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] font-black text-slate-900 uppercase">{invoice.id}</span>
                                                        {invoice.deliveryOrderId && (
                                                            <div className="flex flex-wrap gap-1 mt-0.5 max-w-xs">
                                                                {invoice.deliveryOrderId.split(',').map((sj, idx) => (
                                                                    <span key={idx} className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 text-slate-700 text-[8px] font-bold rounded">
                                                                        SJ: {sj.trim()}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}
                                                        {relatedSOIds.length > 0 && (
                                                            <div className="flex flex-wrap gap-1 mt-1 max-w-xs">
                                                                {relatedSOIds.map(soId => {
                                                                    const soObj = salesOrders.find(s => s.id === soId);
                                                                    const isClosed = soObj?.status === 'completed';
                                                                    return (
                                                                        <span key={soId} className={`px-1.5 py-0.5 text-[8px] font-bold rounded border ${isClosed ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-teal-50 text-teal-800 border-teal-200'}`}>
                                                                            SO: {soId} {isClosed ? '(Closed)' : ''}
                                                                        </span>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4 whitespace-nowrap text-[9px] font-bold text-slate-500">{new Date(invoice.date).toLocaleDateString('id-ID', {day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC'})}</td>
                                                <td className="px-4 py-4 whitespace-nowrap text-[10px] font-black text-slate-700 uppercase">{invoice.customer}</td>
                                                <td className="px-4 py-4 whitespace-nowrap text-[10px] text-slate-800 text-right font-black">
                                                    {new Intl.NumberFormat('id-ID').format(invoice.subtotal)}
                                                </td>
                                                <td className="px-4 py-4 whitespace-nowrap text-right">
                                                    <div className="flex flex-col items-end">
                                                        <span className={`text-[10px] font-black ${(invoice.amountPaid || 0) > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                                                            {new Intl.NumberFormat('id-ID').format(invoice.amountPaid || 0)}
                                                        </span>
                                                        {(invoice.amountPaid || 0) > 0 && (invoice.newDebt || 0) > 0 && (
                                                            <span className="text-[8px] font-bold text-rose-500">
                                                                Sisa: {new Intl.NumberFormat('id-ID').format(invoice.newDebt)}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4 whitespace-nowrap text-center">{getStatusBadge(invoice)}</td>
                                                <td className="px-4 py-4 whitespace-nowrap text-right">
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        {/* Open SOs directly tied to this invoice DOs */}
                                                        {openRelatedSOs.map(openSO => (
                                                            <button 
                                                                key={openSO.id}
                                                                type="button"
                                                                onClick={() => onCloseSalesOrder && onCloseSalesOrder(openSO.id)} 
                                                                className="px-2.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-[8px] font-black uppercase tracking-wider transition-all active:scale-95 shadow-sm flex items-center gap-1"
                                                                title={`Tutup Sales Order ${openSO.id} oleh Finance`}
                                                            >
                                                                <CheckCircleIcon className="h-3 w-3" />
                                                                <span>Tutup SO ({openSO.id})</span>
                                                            </button>
                                                        ))}

                                                        {/* All related SOs are completed */}
                                                        {relatedSOs.length > 0 && openRelatedSOs.length === 0 && (
                                                            <span className="px-2 py-1 bg-slate-100 text-slate-600 border border-slate-200 rounded-lg text-[8px] font-black uppercase tracking-wider flex items-center gap-1">
                                                                <CheckCircleIcon className="h-3 w-3 text-emerald-600" />
                                                                <span>SO Ditutup</span>
                                                            </span>
                                                        )}

                                                        {/* Fallback: no explicit SO linked to DO, but customer has open SO */}
                                                        {relatedSOs.length === 0 && customerOpenSOs.length > 0 && onCloseSalesOrder && (
                                                            <button 
                                                                type="button"
                                                                onClick={() => onCloseSalesOrder(customerOpenSOs[0].id)} 
                                                                className="px-2.5 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-300 rounded-lg text-[8px] font-black uppercase tracking-wider transition-all active:scale-95 shadow-sm flex items-center gap-1"
                                                                title={`Tutup Sales Order ${customerOpenSOs[0].id} untuk ${invoice.customer}`}
                                                            >
                                                                <CheckCircleIcon className="h-3 w-3 text-teal-600" />
                                                                <span>Tutup SO ({customerOpenSOs[0].id})</span>
                                                            </button>
                                                        )}

                                                        <button 
                                                            onClick={() => onSelectInvoice(invoice)} 
                                                            className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[8px] font-black uppercase tracking-widest transition-all active:scale-95"
                                                        >
                                                            DETAIL
                                                        </button>
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
                            MENAMPILKAN {paginatedInvoices.length} DARI {filteredInvoices.length} INVOICE
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
                                <div className="bg-purple-600 text-white px-4 py-2 rounded-xl text-[10px] font-black min-w-[60px] text-center shadow-lg shadow-purple-100">
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
            )}
        </div>
    );
};

export default InvoiceList;
