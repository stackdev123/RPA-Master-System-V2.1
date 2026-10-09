import React, { useState, useMemo, useRef, useEffect } from 'react';
import download from 'downloadjs';
import html2canvas from 'html2canvas';
import { XIcon, PrintIcon, DownloadIcon, PlusIcon, TrashIcon, ChevronDownIcon } from './icons';
import type { MasterItem, Customer } from '../types';

declare const window: any;

interface ManualSJFormProps {
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
                                className={`w-full text-left px-4 py-2 text-xs font-black uppercase transition-colors hover:bg-slate-50 ${value === opt ? 'text-indigo-600 bg-indigo-50/50' : 'text-slate-600'}`}
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

const ManualSJForm: React.FC<ManualSJFormProps> = ({ customers, masterItems, onCancel }) => {
    const [customer, setCustomer] = useState('');
    const [address, setAddress] = useState('');
    const [sjNumber, setSjNumber] = useState(`DO/MANUAL/${Date.now().toString().slice(-6)}`);
    const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
    const [items, setItems] = useState<{ name: string; quantity: string }[]>([{ name: '', quantity: '' }]);
    const [isPreview, setIsPreview] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [previewImages, setPreviewImages] = useState<{data: string, name: string}[] | null>(null);

    const handleAddRow = () => setItems([...items, { name: '', quantity: '' }]);
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

    const itemChunks = useMemo(() => {
        const chunks = [];
        const currentItems = items || [];
        const chunkSize = 10;
        
        if (currentItems.length === 0) {
            const emptyChunk = Array(chunkSize).fill(null);
            chunks.push(emptyChunk);
            return chunks;
        }

        for (let i = 0; i < currentItems.length; i += chunkSize) {
            const chunk = currentItems.slice(i, i + chunkSize);
            while (chunk.length < chunkSize) {
                chunk.push(null as any);
            }
            chunks.push(chunk);
        }
        return chunks;
    }, [items]);

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
        
        const scrollContainer = document.querySelector('.fixed.overflow-y-auto');
        const originalScrollTop = scrollContainer ? scrollContainer.scrollTop : 0;
        if (scrollContainer) scrollContainer.scrollTop = 0;

        const printPages = document.querySelectorAll('.print-page');
        printPages.forEach(page => {
            page.classList.remove('scale-[0.7]', 'sm:scale-100');
            (page as HTMLElement).style.transform = 'none';
        });
        
        try {
            await new Promise(resolve => setTimeout(resolve, 100));
            await document.fonts.ready;
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF({ 
                orientation: 'landscape', 
                unit: 'mm', 
                format: 'a5',
                compress: true 
            });
            
            for (let i = 0; i < itemChunks.length; i++) {
                const canvas = await generateCanvas(`print-page-manual-${i}`);
                if (!canvas) continue;
                
                const imgData = canvas.toDataURL('image/jpeg', 1.0);
                
                if (i > 0) {
                    pdf.addPage();
                }
                pdf.addImage(imgData, 'JPEG', 0, 0, 210, 148, undefined, 'FAST');
            }
            
            const pdfBlob = pdf.output('blob');
            download(pdfBlob, `SJ-MANUAL-${sjNumber.replace(/\//g, '-')}.pdf`, "application/pdf");
        } catch (e) { alert("Gagal download PDF"); } finally { 
            printPages.forEach(page => {
                page.classList.add('scale-[0.7]', 'sm:scale-100');
                (page as HTMLElement).style.transform = '';
            });
            if (scrollContainer) scrollContainer.scrollTop = originalScrollTop;
            setIsDownloading(false); 
        }
    };

    const handleDownloadJPG = async () => {
        setIsDownloading(true);
        
        const scrollContainer = document.querySelector('.fixed.overflow-y-auto');
        const originalScrollTop = scrollContainer ? scrollContainer.scrollTop : 0;
        if (scrollContainer) scrollContainer.scrollTop = 0;

        const printPages = document.querySelectorAll('.print-page');
        printPages.forEach(page => {
            page.classList.remove('scale-[0.7]', 'sm:scale-100');
            (page as HTMLElement).style.transform = 'none';
        });
        
        try {
            await new Promise(resolve => setTimeout(resolve, 100));
            await document.fonts.ready;
            const images = [];
            for (let i = 0; i < itemChunks.length; i++) {
                const canvas = await generateCanvas(`print-page-manual-${i}`);
                if (!canvas) continue;
                
                const imgData = canvas.toDataURL('image/jpeg', 0.98);
                const name = itemChunks.length > 1 
                    ? `SJ-MANUAL-${sjNumber.replace(/\//g, '-')}-hal-${i+1}.jpg`
                    : `SJ-MANUAL-${sjNumber.replace(/\//g, '-')}.jpg`;
                images.push({ data: imgData, name });
            }
            setPreviewImages(images);
        } catch (error) { alert("Gagal membuat preview JPG."); } finally { 
            printPages.forEach(page => {
                page.classList.add('scale-[0.7]', 'sm:scale-100');
                (page as HTMLElement).style.transform = '';
            });
            if (scrollContainer) scrollContainer.scrollTop = originalScrollTop;
            setIsDownloading(false); 
        }
    };

