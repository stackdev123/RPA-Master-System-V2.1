import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import type { ProductionRecord, ExpenseRecord, Invoice, MasterItem } from '../types';
import { CHICKEN_PARTS, sortChickenParts } from '../constants';
import { DownloadIcon } from './icons';

interface HPPViewProps {
    productionHistory: ProductionRecord[];
    expenses: ExpenseRecord[];
    invoices: Invoice[];
    masterItems: MasterItem[];
}

const HPPView: React.FC<HPPViewProps> = ({ productionHistory = [], expenses = [], invoices = [], masterItems = [] }) => {
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));

    const calculationData = useMemo(() => {
        const targetDate = new Date(selectedDate);

        // 1. Filter Data Berdasarkan Tanggal
        const dailyProduction = productionHistory.filter(p => {
            const d = new Date(p.date);
            return d.getFullYear() === targetDate.getFullYear() &&
                   d.getMonth() === targetDate.getMonth() &&
                   d.getDate() === targetDate.getDate();
        });

        const dailyExpenses = expenses.filter(e => {
            const d = new Date(e.date);
            return d.getFullYear() === targetDate.getFullYear() &&
                   d.getMonth() === targetDate.getMonth() &&
                   d.getDate() === targetDate.getDate();
        });

        const dailyInvoices = invoices.filter(i => {
            const d = new Date(i.date);
            return d.getFullYear() === targetDate.getFullYear() &&
                   d.getMonth() === targetDate.getMonth() &&
                   d.getDate() === targetDate.getDate();
        });

        // 2. Agregasi Total Produksi & Biaya Dasar
        let totalRawMaterialCost = 0;
        let totalInputLB = 0;
        let totalOutputKg = 0;
        const itemProductionQtys: { [key: string]: number } = {};

        dailyProduction.forEach(record => {
            totalInputLB += Number(record.initialKg) || 0;
            totalRawMaterialCost += (Number(record.initialKg) * (record.pricePerKg || 0));
            Object.entries(record.items).forEach(([item, qty]) => {
                const q = Number(qty) || 0;
                itemProductionQtys[item] = (itemProductionQtys[item] || 0) + q;
                totalOutputKg += q;
            });
        });

        const totalOperationalCost = dailyExpenses.reduce((sum, e) => sum + e.amount, 0);
        const grandTotalCost = totalRawMaterialCost + totalOperationalCost;

        // 3. Harga Jual Rata-rata per Item (Simple Average Logic)
        const itemPricesList: { [key: string]: number[] } = {};
        dailyInvoices.forEach(inv => {
            inv.items?.forEach(item => {
                if (!item.name) return;
                if (!itemPricesList[item.name]) itemPricesList[item.name] = [];
                if (item.price > 0) {
                    itemPricesList[item.name].push(item.price);
                }
            });
        });

        // 4. Kalkulasi Yield, Recovery, dan Ratio Value
        let totalValueRatio = 0;
        const tempRows = masterItems.map(item => {
            const partName = item.name;
            const qty = itemProductionQtys[partName] || 0;
            
            // Yield % = Qty / Total Input LB (Ayam Hidup)
            const yieldVal = totalInputLB > 0 ? qty / totalInputLB : 0;
            
            // Recovery % = Qty / Total Seluruh Hasil Produksi (Output)
            const recovery = totalOutputKg > 0 ? qty / totalOutputKg : 0;
            
            // Simple Average Price calculation
            const prices = itemPricesList[partName] || [];
            const avgPrice = prices.length > 0 
                ? prices.reduce((a, b) => a + b, 0) / prices.length 
                : 0;
            
            // Ratio (V) = Recovery % * Avg Jual
            const valueRatio = recovery * avgPrice;
            totalValueRatio += valueRatio;

            return {
                name: partName,
                qty,
                yieldVal,
                recovery,
                avgPrice,
                valueRatio
            };
        });

        // 5. Alokasi Biaya Berdasarkan Ratio & Perhitungan HPP Final
        const finalRows = tempRows.map(row => {
            // Cost Ratio = Ratio Item / Total Ratio Seluruh Item
            const costRatio = totalValueRatio > 0 ? row.valueRatio / totalValueRatio : 0;
            
            // Total Biaya Item = Cost Ratio * Grand Total Biaya Hari Ini
            const allocatedCost = grandTotalCost * costRatio;
            
            // HPP / Kg = Total Biaya Item / Qty Produksi Item
            const hppPerKg = row.qty > 0 ? allocatedCost / row.qty : 0;

            return {
                ...row,
                costRatio,
                allocatedCost,
                hppPerKg
            };
        }).filter(r => r.qty > 0);

        return {
            totalRawMaterialCost,
            totalOperationalCost,
            grandTotalCost,
            totalInputLB,
            totalOutputKg,
            totalValueRatio,
            rows: finalRows.sort((a, b) => sortChickenParts(a.name, b.name))
        };

    }, [selectedDate, productionHistory, expenses, invoices, masterItems]);

    const totals = useMemo(() => {
        return calculationData.rows.reduce((acc, row) => {
            acc.qty += row.qty;
            acc.yieldVal += row.yieldVal;
            acc.recovery += row.recovery;
            acc.costRatio += row.costRatio;
            acc.totalCost += row.allocatedCost;
            return acc;
        }, { qty: 0, yieldVal: 0, recovery: 0, costRatio: 0, totalCost: 0 });
    }, [calculationData.rows]);

    const formatCheck = (val: number, decimals: number = 1) => {
        return new Intl.NumberFormat('id-ID', { 
            minimumFractionDigits: 0, 
            maximumFractionDigits: decimals 
        }).format(val);
    };

    const handleExportExcel = () => {
        if (!calculationData || calculationData.rows.length === 0) {
            alert('Belum ada data untuk diexport.');
            return;
        }

        const wb = XLSX.utils.book_new();

        // 1. Prepare Summary Info
        const summaryData = [
            ['AUDIT & KALKULASI HPP'],
            ['Tanggal', selectedDate],
            [''],
            ['Total Input (LB)', { v: calculationData.totalInputLB, t: 'n' }],
            ['Total Output (PROD)', { v: calculationData.totalOutputKg, t: 'n' }],
            ['Total Raw Material Cost', { v: calculationData.totalRawMaterialCost, t: 'n' }],
            ['Total Operasional Cost', { v: calculationData.totalOperationalCost, t: 'n' }],
            ['Grand Total Cost', { v: calculationData.grandTotalCost, t: 'n', f: 'B6+B7' }],
            ['']
        ];

        // 2. Prepare Detailed HPP Table
        const headers = [
            'Item Name',
            'Qty (Kg)',
            'Yield %',
            'Recovery %',
            'Avg Jual (S)',
            'Ratio (V)',
            'Cost Ratio %',
            'Total Biaya (Alokasi)',
            'HPP / Kg'
        ];

        const startIndex = 11;
        const footerIndex = startIndex + calculationData.rows.length;

        const rowsData = calculationData.rows.map((row, i) => {
            const rowIndex = startIndex + i;
            return [
                row.name,
                { v: row.qty, t: 'n' },
                { v: row.yieldVal / 100, t: 'n', f: `IF(B$4=0,0,B${rowIndex}/B$4)`, z: '0.00%' },
                { v: row.recovery / 100, t: 'n', f: `IF(B$5=0,0,B${rowIndex}/B$5)`, z: '0.00%' },
                { v: row.avgPrice, t: 'n', z: '#,##0' },
                { v: row.valueRatio, t: 'n', f: `C${rowIndex}*E${rowIndex}` },
                { v: row.costRatio / 100, t: 'n', f: `IF(F$${footerIndex}=0,0,F${rowIndex}/F$${footerIndex})`, z: '0.00%' },
                { v: row.allocatedCost, t: 'n', f: `G${rowIndex}*B$8`, z: '#,##0' },
                { v: row.hppPerKg, t: 'n', f: `IF(B${rowIndex}=0,0,H${rowIndex}/B${rowIndex})`, z: '#,##0' }
            ];
        });

        const footerRow = [
            'TOTAL',
            { v: totals.qty, t: 'n', f: `SUM(B${startIndex}:B${footerIndex-1})` },
            { v: totals.yieldVal / 100, t: 'n', f: `SUM(C${startIndex}:C${footerIndex-1})`, z: '0.00%' },
            { v: totals.recovery / 100, t: 'n', f: `SUM(D${startIndex}:D${footerIndex-1})`, z: '0.00%' },
            '-',
            { v: calculationData.totalValueRatio, t: 'n', f: `SUM(F${startIndex}:F${footerIndex-1})` },
            { v: totals.costRatio / 100, t: 'n', f: `SUM(G${startIndex}:G${footerIndex-1})`, z: '0.00%' },
            { v: totals.totalCost, t: 'n', f: `SUM(H${startIndex}:H${footerIndex-1})`, z: '#,##0' },
            '-'
        ];

        const wsData = [
            ...summaryData,
            headers,
            ...rowsData,
            footerRow
        ];

        const ws = XLSX.utils.aoa_to_sheet(wsData);

        // Adjust column widths for better visibility
        const colWidths = [
            { wch: 25 }, // A: Item Name
            { wch: 12 }, // B: Qty
            { wch: 10 }, // C: Yield
            { wch: 10 }, // D: Recovery
            { wch: 15 }, // E: Avg Jual
            { wch: 15 }, // F: Ratio (V)
            { wch: 12 }, // G: Cost Ratio
            { wch: 20 }, // H: Total Biaya
            { wch: 15 }  // I: HPP/Kg
        ];
        ws['!cols'] = colWidths;
        
        XLSX.utils.book_append_sheet(wb, ws, `HPP_${selectedDate}`);
        XLSX.writeFile(wb, `Audit_HPP_${selectedDate}.xlsx`);
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            <div className="bg-white p-10 rounded-[3.5rem] border border-slate-100 shadow-2xl shadow-slate-200/60 relative overflow-hidden">
                {/* Header Section */}
                <div className="flex justify-between items-end mb-12 flex-wrap gap-6 relative z-10">
                    <div>
                        <div className="flex items-center gap-4 mb-3">
                            <div className="w-2 h-10 bg-indigo-600 rounded-full" />
                            <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase leading-none">AUDIT & KALKULASI HPP</h2>
                        </div>
                        <p className="text-slate-400 font-bold text-xs ml-6 tracking-[0.2em] uppercase">Analisis Alokasi Biaya Bersama (Joint Cost)</p>
                    </div>
                    
                    <div className="bg-slate-100/80 p-2.5 rounded-[2rem] border border-slate-200/50 flex items-center gap-4">
                        <button
                            onClick={handleExportExcel}
                            className="bg-white text-indigo-600 px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-sm border border-slate-200 hover:bg-slate-50 transition-all flex items-center gap-2"
                        >
                            <DownloadIcon /> Export XLSX
                        </button>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">TANGGAL AUDIT:</span>
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="px-6 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-black shadow-sm focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all"
                        />
                    </div>
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12 relative z-10">
                    <div className="bg-slate-50/80 p-8 rounded-[2.5rem] border border-white shadow-sm">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Total Input (LB)</p>
                        <p className="text-3xl font-black text-slate-900 tracking-tight">{formatCheck(calculationData.totalInputLB, 1)} <span className="text-xs text-slate-300">Kg</span></p>
                    </div>
                    <div className="bg-slate-50/80 p-8 rounded-[2.5rem] border border-white shadow-sm">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Total Output (PROD)</p>
                        <p className="text-3xl font-black text-slate-900 tracking-tight">{formatCheck(calculationData.totalOutputKg, 1)} <span className="text-xs text-slate-300">Kg</span></p>
                    </div>
                    <div className="bg-slate-50/80 p-8 rounded-[2.5rem] border border-white shadow-sm">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Total Operasional</p>
                        <p className="text-2xl font-black text-slate-900 tracking-tight">Rp {formatCheck(calculationData.totalOperationalCost, 0)}</p>
                    </div>
                    <div className="bg-indigo-600 p-8 rounded-[2.5rem] text-white shadow-2xl shadow-indigo-200 ring-4 ring-indigo-50/50">
                        <p className="text-[9px] font-black text-indigo-200 uppercase tracking-widest mb-2 uppercase">Grand Total Biaya</p>
                        <p className="text-3xl font-black tracking-tight">Rp {formatCheck(calculationData.grandTotalCost, 0)}</p>
                    </div>
                </div>
                
                {/* Main Audit Table - Matches Screenshot Columns & Logic */}
                <div className="overflow-x-auto no-scrollbar border border-slate-100 rounded-[3rem] shadow-inner bg-slate-50/30">
                    <table className="min-w-full divide-y divide-slate-100">
                        <thead className="bg-white/80 sticky top-0 z-10">
                            <tr className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                                <th className="px-8 py-7 text-left">ITEM NAME</th>
                                <th className="px-8 py-7 text-right">QTY (KG)</th>
                                <th className="px-8 py-7 text-right text-indigo-600 bg-indigo-50/30">YIELD %</th>
                                <th className="px-8 py-7 text-right">RECOVERY %</th>
                                <th className="px-8 py-7 text-right border-x border-slate-100 bg-amber-50/20 text-amber-600 uppercase">Avg Jual (S)</th>
                                <th className="px-8 py-7 text-right uppercase">Ratio (V)</th>
                                <th className="px-8 py-7 text-right">COST RATIO</th>
                                <th className="px-8 py-7 text-right">TOTAL BIAYA</th>
                                <th className="px-8 py-7 text-right text-white bg-indigo-600 shadow-xl">HPP / KG</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-50">
                            {calculationData.rows.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="px-4 py-32 text-center">
                                        <p className="text-slate-300 font-black uppercase tracking-[0.3em] text-xs">Belum ada data untuk periode ini</p>
                                    </td>
                                </tr>
                            ) : (
                                calculationData.rows.map((row) => (
                                    <tr key={row.name} className="hover:bg-indigo-50/30 transition-all group">
                                        <td className="px-8 py-5 font-black text-slate-800 text-sm group-hover:text-indigo-600 transition-colors">{row.name}</td>
                                        <td className="px-8 py-5 text-right font-mono font-bold text-slate-900">{formatCheck(row.qty, 0)}</td>
                                        <td className="px-8 py-5 text-right font-black text-indigo-600 bg-indigo-50/10">{(row.yieldVal * 100).toFixed(1)}%</td>
                                        <td className="px-8 py-5 text-right text-slate-500 font-bold">{(row.recovery * 100).toFixed(1)}%</td>
                                        <td className="px-8 py-5 text-right text-amber-700 font-black border-x border-slate-50 bg-amber-50/5">{formatCheck(row.avgPrice, 0)}</td>
                                        <td className="px-8 py-5 text-right text-slate-400 font-mono text-[11px] font-bold">{formatCheck(row.valueRatio, 1)}</td>
                                        <td className="px-8 py-5 text-right text-slate-500 font-black">{(row.costRatio * 100).toFixed(1)}%</td>
                                        <td className="px-8 py-5 text-right text-slate-800 font-mono text-[13px]">{formatCheck(row.allocatedCost, 0)}</td>
                                        <td className="px-8 py-5 text-right font-black text-indigo-700 bg-indigo-50/50 text-base border-l border-indigo-100">
                                            {formatCheck(row.hppPerKg, 0)}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                        {calculationData.rows.length > 0 && (
                            <tfoot className="bg-slate-900 text-white shadow-2xl">
                                <tr className="font-black text-[10px] uppercase tracking-[0.2em]">
                                    <td className="px-8 py-8 border-t border-slate-800">TOTAL:</td>
                                    <td className="px-8 py-8 text-right font-mono text-sm">{formatCheck(totals.qty, 0)} Kg</td>
                                    <td className="px-8 py-8 text-right border-t border-slate-800">{(totals.yieldVal * 100).toFixed(1)}%</td>
                                    <td className="px-8 py-8 text-right border-t border-slate-800">{(totals.recovery * 100).toFixed(0)}%</td>
                                    <td className="px-8 py-8 text-right border-t border-slate-800">-</td>
                                    <td className="px-8 py-8 text-right font-mono border-t border-slate-800">{formatCheck(calculationData.totalValueRatio, 1)}</td>
                                    <td className="px-8 py-8 text-right border-t border-slate-800">{(totals.costRatio * 100).toFixed(0)}%</td>
                                    <td className="px-8 py-8 text-right text-emerald-400 text-base border-t border-slate-800">Rp {formatCheck(totals.totalCost, 0)}</td>
                                    <td className="px-8 py-8 text-right bg-indigo-700">-</td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
                
                {/* Method Explanation - As per Screenshot Rumus Ratio */}
                <div className="mt-12 p-8 bg-blue-50/50 border-2 border-dashed border-blue-100 rounded-[3rem]">
                    <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-[0.3em] mb-4 italic text-center">Komponen Audit Manual</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-3 text-[11px] text-blue-900/60 leading-relaxed font-bold">
                        <p>1. <span className="text-blue-700">Yield %:</span> Qty Item / Total Input LB ({formatCheck(calculationData.totalInputLB, 1)} Kg)</p>
                        <p>2. <span className="text-blue-700">Recovery %:</span> Qty Item / Total Output Prod ({formatCheck(calculationData.totalOutputKg, 1)} Kg)</p>
                        <p>3. <span className="text-blue-700">Avg Jual (S):</span> Rata-rata sederhana dari seluruh entri harga jual di invoice.</p>
                        <p>4. <span className="text-blue-700 italic">Ratio (V): Recovery % x Avg Jual (S)</span></p>
                        <p>5. <span className="text-blue-700">Cost Ratio:</span> Ratio Item (V) / Total Ratio (V) Seluruh Item</p>
                        <p>6. <span className="text-blue-700">HPP / Kg:</span> (Cost Ratio x Total Biaya Hari Ini) / Qty Item</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HPPView;