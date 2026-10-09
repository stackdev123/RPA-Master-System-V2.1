import React, { useState, useMemo, useRef, useEffect } from 'react';
import download from 'downloadjs';
import html2canvas from 'html2canvas';
import { XIcon, PrintIcon, DownloadIcon, PlusIcon, TrashIcon, ChevronDownIcon } from './icons';
import type { MasterItem, Customer } from '../types';
import CurrencyInput from './CurrencyInput';

declare const window: any;

interface ManualInvoiceFormProps {
    customers: Customer[];
    masterItems: MasterItem[];
    onCancel: () => void;
}

const SearchableCustomerSelect = ({ options, value, onChange }: { options: string[], value: string, onChange: (val: string) => void }) => {
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

    const allOptions = useMemo(() => [...options, 'CASH'], [options]);
    const filteredOptions = useMemo(() => {
        return allOptions.filter(opt => opt.toLowerCase().includes(search.toLowerCase()));
    }, [allOptions, search]);

    return (
        <div className="relative w-full" ref={containerRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm uppercase outline-none hover:border-indigo-200 transition-all text-left h-[42px]"
            >
                <span className="truncate">{value || '-- PILIH CUSTOMER --'}</span>
                <ChevronDownIcon className={`h-4 w-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-100 shadow-2xl rounded-2xl z-[150] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                    <div className="p-2 border-b border-slate-50">
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Cari pelanggan..."
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none"
                            autoFocus
                        />
                    </div>
                    <div className="max-h-60 overflow-y-auto no-scrollbar py-1">
                        {filteredOptions.map((opt) => (
                            <button
                                key={opt}
                                type="button"
                                onClick={() => { onChange(opt); setIsOpen(false); setSearch(''); }}
                                className={`w-full text-left px-4 py-2.5 text-xs font-black uppercase transition-colors hover:bg-slate-50 ${value === opt ? 'text-indigo-600 bg-indigo-50/50' : 'text-slate-600'}`}
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

const ManualInvoiceForm: React.FC<ManualInvoiceFormProps> = ({ customers, masterItems, onCancel }) => {
    const [customer, setCustomer] = useState('');
    const [address, setAddress] = useState('');
    const [invNumber, setInvNumber] = useState(`INV/MANUAL/${Date.now().toString().slice(-6)}`);
    const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
    const [items, setItems] = useState<{ name: string; quantity: string; price: string }[]>([{ name: '', quantity: '', price: '' }]);
    const [previousDebt, setPreviousDebt] = useState('0');
    const [paid, setPaid] = useState('0');
    const [isPreview, setIsPreview] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);

    // State Biaya Lain (PPN, Biaya Pengiriman, Biaya Lainnya / DLL)
    const [usePpn, setUsePpn] = useState(false);
    const [ppnRate, setPpnRate] = useState('11');
    const [useShipping, setUseShipping] = useState(false);
    const [shippingCost, setShippingCost] = useState('0');
    const [useOtherCost, setUseOtherCost] = useState(false);
    const [otherCostLabel, setOtherCostLabel] = useState('Biaya Lainnya');
    const [otherCostAmount, setOtherCostAmount] = useState('0');

    const handleAddItem = () => setItems([...items, { name: '', quantity: '', price: '' }]);
    const handleRemoveItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));
    const handleUpdateItem = (idx: number, field: string, val: string) => {
        const next = [...items];
        (next[idx] as any)[field] = val;
        setItems(next);
    };

    const handleCustomerChange = (name: string) => {
        setCustomer(name);
        const found = customers.find(c => c.name === name);
        if (found) {
            setAddress(found.address);
        } else if (name === 'CASH') {
            setAddress('');
        }
    };

    const subtotal = useMemo(() => {
        return items.reduce((sum, it) => sum + (parseFloat(it.quantity) || 0) * (parseFloat(it.price) || 0), 0);
    }, [items]);

    const ppnAmount = useMemo(() => {
        if (!usePpn) return 0;
        const rate = parseFloat(ppnRate) || 0;
        return Math.round(subtotal * (rate / 100));
    }, [usePpn, ppnRate, subtotal]);

    const activeExtraCosts = useMemo(() => {
        const list: { label: string; amount: number }[] = [];
        if (usePpn && ppnAmount > 0) {
            list.push({ label: `PPN (${parseFloat(ppnRate) || 0}%)`, amount: ppnAmount });
        }
        if (useShipping && (parseFloat(shippingCost) || 0) > 0) {
            list.push({ label: 'Biaya Pengiriman', amount: parseFloat(shippingCost) || 0 });
        }
        if (useOtherCost && (parseFloat(otherCostAmount) || 0) > 0) {
            list.push({ label: (otherCostLabel || 'Biaya Lainnya').trim(), amount: parseFloat(otherCostAmount) || 0 });
        }
        return list;
    }, [usePpn, ppnRate, ppnAmount, useShipping, shippingCost, useOtherCost, otherCostLabel, otherCostAmount]);

    const totalExtraCosts = useMemo(() => activeExtraCosts.reduce((s, c) => s + c.amount, 0), [activeExtraCosts]);

    const totalBill = subtotal + totalExtraCosts;
    const sisaPiutang = totalBill - (parseFloat(paid) || 0);

    const generateCanvas = async (elementId: string) => {
        const printArea = document.getElementById(elementId);
        if (!printArea) return null;

        try {
            return await html2canvas(printArea, {
                scale: 4, // resolusi tinggi
                backgroundColor: "#ffffff",
                useCORS: true,
                width: printArea.offsetWidth,
                height: printArea.offsetHeight,
                windowWidth: printArea.offsetWidth,
                windowHeight: printArea.offsetHeight,
                scrollX: 0,
                scrollY: 0,
                onclone: (doc) => {
                    const el = doc.getElementById(elementId);
                    if (el) {
                        el.style.transform = "none";
                    }
                }
            });
        } catch (error) {
            console.error("Error in generateCanvas:", error);
            throw error;
        }
    };

    const handleDownload = async () => {
        setIsDownloading(true);
        const printArea = document.getElementById('print-area-inv-manual');
        if (printArea) {
            printArea.classList.remove('scale-[0.6]', 'sm:scale-100');
            printArea.style.transform = 'none';
        }
        try {
            await document.fonts.ready;
            const canvas = await generateCanvas('print-area-inv-manual');
            if (!canvas) return;
            
            const imgData = canvas.toDataURL('image/jpeg', 0.85);
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF({ 
                orientation: 'portrait', 
                unit: 'mm', 
                format: 'a4', 
                compress: true 
            });
            pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
            const pdfBlob = pdf.output('blob');
            download(pdfBlob, `INV-MANUAL-${invNumber.replace(/\//g, '-')}.pdf`, "application/pdf");
        } catch (e) { alert("Gagal download PDF"); } finally { 
            if (printArea) {
                printArea.classList.add('scale-[0.6]', 'sm:scale-100');
                printArea.style.transform = '';
            }
            setIsDownloading(false); 
        }
    };

    const handleDownloadJPG = async () => {
        setIsDownloading(true);
        const printArea = document.getElementById('print-area-inv-manual');
        if (printArea) {
            printArea.classList.remove('scale-[0.6]', 'sm:scale-100');
            printArea.style.transform = 'none';
        }
        try {
            await document.fonts.ready;
            const canvas = await generateCanvas('print-area-inv-manual');
            if (!canvas) return;
            
            const imgData = canvas.toDataURL('image/jpeg', 0.95);
            download(imgData, `INV-MANUAL-${invNumber.replace(/\//g, '-')}.jpg`, "image/jpeg");
        } catch (error) { alert("Gagal mengunduh JPG."); } finally { 
            if (printArea) {
                printArea.classList.add('scale-[0.6]', 'sm:scale-100');
                printArea.style.transform = '';
            }
            setIsDownloading(false); 
        }
    };

    if (isPreview) {
        return (
            <div className="fixed inset-0 bg-slate-900/90 z-[1000] flex flex-col items-center justify-start overflow-y-auto p-4 md:p-10 print:static print:block print:bg-white print:p-0 print:overflow-visible">
                <div className="bg-white p-4 rounded-3xl shadow-2xl relative print:p-0 print:shadow-none print:static print:overflow-visible">
                    <div id="print-area-inv-manual" className="bg-white p-12 text-slate-900 w-[210mm] min-h-[297mm] flex flex-col origin-top-left sm:origin-center scale-[0.6] sm:scale-100 print:scale-100 print:transform-none print:overflow-visible" style={{ boxSizing: 'border-box' }}>
                         <header className="flex flex-row justify-between items-start pb-4 mb-6 border-b-2 border-slate-900" style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid black', paddingBottom: '16px', marginBottom: '24px' }}>
                            <div className="flex items-center gap-5" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                                <img src="/logo trial.png" alt="Logo" style={{ height: '70px', width: 'auto' }} />
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <h2 style={{ fontSize: '22px', fontWeight: '900', margin: 0, textTransform: 'uppercase', lineHeight: '1.2' }}>PT Mitra Karya Foodindo</h2>
                                    <p style={{ fontSize: '10px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase', marginTop: '6px', lineHeight: '1.4' }}>
                                        Kp. Pangkalan No. 436, Desa Pangkalan, Kec. Bojong<br/>
                                        Kab. Purwakarta, Jawa Barat 41164
                                    </p>
                                </div>
                            </div>
                            <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'flex-start' }}>
                                <h1 style={{ fontSize: '36px', fontWeight: '900', margin: 0, textTransform: 'uppercase', lineHeight: '1.2' }}>Invoice</h1>
                                <p style={{ fontSize: '12px', fontWeight: 'bold', color: '#94a3b8', margin: '4px 0 0 0' }}>NO: <span style={{ color: 'black' }}>{invNumber}</span></p>
                                <p style={{ fontSize: '12px', fontWeight: 'bold', color: '#94a3b8', margin: '2px 0 0 0' }}>TGL: <span style={{ color: 'black' }}>{new Date(date).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}</span></p>
                            </div>
                        </header>
                        <section style={{ marginBottom: '24px' }}>
                             <p style={{ fontSize: '10px', fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '2px' }}>Tagihan Kepada:</p>
                             <p style={{ fontSize: '18px', fontWeight: '900', margin: 0, textTransform: 'uppercase', lineHeight: '1.2' }}>{customer || 'CASH'}</p>
                             <p style={{ fontSize: '12px', color: '#64748b', fontWeight: '500', marginTop: '4px', lineHeight: '1.4', display: 'none' }}>{address || '-'}</p>
                        </section>
                        <section style={{ flexGrow: 1 }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                                <thead>
                                    <tr style={{ backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0' }}>
                                        <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: '900', color: '#64748b', textTransform: 'uppercase', fontSize: '10px' }}>Nama Barang</th>
                                        <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '900', color: '#64748b', textTransform: 'uppercase', fontSize: '10px' }}>Berat (Kg)</th>
                                        <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '900', color: '#64748b', textTransform: 'uppercase', fontSize: '10px' }}>Harga/Kg</th>
                                        <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '900', color: '#64748b', textTransform: 'uppercase', fontSize: '10px' }}>Subtotal</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.filter(it => it.name).map((item, idx) => (
                                        <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                            <td style={{ padding: '16px 12px', fontWeight: 'bold', color: '#1e293b', textTransform: 'uppercase' }}>{item.name}</td>
                                            <td style={{ padding: '16px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold' }}>{(parseFloat(item.quantity) || 0).toLocaleString('id-ID', { minimumFractionDigits: 1 })}</td>
                                            <td style={{ padding: '16px 12px', textAlign: 'right', fontFamily: 'monospace' }}>Rp {(parseFloat(item.price) || 0).toLocaleString('id-ID')}</td>
                                            <td style={{ padding: '16px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: '900', color: '#0f172a' }}>Rp {((parseFloat(item.quantity) || 0) * (parseFloat(item.price) || 0)).toLocaleString('id-ID')}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </section>
                        <footer style={{ marginTop: '32px', paddingTop: '20px', borderTop: '2px solid #f1f5f9' }}>
                            <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: '32px' }}>
                                <div style={{ flexGrow: 1 }}>
                                    <div>
                                        <h4 style={{ fontSize: '10px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '1px', borderBottom: '1px solid black', display: 'inline-block', paddingBottom: '4px', marginBottom: '12px' }}>Instruksi Pembayaran</h4>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <div style={{ width: '36px', height: '36px', backgroundColor: '#f8fafc', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #f1f5f9' }}>
                                                    <span style={{ fontSize: '9px', fontWeight: '900', color: '#2563eb', padding: '0 4px' }}>BCA</span>
                                                </div>
                                                <div style={{ lineHeight: '1.2' }}>
                                                    <p style={{ fontSize: '11px', fontWeight: '900', margin: 0 }}>7410888879</p>
                                                    <p style={{ fontSize: '9px', fontWeight: 'bold', color: '#94a3b8', textTransform: 'uppercase', margin: 0 }}>a/n Panji Pranantias Mulyono</p>
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <div style={{ width: '36px', height: '36px', backgroundColor: '#f8fafc', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #f1f5f9' }}>
                                                    <span style={{ fontSize: '9px', fontWeight: '900', color: '#ea580c', padding: '0 4px' }}>BRI</span>
                                                </div>
                                                <div style={{ lineHeight: '1.2' }}>
                                                    <p style={{ fontSize: '11px', fontWeight: '900', margin: 0 }}>007501001986565</p>
                                                    <p style={{ fontSize: '9px', fontWeight: 'bold', color: '#94a3b8', textTransform: 'uppercase', margin: 0 }}>a/n Panji Pranantias Mulyono</p>
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <div style={{ width: '36px', height: '36px', backgroundColor: '#f8fafc', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #f1f5f9' }}>
                                                    <span style={{ fontSize: '9px', fontWeight: '900', color: '#0284c7', padding: '0 4px' }}>Mandiri</span>
                                                </div>
                                                <div style={{ lineHeight: '1.2' }}>
                                                    <p style={{ fontSize: '11px', fontWeight: '900', margin: 0 }}>1730081188881</p>
                                                    <p style={{ fontSize: '9px', fontWeight: 'bold', color: '#94a3b8', textTransform: 'uppercase', margin: 0 }}>a/n Panji Pranantias Mulyono</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div style={{ width: '320px', display: 'flex', flexDirection: 'column' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontWeight: 'bold' }}><span>Subtotal:</span><span style={{ fontFamily: 'monospace' }}>Rp {subtotal.toLocaleString('id-ID')}</span></div>
                                        {activeExtraCosts.map((c, idx) => (
                                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', color: '#475569', fontWeight: 'bold' }}>
                                                <span>{c.label}:</span>
                                                <span style={{ fontFamily: 'monospace' }}>Rp {c.amount.toLocaleString('id-ID')}</span>
                                            </div>
                                        ))}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#0f172a', fontWeight: '900', borderTop: '1px solid #e2e8f0', paddingTop: '6px', fontSize: '16px' }}><span>Total:</span><span style={{ fontFamily: 'monospace' }}>Rp {totalBill.toLocaleString('id-ID')}</span></div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#059669', fontWeight: 'bold', padding: '2px 0' }}><span style={{ fontSize: '10px', textTransform: 'uppercase' }}>Dibayar:</span><span style={{ fontFamily: 'monospace' }}>-Rp {(parseFloat(paid) || 0).toLocaleString('id-ID')}</span></div>
                                        <div style={{ backgroundColor: '#0f172a', color: 'white', padding: '12px 16px 11px 16px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                                            <div style={{ fontSize: '10px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '1px', lineHeight: '1.6' }}>Sisa Yang Harus<br/>Dibayar:</div>
                                            <div style={{ textAlign: 'right' }}>
                                                <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>Rp</div>
                                                <div style={{ fontSize: '22px', fontWeight: '900', fontFamily: 'monospace', lineHeight: '1' }}>{sisaPiutang.toLocaleString('id-ID')}</div>
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ marginTop: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                                        <p style={{ fontSize: '12px', fontWeight: 'bold', margin: '-5px 0 0 0', paddingBottom: '27px', paddingRight: '0px', lineHeight: '1.4' }}>Hormat Kami,<br/>Purwakarta, ............................</p>
                                        <div style={{ marginTop: '60px', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                            <p style={{ fontSize: '12px', fontWeight: 'bold', margin: 0, lineHeight: 1 }}>(..................................)</p>
                                            <p style={{ fontSize: '12px', fontWeight: '900', margin: '4px 0 0 0', textTransform: 'uppercase' }}>CV. DPJ Berkah Unggas</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </footer>
                    </div>
                </div>
                <div className="flex flex-wrap justify-center gap-4 mt-10 pb-10 print:hidden">
                    <button onClick={() => setIsPreview(false)} className="w-[190px] justify-center px-8 py-3 bg-white text-slate-900 rounded-xl font-black text-xs uppercase tracking-widest shadow-md">Back to Edit</button>
                    <button onClick={() => window.print()} className="w-[190px] justify-center px-8 py-3 bg-slate-900 text-white rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2 shadow-lg"><PrintIcon /> Print</button>
                    <button onClick={handleDownload} disabled={isDownloading} className="w-[190px] justify-center px-8 py-3 bg-indigo-600 text-white rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2 shadow-lg"><DownloadIcon /> PDF</button>
                    <button onClick={handleDownloadJPG} disabled={isDownloading} className="w-[190px] justify-center px-8 py-3 bg-sky-600 text-white rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2 shadow-lg"><DownloadIcon /> {isDownloading ? '...' : 'JPG'}</button>
                    <button onClick={onCancel} className="w-[190px] justify-center px-8 py-3 bg-red-600 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg">Tutup</button>
                </div>
                <style>{`
                    @media print {
                        @page { size: A4 portrait; margin: 0; }
                        body * { visibility: hidden; }
                        #print-area-inv-manual, #print-area-inv-manual * { visibility: visible; }
                        #print-area-inv-manual { width: 100%; transform: none !important; margin: 0 !important; }
                    }
                `}</style>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-slate-900/70 z-[500] flex justify-center items-center p-4">
             <div className="bg-white w-full max-w-3xl rounded-[2.5rem] shadow-2xl flex flex-col max-h-[95vh] overflow-hidden border border-slate-200">
                <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                    <div>
                        <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Invoice Manual Quick Print</h2>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest italic">Data tidak tersimpan di database</p>
                    </div>
                    <button onClick={onCancel} className="p-2 hover:bg-white rounded-full transition-colors"><XIcon /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-8 space-y-6 no-scrollbar">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Customer</label>
                            <SearchableCustomerSelect 
                                options={customers.map(c => c.name)}
                                value={customer}
                                onChange={handleCustomerChange}
                            />
                        </div>
                        <div>
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Nomor Inv</label>
                            <input type="text" value={invNumber} onChange={e => setInvNumber(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2" />
                        </div>
                        <div className="col-span-2">
                             <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Alamat</label>
                             <input type="text" value={address} onChange={e => setAddress(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm uppercase outline-none focus:ring-2" placeholder="PURWAKARTA" />
                        </div>
                        <div className="col-span-2">
                             <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Tanggal</label>
                             <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2" />
                        </div>
                    </div>
                    <div className="space-y-3">
                         <div className="flex justify-between items-center border-b border-slate-50 pb-2">
                            <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Item Tagihan (Max 20)</h3>
                            <button onClick={handleAddItem} disabled={items.length >= 20} className="text-[9px] font-black text-indigo-600 uppercase">+ Tambah</button>
                        </div>
                        {items.map((item, idx) => (
                            <div key={idx} className="grid grid-cols-12 gap-2 bg-slate-50/50 p-2 rounded-xl border border-slate-100">
                                <div className="col-span-6">
                                     <input list="manual-parts" value={item.name} onChange={e => handleUpdateItem(idx, 'name', e.target.value.toUpperCase())} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-black uppercase outline-none" placeholder="ITEM NAME" />
                                </div>
                                <div className="col-span-2">
                                     <input type="number" value={item.quantity} onChange={e => handleUpdateItem(idx, 'quantity', e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-black text-right outline-none" placeholder="KG" />
                                </div>
                                <div className="col-span-3">
                                     <CurrencyInput value={item.price} onChange={val => handleUpdateItem(idx, 'price', val.toString())} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-black text-right outline-none" placeholder="HARGA" />
                                </div>
                                <div className="col-span-1 flex items-center justify-center">
                                    <button onClick={() => handleRemoveItem(idx)} className="text-slate-300 hover:text-red-500"><TrashIcon className="h-4 w-4"/></button>
                                </div>
                            </div>
                        ))}
                    </div>
                    {/* Biaya Lain / Tambahan (Opsional) */}
                    <div className="space-y-3 bg-slate-50/70 p-4 rounded-2xl border border-slate-100">
                        <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">
                            Biaya Lain / Tambahan <span className="text-slate-400 font-bold normal-case">(Opsional — Centang jika digunakan)</span>
                        </h3>
                        <div className="space-y-2">
                            <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-2.5 rounded-xl border border-slate-200/70">
                                <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                                    <input type="checkbox" checked={usePpn} onChange={e => setUsePpn(e.target.checked)} className="w-4 h-4 accent-indigo-600 rounded" />
                                    <span className="text-xs font-black text-slate-800 uppercase">PPN (%)</span>
                                </label>
                                {usePpn && (
                                    <div className="flex items-center gap-3">
                                        <div className="relative w-24">
                                            <input type="number" step="0.1" value={ppnRate} onChange={e => setPpnRate(e.target.value)} className="w-full pl-3 pr-6 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-black text-right outline-none" />
                                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400">%</span>
                                        </div>
                                        <span className="text-xs font-black font-mono text-indigo-700 min-w-[90px] text-right">Rp {ppnAmount.toLocaleString('id-ID')}</span>
                                    </div>
                                )}
                            </div>
                            <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-2.5 rounded-xl border border-slate-200/70">
                                <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                                    <input type="checkbox" checked={useShipping} onChange={e => setUseShipping(e.target.checked)} className="w-4 h-4 accent-indigo-600 rounded" />
                                    <span className="text-xs font-black text-slate-800 uppercase">Biaya Pengiriman</span>
                                </label>
                                {useShipping && (
                                    <div className="w-48">
                                        <CurrencyInput value={shippingCost} onChange={val => setShippingCost(val.toString())} className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-black text-right outline-none" placeholder="Nominal (Rp)" />
                                    </div>
                                )}
                            </div>
                            <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-2.5 rounded-xl border border-slate-200/70">
                                <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                                    <input type="checkbox" checked={useOtherCost} onChange={e => setUseOtherCost(e.target.checked)} className="w-4 h-4 accent-indigo-600 rounded" />
                                    <span className="text-xs font-black text-slate-800 uppercase">Biaya Lainnya (DLL)</span>
                                </label>
                                {useOtherCost && (
                                    <div className="flex items-center gap-2 flex-1 sm:justify-end">
                                        <input type="text" value={otherCostLabel} onChange={e => setOtherCostLabel(e.target.value)} className="w-40 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold uppercase outline-none" placeholder="Nama Biaya" />
                                        <div className="w-40">
                                            <CurrencyInput value={otherCostAmount} onChange={val => setOtherCostAmount(val.toString())} className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-black text-right outline-none" placeholder="Nominal (Rp)" />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="border-t pt-4">
                        <div>
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Nominal Dibayar (Rp)</label>
                            <CurrencyInput value={paid} onChange={val => setPaid(val.toString())} className="w-full px-4 py-2.5 bg-emerald-50/50 border border-emerald-100 rounded-xl font-bold text-sm outline-none" />
                        </div>
                    </div>
                    <div className="bg-slate-900 p-6 rounded-2xl text-white">
                         <div className="flex justify-between mb-1 opacity-60 text-[10px] font-black uppercase"><span>Subtotal:</span><span>Rp {subtotal.toLocaleString('id-ID')}</span></div>
                         {activeExtraCosts.map((c, idx) => (
                             <div key={idx} className="flex justify-between mb-1 text-indigo-300 text-[10px] font-black uppercase"><span>+ {c.label}:</span><span>Rp {c.amount.toLocaleString('id-ID')}</span></div>
                         ))}
                         <div className="flex justify-between items-end border-t border-white/10 pt-2 mt-1"><span className="text-[10px] font-black uppercase">Total Tagihan:</span><span className="text-xl font-black text-yellow-400">Rp {totalBill.toLocaleString('id-ID')}</span></div>
                    </div>
                </div>
                <div className="p-6 border-t border-slate-100 flex justify-end gap-3 bg-white">
                    <button onClick={onCancel} className="px-6 py-3 bg-slate-100 text-slate-500 rounded-xl font-black text-[10px] uppercase tracking-widest">Batal</button>
                    <button onClick={() => setIsPreview(true)} className="px-10 py-3 bg-purple-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl transition-all active:scale-95">Generate Preview</button>
                </div>
                <datalist id="manual-parts">{masterItems.map(m => <option key={m.name} value={m.name} />)}</datalist>
             </div>
        </div>
    );
};

export default ManualInvoiceForm;