import React, { useState, useMemo } from 'react';
import type { DeliveryOrder, Invoice, SalesOrder, InvoiceExtraCost, Customer } from '../types';
import { XIcon, PlusIcon, TrashIcon } from './icons';
import CurrencyInput from './CurrencyInput';

interface InvoiceFormProps {
    order?: DeliveryOrder;
    initialData?: Invoice;
    defaultPrices?: Record<string, number>;
    previousDebt: number;
    liveDebt?: number;
    deliveryOrders?: DeliveryOrder[];
    salesOrders?: SalesOrder[];
    customers?: Customer[];
    lockedDOs?: Record<string, string>;
    onSubmit: (invoiceData: Omit<Invoice, 'id' | 'date' | 'timestamp'>[], isEdit?: boolean, useLiveDebt?: boolean) => Promise<void>;
    onCancel: () => void;
}

const InvoiceForm: React.FC<InvoiceFormProps> = ({
    order,
    initialData,
    defaultPrices = {},
    previousDebt,
    liveDebt,
    deliveryOrders = [],
    salesOrders = [],
    customers = [],
    lockedDOs = {},
    onSubmit,
    onCancel
}) => {
    const isEdit = !!initialData;
    const [useLiveDebt, setUseLiveDebt] = useState(false);

    const targetCustomerName = (isEdit ? initialData?.customer : order?.customer) || '';
    const masterCustomerAddress = useMemo(() => {
        if (!targetCustomerName) return '';
        return customers.find(c => c.name.trim().toLowerCase() === targetCustomerName.trim().toLowerCase())?.address || '';
    }, [customers, targetCustomerName]);

    // Cari Nomor SO acuan dari order atau dari daftar SJ pada initialData
    const resolvedSOId = useMemo(() => {
        if (order?.salesOrderId) return order.salesOrderId.trim();
        const rawDOId = (isEdit ? initialData?.deliveryOrderId : order?.id) || '';
        const doIds = rawDOId.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
        if (doIds.length === 0) return '';

        const matchedDO = deliveryOrders.find(d => doIds.includes(d.id.trim().toLowerCase()) && d.salesOrderId);
        if (matchedDO?.salesOrderId) return matchedDO.salesOrderId.trim();

        const matchedSO = salesOrders.find(so =>
            (so.deliveryOrderIds || []).some(id => doIds.includes(id.trim().toLowerCase()))
        );
        return matchedSO?.id || '';
    }, [order, initialData, isEdit, deliveryOrders, salesOrders]);

    const shippingAddressFromSO = useMemo(() => {
        if (resolvedSOId) {
            const matchedSO = salesOrders.find(so => so.id.trim().toLowerCase() === resolvedSOId.toLowerCase());
            if (matchedSO?.customerAddress) return matchedSO.customerAddress;
        }
        return order?.customerAddress || '';
    }, [resolvedSOId, salesOrders, order]);

    const [billingAddress, setBillingAddress] = useState<string>(() => {
        if (isEdit && initialData?.customerAddress) return initialData.customerAddress;
        if (masterCustomerAddress) return masterCustomerAddress;
        return order?.customerAddress || '';
    });

    // Daftar SJ yang awalnya dipilih saat form dibuka
    const initialSelectedDOIds = useMemo(() => {
        const raw = (isEdit ? initialData?.deliveryOrderId : order?.id) || '';
        return Array.from(new Set(raw.split(',').map(s => s.trim()).filter(Boolean)));
    }, [order, initialData, isEdit]);

    const [selectedDOIds, setSelectedDOIds] = useState<string[]>(initialSelectedDOIds);

    // Semua SJ yang memiliki Nomor SO yang sama (untuk fitur Combine SJ per SO)
    const sameSODeliveryOrders = useMemo(() => {
        if (!resolvedSOId) return [] as DeliveryOrder[];
        const targetSO = salesOrders.find(so => so.id.trim().toLowerCase() === resolvedSOId.toLowerCase());
        const soDOList = (targetSO?.deliveryOrderIds || []).map(id => id.trim().toLowerCase());

        return deliveryOrders.filter(d => {
            const matchByField = d.salesOrderId && d.salesOrderId.trim().toLowerCase() === resolvedSOId.toLowerCase();
            const matchBySOList = soDOList.includes(d.id.trim().toLowerCase());
            if (!matchByField && !matchBySOList) return false;
            // Tampilkan jika belum di-invoice, atau memang sudah termasuk dalam invoice yang sedang diedit/dibuat ini
            if (!d.invoiceId) return true;
            if (isEdit && initialData && d.invoiceId === initialData.id) return true;
            if (initialSelectedDOIds.includes(d.id)) return true;
            return false;
        }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [resolvedSOId, deliveryOrders, salesOrders, isEdit, initialData, initialSelectedDOIds]);

    // Normalisasi item: Jika ada item yang sama dari SJ berbeda, gabungkan kuantitasnya
    const initialItems = useMemo(() => {
        // Jika ada beberapa SJ yang dipilih dari daftar DO di memori, hitung gabungannya
        if (selectedDOIds.length > 0 && deliveryOrders.length > 0) {
            const matchedDOs = selectedDOIds
                .map(id => deliveryOrders.find(d => d.id.trim().toLowerCase() === id.trim().toLowerCase()))
                .filter(Boolean) as DeliveryOrder[];

            // Jika sedang edit dan daftar SJ tidak berubah dari initialData, gunakan initialData.items
            const isSameAsInitialEdit =
                isEdit &&
                initialData &&
                selectedDOIds.length === initialSelectedDOIds.length &&
                selectedDOIds.every(id => initialSelectedDOIds.includes(id));

            if (!isSameAsInitialEdit && matchedDOs.length > 0) {
                const map = new Map<string, number>();
                matchedDOs.forEach(sj => {
                    const itemsToUse = sj.receivedItems && sj.receivedItems.length > 0 ? sj.receivedItems : sj.items;
                    itemsToUse.forEach(item => {
                        map.set(item.name, (map.get(item.name) || 0) + item.quantity);
                    });
                });
                return Array.from(map.entries()).map(([name, quantity]) => ({ name, quantity }));
            }
        }

        let rawItems: any[] = [];
        if (order && !isEdit) {
            rawItems = order.receivedItems && order.receivedItems.length > 0 ? order.receivedItems : order.items;
        } else if (isEdit && initialData) {
            rawItems = initialData.items;
        }

        const map = new Map<string, number>();
        rawItems.forEach(item => {
            map.set(item.name, (map.get(item.name) || 0) + item.quantity);
        });

        return Array.from(map.entries()).map(([name, quantity]) => ({ name, quantity }));
    }, [order, initialData, isEdit, selectedDOIds, deliveryOrders, initialSelectedDOIds]);

    const handleToggleCombineDO = (doId: string) => {
        setSelectedDOIds(prev => {
            if (prev.includes(doId)) {
                if (prev.length <= 1) {
                    alert('Minimal harus ada 1 Surat Jalan (DO) yang dipilih untuk Faktur Invoice.');
                    return prev;
                }
                return prev.filter(id => id !== doId);
            } else {
                return [...prev, doId];
            }
        });
    };

    const handleSelectAllSameSODOs = () => {
        const availableIds = sameSODeliveryOrders
            .filter(d => !lockedDOs[d.id] || selectedDOIds.includes(d.id))
            .map(d => d.id);
        if (availableIds.length > 0) {
            setSelectedDOIds(availableIds);
        }
    };

    const [itemsToInvoice, setItemsToInvoice] = useState(initialItems);

    const [prices, setPrices] = useState<{ [key: string]: number }>(() => {
        const basePrices = initialItems.reduce((acc, item) => ({ 
            ...acc, 
            [item.name]: defaultPrices[item.name] || 0 
        }), {});
        if (isEdit && initialData) {
            const existingPrices = initialData.items.reduce((acc, item) => ({ ...acc, [item.name]: item.price }), {});
            return { ...basePrices, ...existingPrices };
        }
        return basePrices;
    });

    // Sync state when initialItems or defaultPrices changes
    React.useEffect(() => {
        setItemsToInvoice(initialItems);
        setPrices(prev => {
            const basePrices = initialItems.reduce((acc, item) => ({ 
                ...acc, 
                [item.name]: defaultPrices[item.name] ?? prev[item.name] ?? 0 
            }), {});
            if (isEdit && initialData) {
                const existingPrices = initialData.items.reduce((acc, item) => ({ ...acc, [item.name]: item.price }), {});
                return { ...basePrices, ...existingPrices };
            }
            return { ...basePrices, ...prev };
        });
    }, [initialItems, isEdit, initialData, defaultPrices]);

    const [keterangan, setKeterangan] = useState(() => {
        let ket = initialData?.keterangan || '';
        if (isEdit && ket) {
            ket = ket.replace('[REKAMAN]', '').trim();
        }
        return ket;
    });

    // State untuk Biaya Lain (PPN, Biaya Pengiriman, Biaya Lainnya / DLL)
    const initialExtraCosts = initialData?.extraCosts || [];
    const existingPpn = initialExtraCosts.find(c => c.type === 'ppn' || c.label.toUpperCase().startsWith('PPN'));
    const existingShipping = initialExtraCosts.find(c => c.type === 'shipping' || c.label.toUpperCase() === 'BIAYA PENGIRIMAN');
    const existingOthers = initialExtraCosts.filter(c => c !== existingPpn && c !== existingShipping);

    const [usePpn, setUsePpn] = useState<boolean>(!!existingPpn);
    const [ppnRate, setPpnRate] = useState<string>(existingPpn?.rate !== undefined ? String(existingPpn.rate) : '11');

    const [useShipping, setUseShipping] = useState<boolean>(!!existingShipping);
    const [shippingCost, setShippingCost] = useState<number>(existingShipping?.amount || 0);

    const [useOtherCost, setUseOtherCost] = useState<boolean>(existingOthers.length > 0);
    const [otherCostItems, setOtherCostItems] = useState<{ id: string; label: string; amount: number }[]>(() => {
        if (existingOthers.length > 0) {
            return existingOthers.map(c => ({ id: c.id || String(Math.random()), label: c.label, amount: c.amount }));
        }
        return [{ id: 'other-1', label: 'Biaya Lainnya', amount: 0 }];
    });

    const handleAddOtherCostItem = () => {
        setOtherCostItems(prev => [...prev, { id: `other-${Date.now()}`, label: '', amount: 0 }]);
    };

    const handleRemoveOtherCostItem = (id: string) => {
        setOtherCostItems(prev => {
            const next = prev.filter(item => item.id !== id);
            if (next.length === 0) {
                setUseOtherCost(false);
                return [{ id: 'other-1', label: 'Biaya Lainnya', amount: 0 }];
            }
            return next;
        });
    };

    const handleUpdateOtherCostItem = (id: string, field: 'label' | 'amount', value: string | number) => {
        setOtherCostItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
    };

    const handlePriceChange = (itemName: string, val: string) => {
        setPrices(prev => ({ ...prev, [itemName]: parseFloat(val) || 0 }));
    };

    const handleQuantityChange = (itemName: string, val: string) => {
        setItemsToInvoice(prev => prev.map(item =>
            item.name === itemName ? { ...item, quantity: parseFloat(val) || 0 } : item
        ));
    };

    const totalSubtotal = useMemo(() => {
        return itemsToInvoice.reduce((sum, item) => sum + (item.quantity * (prices[item.name] || 0)), 0);
    }, [itemsToInvoice, prices]);

    const ppnAmount = useMemo(() => {
        if (!usePpn) return 0;
        const rateNum = parseFloat(ppnRate) || 0;
        return Math.round(totalSubtotal * (rateNum / 100));
    }, [usePpn, ppnRate, totalSubtotal]);

    const activeExtraCosts = useMemo<InvoiceExtraCost[]>(() => {
        const list: InvoiceExtraCost[] = [];
        if (usePpn && ppnAmount > 0) {
            const rateNum = parseFloat(ppnRate) || 0;
            list.push({
                id: 'ppn',
                label: `PPN (${rateNum}%)`,
                amount: ppnAmount,
                type: 'ppn',
                rate: rateNum
            });
        }
        if (useShipping && shippingCost > 0) {
            list.push({
                id: 'shipping',
                label: 'Biaya Pengiriman',
                amount: Number(shippingCost) || 0,
                type: 'shipping'
            });
        }
        if (useOtherCost) {
            otherCostItems.forEach((it, idx) => {
                if ((Number(it.amount) || 0) > 0) {
                    list.push({
                        id: it.id || `other-${idx}`,
                        label: (it.label || 'Biaya Lainnya').trim(),
                        amount: Number(it.amount) || 0,
                        type: 'other'
                    });
                }
            });
        }
        return list;
    }, [usePpn, ppnRate, ppnAmount, useShipping, shippingCost, useOtherCost, otherCostItems]);

    const totalExtraCosts = useMemo(() => {
        return activeExtraCosts.reduce((sum, c) => sum + c.amount, 0);
    }, [activeExtraCosts]);

    const activePreviousDebt = 0;
    const totalBill = totalSubtotal + totalExtraCosts;

    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSubmitting) return;
        const hasMissingPrice = itemsToInvoice.some(item => prices[item.name] === undefined || prices[item.name] === null || isNaN(prices[item.name]));
        if (hasMissingPrice) {
            alert('Mohon isi harga untuk semua item.');
            return;
        }

        setIsSubmitting(true);
        // deliveryOrderId di sini bisa berupa satu ID atau beberapa (comma separated) hasil combine
        const currentDOID = selectedDOIds.length > 0
            ? selectedDOIds.join(', ')
            : (isEdit ? initialData!.deliveryOrderId : order!.id);
        const currentCustomer = isEdit ? initialData!.customer : order!.customer;
        const currentAddress = billingAddress.trim();

        const invoicesData: Omit<Invoice, 'id' | 'date' | 'timestamp'>[] = itemsToInvoice.map(item => ({
            deliveryOrderId: currentDOID,
            customer: currentCustomer,
            customerAddress: currentAddress,
            itemName: item.name,
            items: [{ name: item.name, quantity: item.quantity, price: prices[item.name], total: item.quantity * prices[item.name] }],
            subtotal: item.quantity * prices[item.name],
            itemsSubtotal: totalSubtotal,
            extraCosts: activeExtraCosts,
            previousDebt: activePreviousDebt,
            totalAmount: totalBill,
            transfer: 0,
            cash: 0,
            amountPaid: 0,
            newDebt: totalBill,
            qtyDiterima: item.quantity,
            keterangan: keterangan,
            status: 'Unpaid',
            paymentMethod: '-',
            editInvoiceId: isEdit ? initialData!.id : undefined
        }));

        try {
            await onSubmit(invoicesData, isEdit, useLiveDebt);
        } finally {
            setIsSubmitting(false);
        }
    };

    const activeDOList = selectedDOIds.length > 0
        ? selectedDOIds
        : ((isEdit ? initialData?.deliveryOrderId : order?.id) || '-').split(',').map(s => s.trim()).filter(Boolean);

    return (
        <div className="fixed inset-0 bg-slate-900/75 backdrop-blur-sm overflow-y-auto h-full w-full z-[300] flex justify-center items-center p-4">
            <form onSubmit={handleSubmit} className="bg-white p-6 rounded-[2.5rem] shadow-2xl w-full max-w-2xl max-h-[95vh] flex flex-col border border-slate-200">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h2 className="text-2xl font-black text-slate-800 tracking-tighter uppercase leading-none">
                            {isEdit ? 'Edit / Update Faktur Invoice' : 'Buat Faktur Invoice'}
                        </h2>
                        <div className="flex flex-wrap items-center gap-1.5 mt-2">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Surat Jalan (DO):</span>
                            {activeDOList.map((sj, idx) => (
                                <span key={idx} className="px-2.5 py-0.5 bg-slate-100 border border-slate-200 text-slate-800 text-[10px] font-black rounded-lg">
                                    {sj}
                                </span>
                            ))}
                            {resolvedSOId && (
                                <span className="px-2.5 py-0.5 bg-teal-50 border border-teal-200 text-teal-800 text-[10px] font-black rounded-lg">
                                    Acuan SO: {resolvedSOId}
                                </span>
                            )}
                        </div>
                    </div>
                    <button onClick={onCancel} type="button" className="p-2 text-slate-300 hover:text-slate-600 transition-colors"><XIcon /></button>
                </div>

                <div className="flex-grow overflow-y-auto pr-2 space-y-6 no-scrollbar">
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Nama Customer</p>
                                <p className="font-black text-slate-800 text-lg uppercase">{isEdit ? initialData.customer : order?.customer}</p>
                            </div>
                            {activeDOList.length > 1 && (
                                <span className="px-3 py-1 bg-purple-100 text-purple-800 border border-purple-200 rounded-xl text-[10px] font-black uppercase tracking-wider">
                                    Combine {activeDOList.length} Surat Jalan (DO)
                                </span>
                            )}
                        </div>

                        <div className="pt-2 border-t border-slate-200/70 space-y-1.5">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <label className="block text-[10px] font-black text-slate-600 uppercase tracking-widest">
                                    📍 Alamat Tagihan <span className="text-slate-400 font-bold normal-case">(Bisa diedit)</span>
                                </label>
                                <div className="flex flex-wrap items-center gap-2">
                                    {masterCustomerAddress && masterCustomerAddress.trim() !== billingAddress.trim() && (
                                        <button
                                            type="button"
                                            onClick={() => setBillingAddress(masterCustomerAddress)}
                                            className="text-[9px] font-black text-indigo-600 hover:text-indigo-800 underline"
                                        >
                                            Gunakan Alamat Master
                                        </button>
                                    )}
                                    {shippingAddressFromSO && shippingAddressFromSO.trim() !== billingAddress.trim() && shippingAddressFromSO.trim() !== masterCustomerAddress.trim() && (
                                        <button
                                            type="button"
                                            onClick={() => setBillingAddress(shippingAddressFromSO)}
                                            className="text-[9px] font-black text-teal-600 hover:text-teal-800 underline"
                                        >
                                            Sama dgn Alamat Kirim SO
                                        </button>
                                    )}
                                </div>
                            </div>
                            <textarea
                                rows={2}
                                value={billingAddress}
                                onChange={e => setBillingAddress(e.target.value)}
                                placeholder="Masukkan atau ubah alamat tagihan pada faktur invoice ini..."
                                className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none"
                            />
                        </div>
                    </div>

                    {/* Menu Combine SJ (Simple) */}
                    {resolvedSOId && sameSODeliveryOrders.length > 1 && (
                        <div className="bg-slate-50 px-4 py-3 rounded-2xl border border-slate-200 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                                <span className="text-[10px] font-black text-slate-700 uppercase tracking-wider">
                                    Combine SJ — No. SO: <span className="text-teal-700">{resolvedSOId}</span>
                                </span>
                                {selectedDOIds.length < sameSODeliveryOrders.length && (
                                    <button
                                        type="button"
                                        onClick={handleSelectAllSameSODOs}
                                        className="text-[9px] font-black text-teal-600 hover:text-teal-800 uppercase underline"
                                    >
                                        Pilih Semua ({sameSODeliveryOrders.length} SJ)
                                    </button>
                                )}
                            </div>

                            <div className="flex flex-wrap gap-2">
                                {sameSODeliveryOrders.map(sj => {
                                    const isChecked = selectedDOIds.includes(sj.id);
                                    const lockedBy = lockedDOs[sj.id];
                                    const isDisabled = !!lockedBy && !isChecked;
                                    const sjItems = sj.receivedItems && sj.receivedItems.length > 0 ? sj.receivedItems : sj.items;
                                    const totalKg = sjItems.reduce((acc, it) => acc + (it.quantity || 0), 0);

                                    return (
                                        <label
                                            key={sj.id}
                                            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase transition-all cursor-pointer select-none ${
                                                isChecked
                                                    ? 'bg-teal-50 border-teal-500 text-teal-900'
                                                    : isDisabled
                                                    ? 'bg-slate-100 border-slate-200 text-slate-400 opacity-60 cursor-not-allowed'
                                                    : 'bg-white border-slate-200 text-slate-700 hover:border-teal-300'
                                            }`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={isChecked}
                                                disabled={isDisabled}
                                                onChange={() => handleToggleCombineDO(sj.id)}
                                                className="w-3.5 h-3.5 accent-teal-600 rounded cursor-pointer"
                                            />
                                            <span>{sj.id}</span>
                                            <span className="text-slate-400 font-bold">({totalKg.toLocaleString('id-ID')} kg)</span>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    <div className="space-y-3">
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Rincian Harga Item</h3>
                        {itemsToInvoice.map(item => (
                            <div key={item.name} className="grid grid-cols-3 gap-4 items-center bg-white p-3 rounded-2xl border border-slate-100 shadow-sm">
                                <div className="col-span-1">
                                    <p className="text-xs font-black text-slate-700 uppercase leading-tight">{item.name}</p>
                                    <div className="relative mt-1">
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={item.quantity || ''}
                                            onChange={e => handleQuantityChange(item.name, e.target.value)}
                                            className="w-full pr-7 pl-2 py-1 bg-indigo-50 border border-indigo-100 rounded-lg text-[10px] font-black focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                                            placeholder="0"
                                        />
                                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[8px] font-black text-indigo-400">Kg</span>
                                    </div>
                                </div>
                                <div className="col-span-2">
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-300">Rp</span>
                                        <CurrencyInput
                                            value={prices[item.name]}
                                            onChange={val => handlePriceChange(item.name, val.toString())}
                                            className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black focus:ring-4 focus:ring-red-500/5 outline-none transition-all"
                                            placeholder="0"
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Biaya Lain / Tambahan (Opsional) */}
                    <div className="space-y-3 bg-slate-50/80 p-4 rounded-2xl border border-slate-200/80">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest">
                                Biaya Lain / Tambahan <span className="text-[10px] font-bold text-slate-400 normal-case">(Opsional — Centang jika digunakan)</span>
                            </h3>
                        </div>

                        <div className="space-y-2.5">
                            {/* Opsi 1: PPN */}
                            <div className={`p-3 rounded-xl border transition-all ${usePpn ? 'bg-white border-indigo-200 shadow-2xs' : 'bg-white/60 border-slate-200/70'}`}>
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <label className="inline-flex items-center gap-2.5 cursor-pointer select-none">
                                        <input
                                            type="checkbox"
                                            checked={usePpn}
                                            onChange={e => setUsePpn(e.target.checked)}
                                            className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                                        />
                                        <span className="text-xs font-black text-slate-800 uppercase">PPN (Pajak)</span>
                                    </label>

                                    {usePpn && (
                                        <div className="flex items-center gap-3 flex-1 justify-end">
                                            <div className="relative w-24">
                                                <input
                                                    type="number"
                                                    step="0.1"
                                                    min="0"
                                                    value={ppnRate}
                                                    onChange={e => setPpnRate(e.target.value)}
                                                    className="w-full pl-3 pr-7 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-black text-right outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                    placeholder="11"
                                                />
                                                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400">%</span>
                                            </div>
                                            <div className="text-right min-w-[110px]">
                                                <span className="text-xs font-black font-mono text-indigo-700">
                                                    Rp {ppnAmount.toLocaleString('id-ID')}
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Opsi 2: Biaya Pengiriman */}
                            <div className={`p-3 rounded-xl border transition-all ${useShipping ? 'bg-white border-indigo-200 shadow-2xs' : 'bg-white/60 border-slate-200/70'}`}>
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <label className="inline-flex items-center gap-2.5 cursor-pointer select-none">
                                        <input
                                            type="checkbox"
                                            checked={useShipping}
                                            onChange={e => setUseShipping(e.target.checked)}
                                            className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                                        />
                                        <span className="text-xs font-black text-slate-800 uppercase">Biaya Pengiriman (Ongkir)</span>
                                    </label>

                                    {useShipping && (
                                        <div className="relative sm:w-56">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400">Rp</span>
                                            <CurrencyInput
                                                value={shippingCost}
                                                onChange={val => setShippingCost(Number(val) || 0)}
                                                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-black text-right outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                placeholder="0"
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Opsi 3: Biaya Lainnya / DLL */}
                            <div className={`p-3 rounded-xl border transition-all ${useOtherCost ? 'bg-white border-indigo-200 shadow-2xs' : 'bg-white/60 border-slate-200/70'}`}>
                                <div className="flex items-center justify-between">
                                    <label className="inline-flex items-center gap-2.5 cursor-pointer select-none">
                                        <input
                                            type="checkbox"
                                            checked={useOtherCost}
                                            onChange={e => setUseOtherCost(e.target.checked)}
                                            className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                                        />
                                        <span className="text-xs font-black text-slate-800 uppercase">Biaya Lainnya (DLL)</span>
                                    </label>

                                    {useOtherCost && (
                                        <button
                                            type="button"
                                            onClick={handleAddOtherCostItem}
                                            className="inline-flex items-center gap-1 text-[10px] font-black text-indigo-600 hover:text-indigo-800 uppercase tracking-wider"
                                        >
                                            <PlusIcon className="h-3.5 w-3.5" />
                                            <span>Tambah Baris</span>
                                        </button>
                                    )}
                                </div>

                                {useOtherCost && (
                                    <div className="mt-3 space-y-2">
                                        {otherCostItems.map((item) => (
                                            <div key={item.id} className="grid grid-cols-12 gap-2 items-center">
                                                <div className="col-span-6">
                                                    <input
                                                        type="text"
                                                        value={item.label}
                                                        onChange={e => handleUpdateOtherCostItem(item.id, 'label', e.target.value)}
                                                        placeholder="Nama Biaya (Misal: Packing / Materai)"
                                                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                    />
                                                </div>
                                                <div className="col-span-5 relative">
                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400">Rp</span>
                                                    <CurrencyInput
                                                        value={item.amount}
                                                        onChange={val => handleUpdateOtherCostItem(item.id, 'amount', Number(val) || 0)}
                                                        className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-black text-right outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                        placeholder="0"
                                                    />
                                                </div>
                                                <div className="col-span-1 flex justify-center">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveOtherCostItem(item.id)}
                                                        className="text-slate-300 hover:text-rose-500 transition-colors p-1"
                                                        title="Hapus Biaya"
                                                    >
                                                        <TrashIcon className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="p-3.5 bg-amber-50 border border-amber-200/80 rounded-2xl flex items-center gap-2.5 text-amber-800">
                        <span className="text-base font-black">ℹ</span>
                        <p className="text-[11px] font-bold leading-relaxed">
                            Pembayaran tagihan (Transfer / Cash) dicatat terpisah pada menu <strong>Buku Piutang / Kasir</strong> untuk memilih faktur mana yang dibayarkan.
                        </p>
                    </div>

                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Keterangan Tambahan</label>
                        <textarea
                            value={keterangan}
                            onChange={e => setKeterangan(e.target.value)}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold focus:ring-4 focus:ring-red-500/5 outline-none"
                            rows={2}
                            placeholder="Catatan untuk invoice..."
                        />
                    </div>

                    <div className="bg-slate-900 text-white p-6 rounded-[2rem] shadow-xl">
                        <div className="flex justify-between text-[10px] font-black uppercase tracking-widest opacity-60 mb-2">
                            <span>Subtotal Barang:</span>
                            <span>{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(totalSubtotal)}</span>
                        </div>
                        {activeExtraCosts.map(cost => (
                            <div key={cost.id} className="flex justify-between text-[10px] font-black uppercase tracking-widest text-indigo-300 mb-1.5">
                                <span>+ {cost.label}:</span>
                                <span>{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(cost.amount)}</span>
                            </div>
                        ))}
                        <div className="flex justify-between items-end border-t border-white/10 pt-4 mt-2">
                            <span className="text-xs font-black uppercase tracking-widest">TOTAL TAGIHAN:</span>
                            <span className="text-2xl font-black text-yellow-400 leading-none">
                                {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(totalBill)}
                            </span>
                        </div>
                        <div className="flex justify-between items-center mt-5">
                            <span className="text-[9px] font-black uppercase tracking-[0.2em] opacity-40">Status:</span>
                            <span className="px-4 py-1.5 rounded-full font-black uppercase text-[10px] tracking-widest bg-amber-500/20 text-amber-300 ring-1 ring-amber-400/40">
                                Belum Dibayar (Unpaid)
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end pt-6 border-t border-slate-100 mt-6 gap-3">
                    <button type="button" onClick={onCancel} className="px-6 py-3 bg-slate-100 text-slate-500 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all">BATAL</button>
                    <button type="submit" disabled={isSubmitting} className={`px-8 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg transition-all active:scale-95 ${isSubmitting ? 'bg-red-400 text-white cursor-not-allowed' : 'bg-red-600 text-white hover:bg-red-700 shadow-red-100'}`}>
                        {isSubmitting ? 'MENYIMPAN...' : (isEdit ? 'UPDATE INVOICE' : 'SIMPAN INVOICE')}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default InvoiceForm;