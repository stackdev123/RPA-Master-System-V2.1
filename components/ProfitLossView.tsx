import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import type { Invoice, ProductionRecord, ExpenseRecord, SalaryRecord, StockLog, TradingPurchaseRecord, StockDisposalRecord, StockItem, LedgerEntry, MasterItem } from '../types';
import { CHICKEN_PARTS, INITIAL_STOCK_OCT_18, INITIAL_VALUATION_OCT_18 } from '../constants';
import { DownloadIcon } from './icons';

interface ProfitLossViewProps {
    invoices: Invoice[];
    productionHistory: ProductionRecord[];
    expenses: ExpenseRecord[];
    salaries: SalaryRecord[];
    stockLogs: StockLog[];
    tradingPurchases: TradingPurchaseRecord[];
    stockDisposals: StockDisposalRecord[];
    stock: StockItem[];
    ledgerEntries: LedgerEntry[];
    masterItems: MasterItem[];
    earlyStock?: any[];
}

type FilterType = 'all' | 'date' | 'month' | 'range';

const ProfitLossView: React.FC<ProfitLossViewProps> = ({
    invoices = [],
    productionHistory = [],
    expenses = [],
    salaries = [],
    stockLogs = [],
    tradingPurchases = [],
    stockDisposals = [],
    stock = [],
    ledgerEntries = [],
    masterItems = [],
    earlyStock = []
}) => {
    const [filterType, setFilterType] = useState<FilterType>('range');
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
    const [dateRange, setDateRange] = useState({
        start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10),
        end: new Date().toISOString().slice(0, 10),
    });
    const [inspectedSubDetail, setInspectedSubDetail] = useState<{
        itemName: string,
        category: string,
        logs: any[]
    } | null>(null);

    const report = useMemo(() => {
        let start: Date;
        let end: Date;

        const parseLocal = (s: string) => {
            const [y, m, d] = s.split('-').map(Number);
            return new Date(y, m - 1, d);
        };

        if (filterType === 'all') {
            start = new Date(2000, 0, 1);
            end = new Date(2100, 0, 1);
        } else if (filterType === 'date') {
            start = parseLocal(selectedDate);
            start.setHours(7, 0, 0, 0);
            end = parseLocal(selectedDate);
            end.setDate(end.getDate() + 1);
            end.setHours(6, 59, 59, 999);
        } else if (filterType === 'month') {
            const [year, month] = selectedMonth.split('-').map(Number);
            start = new Date(year, month - 1, 1, 7, 0, 0, 0);
            end = new Date(year, month, 1, 6, 59, 59, 999);
        } else {
            start = parseLocal(dateRange.start);
            start.setHours(7, 0, 0, 0);
            end = parseLocal(dateRange.end);
            end.setDate(end.getDate() + 1);
            end.setHours(6, 59, 59, 999);
        }

        const inRange = (dInput: string | Date) => {
            let d: Date;
            if (typeof dInput === 'string') {
                if (dInput.includes('T') || dInput.includes(':')) {
                    d = new Date(dInput);
                    return d.getTime() >= start.getTime() && d.getTime() <= end.getTime();
                } else {
                    d = parseLocal(dInput);
                }
            } else {
                if (dInput.getUTCHours() === 0 && dInput.getUTCMinutes() === 0) {
                    d = new Date(dInput.getUTCFullYear(), dInput.getUTCMonth(), dInput.getUTCDate());
                } else {
                    d = new Date(dInput.getTime());
                    return d.getTime() >= start.getTime() && d.getTime() <= end.getTime();
                }
            }
            d.setHours(12, 0, 0, 0);
            return d.getTime() >= start.getTime() && d.getTime() <= end.getTime();
        };

        const now = new Date();
        const itemAvgPrices: { [key: string]: number } = {};
        const itemAggregator: { [key: string]: { sumPrices: number, count: number } } = {};

        invoices.forEach(inv => {
            if (!inv.date) return;
            const invDate = new Date(inv.date);
            if (invDate.getMonth() === now.getMonth() && invDate.getFullYear() === now.getFullYear()) {
                inv.items?.forEach(item => {
                    if (!item.name) return;
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
        masterItems.forEach(item => {
            const normName = item.name.trim().toUpperCase();
            const data = itemAggregator[normName];
            itemAvgPrices[normName] = (data && data.count > 0) ? data.sumPrices / data.count : 22000;
        });

        const filteredInvoices = invoices.filter(inv => inv.date && inRange(inv.date));
        const totalSales = filteredInvoices.reduce((sum, inv) => sum + (Number(inv.subtotal) || 0), 0);

        let beginningInventoryVal = 0;
        const beginningDetails: any[] = [];
        const currentStockMap = new Map<string, number>(stock.map(s => [s.name.trim().toUpperCase(), s.quantity] as [string, number]));
        const beginningQtyMap = new Map<string, number>();

        const baseDate = new Date(2025, 9, 18, 7, 0, 0, 0);
        const isBaseDate = start.getFullYear() === 2025 && start.getMonth() === 9 && start.getDate() === 18;
        const isEndingNow = filterType === 'all' || end.getTime() >= Date.now();

        const toYMD = (d: Date) => {
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };

        const dayBeforeStart = new Date(start);
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

        masterItems.forEach(item => {
            const normName = item.name.trim().toUpperCase();
            const qtyOnBase = INITIAL_STOCK_OCT_18[normName] ?? 0;

            if (isBaseDate || filterType === 'all') {
                beginningQtyMap.set(normName, qtyOnBase);
            } else {
                let deltaBeforeStart = 0;
                stockLogs.forEach(log => {
                    if (!log.itemName || !log.timestamp) return;
                    const logTime = new Date(log.timestamp).getTime();
                    if (log.itemName.trim().toUpperCase() === normName) {
                        if (logTime >= baseDate.getTime() && logTime < start.getTime()) {
                            deltaBeforeStart += (Number(log.change) || 0);
                        }
                    }
                });
                beginningQtyMap.set(normName, Math.max(0, qtyOnBase + deltaBeforeStart));
            }

            const qtyAtStart = beginningQtyMap.get(normName) || 0;
            const price = itemAvgPrices[normName] || 22000;
            beginningInventoryVal += qtyAtStart * price;
        });

        if (filterType === 'all' || isBaseDate) {
            beginningInventoryVal = 0;
        } else if (earlyBeginningFound) {
            beginningInventoryVal = earlyBeginningVal;
        } else {
            // Tidak ada data earlyStock untuk hari sebelum start → beginning inventory = 0
            beginningInventoryVal = 0;
        }

        const filteredProduction = productionHistory.filter(rec => inRange(rec.date));
        const filteredTradingPurchases = tradingPurchases.filter(tp => inRange(tp.tanggal));
        const filteredStockDisposals = stockDisposals.filter(sd => inRange(sd.tanggal));
        const filteredExpenses = expenses.filter(exp => inRange(exp.date));
        const filteredSalaries = salaries.filter(sal => inRange(sal.date));
        const filteredStockLogs = stockLogs.filter(sl => inRange(sl.timestamp));

        const belanjaLB = filteredProduction.reduce((sum, rec) => sum + ((Number(rec.initialKg) || 0) * (Number(rec.pricePerKg) || 0)), 0);
        const pembelianTrading = filteredTradingPurchases.reduce((sum, tp) => sum + (Number(tp.total_harga) || (Number(tp.kg) * Number(tp.harga_per_kg)) || 0), 0);
        const rugiStock = filteredStockDisposals.reduce((sum, sd) => sum + (Number(sd.total_kerugian) || (Number(sd.kg) * Number(sd.harga_valuasi_kg)) || 0), 0);

        const totalGeneralExpenses = filteredExpenses.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);
        const totalSalaries = filteredSalaries.reduce((sum, sal) => sum + (Number(sal.totalSalary) || 0), 0);
        const totalOperasional = totalGeneralExpenses + totalSalaries;

        let endingInventoryVal = 0;
        const endingDetails: any[] = [];

        masterItems.forEach(item => {
            const normName = item.name.trim().toUpperCase();
            const qtyAtStart = beginningQtyMap.get(normName) || 0;

            let pengirimanInPeriod = 0;
            let pemusnahanInPeriod = 0;
            let produksiInPeriod = 0;
            let tradingInPeriod = 0;
            let returInPeriod = 0;
            let penyesuaianInPeriod = 0;

            const pengirimanLogs: any[] = [];
            const pemusnahanLogs: any[] = [];
            const produksiLogs: any[] = [];
            const tradingLogs: any[] = [];
            const returLogs: any[] = [];
            const penyesuaianLogs: any[] = [];

            stockLogs.forEach(log => {
                if (log.itemName && log.itemName.trim().toUpperCase() === normName && inRange(log.timestamp)) {
                    const change = Number(log.change) || 0;
                    if (log.type === 'Produksi') {
                        produksiInPeriod += change;
                        produksiLogs.push(log);
                    }
                    else if (log.type === 'Pemusnahan') {
                        pemusnahanInPeriod += Math.abs(change);
                        pemusnahanLogs.push(log);
                    }
                    else if (log.type === 'Alokasi') {
                        if (change < 0) {
                            pengirimanInPeriod += Math.abs(change);
                            pengirimanLogs.push(log);
                        }
                        else {
                            returInPeriod += change;
                            returLogs.push(log);
                        }
                    }
                    else if (log.type === 'Pembelian') {
                        tradingInPeriod += change;
                        tradingLogs.push(log);
                    }
                    else {
                        penyesuaianInPeriod += change;
                        penyesuaianLogs.push(log);
                    }
                }
            });

            let qtyAtEnd = Math.max(0, qtyAtStart + produksiInPeriod + tradingInPeriod + returInPeriod + penyesuaianInPeriod - pengirimanInPeriod - pemusnahanInPeriod);
            if (isEndingNow) {
                qtyAtEnd = currentStockMap.get(normName) ?? qtyAtEnd;
            }

            const price = itemAvgPrices[normName] || 22000;
            const total = qtyAtEnd * price;
            endingInventoryVal += total;

            endingDetails.push({
                name: item.name,
                qtyAtStart,
                pengirimanInPeriod,
                pemusnahanInPeriod,
                produksiInPeriod,
                tradingInPeriod,
                returInPeriod,
                qtyAtEnd,
                price,
                total,
                logs: {
                    pengiriman: pengirimanLogs,
                    pemusnahan: pemusnahanLogs,
                    produksi: produksiLogs,
                    trading: tradingLogs,
                    retur: returLogs,
                    penyesuaian: penyesuaianLogs
                },
                penyesuaianInPeriod
            });
        });

        if (earlyEndingFound) {
            endingInventoryVal = earlyEndingVal;
        }

        const netProfit = totalSales - beginningInventoryVal - belanjaLB - pembelianTrading - totalOperasional - rugiStock + endingInventoryVal;

        return {
            start,
            end,
            totalSales,
            beginningInventoryVal,
            belanjaLB,
            pembelianTrading,
            endingInventoryVal,
            totalOperasional,
            rugiStock,
            netProfit,
            endingDetails,
            isBaseDate,
            filteredInvoices,
            filteredProduction,
            filteredTradingPurchases,
            filteredStockDisposals,
            filteredExpenses,
            filteredSalaries,
            filteredStockLogs
        };
    }, [invoices, productionHistory, expenses, salaries, stockLogs, tradingPurchases, stockDisposals, stock, filterType, selectedMonth, selectedDate, dateRange, earlyStock, masterItems]);

    const formatIDR = (val: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val);

    const exportToExcel = () => {
        const wb = XLSX.utils.book_new();

        const summaryData = [
            ["LAPORAN LABA RUGI", ""],
            ["Periode:", filterType === 'all' ? 'Semua Waktu' : `${report.start.toLocaleDateString('id-ID')} - ${report.end.toLocaleDateString('id-ID')}`],
            ["", ""],
            ["KATEGORI", "JUMLAH (IDR)"],
            ["PENJUALAN (+)", report.totalSales],
            ["STOK AWAL (-)", -report.beginningInventoryVal],
            ["BELANJA LB (-)", -report.belanjaLB],
            ["TRADING PURCHASES (-)", -report.pembelianTrading],
            ["STOK AKHIR (+)", report.endingInventoryVal],
            ["OPERASIONAL & GAJI (-)", -report.totalOperasional],
            ["KERUGIAN STOCK (-)", -report.rugiStock],
            ["", ""],
            ["LABA/RUGI BERSIH", report.netProfit],
        ];
        const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
        XLSX.utils.book_append_sheet(wb, wsSummary, "Ringkasan Laba Rugi");

        const inventoryAuditData = [
            ["DETAIL VALUASI STOK AKHIR (AUDIT TRAIL)", "", "", "", "", "", "", "", ""],
            ["Item", "Stok Awal", "Produksi (+)", "Trading (+)", "Retur (+)", "Pengiriman (-)", "Pemusnahan (-)", "Penyesuaian (+/-)", "Stok Akhir", "Harga Rerata", "Subtotal Valuasi"],
        ];

        report.endingDetails.forEach(det => {
            inventoryAuditData.push([
                det.name,
                det.qtyAtStart,
                det.produksiInPeriod,
                det.tradingInPeriod,
                det.returInPeriod,
                det.pengirimanInPeriod,
                det.pemusnahanInPeriod,
                det.penyesuaianInPeriod,
                det.qtyAtEnd,
                det.price,
                det.total
            ]);
        });
        inventoryAuditData.push(["", "", "", "", "", "", "", "", "", "TOTAL VALUASI", report.endingInventoryVal.toString()]);
        const wsInventory = XLSX.utils.aoa_to_sheet(inventoryAuditData);
        XLSX.utils.book_append_sheet(wb, wsInventory, "Audit Stok Akhir");

        // --- Detail Invoices ---
        const invoiceData = [
            ["DETAIL PENJUALAN / INVOICE"],
            ["Tanggal", "No. Invoice", "Pelanggan", "Item", "Qty", "Harga Satuan", "Subtotal"]
        ];
        report.filteredInvoices.forEach(inv => {
            const dateStr = new Date(inv.date).toLocaleDateString('id-ID');
            // Support both Invoice structure (from old state) and Supabase invoice
            const invNumber = inv.nomor_invoice || inv.invoiceNumber || inv.id || '-';
            const custName = inv.customer || inv.customerName || '-';

            // Either we have an items array or a singular item mapping
            if (inv.items && Array.isArray(inv.items)) {
                inv.items.forEach(item => {
                    const qty = Number(item.quantity) || 0;
                    const price = Number(item.price) || 0;
                    invoiceData.push([
                        dateStr,
                        invNumber,
                        custName,
                        item.name,
                        qty.toString(),
                        price.toString(),
                        (qty * price).toString()
                    ]);
                });
            } else if (inv.itemName) {
                const qty = Number(inv.qtyDiterima) || 0;
                const price = Number(inv.harga) || 0;
                invoiceData.push([
                    dateStr,
                    invNumber,
                    custName,
                    inv.itemName,
                    qty.toString(),
                    price.toString(),
                    inv.total ? inv.total.toString() : (qty * price).toString()
                ]);
            }
        });
        const wsInvoices = XLSX.utils.aoa_to_sheet(invoiceData);
        XLSX.utils.book_append_sheet(wb, wsInvoices, "Detail Invoices");

        // --- Detail Pembelian / Produksi LB ---
        const productionData = [
            ["DETAIL PEMBELIAN & PRODUKSI LB"],
            ["Tanggal", "Kandang/Supplier", "Mobil", "Supir", "Estimasi Ekor", "Total Kg", "Harga/Kg", "Subtotal", "Gagal (Ekor)", "Berhasil (Ekor)"]
        ];
        report.filteredProduction.forEach(prod => {
            const dateStr = new Date(prod.date).toLocaleDateString('id-ID');
            const totalKg = Number(prod.initialKg) || 0;
            const price = Number(prod.pricePerKg) || 0;
            productionData.push([
                dateStr,
                prod.coopName,
                prod.plateNumber || '-',
                prod.driverName || '-',
                (prod.estimatedChickenCount || 0).toString(),
                totalKg.toString(),
                price.toString(),
                (totalKg * price).toString(),
                (prod.failedChickenCount || 0).toString(),
                (prod.successChickenCount || 0).toString()
            ]);
        });
        const wsProduction = XLSX.utils.aoa_to_sheet(productionData);
        XLSX.utils.book_append_sheet(wb, wsProduction, "Detail Pembelian LB");

        // --- Detail Trading Purchases ---
        const tradingData = [
            ["DETAIL TRADING PURCHASES"],
            ["Tanggal", "Supplier", "Item", "Kategori", "Kg", "Harga/Kg", "Total Harga", "Catatan"]
        ];
        report.filteredTradingPurchases.forEach(tp => {
            const dateStr = new Date(tp.tanggal).toLocaleDateString('id-ID');
            const kg = Number(tp.kg) || 0;
            const hrg = Number(tp.harga_per_kg) || 0;
            const tot = Number(tp.total_harga) || (kg * hrg) || 0;
            tradingData.push([
                dateStr,
                tp.supplier_name,
                tp.nama_barang,
                tp.kategori,
                kg.toString(),
                hrg.toString(),
                tot.toString(),
                tp.catatan || '-'
            ]);
        });
        const wsTrading = XLSX.utils.aoa_to_sheet(tradingData);
        XLSX.utils.book_append_sheet(wb, wsTrading, "Detail Trading");

        // --- Detail Pengiriman (Surat Jalan/Stock Logs) ---
        // Includes Pengiriman & Retur from stock logs, maybe others if needed
        const stockLogsData = [
            ["DETAIL LOG PERGERAKAN STOK"],
            ["Tanggal", "Tipe", "Item", "Perubahan (Kg)", "Tujuan/Catatan"]
        ];
        report.filteredStockLogs.forEach(sl => {
            const dateStr = new Date(sl.timestamp).toLocaleDateString('id-ID');
            const change = Number(sl.change) || 0;
            let notes = sl.notes || '';
            stockLogsData.push([
                dateStr,
                sl.type,
                sl.itemName,
                change.toString(),
                notes
            ]);
        });
        const wsStockLogs = XLSX.utils.aoa_to_sheet(stockLogsData);
        XLSX.utils.book_append_sheet(wb, wsStockLogs, "Log Stok (SJ & Retur)");

        // --- Detail Pemusnahan / Rugi Stock ---
        const disposalData = [
            ["DETAIL PEMUSNAHAN / KERUGIAN STOK"],
            ["Tanggal", "Item", "Kg", "Harga Valuasi/Kg", "Total Kerugian", "Catatan"]
        ];
        report.filteredStockDisposals.forEach(sd => {
            const dateStr = new Date(sd.tanggal).toLocaleDateString('id-ID');
            const kg = Number(sd.kg) || 0;
            const hrg = Number(sd.harga_valuasi_kg) || 0;
            const tot = Number(sd.total_kerugian) || (kg * hrg) || 0;
            disposalData.push([
                dateStr,
                sd.nama_barang,
                kg.toString(),
                hrg.toString(),
                tot.toString(),
                sd.catatan || '-'
            ]);
        });
        const wsDisposal = XLSX.utils.aoa_to_sheet(disposalData);
        XLSX.utils.book_append_sheet(wb, wsDisposal, "Detail Pemusnahan");

        // --- Detail Operasional & Gaji ---
        const operasionalData = [
            ["DETAIL OPERASIONAL & GAJI"],
            ["Tanggal", "Tipe", "Kategori", "Deskripsi / Karyawan", "Jumlah (IDR)"]
        ];
        report.filteredExpenses.forEach(exp => {
            const dateStr = new Date(exp.date).toLocaleDateString('id-ID');
            const amount = Number(exp.amount) || 0;
            operasionalData.push([
                dateStr,
                "Pengeluaran Operasional",
                exp.category,
                exp.description,
                amount.toString()
            ]);
        });
        report.filteredSalaries.forEach(sal => {
            const dateStr = new Date(sal.date).toLocaleDateString('id-ID');
            const amount = Number(sal.totalSalary) || 0;
            operasionalData.push([
                dateStr,
                "Gaji Karyawan",
                sal.role || "Karyawan",
                sal.employeeName,
                amount.toString()
            ]);
        });
        const wsOperasional = XLSX.utils.aoa_to_sheet(operasionalData);
        XLSX.utils.book_append_sheet(wb, wsOperasional, "Detail Operasional");

        XLSX.writeFile(wb, `Laporan_Laba_Rugi_${filterType}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    };

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 md:p-10 rounded-[2.5rem] border border-slate-100 shadow-sm">
                <div className="flex flex-col xl:flex-row xl:justify-between xl:items-end mb-10 gap-8">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-2 h-8 bg-indigo-600 rounded-full"></div>
                            <h2 className="text-3xl font-black text-slate-800 tracking-tighter uppercase">LABA RUGI</h2>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 bg-slate-50 p-3 rounded-[2rem] border border-slate-100 shadow-inner">
                        <button onClick={exportToExcel} className="flex flex-col px-6 border-r border-slate-200 group">
                            <div className="flex items-center gap-1 mb-1">
                                <DownloadIcon className="w-2.5 h-2.5 text-indigo-500" />
                                <span className="text-[8px] font-black text-indigo-500 uppercase">Export</span>
                            </div>
                            <span className="text-xs font-black text-slate-800 group-hover:text-indigo-600 transition-colors">Unduh XLSX</span>
                        </button>

                        <div className="flex flex-col px-4 border-r border-slate-200">
                            <span className="text-[8px] font-black text-slate-400 uppercase mb-1">Filter</span>
                            <select value={filterType} onChange={(e) => setFilterType(e.target.value as FilterType)} className="bg-transparent text-xs font-black outline-none">
                                <option value="all">Semua Waktu</option>
                                <option value="date">Harian</option>
                                <option value="month">Bulanan</option>
                                <option value="range">Rentang</option>
                            </select>
                        </div>
                        {filterType === 'date' && <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="bg-transparent text-xs font-black" />}
                        {filterType === 'month' && <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="bg-transparent text-xs font-black" />}
                        {filterType === 'range' && (
                            <>
                                <input type="date" value={dateRange.start} onChange={(e) => setDateRange(p => ({ ...p, start: e.target.value }))} className="bg-transparent text-xs font-black" />
                                <input type="date" value={dateRange.end} onChange={(e) => setDateRange(p => ({ ...p, end: e.target.value }))} className="bg-transparent text-xs font-black" />
                            </>
                        )}
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="bg-emerald-50/50 p-6 rounded-3xl border border-emerald-100 flex justify-between items-center">
                        <div><p className="text-[10px] font-black text-emerald-600">TOTAL PENJUALAN (+)</p></div>
                        <span className="text-2xl font-mono font-black text-emerald-600">{formatIDR(report.totalSales)}</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-4">
                            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 flex justify-between items-center">
                                <p className="text-[9px] font-black text-slate-400">BEGINNING INVENTORY (-)</p>
                                <span className="text-sm font-mono font-bold text-rose-500">-{formatIDR(report.beginningInventoryVal)}</span>
                            </div>
                            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 flex justify-between items-center">
                                <p className="text-[9px] font-black text-slate-400">BELANJA LB (-)</p>
                                <span className="text-sm font-mono font-bold text-rose-500">-{formatIDR(report.belanjaLB)}</span>
                            </div>
                            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 flex justify-between items-center">
                                <p className="text-[9px] font-black text-slate-400">PEMBELIAN TRADING (-)</p>
                                <span className="text-sm font-mono font-bold text-rose-500">-{formatIDR(report.pembelianTrading)}</span>
                            </div>
                        </div>
                        <div className="space-y-4">
                            <div className="bg-indigo-50/50 p-5 rounded-2xl border border-indigo-100 flex justify-between items-center">
                                <p className="text-[9px] font-black text-indigo-500">ENDING INVENTORY (+)</p>
                                <span className="text-sm font-mono font-bold text-indigo-600">+{formatIDR(report.endingInventoryVal)}</span>
                            </div>
                            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 flex justify-between items-center">
                                <p className="text-[9px] font-black text-slate-400">OPERASIONAL & GAJI (-)</p>
                                <span className="text-sm font-mono font-bold text-rose-500">-{formatIDR(report.totalOperasional)}</span>
                            </div>
                            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 flex justify-between items-center">
                                <p className="text-[9px] font-black text-slate-400">KERUGIAN STOCK / PEMUSNAHAN (-)</p>
                                <span className="text-sm font-mono font-bold text-rose-500">-{formatIDR(report.rugiStock)}</span>
                            </div>
                        </div>
                    </div>

                    <div className={`mt-10 p-8 rounded-[2.5rem] border flex flex-col md:flex-row justify-between items-center gap-6 shadow-2xl ${report.netProfit >= 0 ? 'bg-indigo-600' : 'bg-rose-600'}`}>
                        <h3 className="text-2xl font-black text-white">{report.netProfit >= 0 ? 'LABA BERSIH' : 'RUGI BERSIH'}</h3>
                        <span className="text-3xl font-mono font-black text-white">{formatIDR(report.netProfit)}</span>
                    </div>
                </div>

                <div className="mt-12 p-6 bg-slate-50 rounded-[2rem] border border-slate-200/50 text-[10px] text-slate-500 font-bold uppercase text-center">
                    METODE AUDIT: Laba = Penjualan - (Stok Awal + Pembelian - Stok Akhir) - Beban.
                </div>
            </div>

            {/* Modal Detail Inspeksi Transaksi */}
            {inspectedSubDetail && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
                    <div className="bg-white w-full max-w-2xl max-h-[80vh] rounded-[2rem] shadow-2xl flex flex-col border border-slate-200">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/80">
                            <div>
                                <h4 className="text-sm font-black text-slate-800 uppercase">Detail Transaksi: {inspectedSubDetail.itemName}</h4>
                                <p className="text-[9px] font-bold text-slate-400 uppercase">Kategori: {inspectedSubDetail.category}</p>
                            </div>
                            <button onClick={() => setInspectedSubDetail(null)} className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-rose-500 transition-all font-bold">✕</button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 no-scrollbar">
                            <div className="space-y-3">
                                {inspectedSubDetail.logs.length === 0 ? (
                                    <p className="text-center py-10 text-[10px] font-black text-slate-300 uppercase italic">Tidak ada data transaksi</p>
                                ) : (
                                    inspectedSubDetail.logs.map((log, lIdx) => {
                                        const isProd = log && typeof log === 'object' && 'items' in log;
                                        const dateLabel = new Date(isProd ? log.date : log.timestamp).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });

                                        let qty = 0;
                                        if (isProd) {
                                            const items = (log as any).items || {};
                                            const entry = Object.entries(items).find(([name]) => name.trim().toUpperCase() === inspectedSubDetail.itemName.trim().toUpperCase());
                                            qty = entry ? Number(entry[1]) : 0;
                                        } else {
                                            qty = Math.abs(Number((log as any).change) || 0);
                                        }

                                        return (
                                            <div key={lIdx} className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex justify-between items-center group hover:bg-white hover:border-indigo-100 transition-all">
                                                <div className="space-y-0.5">
                                                    <div className="text-[10px] font-black text-slate-800">{isProd ? `PRODUKSI - ${(log as any).coopName}` : `${(log as any).type} ${(log as any).notes ? `- ${(log as any).notes}` : ''}`}</div>
                                                    <div className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">{dateLabel}</div>
                                                </div>
                                                <div className="text-right">
                                                    <div className={`text-xs font-mono font-black ${inspectedSubDetail.category === 'Pengiriman' || inspectedSubDetail.category === 'Pemusnahan' || (inspectedSubDetail.category === 'Penyesuaian' && Number(qty) < 0) ? 'text-rose-500' : 'text-emerald-500'}`}>
                                                        {inspectedSubDetail.category === 'Pengiriman' || inspectedSubDetail.category === 'Pemusnahan' || (inspectedSubDetail.category === 'Penyesuaian' && Number(qty) < 0) ? '-' : '+'} {Number(qty).toFixed(2)} Kg
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                        <div className="p-4 bg-slate-50 border-t border-slate-100 text-[8px] text-slate-400 font-bold uppercase tracking-widest text-center">
                            Daftar transaksi yang mempengaruhi stok item dalam periode terpilih.
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProfitLossView;
