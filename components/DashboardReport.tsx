import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { ProductionRecord, DeliveryOrder, Invoice, ExpenseRecord, SalaryRecord, StockLog, StockItem, LedgerEntry, TradingPurchaseRecord, StockDisposalRecord } from '../types';
import { CHICKEN_PARTS, sortChickenParts, INITIAL_STOCK_OCT_18, INITIAL_VALUATION_OCT_18 } from '../constants';
import { ChevronDownIcon, XIcon } from './icons';

interface DashboardReportProps {
    productionHistory: ProductionRecord[];
    deliveryOrders: DeliveryOrder[];
    invoices: Invoice[];
    expenses: ExpenseRecord[];
    salaries: SalaryRecord[];
    stockLogs: StockLog[];
    stock: StockItem[];
    ledgerEntries: LedgerEntry[];
    tradingPurchases: TradingPurchaseRecord[];
    stockDisposals: StockDisposalRecord[];
    earlyStock?: any[];
    onSelectPNL?: () => void;
}

type FilterType = 'all' | 'date' | 'month' | 'range';

interface SearchableSelectProps {
    label: string;
    options: string[];
    value: string;
    onChange: (val: string) => void;
    placeholder: string;
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({ label, options, value, onChange, placeholder }) => {
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
        <div className="space-y-1.5 flex-1 min-w-[200px]" ref={containerRef}>
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>
            <div className="relative">
                <button
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    className="w-full flex items-center justify-between px-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-wider shadow-sm hover:border-red-200 transition-colors text-left"
                >
                    <div className="flex items-center gap-2 truncate">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-slate-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <span className={value === 'all' ? 'text-slate-400' : 'text-slate-900'}>
                            {value === 'all' ? placeholder : value}
                        </span>
                    </div>
                    <ChevronDownIcon className={`h-4 w-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>

                {isOpen && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-100 shadow-2xl rounded-2xl z-[150] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-2 border-b border-slate-50">
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Cari..."
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-red-500/10"
                                autoFocus
                            />
                        </div>
                        <div className="max-h-60 overflow-y-auto no-scrollbar py-1">
                            <button
                                onClick={() => { onChange('all'); setIsOpen(false); setSearch(''); }}
                                className={`w-full text-left px-4 py-2 text-xs font-black uppercase transition-colors hover:bg-slate-50 ${value === 'all' ? 'text-red-600 bg-red-50/50' : 'text-slate-600'}`}
                            >
                                {placeholder}
                            </button>
                            {filteredOptions.map((opt) => (
                                <button
                                    key={opt}
                                    onClick={() => { onChange(opt); setIsOpen(false); setSearch(''); }}
                                    className={`w-full text-left px-4 py-2 text-xs font-black uppercase transition-colors hover:bg-slate-50 ${value === opt ? 'text-red-600 bg-red-50/50' : 'text-slate-600'}`}
                                >
                                    {opt}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const DashboardReport: React.FC<DashboardReportProps> = ({
    productionHistory,
    deliveryOrders,
    invoices,
    expenses,
    salaries,
    stockLogs,
    stock,
    ledgerEntries,
    tradingPurchases,
    stockDisposals,
    earlyStock = [],
    onSelectPNL
}) => {
    const [filterType, setFilterType] = useState<FilterType>('all');
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
    const [dateRange, setDateRange] = useState({
        start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10),
        end: new Date().toISOString().slice(0, 10),
    });

    const [selCustomer, setSelCustomer] = useState<string>('all');
    const [selCoop, setSelCoop] = useState<string>('all');
    const [selItem, setSelItem] = useState<string>('all');
    const [selStatus, setSelStatus] = useState<string>('all');

    const options = useMemo(() => {
        const customers = Array.from(new Set(invoices.map(i => i.customer))).filter(Boolean).sort();
        const coops = Array.from(new Set(productionHistory.map(p => p.coopName))).filter(Boolean).sort();
        const items = [...CHICKEN_PARTS].sort(sortChickenParts);
        const statuses = ['Paid', 'Partial', 'Unpaid'];
        return { customers, coops, items, statuses };
    }, [invoices, productionHistory]);

    const handleReset = () => {
        setSelCustomer('all');
        setSelCoop('all');
        setSelItem('all');
        setSelStatus('all');
    };

    const kpiData = useMemo(() => {
        let startDate: Date;
        let endDate: Date;

        const parseLocal = (s: string) => {
            const [y, m, d] = s.split('-').map(Number);
            return new Date(y, m - 1, d);
        };

        if (filterType === 'date') {
            startDate = parseLocal(selectedDate);
            startDate.setHours(7, 0, 0, 0);
            endDate = parseLocal(selectedDate);
            endDate.setDate(endDate.getDate() + 1);
            endDate.setHours(6, 59, 59, 999);
        } else if (filterType === 'month') {
            const [year, month] = selectedMonth.split('-').map(Number);
            startDate = new Date(year, month - 1, 1, 7, 0, 0, 0);
            endDate = new Date(year, month, 1, 6, 59, 59, 999);
        } else if (filterType === 'range') {
            startDate = parseLocal(dateRange.start);
            startDate.setHours(7, 0, 0, 0);
            endDate = parseLocal(dateRange.end);
            endDate.setDate(endDate.getDate() + 1);
            endDate.setHours(6, 59, 59, 999);
        } else {
            startDate = new Date(2000, 0, 1); 
            endDate = new Date(2100, 0, 1);
        }

        const inRange = (dInput: string | Date) => {
            let d: Date;
            if (typeof dInput === 'string') {
                if (dInput.includes('T') || dInput.includes(':')) {
                    d = new Date(dInput);
                    return d.getTime() >= startDate.getTime() && d.getTime() <= endDate.getTime();
                } else {
                    d = parseLocal(dInput);
                }
            } else {
                if (dInput.getUTCHours() === 0 && dInput.getUTCMinutes() === 0) {
                    d = new Date(dInput.getUTCFullYear(), dInput.getUTCMonth(), dInput.getUTCDate());
                } else {
                    d = new Date(dInput.getTime());
                    return d.getTime() >= startDate.getTime() && d.getTime() <= endDate.getTime();
                }
            }
            d.setHours(12, 0, 0, 0);
            return d.getTime() >= startDate.getTime() && d.getTime() <= endDate.getTime();
        };

        const adjustQty = (_name: string, qty: number) => {
            if (!qty) return 0;
            return qty;
        };

        // --- HARGA RATA-RATA GLOBAL PER ITEM (SINKRON DENGAN PROFIT LOSS & STOCK VALUE) ---
        const now = new Date();
        const curM = now.getMonth();
        const curY = now.getFullYear();
        
        const itemAvgPrices: { [key: string]: number } = {};
        const itemAggregator: { [key: string]: { sumPrices: number, count: number } } = {};
        
        invoices.forEach(inv => {
            const invDate = new Date(inv.date);
            if (invDate.getMonth() === curM && invDate.getFullYear() === curY) {
                inv.items.forEach(item => {
                    const normName = item.name.trim().toUpperCase();
                    const price = Number(item.price) || 0;
                    if (price > 0) {
                        if (!itemAggregator[normName]) itemAggregator[normName] = { sumPrices: 0, count: 0 };
                        itemAggregator[normName].sumPrices += price;
                        itemAggregator[normName].count += 1;
                    }
                });
            }
        });

        CHICKEN_PARTS.forEach(part => {
            const normName = part.trim().toUpperCase();
            const data = itemAggregator[normName];
            itemAvgPrices[normName] = (data && data.count > 0) ? data.sumPrices / data.count : 22000;
        });

        let totalLBMasuk = 0;
        let totalKematianLB = 0;
        let totalBelanjaLB = 0;
        let totalProduksi = 0;

        productionHistory.forEach(rec => {
            const matchCoop = selCoop === 'all' || rec.coopName === selCoop;
            if (inRange(rec.date) && matchCoop) {
                let currentRecProd = 0;
                Object.entries(rec.items).forEach(([name, qty]) => {
                    const finalQty = Number(qty) || 0;
                    if (selItem === 'all' || name === selItem) currentRecProd += finalQty;
                });
                totalProduksi += currentRecProd;
                totalLBMasuk += Number(rec.initialKg) || 0;
                totalKematianLB += Number(rec.mortality) || 0;
                totalBelanjaLB += (Number(rec.initialKg) || 0) * (Number(rec.pricePerKg) || 0);
            }
        });

        let totalPengiriman = 0;
        let totalRetur = 0;
        const customerLastOrder: { [key: string]: Date } = {};

        deliveryOrders.forEach(order => {
            const orderDate = new Date(order.date);
            if (!customerLastOrder[order.customer] || orderDate > customerLastOrder[order.customer]) {
                customerLastOrder[order.customer] = orderDate;
            }

            const matchCust = selCustomer === 'all' || order.customer === selCustomer;
            if (inRange(order.date) && matchCust) {
                const items = order.receivedItems?.length ? order.receivedItems : order.items;
                items.forEach(item => {
                    const finalQty = adjustQty(item.name, Number(item.quantity) || 0);
                    totalPengiriman += finalQty;
                });
                order.rejectedItems?.forEach(item => {
                    const finalQty = adjustQty(item.name, Number(item.quantity) || 0);
                    totalRetur += finalQty;
                });
            }
        });

        let totalPenjualanRp = 0;
        let totalPembayaranRp = 0;
        let volumePenjualanKg = 0;
        const customerTimeline: { [key: string]: number } = {};

        invoices.forEach(inv => {
            const matchCust = selCustomer === 'all' || inv.customer === selCustomer;
            const matchStatus = selStatus === 'all' || inv.status === selStatus;
            
            if (!customerTimeline[inv.customer]) customerTimeline[inv.customer] = 0;
            customerTimeline[inv.customer] += (Number(inv.subtotal) - (Number(inv.transfer) + Number(inv.cash)));

            if (inRange(inv.date) && matchCust && matchStatus) {
                inv.items.forEach(item => {
                    const finalQty = adjustQty(item.name, item.quantity);
                    if (selItem === 'all' || item.name === selItem) {
                        totalPenjualanRp += Number(item.total) || 0;
                        volumePenjualanKg += finalQty;
                    }
                });
                totalPembayaranRp += (Number(inv.transfer) || 0) + (Number(inv.cash) || 0);
            }
        });

        ledgerEntries.forEach(entry => {
            if (!customerTimeline[entry.customerId]) customerTimeline[entry.customerId] = 0;
            customerTimeline[entry.customerId] += (Number(entry.debit || 0) - Number(entry.credit || 0));

            const matchCust = selCustomer === 'all' || entry.customerId === selCustomer;
            if (inRange(entry.date) && matchCust) {
                totalPenjualanRp += Number(entry.debit || 0);
                totalPembayaranRp += Number(entry.credit || 0);
            }
        });

        let currentTotalInventoryVal = 0;
        stock.forEach(item => {
            const normName = item.name.trim().toUpperCase();
            currentTotalInventoryVal += (item.quantity * (itemAvgPrices[normName] || 22000));
        });

        const totalSales = invoices.filter(inv => inRange(inv.date)).reduce((sum, inv) => sum + (Number(inv.subtotal) || 0), 0);
        const belanjaLB = productionHistory.filter(rec => inRange(rec.date)).reduce((sum, rec) => sum + ((Number(rec.initialKg) || 0) * (Number(rec.pricePerKg) || 0)), 0); 
        const totalTrading = tradingPurchases.filter(tp => inRange(new Date(tp.tanggal))).reduce((sum, tp) => sum + (Number(tp.total_harga) || (Number(tp.kg) * Number(tp.harga_per_kg)) || 0), 0);
        const totalOperasional = expenses.filter(exp => inRange(exp.date)).reduce((sum, exp) => sum + Number(exp.amount || 0), 0) +
                                 salaries.filter(sal => inRange(sal.date)).reduce((sum, sal) => sum + Number(sal.totalSalary || 0), 0);
        const rugiStock = stockDisposals.filter(sd => inRange(new Date(sd.tanggal))).reduce((sum, sd) => sum + (Number(sd.total_kerugian) || (Number(sd.kg) * Number(sd.harga_valuasi_kg)) || 0), 0);

        // Beginning Inventory (Stok Awal Periode)
        let beginningInventoryVal = 0;
        const beginningQtyMap = new Map<string, number>();
        const currentStockMap = new Map<string, number>(stock.map(s => [s.name.trim().toUpperCase(), s.quantity] as [string, number]));

        const baseDate = new Date(2025, 9, 18, 7, 0, 0, 0); 
        const isBaseDate = startDate.getFullYear() === 2025 && startDate.getMonth() === 9 && startDate.getDate() === 18;
        const isEndingNow = filterType === 'all' || endDate.getTime() >= Date.now();

        // Cari snapshot dari database (early_stock)
        const toYMD = (d: Date) => {
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };

        const dayBeforeStart = new Date(startDate);
        dayBeforeStart.setDate(dayBeforeStart.getDate() - 1);
        
        // Ending stock corresponds to the calendar date of the end of the period
        let dayEnd: Date;
        if (filterType === 'date') {
            dayEnd = parseLocal(selectedDate);
        } else if (filterType === 'month') {
            const [year, month] = selectedMonth.split('-').map(Number);
            dayEnd = new Date(year, month, 0); // Last day of month
        } else if (filterType === 'range') {
            dayEnd = parseLocal(dateRange.end);
        } else {
            dayEnd = new Date();
        }
        
        const dayBeforeStartStr = toYMD(dayBeforeStart);
        const dayEndStr = toYMD(dayEnd);

        let earlyBeginningVal = 0;
        let earlyBeginningFound = false;
        let earlyEndingVal = 0;
        let earlyEndingFound = false;

        earlyStock.forEach(s => {
            if (s.tanggal === dayBeforeStartStr) {
                earlyBeginningVal += (Number(s.ending_stock) || 0);
                earlyBeginningFound = true;
            }
            if (s.tanggal === dayEndStr) {
                earlyEndingVal += (Number(s.ending_stock) || 0);
                earlyEndingFound = true;
            }
        });

        const beginningSnapshotMap = new Map<string, number>();
        // ... kept for compatibility if needed elsewhere

        // Metode Kalkulasi Maju (Forward Calculation):
        CHICKEN_PARTS.forEach(item => {
            const normName = item.trim().toUpperCase();
            const qtyOnBase = INITIAL_STOCK_OCT_18[normName] ?? 0;

            if (isBaseDate || filterType === 'all') {
                beginningQtyMap.set(normName, qtyOnBase);
            } else {
                let deltaBeforeStart = 0;
                stockLogs.forEach(log => {
                    const logTime = new Date(log.timestamp).getTime();
                    if (log.itemName.trim().toUpperCase() === normName) {
                        if (logTime >= baseDate.getTime() && logTime < startDate.getTime()) {
                            deltaBeforeStart += (Number(log.change) || 0);
                        }
                    }
                });
                const calculatedQtyAtStart = Math.max(0, qtyOnBase + deltaBeforeStart);
                // Gunakan snapshot jika ada
                const qtyAtStart = beginningSnapshotMap.has(normName) ? (beginningSnapshotMap.get(normName) || 0) : calculatedQtyAtStart;
                beginningQtyMap.set(normName, qtyAtStart);
            }

            const qtyAtStart = beginningQtyMap.get(normName) || 0;
            beginningInventoryVal += (qtyAtStart * (itemAvgPrices[normName] || 22000));
        });

        if (filterType === 'all' || isBaseDate) {
            beginningInventoryVal = 0;
        } else if (earlyBeginningFound) {
            beginningInventoryVal = earlyBeginningVal;
        }

        // Ending Inventory (Stok Akhir Periode)
        let endingInventoryVal = 0;
        CHICKEN_PARTS.forEach(item => {
            const normName = item.trim().toUpperCase();
            const qtyAtStart = beginningQtyMap.get(normName) || 0;

            let inPeriodChange = 0;
            stockLogs.forEach(log => {
                if (log.itemName.trim().toUpperCase() === normName && inRange(log.timestamp)) {
                    inPeriodChange += (Number(log.change) || 0);
                }
            });

            const calculatedQtyAtEnd = Math.max(0, qtyAtStart + inPeriodChange);
            
            // SNAP TO LIVE / SNAP TO SNAPSHOT: 
            // 1. Jika berakhir SEKARANG, gunakan data stok fisik murni
            // 2. Jika ada snapshot di early_stock, gunakan snapshot tersebut
            // 3. Fallback ke kalkulasi dinamis
            let qtyAtEnd = calculatedQtyAtEnd;
            if (isEndingNow) {
                qtyAtEnd = currentStockMap.get(normName) ?? calculatedQtyAtEnd;
            } else if (beginningSnapshotMap.has(normName)) {
                qtyAtEnd = beginningSnapshotMap.get(normName) || 0;
            }
            
            const price = itemAvgPrices[normName] || 22000;
            endingInventoryVal += (qtyAtEnd * price);
        });

        if (earlyEndingFound) {
            endingInventoryVal = earlyEndingVal;
        }
        
        // Note: rugiStock sudah terhitung di dalam selisih stok (Ending Inventory lebih rendah), 
        // jadi tidak dikurangi lagi di formula netProfit agar tidak double counting.
        const globalNetProfit = totalSales - beginningInventoryVal - belanjaLB - totalTrading - totalOperasional + endingInventoryVal;

        const allDebts = Object.entries(customerTimeline)
            .map(([name, balance]) => ({
                name,
                debt: Math.max(0, balance),
                lastOrder: customerLastOrder[name] || null
            }))
            .filter(d => d.debt > 0)
            .sort((a, b) => b.debt - a.debt);

        return {
            totalLBMasuk, totalKematianLB, totalProduksi, totalPengiriman, totalPenjualanRp, totalPembayaranRp,
            totalBelanjaLB, totalValuasiStockCurrent: endingInventoryVal, 
            totalSisaPiutangGlobal: totalPenjualanRp - totalPembayaranRp, 
            totalBiaya: totalOperasional, volumePenjualanKg, totalRetur, totalTrading, globalNetProfit,
            allDebts
        };
    }, [productionHistory, deliveryOrders, invoices, expenses, salaries, stock, filterType, selectedMonth, dateRange, selCustomer, selCoop, selItem, selStatus, ledgerEntries, tradingPurchases, stockDisposals]);

    const formatCurrency = (val: number, decimals: number = 0) => 
        new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(val);
    
    const formatNumber = (val: number) => new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(val);

    const KPICard = ({ title, value, subValue, color = 'blue', onClick }: { title: string, value: string, subValue?: string, color?: string, onClick?: () => void }) => {
        const bgColors: any = { blue: 'bg-indigo-50/80', green: 'bg-emerald-50/80', red: 'bg-rose-50/80', yellow: 'bg-amber-50/80', purple: 'bg-violet-50/80', cyan: 'bg-cyan-50/80', slate: 'bg-slate-50/80', indigo: 'bg-indigo-100/50', orange: 'bg-orange-50/80', emerald: 'bg-emerald-100/40' };
        const textColors: any = { blue: 'text-indigo-600', green: 'text-emerald-600', red: 'text-rose-600', yellow: 'text-amber-600', purple: 'text-violet-600', cyan: 'text-cyan-600', slate: 'text-slate-600', indigo: 'text-indigo-700', orange: 'text-orange-600', emerald: 'text-emerald-700' };
        
        return (
            <div 
                onClick={onClick}
                className={`${bgColors[color]} p-2 sm:p-3 rounded-[1.2rem] border border-white shadow-sm flex flex-col justify-between transition-all hover:scale-[1.02] hover:shadow-md overflow-hidden min-h-[75px] ${onClick ? 'cursor-pointer hover:ring-2 hover:ring-indigo-500/20 active:scale-[0.98]' : ''}`}
            >
                <h3 className="text-[7px] font-black uppercase tracking-[0.2em] text-black mb-1 truncate">{title}</h3>
                <div>
                    <p className={`text-xs sm:text-sm lg:text-base font-black ${textColors[color]} truncate tracking-tight leading-none`}>{value}</p>
                    {subValue && <p className="text-[6px] font-bold text-slate-500 mt-1 truncate uppercase tracking-widest">{subValue}</p>}
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6">
             <div className="bg-white p-4 md:p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col gap-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-rose-600 rounded-[1rem] flex items-center justify-center text-white font-black shadow-lg shadow-rose-100 text-lg">R</div>
                        <div>
                            <h2 className="text-xl font-black text-slate-800 tracking-tight leading-none uppercase">DASHBOARD</h2>
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1">Live Analytics & Reporting</p>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-[1.2rem] border border-slate-100">
                        <select value={filterType} onChange={(e) => setFilterType(e.target.value as FilterType)} className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-sm outline-none">
                            <option value="all">Semua Waktu</option>
                            <option value="date">Harian</option>
                            <option value="month">Bulan Ini</option>
                            <option value="range">Rentang</option>
                        </select>
                        {filterType === 'date' && <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-[10px] font-bold outline-none"/>}
                        {filterType === 'month' && <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-[10px] font-bold outline-none"/>}
                        {filterType === 'range' && (
                            <div className="flex items-center gap-1.5">
                                <input type="date" value={dateRange.start} onChange={(e) => setDateRange(p => ({...p, start: e.target.value}))} className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-[10px] font-bold outline-none"/>
                                <input type="date" value={dateRange.end} onChange={(e) => setDateRange(p => ({...p, end: e.target.value}))} className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-[10px] font-bold outline-none"/>
                            </div>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 items-end gap-3 p-4 bg-slate-50/50 rounded-[2rem] border border-slate-100/50">
                    <SearchableSelect label="Pelanggan" options={options.customers} value={selCustomer} onChange={setSelCustomer} placeholder="Semua Pelanggan" />
                    <SearchableSelect label="Nama Kandang" options={options.coops} value={selCoop} onChange={setSelCoop} placeholder="Semua Kandang" />
                    <SearchableSelect label="Bagian Ayam" options={options.items} value={selItem} onChange={setSelItem} placeholder="Semua Bagian" />
                    <SearchableSelect label="Status Invoice" options={options.statuses} value={selStatus} onChange={setSelStatus} placeholder="Semua Status" />
                    <button onClick={handleReset} className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-[9px] font-black uppercase tracking-[0.1em] text-slate-400 hover:text-rose-600 transition-all shadow-sm h-[38px]">Reset Filter</button>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
                <KPICard title="Total LB Masuk" value={`${formatNumber(kpiData.totalLBMasuk)} Kg`} color="blue" subValue="Stock Raw In" />
                <KPICard title="Kematian LB" value={`${formatNumber(kpiData.totalKematianLB)} Ekor`} color="red" subValue="Mortalitas" />
                <KPICard title="Total Pengiriman" value={`${formatNumber(kpiData.totalPengiriman)} Kg`} color="purple" subValue="Logistik Out" />
                <KPICard title="Total Belanja LB" value={formatCurrency(kpiData.totalBelanjaLB)} color="indigo" subValue="HPP Raw Mat" />
                <KPICard title="Trading" value={formatCurrency(kpiData.totalTrading)} color="emerald" subValue="Meat Purchases" />
                <KPICard title="Retur" value={`${formatNumber(kpiData.totalRetur)} Kg`} color="orange" subValue="Rejected Qty" />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2 sm:gap-3">
                <KPICard title="Total Penjualan" value={formatCurrency(kpiData.totalPenjualanRp)} color="green" subValue={`Vol: ${formatNumber(kpiData.volumePenjualanKg)} Kg`} />
                <KPICard title="Total Produksi Net" value={`${formatNumber(kpiData.totalProduksi)} Kg`} color="purple" subValue={`Yield: ${kpiData.totalLBMasuk > 0 ? ((kpiData.totalProduksi / kpiData.totalLBMasuk) * 100).toFixed(1) : '0'}%`} />
                <KPICard title="Total Pembayaran" value={formatCurrency(kpiData.totalPembayaranRp)} color="yellow" subValue="Cash & Trf Received" />
                <KPICard title="Sisa Piutang" value={formatCurrency(kpiData.totalSisaPiutangGlobal)} color="red" subValue="Outstanding" />
                <KPICard title="Valuasi Stok" value={formatCurrency(kpiData.totalValuasiStockCurrent, 2)} color="cyan" subValue="Inventory Value" />
                <KPICard title="Biaya Operasional" value={formatCurrency(kpiData.totalBiaya)} color="slate" subValue="General & Salary" />
                <KPICard 
                    title="Laba Rugi Bersih" 
                    value={formatCurrency(kpiData.globalNetProfit, 2)} 
                    color={kpiData.globalNetProfit >= 0 ? 'indigo' : 'red'} 
                    subValue="Global Performance" 
                    onClick={onSelectPNL}
                />
            </div>

            <div className="grid grid-cols-1">
                <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
                    <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2 uppercase tracking-tight">
                        <span className="w-1.5 h-6 bg-rose-600 rounded-full"></span> Daftar Piutang Pelanggan (Rp)
                    </h3>
                    <div className="max-h-[600px] overflow-y-auto no-scrollbar pr-2">
                        <div className="space-y-4 max-w-4xl mx-auto">
                            {kpiData.allDebts.length === 0 ? (
                                <p className="text-center py-10 text-slate-300 font-bold uppercase tracking-widest text-[10px] italic">Belum ada piutang</p>
                            ) : (
                                kpiData.allDebts.map((cust, idx) => (
                                    <div key={idx} className="flex items-center gap-4 group border-b border-slate-50 pb-4 last:border-0 hover:bg-slate-50/50 transition-colors rounded-lg px-2">
                                        <span className="w-8 text-[10px] font-black text-slate-300 group-hover:text-rose-400 transition-colors shrink-0">#{(idx+1).toString().padStart(2, '0')}</span>
                                        <span className="flex-1 text-[11px] font-black text-slate-600 uppercase tracking-tight">{cust.name}</span>
                                        <div className="text-right shrink-0">
                                            <span className="text-sm font-mono font-black text-rose-600">{formatCurrency(cust.debt)}</span>
                                            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                                                Last Order: {cust.lastOrder ? cust.lastOrder.toLocaleDateString('id-ID', {day: '2-digit', month: 'short'}) : '-'}
                                            </p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="mt-8 p-6 bg-blue-50/50 rounded-[2.5rem] border border-blue-100 flex flex-col md:flex-row items-center gap-6">
                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-blue-400 font-black shadow-sm shrink-0 italic">f(x)</div>
                <div className="text-[10px] text-blue-500 font-bold leading-relaxed uppercase tracking-wide text-center md:text-left">
                    <span className="text-blue-900">KALKULASI PROFIT (PNL):</span> Perhitungan global sinkron dengan Laporan Laba Rugi detail. Menggunakan valuasi stok fisik dan saldo awal basis Rp 12.720.313 pada 18 Oktober 2025. Harga valuasi menggunakan Simple Average bulan berjalan.
                </div>
            </div>
        </div>
    );
};

export default DashboardReport;