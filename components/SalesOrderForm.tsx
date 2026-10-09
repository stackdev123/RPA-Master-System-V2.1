import React, { useState, useMemo, useRef, useEffect } from 'react';
import { XIcon, PlusIcon, TrashIcon, ChevronDownIcon } from './icons';
import type { Customer, MasterItem, SalesOrder, SalesOrderItem } from '../types';

interface SalesOrderFormProps {
  initialData?: SalesOrder | null;
  customers: Customer[];
  masterItems: MasterItem[];
  currentStock: Record<string, number>;
  onSubmit: (order: SalesOrder) => Promise<void>;
  onCancel: () => void;
}

const PAYMENT_METHODS = [
  'Cash',
  'Transfer',
  'Tempo 7 Hari',
  'Tempo 14 Hari',
  'Tempo 30 Hari',
  'COD (Bayar di Tempat)'
];

export const SalesOrderForm: React.FC<SalesOrderFormProps> = ({
  initialData,
  customers,
  masterItems,
  currentStock,
  onSubmit,
  onCancel
}) => {
  const [customer, setCustomer] = useState(initialData?.customer || '');
  const [address, setAddress] = useState(() => {
    if (initialData?.customerAddress) return initialData.customerAddress;
    if (initialData?.customer) {
      const found = customers.find(c => c.name.trim().toLowerCase() === initialData.customer.trim().toLowerCase());
      return found?.address || '';
    }
    return '';
  });
  const [date, setDate] = useState(initialData?.date || new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState(initialData?.paymentMethod || 'Cash');
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Searchable customer dropdown state
  const [isCustomerOpen, setIsCustomerOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const customerDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(e.target as Node)) {
        setIsCustomerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const [items, setItems] = useState<Array<{ name: string; quantity: number | ''; price: number | ''; notes?: string }>>(
    initialData?.items && initialData.items.length > 0
      ? initialData.items.map(it => ({ name: it.name, quantity: it.quantity, price: it.price, notes: it.notes }))
      : [{ name: '', quantity: '', price: '', notes: '' }]
  );

  const filteredCustomers = useMemo(() => {
    return customers.filter(c => c.name.toLowerCase().includes(customerSearch.toLowerCase()));
  }, [customers, customerSearch]);

  const handleCustomerSelect = (c: Customer) => {
    setCustomer(c.name);
    setAddress(c.address || '');
    setIsCustomerOpen(false);
  };

  const handleAddItemRow = () => {
    setItems(prev => [...prev, { name: '', quantity: '', price: '', notes: '' }]);
  };

  const handleRemoveItemRow = (idx: number) => {
    if (items.length <= 1) return;
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  const handleItemChange = (idx: number, field: string, value: any) => {
    setItems(prev => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: value };
      return copy;
    });
  };

  const totalQty = useMemo(() => {
    return items.reduce((acc, it) => acc + (Number(it.quantity) || 0), 0);
  }, [items]);

  const totalAmount = useMemo(() => {
    return items.reduce((acc, it) => acc + ((Number(it.quantity) || 0) * (Number(it.price) || 0)), 0);
  }, [items]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer.trim()) {
      alert('Silakan pilih customer terlebih dahulu.');
      return;
    }

    const validItems: SalesOrderItem[] = items
      .filter(it => it.name.trim() !== '' && Number(it.quantity) > 0)
      .map(it => {
        const qty = Number(it.quantity) || 0;
        const pr = Number(it.price) || 0;
        return {
          name: it.name.trim().toUpperCase(),
          quantity: qty,
          price: pr,
          total: qty * pr,
          fulfilledQty: initialData?.items?.find(prev => prev.name === it.name)?.fulfilledQty || 0,
          notes: it.notes || ''
        };
      });

    if (validItems.length === 0) {
      alert('Tambahkan minimal 1 item pesanan dengan kuantitas > 0.');
      return;
    }

    setIsSubmitting(true);
    try {
      const soId = initialData?.id || `SO/${date.replace(/-/g, '').slice(2)}/${Date.now().toString().slice(-4)}`;
      
      const newSO: SalesOrder = {
        id: soId,
        date,
        customer: customer.trim().toUpperCase(),
        customerAddress: address,
        paymentMethod,
        items: validItems,
        totalAmount,
        totalQty,
        status: initialData?.status || 'pending',
        notes: notes.trim(),
        deliveryOrderIds: initialData?.deliveryOrderIds || [],
        timestamp: initialData?.timestamp || new Date().toISOString()
      };

      await onSubmit(newSO);
    } catch (err: any) {
      alert('Gagal menyimpan Sales Order: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-3 md:p-6 overflow-y-auto">
      <div className="bg-white rounded-[2.5rem] w-full max-w-4xl shadow-2xl border border-slate-100 flex flex-col max-h-[92vh] overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-teal-100 text-teal-700">
                {initialData ? 'Edit Order' : 'Order Baru'}
              </span>
              <h2 className="text-xl font-black text-slate-800 tracking-tight">
                {initialData ? `Edit Sales Order: ${initialData.id}` : 'Form Input Sales Order (SO)'}
              </h2>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
          >
            <XIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Top Row: Customer & Order Details */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* Customer Dropdown */}
            <div className="relative" ref={customerDropdownRef}>
              <label className="block text-[11px] font-black uppercase tracking-wider text-slate-600 mb-1.5">
                Customer / Pelanggan <span className="text-rose-500">*</span>
              </label>
              <button
                type="button"
                onClick={() => setIsCustomerOpen(!isCustomerOpen)}
                className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 hover:bg-slate-100 transition-colors text-left"
              >
                <span className="truncate">{customer || '-- Pilih Pelanggan --'}</span>
                <ChevronDownIcon className="h-4 w-4 text-slate-400 shrink-0" />
              </button>

              {isCustomerOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 p-2 max-h-60 overflow-y-auto">
                  <input
                    type="text"
                    placeholder="Cari customer..."
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none font-medium mb-2 focus:ring-2 focus:ring-teal-500"
                    autoFocus
                  />
                  <div className="space-y-1">
                    {filteredCustomers.length === 0 ? (
                      <p className="text-xs text-slate-400 p-2 text-center">Customer tidak ditemukan</p>
                    ) : (
                      filteredCustomers.map((c, cIdx) => (
                        <button
                          key={c.id || `${c.name}-${cIdx}`}
                          type="button"
                          onClick={() => handleCustomerSelect(c)}
                          className="w-full text-left px-3 py-2 rounded-xl text-xs hover:bg-teal-50 hover:text-teal-700 transition-colors flex flex-col"
                        >
                          <span className="font-bold">{c.name}</span>
                          {c.address && <span className="text-[10px] text-slate-400 truncate">{c.address}</span>}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Tanggal Pesanan */}
            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-slate-600 mb-1.5">
                Tanggal Pesanan <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-teal-500"
                required
              />
            </div>

            {/* Metode Pembayaran */}
            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-slate-600 mb-1.5">
                Metode Pembayaran <span className="text-rose-500">*</span>
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-teal-500"
              >
                {PAYMENT_METHODS.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Alamat Kirim (Editable) */}
          <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-200/80 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label className="block text-[11px] font-black uppercase tracking-wider text-slate-600">
                Alamat Kirim <span className="text-[10px] font-bold text-slate-400 normal-case">(Bisa diedit)</span>
              </label>
              {(() => {
                const masterAddr = customers.find(c => c.name.trim().toLowerCase() === customer.trim().toLowerCase())?.address || '';
                if (masterAddr && masterAddr.trim() !== address.trim()) {
                  return (
                    <button
                      type="button"
                      onClick={() => setAddress(masterAddr)}
                      className="text-[10px] font-black text-teal-600 hover:text-teal-800 underline"
                    >
                      Reset ke Alamat Master
                    </button>
                  );
                }
                return null;
              })()}
            </div>
            <textarea
              rows={2}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Masukkan atau ubah alamat pengiriman untuk pesanan ini..."
              className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-teal-500 resize-none"
            />
          </div>

          {/* Items Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Daftar Item Pesanan</h3>
                <span className="text-[10px] text-slate-400">Pilih item, tentukan kuantitas (kg) dan harga jual.</span>
              </div>
              <button
                type="button"
                onClick={handleAddItemRow}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-50 text-teal-700 hover:bg-teal-100 rounded-xl text-xs font-black transition-colors"
              >
                <PlusIcon className="h-4 w-4" />
                Tambah Item
              </button>
            </div>

            <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
              <div className="bg-slate-50 px-4 py-2.5 grid grid-cols-12 gap-2 text-[10px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-100">
                <div className="col-span-4">Item & Info Stok</div>
                <div className="col-span-2 text-right">Kuantitas (Kg)</div>
                <div className="col-span-3 text-right">Harga Jual / Kg</div>
                <div className="col-span-2 text-right">Subtotal</div>
                <div className="col-span-1 text-center">Aksi</div>
              </div>

              <div className="divide-y divide-slate-100">
                {items.map((row, idx) => {
                  const stockAvail = row.name ? (currentStock[row.name.toUpperCase()] ?? currentStock[row.name] ?? 0) : null;
                  const itemSubtotal = (Number(row.quantity) || 0) * (Number(row.price) || 0);

                  return (
                    <div key={idx} className="p-3 grid grid-cols-12 gap-2 items-center hover:bg-slate-50/50 transition-colors">
                      {/* Item Selector */}
                      <div className="col-span-4">
                        <select
                          value={row.name}
                          onChange={(e) => handleItemChange(idx, 'name', e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-teal-500"
                          required
                        >
                          <option value="">-- Pilih Item --</option>
                          {masterItems.map((it, itIdx) => (
                            <option key={it.id || `${it.name}-${itIdx}`} value={it.name}>
                              {it.name}
                            </option>
                          ))}
                        </select>
                        {stockAvail !== null && (
                          <div className="mt-1 flex items-center gap-1.5 text-[10px]">
                            <span className="text-slate-400">Stok Gudang:</span>
                            <span className={`font-black ${stockAvail <= 0 ? 'text-rose-500' : 'text-emerald-600'}`}>
                              {stockAvail.toLocaleString('id-ID')} kg
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Quantity */}
                      <div className="col-span-2">
                        <input
                          type="number"
                          step="any"
                          min="0"
                          placeholder="0.0"
                          value={row.quantity}
                          onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                          className="w-full px-3 py-2 text-right bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-teal-500"
                          required
                        />
                      </div>

                      {/* Price per Kg */}
                      <div className="col-span-3">
                        <div className="relative">
                          <span className="absolute left-2.5 top-2 text-[10px] font-bold text-slate-400">Rp</span>
                          <input
                            type="number"
                            step="any"
                            min="0"
                            placeholder="0"
                            value={row.price}
                            onChange={(e) => handleItemChange(idx, 'price', e.target.value)}
                            className="w-full pl-8 pr-3 py-2 text-right bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-teal-500"
                            required
                          />
                        </div>
                      </div>

                      {/* Subtotal */}
                      <div className="col-span-2 text-right">
                        <span className="text-xs font-black text-slate-800">
                          Rp {itemSubtotal.toLocaleString('id-ID')}
                        </span>
                      </div>

                      {/* Delete Action */}
                      <div className="col-span-1 flex justify-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveItemRow(idx)}
                          disabled={items.length <= 1}
                          className="p-1.5 text-slate-300 hover:text-rose-600 disabled:opacity-30 disabled:hover:text-slate-300 transition-colors rounded-lg"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-[11px] font-black uppercase tracking-wider text-slate-600 mb-1.5">
              Catatan Khusus / Permintaan Khusus
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Contoh: Pengiriman pagi jam 06:00, ukuran karkas 1.2kg, kemasan kantong merah..."
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-800 font-medium outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          {/* Summary Footer Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-2">
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Kuantitas</span>
              <p className="text-xl font-black text-slate-800 mt-1">
                {totalQty.toLocaleString('id-ID')} <span className="text-xs font-normal text-slate-500">kg</span>
              </p>
            </div>
            <div className="bg-teal-50 p-4 rounded-2xl border border-teal-100 col-span-2 md:col-span-2 flex flex-col justify-center">
              <span className="text-[10px] font-black uppercase tracking-wider text-teal-600">Total Nilai Pesanan</span>
              <p className="text-2xl font-black text-teal-800 mt-1">
                Rp {totalAmount.toLocaleString('id-ID')}
              </p>
            </div>
          </div>
        </form>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-slate-500 hover:bg-slate-200 transition-colors"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-8 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-teal-500/20 active:scale-95 transition-all flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Menyimpan...
              </>
            ) : (
              'Simpan Sales Order'
            )}
          </button>
        </div>

      </div>
    </div>
  );
};

export default SalesOrderForm;