    const confirmDownloadJPG = async () => {
        if (!previewImages) return;
        for (let i = 0; i < previewImages.length; i++) {
            download(previewImages[i].data, previewImages[i].name, "image/jpeg");
            if (i < previewImages.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 300));
            }
        }
        setPreviewImages(null);
    };

    if (isPreview) {
        return (
            <div className="fixed inset-0 bg-slate-900/90 z-[1000] flex flex-col items-center justify-start overflow-y-auto p-4 md:p-10 print:static print:block print:bg-white print:p-0 print:overflow-visible">
                <div className="bg-white p-2 md:p-4 rounded-3xl shadow-2xl relative print:p-0 print:shadow-none print:bg-transparent print:static print:overflow-visible">
                    <div id="print-area-manual" className="flex flex-col gap-8 print:block print:gap-0 print:overflow-visible">
                        {itemChunks.map((chunk, pageIndex) => (
                            <div 
                                key={pageIndex}
                                id={`print-page-manual-${pageIndex}`} 
                                className="print-page bg-white text-black flex flex-col origin-top-left sm:origin-center scale-[0.7] sm:scale-100 print:scale-100 print:transform-none" 
                                style={{ width: '800px', height: '564px', padding: '38px 30px 30px 30px', boxSizing: 'border-box', fontFamily: 'sans-serif', fontWeight: '400' }}
                            >
                                {/* HEADER SECTION */}
                                <div className="flex justify-between items-end mb-1" style={{ marginBottom: '4px', paddingBottom: '3px' }}>
                                    <h1 style={{ fontSize: '32px', fontWeight: '900', lineHeight: '1.2', margin: '0', textTransform: 'uppercase', letterSpacing: '-1px' }}>SURAT JALAN</h1>
                                    <div className="flex items-center gap-6">
                                        <div style={{ fontSize: '10px', textAlign: 'right', fontWeight: '400', lineHeight: '1.2' }}>
                                            <p style={{ margin: 0 }}>Kp. Pangkalan No. 436, Desa Pangkalan</p>
                                            <p style={{ margin: 0 }}>Kec. Bojong, Kab. Purwakarta</p>
                                            <p style={{ margin: 0 }}>Jawa Barat 41164</p>
                                        </div>
                                        <img src="/logo trial.png" alt="Logo" style={{ height: '42px', width: 'auto' }} />
                                    </div>
                                </div>

                                <div style={{ borderTop: '2px solid black', marginBottom: '6px', width: '100%' }}></div>

                                {/* INFO SECTION */}
                                <div className="flex justify-between items-start mb-2 gap-4">
                                    <div style={{ border: '1px solid black', width: '48%', height: '58px', padding: '0px 10px', boxSizing: 'border-box' }}>
                                        <p style={{ fontSize: '11px', fontWeight: '400', margin: '0', color: '#000', paddingBottom: '0px' }}>Alamat kirim :</p>
                                        <p style={{ fontSize: '16px', fontWeight: '400', margin: '0', textTransform: 'uppercase', lineHeight: '1.1', paddingBottom: '0px' }}>{customer || 'CASH'}</p>
                                        <p style={{ fontSize: '10px', margin: '0', lineHeight: '1.2', paddingBottom: '0px' }}>{address || '-'}</p>
                                    </div>
                                    
                                    <table style={{ width: '48%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                                        <tbody>
                                            <tr style={{ height: '22px' }}>
                                                <td style={{ border: '1px solid black', textAlign: 'center', fontSize: '11px', fontWeight: '400', width: '50%', backgroundColor: 'transparent', paddingBottom: '0px', paddingRight: '1px', paddingTop: '0px' }}>Nomor SJ</td>
                                                <td style={{ border: '1px solid black', textAlign: 'center', fontSize: '11px', fontWeight: '400', width: '50%', backgroundColor: 'transparent', paddingBottom: '0px', paddingRight: '1px', paddingTop: '0px' }}>Tanggal</td>
                                            </tr>
                                            <tr style={{ height: '35px' }}>
                                                <td style={{ border: '1px solid black', textAlign: 'center', fontSize: '13px', fontWeight: '400', verticalAlign: 'middle' }}>{sjNumber}{itemChunks.length > 1 ? ` (Hal ${pageIndex + 1}/${itemChunks.length})` : ''}</td>
                                                <td style={{ border: '1px solid black', textAlign: 'center', fontSize: '13px', fontWeight: '400', verticalAlign: 'middle' }}>
                                                    {new Date(date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()}
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>

                                {/* MAIN ITEMS TABLE */}
                                <div style={{ border: '1px solid black', flexGrow: 1, overflow: 'hidden' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                        <thead>
                                            <tr style={{ height: '26px', borderBottom: '1px solid black', backgroundColor: 'transparent' }}>
                                                <th style={{ borderRight: '1px solid black', fontSize: '11px', fontWeight: '400', width: '40px', textAlign: 'center', paddingBottom: '2px' }}>No</th>
                                                <th style={{ borderRight: '1px solid black', fontSize: '11px', fontWeight: '400', textAlign: 'center', paddingLeft: '0px', width: '35%', paddingBottom: '2px', paddingTop: '0px' }}>Nama Barang</th>
                                                <th style={{ borderRight: '1px solid black', fontSize: '11px', fontWeight: '400', width: '85px', textAlign: 'center', paddingBottom: '2px' }}>Kirim Kg</th>
                                                <th style={{ borderRight: '1px solid black', fontSize: '11px', fontWeight: '400', width: '85px', textAlign: 'center', paddingBottom: '2px' }}>Terima Kg</th>
                                                <th style={{ borderRight: '1px solid black', fontSize: '11px', fontWeight: '400', width: '85px', textAlign: 'center', paddingBottom: '2px' }}>Tolak/Retur</th>
                                                <th style={{ fontSize: '11px', fontWeight: '400', width: '100px', textAlign: 'center', paddingBottom: '2px' }}>Keterangan</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {chunk.map((item, index) => {
                                                const globalIndex = pageIndex * 10 + index + 1;
                                                return (
                                                    <tr key={index} style={{ height: '26px' }}>
                                                        <td style={{ borderRight: '1px solid black', borderBottom: '1px solid #eee', textAlign: 'center', fontSize: '11px', fontWeight: '400', paddingLeft: '1px', paddingTop: '1px', paddingBottom: '2px' }}>{item ? globalIndex : ''}</td>
                                                        <td style={{ borderRight: '1px solid black', borderBottom: '1px solid #eee', fontSize: '11px', paddingLeft: '12px', textTransform: 'uppercase', fontWeight: '400', paddingBottom: '2px' }}>{item?.name || ''}</td>
                                                        <td style={{ borderRight: '1px solid black', borderBottom: '1px solid #eee', textAlign: 'center', fontSize: '12px', fontStyle: 'italic', fontWeight: '400', paddingBottom: '2px' }}>{item?.quantity || ''}</td>
                                                        <td style={{ borderRight: '1px solid black', borderBottom: '1px solid #eee', textAlign: 'center', fontSize: '12px', fontStyle: 'italic', fontWeight: '400', paddingBottom: '2px' }}></td>
                                                        <td style={{ borderRight: '1px solid black', borderBottom: '1px solid #eee', textAlign: 'center', fontSize: '12px', fontStyle: 'italic', fontWeight: '400', paddingBottom: '2px' }}></td>
                                                        <td style={{ borderBottom: '1px solid #eee', paddingBottom: '2px' }}></td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>

                                {/* SIGNATURE SECTION */}
                                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                                    <table style={{ width: '65%', borderCollapse: 'collapse', border: '1px solid black' }}>
                                        <thead>
                                            <tr style={{ height: '22px', fontSize: '11px', textAlign: 'center', backgroundColor: 'transparent' }}>
                                                <td style={{ borderRight: '1px solid black', width: '33%', fontWeight: '400' }}>Disiapkan Oleh</td>
                                                <td style={{ borderRight: '1px solid black', width: '33%', fontWeight: '400' }}>Dikirim Oleh</td>
                                                <td style={{ width: '33%', fontWeight: '400' }}>Diterima Oleh</td>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr style={{ height: '60px' }}>
                                                <td style={{ borderRight: '1px solid black', verticalAlign: 'top' }}></td>
                                                <td style={{ borderRight: '1px solid black', verticalAlign: 'top' }}></td>
                                                <td style={{ verticalAlign: 'top' }}></td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                
                <div className="flex flex-wrap justify-center gap-4 mt-10 pb-10 print:hidden">
                    <button onClick={() => setIsPreview(false)} className="w-[190px] justify-center px-8 py-3 bg-white text-slate-900 rounded-xl font-black text-xs uppercase tracking-widest shadow-md">Back to Edit</button>
                    <button onClick={() => window.print()} className="w-[190px] justify-center px-8 py-3 bg-slate-900 text-white rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2 shadow-lg"><PrintIcon /> Print</button>
                    <button onClick={handleDownload} disabled={isDownloading} className="w-[190px] justify-center px-8 py-3 bg-indigo-600 text-white rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2 shadow-lg"><DownloadIcon /> {isDownloading ? '...' : 'PDF'}</button>
                    <button onClick={handleDownloadJPG} disabled={isDownloading} className="w-[190px] justify-center px-8 py-3 bg-sky-600 text-white rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2 shadow-lg"><DownloadIcon /> {isDownloading ? '...' : 'JPG'}</button>
                    <button onClick={onCancel} className="w-[190px] justify-center px-8 py-3 bg-red-600 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg">Tutup</button>
                </div>

                <style>{`
                    @media print {
                        @page { 
                            size: A5 landscape; 
                            margin: 0; 
                        }
                        body { -webkit-print-color-adjust: exact !important; }
                        body * { visibility: hidden; }
                        #print-area-manual, #print-area-manual * { visibility: visible; }
                        #print-area-manual { 
                            width: 100% !important; 
                            margin: 0 !important; 
                        }
                        .print-page {
                            position: relative !important;
                            page-break-after: always;
                            width: 800px !important;
                            height: 564px !important;
                            margin: 0 !important;
                            padding: 38px 30px 30px 30px !important;
                            transform: none !important;
                        }
                        .print-page:last-child {
                            page-break-after: auto;
                        }
                    }
                `}</style>
                
                {previewImages && (
                    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[2000] flex flex-col items-center justify-center p-4 print:hidden">
                        <div className="bg-white rounded-3xl p-6 max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-xl font-black uppercase tracking-tighter text-slate-800">Preview JPG</h3>
                                <button onClick={() => setPreviewImages(null)} className="text-slate-400 hover:text-slate-600 transition-colors"><XIcon className="h-6 w-6" /></button>
                            </div>
                            <div className="flex-1 overflow-y-auto min-h-0 bg-slate-100 rounded-2xl p-4 flex flex-col gap-4 items-center">
                                {previewImages.map((img, idx) => (
                                    <img key={idx} src={img.data} alt={`Preview ${idx + 1}`} className="max-w-full h-auto shadow-md rounded-lg border border-slate-200" />
                                ))}
                            </div>
                            <div className="flex justify-end gap-3 mt-6">
                                <button onClick={() => setPreviewImages(null)} className="px-6 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-50 transition-all active:scale-95">Batal</button>
                                <button onClick={confirmDownloadJPG} className="px-8 py-3 bg-sky-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-sky-700 shadow-lg transition-all flex items-center active:scale-95"><DownloadIcon className="h-4 w-4 mr-2" /> Download JPG</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-slate-900/70 z-[500] flex justify-center items-center p-4">
            <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
                <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                    <div>
                        <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Buat SJ Manual</h2>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest italic">Tidak menyimpan ke database</p>
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
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 block">SJ Number</label>
                            <input type="text" value={sjNumber} onChange={e => setSjNumber(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-slate-900/5" />
                        </div>
                        <div className="col-span-2">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Alamat</label>
                            <input type="text" value={address} onChange={e => setAddress(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm uppercase outline-none focus:ring-2 focus:ring-slate-900/5" placeholder="ALAMAT PENGIRIMAN" />
                        </div>
                        <div className="col-span-2">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Tanggal</label>
                            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-slate-900/5" />
                        </div>
                    </div>
                    <div className="space-y-3">
                        <div className="flex justify-between items-center border-b border-slate-50 pb-2">
                            <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Daftar Barang</h3>
                            <button onClick={handleAddRow} className="text-[9px] font-black text-indigo-600 uppercase">+ Tambah Baris</button>
                        </div>
                        {items.map((item, idx) => (
                            <div key={idx} className="flex gap-2 items-center bg-slate-50/50 p-2 rounded-xl border border-slate-100 group">
                                <span className="text-[9px] font-black text-slate-300 w-4">{idx+1}</span>
                                <input list="manual-parts" value={item.name} onChange={e => handleUpdateItem(idx, 'name', e.target.value.toUpperCase())} className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-black uppercase outline-none" placeholder="PART NAME" />
                                <input type="number" value={item.quantity} onChange={e => handleUpdateItem(idx, 'quantity', e.target.value)} className="w-24 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-black text-right outline-none" placeholder="0.00" />
                                <button onClick={() => handleRemoveItem(idx)} className="p-1.5 text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"><TrashIcon className="h-4 w-4"/></button>
                            </div>
                        ))}
                        <datalist id="manual-parts">{masterItems.map(m => <option key={m.name} value={m.name} />)}</datalist>
                    </div>
                </div>
                <div className="p-6 border-t border-slate-100 flex justify-end gap-3 bg-white">
                    <button onClick={onCancel} className="px-6 py-3 bg-slate-100 text-slate-500 rounded-xl font-black text-[10px] uppercase tracking-widest">Batal</button>
                    <button onClick={() => setIsPreview(true)} className="px-10 py-3 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl transition-all active:scale-95">Generate Preview</button>
                </div>
            </div>
        </div>
    );
};

export default ManualSJForm;