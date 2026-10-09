
import React, { useState } from 'react';
import download from 'downloadjs';
import html2canvas from 'html2canvas';
import type { LedgerEntry, Customer } from '../types';
import { PrintIcon, DownloadIcon, XIcon } from './icons';

declare const jspdf: any;

interface PaymentReceiptProps {
    payment: LedgerEntry;
    customer: Customer;
    onClose: () => void;
}

const formatCurrency = (value: number) => {
    if (typeof value !== 'number') return '-';
    return `Rp ${new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0 }).format(value)}`;
};

const PaymentReceipt: React.FC<PaymentReceiptProps> = ({ payment, customer, onClose }) => {
    const [isDownloading, setIsDownloading] = useState(false);

    const handlePrint = () => { window.print(); };

    const handleDownload = async () => {
        const printArea = document.getElementById('receipt-print-area');
        if (!printArea) return;
        setIsDownloading(true);
        try {
            const canvas = await html2canvas(printArea, { 
                scale: 4, 
                backgroundColor: "#ffffff",
                useCORS: true,
                width: printArea.offsetWidth,
                height: printArea.offsetHeight,
                windowWidth: printArea.offsetWidth,
                windowHeight: printArea.offsetHeight,
                scrollX: 0,
                scrollY: 0,
                onclone: (clonedDoc) => {
                    const images = clonedDoc.getElementsByTagName('img');
                    for (let i = 0; i < images.length; i++) {
                        images[i].style.display = 'inline-block';
                    }
                }
            });
            const imgData = canvas.toDataURL('image/jpeg', 0.75);
            const { jsPDF } = jspdf;
            const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a5', compress: true });
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const imgProps = pdf.getImageProperties(imgData);
            const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;
            pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, imgHeight, undefined, 'FAST');
            const pdfBlob = pdf.output('blob');
            download(pdfBlob, `TandaTerima-${customer.name}-${payment.id}.pdf`, "application/pdf");
        } catch (error) {
            console.error("Error generating PDF", error);
        } finally {
            setIsDownloading(false);
        }
    };
    return (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75 overflow-y-auto h-full w-full z-50 flex justify-center items-center p-4 print:bg-white print:block">
            <div className="relative bg-white p-4 rounded-lg shadow-xl w-full max-w-4xl flex flex-col print:shadow-none print:rounded-none print:p-0 print:max-w-full">
                <div id="receipt-print-area" className="bg-white p-6 font-sans text-black flex flex-col" style={{ width: '210mm', minHeight: '148mm', margin: 'auto' }}>
                    <header className="text-center mb-6 border-b pb-4">
                        <h1 className="text-2xl font-bold text-gray-800">TANDA TERIMA PEMBAYARAN</h1>
                        <p className="text-sm text-gray-600">PT Mitra Karya Foodindo</p>
                    </header>
                    
                    <div className="flex justify-between items-start text-sm mb-6">
                        <section className="space-y-2 w-1/2">
                            <div className="flex justify-between pr-4">
                                <span className="font-semibold text-gray-700">Tanggal:</span>
                                <span>{new Date(payment.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
                            </div>
                            <div className="flex justify-between pr-4">
                                <span className="font-semibold text-gray-700">No. Referensi:</span>
                                <span>{payment.id}</span>
                            </div>
                             <div className="flex justify-between pr-4">
                                <span className="font-semibold text-gray-700">Metode Pembayaran:</span>
                                <span>{payment.paymentMethod}</span>
                            </div>
                        </section>
                        
                         <section className="w-1/2 border-l pl-4">
                            <p className="text-sm text-gray-600">Diterima dari:</p>
                            <p className="text-base font-bold text-gray-800">{customer.name}</p>
                            <p className="text-xs text-gray-600">{customer.address}</p>
                        </section>
                    </div>


                    <section className="mb-6 flex-grow">
                        <table className="w-full text-sm">
                             <thead className="bg-gray-50 border-y">
                                <tr>
                                    <th className="py-2 px-4 text-left font-semibold">Keterangan</th>
                                    <th className="py-2 px-4 text-right font-semibold">Jumlah</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr className="border-b">
                                    <td className="py-2 px-4 text-gray-600">{payment.description}</td>
                                    <td className="py-2 px-4 text-right font-semibold">{formatCurrency(payment.credit)}</td>
                                </tr>
                                <tr>
                                    <td className="py-2 px-4 text-gray-600">Sisa Hutang Sebelumnya</td>
                                    <td className="py-2 px-4 text-right">{formatCurrency(payment.balance + payment.credit)}</td>
                                </tr>
                                 <tr>
                                    <td className="py-2 px-4 text-gray-800 font-bold">Sisa Hutang Baru</td>
                                    <td className="py-2 px-4 text-right font-bold text-red-600">{formatCurrency(payment.balance)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </section>
                    
                    {payment.paymentMethod === 'Transfer' && payment.paymentProof && (
                        <section className="mb-4">
                            <h3 className="text-sm font-semibold text-gray-700 mb-2">Bukti Transfer:</h3>
                            <div className="border p-2 rounded-md max-w-xs">
                                <img src={payment.paymentProof} alt="Bukti Transfer" className="max-w-full h-auto rounded"/>
                            </div>
                        </section>
                    )}

                     <footer className="mt-auto pt-8 flex justify-end text-center text-xs text-gray-500">
                        <div className="w-1/4">
                            <p>Penerima,</p>
                            <div className="border-t mt-16 pt-2">(____________________)</div>
                        </div>
                    </footer>

                </div>
                 <div className="flex flex-wrap justify-center gap-3 mt-4 pt-4 border-t print:hidden">
                    <button onClick={handlePrint} className="w-[190px] justify-center flex items-center bg-blue-500 text-white font-bold py-2 px-4 rounded-md hover:bg-blue-600"><PrintIcon /><span className="ml-2">Print</span></button>
                    <button onClick={handleDownload} disabled={isDownloading} className="w-[190px] justify-center flex items-center bg-gray-700 text-white font-bold py-2 px-4 rounded-md hover:bg-gray-800 disabled:bg-gray-400"><DownloadIcon /><span className="ml-2">{isDownloading ? 'Mengunduh...' : 'Download'}</span></button>
                    <button onClick={onClose} className="p-2 text-gray-500 hover:text-gray-800 ml-4"><XIcon /></button>
                </div>
            </div>
             <style>{`
                @media print {
                    @page { size: A5 landscape; margin: 0; }
                    body { -webkit-print-color-adjust: exact; }
                    body * { visibility: hidden; } 
                    .fixed { position: static; }
                    #receipt-print-area, #receipt-print-area * { visibility: visible; } 
                    #receipt-print-area { position: absolute; left: 0; top: 0; width: 100%; height: auto; padding: 0; margin: 0; }
                }
            `}</style>
        </div>
    );
};

export default PaymentReceipt;
