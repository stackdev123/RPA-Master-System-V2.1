import React, { useState, useMemo, useEffect } from 'react';
import type { LedgerEntry, Invoice, Customer } from '../types';
import { XIcon } from './icons';
import CurrencyInput from './CurrencyInput';

interface DebtPaymentFormProps {
    customerName: string;
    customers?: Customer[];
    customerDebts?: { [key: string]: number };
    currentDebt: number;
    invoices?: Invoice[];
    initialSelectedInvoiceIds?: string[];
    onSubmit: (paymentData: Omit<LedgerEntry, 'id' | 'balance' | 'debit' | 'timestamp'>) => void;
    onCancel: () => void;
}

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(value);
};

const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });
};

const DebtPaymentForm: React.FC<DebtPaymentFormProps> = ({
    customerName,
    customers = [],
    customerDebts = {},
    currentDebt,
    invoices = [],
    initialSelectedInvoiceIds = [],
    onSubmit,
    onCancel
}) => {
    const [activeCustomer, setActiveCustomer] = useState<string>(customerName || '');
    const [amount, setAmount] = useState(0);
    const [paymentMethod, setPaymentMethod] = useState<'Transfer' | 'Cash'>('Transfer');
    const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
    const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<string[]>(initialSelectedInvoiceIds);
    const [notes, setNotes] = useState('');
    const [paymentProof, setPaymentProof] = useState<string | undefined>(undefined);
    const [fileName, setFileName] = useState('');
    const [showPaidInvoices, setShowPaidInvoices] = useState(false);

    useEffect(() => {
        if (customerName) {
            setActiveCustomer(customerName);
        }
    }, [customerName]);

    // Filter invoice milik pelanggan yang dipilih
    const customerInvoices = useMemo(() => {
        if (!activeCustomer) return [];
        return invoices
            .filter(inv => inv.customer.trim().toLowerCase() === activeCustomer.trim().toLowerCase())
            .map(inv => {
                const totalTagihan = Number(inv.subtotal) || 0;
                const sudahDibayar = Number(inv.amountPaid) || 0;
                const sisaTagihan = Math.max(0, totalTagihan - sudahDibayar);
                return {
                    ...inv,
                    totalTagihan,
                    sudahDibayar,
                    sisaTagihan,
                };
            })
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [invoices, activeCustomer]);

    useEffect(() => {
        if (initialSelectedInvoiceIds && initialSelectedInvoiceIds.length > 0 && customerInvoices.length > 0) {
            setSelectedInvoiceIds(initialSelectedInvoiceIds);
            const initTotal = initialSelectedInvoiceIds.reduce((sum, id) => {
                const found = customerInvoices.find(i => i.id === id);
                if (!found) return sum;
                return sum + (found.sisaTagihan > 0 ? found.sisaTagihan : found.totalTagihan);
            }, 0);
            setAmount(initTotal);
        }
    }, [initialSelectedInvoiceIds, customerInvoices]);

    const unpaidInvoices = useMemo(
        () => customerInvoices.filter(inv => inv.sisaTagihan > 0),
        [customerInvoices]
    );

    const displayedInvoices = useMemo(
        () => (showPaidInvoices ? customerInvoices : unpaidInvoices),
        [showPaidInvoices, customerInvoices, unpaidInvoices]
    );

    // Hitung total tagihan dari invoice-invoice yang dicentang
    const selectedInvoicesList = useMemo(() => {
        return selectedInvoiceIds
            .map(id => customerInvoices.find(inv => inv.id === id))
            .filter(Boolean) as typeof customerInvoices;
    }, [selectedInvoiceIds, customerInvoices]);

    const totalSelectedDebt = useMemo(() => {
        return selectedInvoicesList.reduce((sum, inv) => sum + (inv.sisaTagihan > 0 ? inv.sisaTagihan : inv.totalTagihan), 0);
    }, [selectedInvoicesList]);

    // Toggle pilih 1 atau beberapa invoice
    const handleToggleInvoice = (invId: string) => {
        setSelectedInvoiceIds(prev => {
            const next = prev.includes(invId)
                ? prev.filter(id => id !== invId)
                : [...prev, invId];

            const nextTotal = next.reduce((sum, id) => {
                const found = customerInvoices.find(i => i.id === id);
                if (!found) return sum;
                return sum + (found.sisaTagihan > 0 ? found.sisaTagihan : found.totalTagihan);
            }, 0);
            setAmount(nextTotal);
            return next;
        });
    };

    const handleSelectAllUnpaid = () => {
        const allIds = unpaidInvoices.map(i => i.id);
        setSelectedInvoiceIds(allIds);
        const nextTotal = unpaidInvoices.reduce((sum, i) => sum + i.sisaTagihan, 0);
        setAmount(nextTotal);
    };

    const handleClearSelection = () => {
        setSelectedInvoiceIds([]);
        setAmount(0);
    };

    // Distribusi nominal pembayaran ke invoice-invoice yang dipilih secara berurutan
    const invoiceAllocations = useMemo(() => {
        let remaining = Number(amount) || 0;
        return selectedInvoicesList.map((inv, idx) => {
            const target = inv.sisaTagihan > 0 ? inv.sisaTagihan : inv.totalTagihan;
            const isLast = idx === selectedInvoicesList.length - 1;
            const allocated = isLast
                ? Math.max(0, Math.min(remaining, target) || remaining)
                : Math.max(0, Math.min(remaining, target));
            remaining = Math.max(0, remaining - allocated);
            const remainingAfterPay = Math.max(0, target - allocated);
            return {
                invoiceId: inv.id,
                date: inv.date,
                target,
                allocated,
                remainingAfterPay,
                statusAfter: remainingAfterPay <= 0 && allocated > 0 ? 'LUNAS' : allocated > 0 ? 'SEBAGIAN' : 'BELUM TERBAYAR'
            };
        });
    }, [selectedInvoicesList, amount]);

    const activeCustomerDebt = useMemo(() => {
        if (activeCustomer === customerName && currentDebt > 0) return currentDebt;
        if (customerDebts[activeCustomer] !== undefined) return customerDebts[activeCustomer];
        return unpaidInvoices.reduce((s, i) => s + i.sisaTagihan, 0);
    }, [activeCustomer, customerName, currentDebt, customerDebts, unpaidInvoices]);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 2 * 1024 * 1024) {
                alert("Ukuran file terlalu besar. Maksimal 2MB.");
                return;
            }
            try {
                const base64 = await fileToBase64(file);
                setPaymentProof(base64);
                setFileName(file.name);
            } catch (error) {
                console.error("Error converting file to base64", error);
                alert("Gagal memproses file.");
            }
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!activeCustomer) {
            alert("Silakan pilih pelanggan terlebih dahulu.");
            return;
        }
        if (selectedInvoiceIds.length === 0) {
            alert("Silakan pilih minimal 1 Faktur / Invoice yang akan dibayar terlebih dahulu.");
            return;
        }
        if (amount <= 0) {
            alert("Jumlah pembayaran harus lebih dari nol.");
            return;
        }
        if (amount > totalSelectedDebt && totalSelectedDebt > 0) {
            if (!window.confirm(`Jumlah pembayaran (${formatCurrency(amount)}) melebihi total tagihan dari ${selectedInvoiceIds.length} invoice yang dipilih (${formatCurrency(totalSelectedDebt)}). Lanjutkan?`)) {
                return;
            }
        }

        const activeAllocs = invoiceAllocations.filter(a => a.allocated > 0);
        let invoiceSummaryText = '';
        if (activeAllocs.length === 1) {
            const invDateStr = new Date(activeAllocs[0].date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
            invoiceSummaryText = `Pembayaran Faktur ${activeAllocs[0].invoiceId} (Tgl ${invDateStr}): Rp ${activeAllocs[0].allocated.toLocaleString('id-ID')}`;
        } else {
            const parts = activeAllocs.map(a => {
                const invDateStr = new Date(a.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
                return `${a.invoiceId} (Tgl ${invDateStr}): Rp ${a.allocated.toLocaleString('id-ID')}`;
            });
            invoiceSummaryText = `Pembayaran ${activeAllocs.length} Faktur (${parts.join(', ')})`;
        }

        const description = notes.trim()
            ? `${invoiceSummaryText} — ${notes.trim()}`
            : invoiceSummaryText;

        onSubmit({
            customerId: activeCustomer,
            date: new Date(date),
            description,
            credit: amount,
            paymentMethod,
            paymentProof,
        });
    };

    return (
        <div className="fixed inset-0 bg-slate-900/75 backdrop-blur-sm overflow-y-auto h-full w-full z-[200] flex justify-center items-center p-4">
            <form onSubmit={handleSubmit} className="bg-white p-6 rounded-[2rem] shadow-2xl w-full max-w-2xl max-h-[95vh] flex flex-col border border-slate-200">
                <div className="flex justify-between items-center pb-4 border-b border-slate-100 mb-4">
                    <div>
                        <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Pembayaran Faktur / Invoice</h2>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                            Pilih 1 atau beberapa Invoice yang ingin dibayar sekaligus
                        </p>
                    </div>
                    <button onClick={onCancel} type="button" className="p-2 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 transition-colors">
                        <XIcon />
                    </button>
                </div>

                <div className="flex-grow overflow-y-auto pr-1 space-y-5 no-scrollbar">
                    {/* Info Pelanggan */}
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex-1">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Pelanggan</p>
                            {customerName ? (
                                <p className="text-base font-black text-slate-900 uppercase">{activeCustomer}</p>
                            ) : (
                                <select
                                    value={activeCustomer}
                                    onChange={(e) => {
                                        setActiveCustomer(e.target.value);
                                        setSelectedInvoiceIds([]);
                                        setAmount(0);
                                    }}
                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-black uppercase outline-none"
                                >
                                    <option value="">-- PILIH PELANGGAN --</option>
                                    {customers.map(c => (
                                        <option key={c.name} value={c.name}>{c.name}</option>
                                    ))}
                                </select>
                            )}
                        </div>
                        <div className="sm:text-right">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Total Sisa Piutang</p>
                            <p className="text-base font-black text-rose-600 font-mono">{formatCurrency(activeCustomerDebt)}</p>
                        </div>
                    </div>

                    {/* Daftar Pilihan Invoice (Bisa Pilih 1 atau Banyak) */}
                    <div className="space-y-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                                <label className="block text-xs font-black uppercase tracking-wider text-slate-800">
                                    1. Pilih Faktur / Invoice yang Dibayar <span className="text-rose-500">*</span>
                                </label>
                                <p className="text-[10px] font-bold text-slate-400">
                                    Centang satu atau beberapa invoice untuk pembayaran gabungan
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                {unpaidInvoices.length > 1 && (
                                    <button
                                        type="button"
                                        onClick={handleSelectAllUnpaid}
                                        className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all"
                                    >
                                        Pilih Semua Belum Lunas ({unpaidInvoices.length})
                                    </button>
                                )}
                                {selectedInvoiceIds.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={handleClearSelection}
                                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all"
                                    >
                                        Reset
                                    </button>
                                )}
                                {customerInvoices.length > unpaidInvoices.length && (
                                    <button
                                        type="button"
                                        onClick={() => setShowPaidInvoices(prev => !prev)}
                                        className="text-[10px] font-bold text-slate-400 hover:text-slate-600 underline"
                                    >
                                        {showPaidInvoices ? 'Sembunyikan Lunas' : `Tampilkan Lunas (${customerInvoices.length - unpaidInvoices.length})`}
                                    </button>
                                )}
                            </div>
                        </div>

                        {displayedInvoices.length === 0 ? (
                            <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl text-center">
                                <p className="text-xs font-black text-slate-400 uppercase tracking-wider">
                                    Tidak ada Faktur / Invoice yang belum lunas untuk pelanggan ini
                                </p>
                            </div>
                        ) : (
                            <div className="max-h-56 overflow-y-auto space-y-2 pr-1 no-scrollbar border border-slate-200 rounded-2xl p-2.5 bg-slate-50/50">
                                {displayedInvoices.map(inv => {
                                    const isSelected = selectedInvoiceIds.includes(inv.id);
                                    const isLunas = inv.sisaTagihan <= 0;
                                    const orderIndex = selectedInvoiceIds.indexOf(inv.id);

                                    return (
                                        <label
                                            key={inv.id}
                                            className={`flex items-center justify-between gap-3 p-3 rounded-xl border transition-all cursor-pointer select-none ${
                                                isSelected
                                                    ? 'bg-indigo-50/80 border-indigo-500 shadow-2xs'
                                                    : isLunas
                                                    ? 'bg-slate-100/70 border-slate-200 opacity-60'
                                                    : 'bg-white border-slate-200 hover:border-indigo-300'
                                            }`}
                                        >
                                            <div className="flex items-start gap-3 min-w-0">
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => handleToggleInvoice(inv.id)}
                                                    className="mt-1 w-4 h-4 accent-indigo-600 rounded cursor-pointer shrink-0"
                                                />
                                                <div className="min-w-0">
                                                    <div className="flex flex-wrap items-center gap-1.5">
                                                        <span className="text-xs font-black text-slate-900 uppercase">{inv.id}</span>
                                                        {isSelected && selectedInvoiceIds.length > 1 && (
                                                            <span className="px-1.5 py-0.5 bg-indigo-600 text-white text-[8px] font-black rounded-md">
                                                                #{orderIndex + 1}
                                                            </span>
                                                        )}
                                                        <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase ${
                                                            isLunas
                                                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                                : inv.sudahDibayar > 0
                                                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                                                        }`}>
                                                            {isLunas ? 'Lunas' : inv.sudahDibayar > 0 ? 'Cicilan / Sebagian' : 'Belum Lunas'}
                                                        </span>
                                                    </div>
                                                    <p className="text-[10px] font-bold text-slate-400 mt-0.5 truncate">
                                                        Tgl: {new Date(inv.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                        {inv.deliveryOrderId ? ` • SJ: ${inv.deliveryOrderId}` : ''}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="text-right shrink-0">
                                                <p className="text-xs font-black font-mono text-slate-900">
                                                    {formatCurrency(inv.sisaTagihan > 0 ? inv.sisaTagihan : inv.totalTagihan)}
                                                </p>
                                                {inv.sudahDibayar > 0 && inv.sisaTagihan > 0 && (
                                                    <p className="text-[9px] font-bold text-emerald-600">
                                                        Terbayar: {formatCurrency(inv.sudahDibayar)} dari {formatCurrency(inv.totalTagihan)}
                                                    </p>
                                                )}
                                            </div>
                                        </label>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Ringkasan Alokasi Pembayaran untuk Invoice yang Dipilih */}
                    {selectedInvoicesList.length > 0 && (
                        <div className="bg-indigo-950 text-white p-4 rounded-2xl space-y-2.5 shadow-lg">
                            <div className="flex items-center justify-between border-b border-white/10 pb-2">
                                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-300">
                                    Total Tagihan ({selectedInvoicesList.length} Invoice Dipilih)
                                </span>
                                <span className="text-sm font-black font-mono text-yellow-400">
                                    {formatCurrency(totalSelectedDebt)}
                                </span>
                            </div>
                            <div className="space-y-1.5 max-h-32 overflow-y-auto no-scrollbar">
                                {invoiceAllocations.map(alloc => (
                                    <div key={alloc.invoiceId} className="flex items-center justify-between text-[11px]">
                                        <div className="flex items-center gap-2">
                                            <span className="font-black text-white">{alloc.invoiceId}</span>
                                            <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${
                                                alloc.statusAfter === 'LUNAS'
                                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                                                    : alloc.statusAfter === 'SEBAGIAN'
                                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-400/30'
                                                    : 'bg-rose-500/20 text-rose-300'
                                            }`}>
                                                {alloc.statusAfter}
                                            </span>
                                        </div>
                                        <div className="font-mono text-right">
                                            <span className="font-black text-emerald-300">Dibayar: {formatCurrency(alloc.allocated)}</span>
                                            {alloc.remainingAfterPay > 0 && (
                                                <span className="text-[10px] text-slate-300 ml-2">(Sisa: {formatCurrency(alloc.remainingAfterPay)})</span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="payment-date" className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Tanggal Bayar</label>
                            <input
                                type="date"
                                id="payment-date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className="block w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
                                required
                            />
                        </div>
                        <div>
                            <label htmlFor="payment-method" className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Metode Bayar</label>
                            <select
                                id="payment-method"
                                value={paymentMethod}
                                onChange={(e) => setPaymentMethod(e.target.value as any)}
                                className="block w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
                            >
                                <option value="Transfer">Transfer</option>
                                <option value="Cash">Cash</option>
                            </select>
                        </div>
                    </div>
                    
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <label htmlFor="payment-amount" className="block text-[10px] font-black uppercase tracking-widest text-slate-500">
                                2. Jumlah Pembayaran Diterima (Rp)
                            </label>
                            {totalSelectedDebt > 0 && amount !== totalSelectedDebt && (
                                <button
                                    type="button"
                                    onClick={() => setAmount(totalSelectedDebt)}
                                    className="text-[10px] font-black text-indigo-600 hover:text-indigo-800 uppercase underline"
                                >
                                    Sesuaikan Total Pilihan ({formatCurrency(totalSelectedDebt)})
                                </button>
                            )}
                        </div>
                        <CurrencyInput
                            id="payment-amount"
                            value={amount === 0 ? '' : amount}
                            onChange={(val) => setAmount(Number(val))}
                            className="block w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black outline-none focus:ring-2 focus:ring-indigo-500/20"
                            placeholder="0"
                            required
                        />
                    </div>

                    {paymentMethod === 'Transfer' && (
                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Bukti Transfer (Opsional)</label>
                            <div className="flex justify-center px-6 pt-4 pb-4 border-2 border-slate-200 border-dashed rounded-xl bg-slate-50/50">
                                <div className="space-y-1 text-center">
                                    <div className="flex text-xs text-slate-600 justify-center">
                                        <label htmlFor="file-upload" className="relative cursor-pointer bg-white px-3 py-1 rounded-lg border border-slate-200 font-black text-indigo-600 hover:text-indigo-500">
                                            <span>Unggah Bukti</span>
                                            <input id="file-upload" name="file-upload" type="file" className="sr-only" accept="image/png, image/jpeg, image/gif" onChange={handleFileChange} />
                                        </label>
                                    </div>
                                    <p className="text-[10px] text-slate-400">PNG, JPG hingga 2MB</p>
                                    {fileName && <p className="text-xs text-emerald-600 mt-1 font-bold">{fileName}</p>}
                                </div>
                            </div>
                        </div>
                    )}
                    <div>
                        <label htmlFor="payment-notes" className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Catatan Tambahan (Opsional)</label>
                        <textarea
                            id="payment-notes"
                            rows={2}
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="block w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
                            placeholder="Contoh: Pelunasan via BCA / Cicilan..."
                        />
                    </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 mt-4">
                    <button type="button" onClick={onCancel} className="px-5 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-200 transition-all">
                        Batal
                    </button>
                    <button
                        type="submit"
                        disabled={selectedInvoiceIds.length === 0 || amount <= 0}
                        className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-emerald-100 transition-all active:scale-95"
                    >
                        Simpan Pembayaran ({selectedInvoiceIds.length} Invoice)
                    </button>
                </div>
            </form>
        </div>
    );
};

export default DebtPaymentForm;