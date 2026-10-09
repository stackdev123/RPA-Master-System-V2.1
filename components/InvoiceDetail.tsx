import React, { useState } from 'react';
import download from 'downloadjs';
import html2canvas from 'html2canvas';
import type { Invoice } from '../types';
import { PrintIcon, DownloadIcon, XIcon } from './icons';

declare const window: any;

const formatCurrency = (value: number) => {
    if (typeof value !== 'number') return '-';
    return `Rp ${new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0 }).format(value)}`;
};

const InvoiceDetail: React.FC<InvoiceDetailProps> = ({ invoice, onClose, onEdit, liveDebt, salesOrderId }) => {
    const [isDownloading, setIsDownloading] = useState(false);

    const handlePrint = () => { window.print(); };

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
        const printArea = document.getElementById('invoice-print-area');
        if (printArea) {
            printArea.classList.remove('scale-[0.9]', 'sm:scale-100');
            printArea.style.transform = 'none';
        }
        try {
            await document.fonts.ready;
            const canvas = await generateCanvas('invoice-print-area');
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
            download(pdfBlob, `Invoice-${invoice.id.replace(/\//g, '-')}.pdf`, "application/pdf");
        } catch (error) {
            console.error("Error generating PDF", error);
            alert("Gagal mengunduh PDF.");
        } finally {
            if (printArea) {
                printArea.classList.add('scale-[0.9]', 'sm:scale-100');
                printArea.style.transform = '';
            }
            setIsDownloading(false);
        }
    };

    const handleDownloadJPG = async () => {
        setIsDownloading(true);
        const printArea = document.getElementById('invoice-print-area');
        if (printArea) {
            printArea.classList.remove('scale-[0.9]', 'sm:scale-100');
            printArea.style.transform = 'none';
        }
        try {
            await document.fonts.ready;
            const canvas = await generateCanvas('invoice-print-area');
            if (!canvas) return;
            
            const imgData = canvas.toDataURL('image/jpeg', 0.95);
            download(imgData, `Invoice-${invoice.id.replace(/\//g, '-')}.jpg`, "image/jpeg");
        } catch (error) {
            alert("Gagal mengunduh JPG.");
        } finally {
            if (printArea) {
                printArea.classList.add('scale-[0.9]', 'sm:scale-100');
                printArea.style.transform = '';
            }
            setIsDownloading(false);
        }
    };

    const pureItemsSubtotal = invoice.items && invoice.items.length > 0
        ? invoice.items.reduce((sum, it) => sum + (Number(it.total) || 0), 0)
        : (invoice.itemsSubtotal ?? invoice.subtotal);
    const extraCostsTotal = (invoice.extraCosts || []).reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
    const displayTotalAmount = pureItemsSubtotal + extraCostsTotal;
    const displayNewDebt = Math.max(0, displayTotalAmount - invoice.amountPaid);

    return (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md overflow-y-auto h-full w-full z-[200] flex justify-center items-start pt-4 md:pt-10 pb-4 md:pb-10 print:static print:bg-white print:block print:p-0 print:overflow-visible">
            <div className="relative bg-white p-2 md:p-4 rounded-3xl shadow-2xl flex flex-col w-[96%] md:w-auto print:static print:shadow-none print:rounded-none print:p-0 print:overflow-visible">
                
                <div className="overflow-x-auto no-scrollbar rounded-2xl md:rounded-none bg-slate-50 md:bg-white border md:border-none border-slate-200 print:overflow-visible">
                    <div id="invoice-print-area" className="bg-white p-8 md:p-12 font-sans text-slate-900 w-[210mm] min-h-[297mm] print:w-auto print:min-h-full print:p-10 mx-auto flex flex-col shrink-0 scale-[0.9] sm:scale-100 print:scale-100 print:transform-none print:overflow-visible origin-top-left sm:origin-center" style={{ boxSizing: 'border-box' }}>
                        
                        <header className="flex flex-row justify-between items-start pb-4 mb-6 border-b-2 border-slate-900" style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', borderBottom: '2px solid black', paddingBottom: '16px', marginBottom: '24px' }}>
                            <div className="flex items-center gap-5" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                                <img src="/logo trial.png" alt="Logo DPJ" style={{ height: '70px', width: 'auto' }} />
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
                                <p style={{ fontSize: '12px', fontWeight: 'bold', color: '#94a3b8', margin: '4px 0 0 0' }}>NO: <span style={{ color: 'black' }}>{invoice.id}</span></p>
                                <p style={{ fontSize: '12px', fontWeight: 'bold', color: '#94a3b8', margin: '2px 0 0 0' }}>TGL: <span style={{ color: 'black' }}>{new Date(invoice.date).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })}</span></p>
                                {salesOrderId && (
                                    <p style={{ fontSize: '12px', fontWeight: 'bold', color: '#94a3b8', margin: '2px 0 0 0' }}>NO. SO: <span style={{ color: '#0f766e', fontWeight: '900' }}>{salesOrderId}</span></p>
                                )}
                            </div>
                        </header>

                        <section style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                            <div>
                                <p style={{ fontSize: '10px', fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '2px' }}>Tagihan Kepada:</p>
                                <p style={{ fontSize: '18px', fontWeight: '900', margin: 0, textTransform: 'uppercase', lineHeight: '1.2' }}>{invoice.customer}</p>
                                {invoice.customerAddress && (
                                    <p style={{ fontSize: '11px', color: '#64748b', fontWeight: '500', marginTop: '2px', lineHeight: '1.4' }}>{invoice.customerAddress}</p>
                                )}
                            </div>
                            {invoice.deliveryOrderId && (
                                <div style={{ textAlign: 'right' }}>
                                    <p style={{ fontSize: '10px', fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>Surat Jalan (DO):</p>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'flex-end', maxWidth: '340px' }}>
                                        {invoice.deliveryOrderId.split(',').map((sj, i) => (
                                            <span key={i} style={{ fontSize: '11px', fontWeight: '900', backgroundColor: '#f1f5f9', color: '#0f172a', padding: '4px 10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                                                {sj.trim()}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </section>
                        
                        <section style={{ flexGrow: 1 }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                                <thead>
                                    <tr style={{ backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0' }}>
                                        <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: '900', color: '#64748b', textTransform: 'uppercase', fontSize: '10px', width: '50%' }}>Nama Barang</th>
                                        <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '900', color: '#64748b', textTransform: 'uppercase', fontSize: '10px' }}>Berat (Kg)</th>
                                        <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '900', color: '#64748b', textTransform: 'uppercase', fontSize: '10px' }}>Harga/Kg</th>
                                        <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '900', color: '#64748b', textTransform: 'uppercase', fontSize: '10px' }}>Subtotal</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {invoice.items.map((item, idx) => (
                                        <tr key={`${item.name}-${idx}`} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                            <td style={{ padding: '16px 12px', fontWeight: 'bold', color: '#1e293b', textTransform: 'uppercase' }}>{item.name}</td>
                                            <td style={{ padding: '16px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold' }}>{item.quantity.toLocaleString('id-ID', { minimumFractionDigits: 1 })}</td>
                                            <td style={{ padding: '16px 12px', textAlign: 'right', fontFamily: 'monospace' }}>{formatCurrency(item.price)}</td>
                                            <td style={{ padding: '16px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: '900', color: '#0f172a' }}>{formatCurrency(item.total)}</td>
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
                                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontWeight: 'bold' }}>
                                            <span>Subtotal:</span>
                                            <span style={{ fontFamily: 'monospace' }}>{formatCurrency(pureItemsSubtotal)}</span>
                                        </div>
                                        {invoice.extraCosts && invoice.extraCosts.map((cost, idx) => (
                                            <div key={cost.id || idx} style={{ display: 'flex', justifyContent: 'space-between', color: '#475569', fontWeight: 'bold' }}>
                                                <span>{cost.label}:</span>
                                                <span style={{ fontFamily: 'monospace' }}>{formatCurrency(cost.amount)}</span>
                                            </div>
                                        ))}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#0f172a', fontWeight: '900', borderTop: '1px solid #e2e8f0', paddingTop: '6px', fontSize: '16px' }}>
                                            <span>Total:</span>
                                            <span style={{ fontFamily: 'monospace' }}>{formatCurrency(displayTotalAmount)}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#059669', fontWeight: 'bold', padding: '2px 0' }}>
                                            <span style={{ fontSize: '10px', textTransform: 'uppercase' }}>Dibayar:</span>
                                            <span style={{ fontFamily: 'monospace' }}>-{formatCurrency(invoice.amountPaid)}</span>
                                        </div>
                                        <div style={{ backgroundColor: '#0f172a', color: 'white', padding: '12px 16px 11px 16px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                                            <div style={{ fontSize: '10px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '1px', lineHeight: '1.6' }}>
                                                Sisa Yang Harus<br/>Dibayar:
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>Rp</div>
                                                <div style={{ fontSize: '22px', fontWeight: '900', fontFamily: 'monospace', lineHeight: '1' }}>
                                                    {new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0 }).format(displayNewDebt)}
                                                </div>
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

                <div className="flex flex-col md:flex-row md:justify-end md:items-center mt-6 md:mt-8 pt-4 border-t print:hidden px-4 pb-6 gap-4">
                    <div className="flex flex-wrap justify-center gap-3">
                        {onEdit && (
                            <button onClick={() => onEdit(invoice)} className="w-[190px] flex-1 md:flex-none justify-center bg-orange-500 text-white font-black text-[10px] uppercase tracking-widest py-3.5 px-6 rounded-2xl hover:bg-orange-600 transition-all shadow-lg shadow-orange-100 active:scale-95">
                                Edit
                            </button>
                        )}
                        <button onClick={handlePrint} className="w-[190px] flex-1 md:flex-none flex items-center justify-center bg-slate-900 text-white font-black text-[10px] uppercase tracking-widest py-3.5 px-6 rounded-2xl hover:bg-slate-800 transition-all shadow-lg shadow-slate-100 active:scale-95">
                            <PrintIcon className="h-4 w-4 mr-2" /><span>Print</span>
                        </button>
                        <button onClick={handleDownload} disabled={isDownloading} className="w-[190px] flex-1 md:flex-none flex items-center justify-center bg-indigo-600 text-white font-black text-[10px] uppercase tracking-widest py-3.5 px-6 rounded-2xl hover:bg-indigo-700 disabled:bg-slate-300 transition-all shadow-lg shadow-indigo-100 active:scale-95">
                            <DownloadIcon className="h-4 w-4 mr-2" /><span>{isDownloading ? '...' : 'PDF'}</span>
                        </button>
                        <button onClick={handleDownloadJPG} disabled={isDownloading} className="w-[190px] flex-1 md:flex-none flex items-center justify-center bg-sky-600 text-white font-black text-[10px] uppercase tracking-widest py-3.5 px-6 rounded-2xl hover:bg-sky-700 transition-all disabled:bg-slate-300 transition-all shadow-lg shadow-indigo-100 active:scale-95">
                            <DownloadIcon className="h-4 w-4 mr-2" /><span>{isDownloading ? '...' : 'JPG'}</span>
                        </button>
                        <button onClick={onClose} className="md:hidden w-[190px] flex-1 flex items-center justify-center bg-slate-200 text-slate-700 font-black text-[10px] uppercase tracking-widest py-3.5 px-6 rounded-2xl hover:bg-slate-300 transition-all active:scale-95">
                            Tutup
                        </button>
                    </div>
                    <button onClick={onClose} className="hidden md:block p-3 text-slate-300 hover:text-slate-900 ml-4"><XIcon /></button>
                </div>
            </div>
        </div>
    );
};

interface InvoiceDetailProps {
    invoice: Invoice;
    onClose: () => void;
    onEdit?: (invoice: Invoice) => void;
    liveDebt?: number;
    salesOrderId?: string;
}

export default InvoiceDetail;