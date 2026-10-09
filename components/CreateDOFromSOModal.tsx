import React, { useState, useMemo, useEffect, useRef } from 'react';
import { XIcon, TruckIcon, CheckCircleIcon, ExclamationCircleIcon, SearchIcon, ChevronDownIcon, ShoppingCartIcon, PlusIcon, TrashIcon } from './icons';
import type { SalesOrder, StockItem, DeliveryOrder, Customer, MasterItem } from '../types';

interface CreateDOFromSOModalProps {
  initialSalesOrder?: SalesOrder | null;
  salesOrders: SalesOrder[];
  existingDOs?: DeliveryOrder[];
  currentStock: StockItem[] | Record<string, number>;
  customers?: Customer[];
  masterItems?: MasterItem[];
  onSubmit: (params: {
    soId: string;
    deliveryOrderId: string;
    date: string;
    customer: string;
    items: { name: string; quantity: number }[];
  }) => Promise<void>;
  onCancel: () => void;
  onNavigateToSO?: () => void;
  lockedSOs?: Record<string, string>;
  onSelectSOChange?: (soId: string) => void;
}

export const CreateDOFromSOModal: React.FC<CreateDOFromSOModalProps> = ({
  initialSalesOrder,
  salesOrders = [],
  existingDOs = [],
  currentStock,
  customers = [],
  masterItems = [],
  onSubmit,
  onCancel,
  onNavigateToSO,
  lockedSOs = {},
  onSelectSOChange
}) => {
  // Filter active Sales Orders that are not completed/cancelled
  const activeSalesOrders = useMemo(() => {
    return salesOrders.filter(so => so.status !== 'completed' && so.status !== 'cancelled');
  }, [salesOrders]);

  const [date, setDate] = useState(() => {
    if (initialSalesOrder?.date) {
      return String(initialSalesOrder.date).slice(0, 10);
    }
    return new Date().toISOString().slice(0, 10);
  });

  // Mode filter dinamis berdasarkan tanggal kirim
  const [filterByDeliveryDate, setFilterByDeliveryDate] = useState<boolean>(true);

  // Daftar tanggal unik dari SO aktif untuk memudahkan pemilihan tanggal kirim
  const availableSODates = useMemo(() => {
    const counts: Record<string, number> = {};
    activeSalesOrders.forEach(so => {
      const d = String(so.date || '').slice(0, 10);
      if (d) counts[d] = (counts[d] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[0].localeCompare(a[0]));
  }, [activeSalesOrders]);

  // SO yang sesuai dengan Tanggal Kirim (date)
  const dateMatchedSalesOrders = useMemo(() => {
    return activeSalesOrders.filter(so => String(so.date || '').slice(0, 10) === date);
  }, [activeSalesOrders, date]);

  // Daftar SO yang ditampilkan di dropdown dinamis
  const dropdownSalesOrders = useMemo(() => {
    if (filterByDeliveryDate) {
      return dateMatchedSalesOrders;
    }
    return activeSalesOrders;
  }, [filterByDeliveryDate, dateMatchedSalesOrders, activeSalesOrders]);

  // Selected SO state
  const [selectedSOId, setSelectedSOId] = useState<string>(() => {
    if (
      initialSalesOrder &&
      initialSalesOrder.status !== 'completed' &&
      initialSalesOrder.status !== 'cancelled' &&
      !lockedSOs[initialSalesOrder.id]
    ) {
      return initialSalesOrder.id;
    }
    const todayStr = new Date().toISOString().slice(0, 10);
    const matchingToday = activeSalesOrders.find(
      so => String(so.date || '').slice(0, 10) === todayStr && !lockedSOs[so.id]
    );
    if (matchingToday) return matchingToday.id;
    return '';
  });

  // Update pilihan SO secara dinamis saat Tanggal Kirim atau mode filter berubah
  useEffect(() => {
    if (dropdownSalesOrders.length === 0) {
      setSelectedSOId('');
      return;
    }
    const stillValid = dropdownSalesOrders.some(so => so.id === selectedSOId && !lockedSOs[so.id]);
    if (!stillValid) {
      const firstUnlocked = dropdownSalesOrders.find(so => !lockedSOs[so.id]);
      setSelectedSOId(firstUnlocked ? firstUnlocked.id : '');
    }
  }, [date, filterByDeliveryDate, dropdownSalesOrders, lockedSOs]);

  useEffect(() => {
    if (onSelectSOChange) {
      onSelectSOChange(selectedSOId);
    }
  }, [selectedSOId, onSelectSOChange]);

  const currentSO = useMemo(() => {
    return salesOrders.find(so => so.id === selectedSOId) || null;
  }, [salesOrders, selectedSOId]);

  // Convert currentStock to safe lookup object
  const stockLookup = useMemo(() => {
    const map: Record<string, number> = {};
    if (Array.isArray(currentStock)) {
      currentStock.forEach(s => {
        if (s && s.name) {
          map[s.name.toUpperCase()] = Number(s.quantity) || 0;
          map[s.name] = Number(s.quantity) || 0;
        }
      });
    } else if (currentStock && typeof currentStock === 'object') {
      Object.entries(currentStock).forEach(([k, v]) => {
        map[k.toUpperCase()] = Number(v) || 0;
        map[k] = Number(v) || 0;
      });
    }
    return map;
  }, [currentStock]);

  const [isManualDONumber, setIsManualDONumber] = useState(false);

  const computeNextDONumber = (targetDateStr: string, doList: DeliveryOrder[]) => {
    const cleanDate = targetDateStr ? targetDateStr.slice(2, 10).replace(/-/g, '') : new Date().toISOString().slice(2, 10).replace(/-/g, '');
    const prefix = `DO/${cleanDate}/`;
    const matching = (doList || []).filter(o => o.id && o.id.toUpperCase().startsWith(prefix.toUpperCase()));
    const nums = matching.map(o => parseInt(o.id.slice(prefix.length), 10)).filter(n => !isNaN(n));
    const nextSeq = (nums.length > 0 ? Math.max(...nums) : 0) + 1;
    return `${prefix}${nextSeq.toString().padStart(3, '0')}`;
  };

  // Generate next sequential DO number
  const [doNumber, setDoNumber] = useState(() => computeNextDONumber(new Date().toISOString().slice(0, 10), existingDOs));

  // Keep auto-generated DO number synced when existingDOs or date changes (unless manually edited)
  useEffect(() => {
    if (!isManualDONumber) {
      setDoNumber(computeNextDONumber(date, existingDOs));
    }
  }, [existingDOs, date, isManualDONumber]);

  const isDuplicateDONumber = useMemo(() => {
    const trimmed = doNumber.trim().toLowerCase();
    if (!trimmed) return false;
    return (existingDOs || []).some(o => o.id && o.id.trim().toLowerCase() === trimmed);
  }, [doNumber, existingDOs]);

  const currentSOLockedBy = selectedSOId ? lockedSOs[selectedSOId] : undefined;

  // Quantities to ship for each item in the selected SO
  const [shipQuantities, setShipQuantities] = useState<Record<string, number>>({});

  // Additional items not in the Sales Order
  const [extraItems, setExtraItems] = useState<{ name: string; quantity: number }[]>([]);
  const [showAddExtraForm, setShowAddExtraForm] = useState(false);
  const [newExtraName, setNewExtraName] = useState('');
  const [newExtraQty, setNewExtraQty] = useState('');

  // Initialize ship quantities whenever currentSO changes
  useEffect(() => {
    if (currentSO) {
      const initialMap: Record<string, number> = {};
      currentSO.items.forEach(it => {
        const remaining = Math.max(0, it.quantity - (it.fulfilledQty || 0));
        initialMap[it.name] = remaining;
      });
      setShipQuantities(initialMap);
      setExtraItems([]);
      setShowAddExtraForm(false);
    } else {
      setShipQuantities({});
      setExtraItems([]);
      setShowAddExtraForm(false);
    }
  }, [selectedSOId]);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleQtyChange = (itemName: string, val: string) => {
    const num = parseFloat(val);
    setShipQuantities(prev => ({
      ...prev,
      [itemName]: isNaN(num) ? 0 : Math.max(0, num)
    }));
  };

  const handleExtraQtyChange = (itemName: string, val: string) => {
    const num = parseFloat(val);
    const validQty = isNaN(num) ? 0 : Math.max(0, num);
    setExtraItems(prev => prev.map(item => item.name === itemName ? { ...item, quantity: validQty } : item));
  };

  const handleRemoveExtraItem = (itemName: string) => {
    setExtraItems(prev => prev.filter(item => item.name !== itemName));
  };

  const handleAddExtraItem = () => {
    const trimmed = newExtraName.trim().toUpperCase();
    if (!trimmed) {
      alert('Nama barang harus diisi atau dipilih.');
      return;
    }
    const qty = parseFloat(newExtraQty);
    if (isNaN(qty) || qty <= 0) {
      alert('Jumlah kuantitas kirim (kg) harus lebih besar dari 0.');
      return;
    }

    // Cek apakah item sudah ada di SO
    const existsInSO = currentSO?.items.some(i => i.name.toUpperCase() === trimmed);
    if (existsInSO) {
      alert(`Barang "${trimmed}" sudah ada di dalam daftar pesanan Sales Order. Silakan atur kuantitas kirim langsung pada baris item tersebut.`);
      return;
    }

    // Cek apakah item sudah ada di extraItems
    const existsInExtra = extraItems.some(i => i.name.toUpperCase() === trimmed);
    if (existsInExtra) {
      alert(`Barang "${trimmed}" sudah ditambahkan sebelumnya.`);
      return;
    }

    setExtraItems(prev => [...prev, { name: trimmed, quantity: qty }]);
    setNewExtraName('');
    setNewExtraQty('');
    setShowAddExtraForm(false);
  };

  const setAllToMax = () => {
    if (!currentSO) return;
    const map: Record<string, number> = {};
    currentSO.items.forEach(it => {
      const remaining = Math.max(0, it.quantity - (it.fulfilledQty || 0));
      map[it.name] = remaining;
    });
    setShipQuantities(map);
  };

  const setAllToZero = () => {
    if (!currentSO) return;
    const map: Record<string, number> = {};
    currentSO.items.forEach(it => {
      map[it.name] = 0;
    });
    setShipQuantities(map);
  };

  const totalShipQty = useMemo(() => {
    const soTotal = Object.values(shipQuantities).reduce((acc, q) => acc + (Number(q) || 0), 0);
    const extraTotal = extraItems.reduce((acc, it) => acc + (Number(it.quantity) || 0), 0);
    return soTotal + extraTotal;
  }, [shipQuantities, extraItems]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!currentSO) {
      alert('Silakan pilih salah satu Sales Order dari dropdown terlebih dahulu.');
      return;
    }

    if (currentSOLockedBy) {
      alert(`Sales Order ${currentSO.id} sedang diproses pembuatan Surat Jalannya oleh pengguna "${currentSOLockedBy}". Pembuatan dibatalkan untuk mencegah double Surat Jalan.`);
      return;
    }

    if (currentSO.status === 'completed' || currentSO.status === 'cancelled') {
      alert(`Sales Order ${currentSO.id} sudah berstatus "${currentSO.status}". Tidak dapat membuat Surat Jalan ganda.`);
      return;
    }

    if (!doNumber.trim()) {
      alert('Nomor Surat Jalan (DO) tidak boleh kosong.');
      return;
    }

    if (isDuplicateDONumber) {
      alert(`Nomor Surat Jalan "${doNumber.trim()}" sudah terdaftar! Silakan gunakan nomor lain agar tidak double.`);
      return;
    }

    const soItemsToShip = Object.entries(shipQuantities)
      .filter(([_, qty]) => Number(qty) > 0)
      .map(([name, quantity]) => ({
        name,
        quantity: Number(quantity)
      }));

    const extraItemsToShip = extraItems
      .filter(it => Number(it.quantity) > 0)
      .map(it => ({
        name: it.name,
        quantity: Number(it.quantity)
      }));

    const itemsToShip = [...soItemsToShip, ...extraItemsToShip];

    if (itemsToShip.length === 0) {
      alert('Kuantitas kirim harus lebih besar dari 0 untuk minimal 1 item.');
      return;
    }

    // Cek ketersediaan stok & kumpulkan peringatan jika stok kurang/minus
    const stockShortages: string[] = [];
    itemsToShip.forEach(it => {
      const currentAvail = stockLookup[it.name.toUpperCase()] ?? stockLookup[it.name] ?? 0;
      if (it.quantity > currentAvail) {
        const estMinus = currentAvail - it.quantity;
        stockShortages.push(
          `• ${it.name}: Kirim ${it.quantity} kg (Stok saat ini: ${currentAvail} kg) -> Estimasi stok menjadi: ${estMinus} kg`
        );
      }
    });

    // Tetap bisa diterbitkan dengan konfirmasi peringatan terlebih dahulu
    if (stockShortages.length > 0) {
      const confirmProceed = window.confirm(
        `PERINGATAN STOK KURANG / KOSONG:\n\n` +
        stockShortages.join('\n') +
        `\n\nStok di gudang akan menjadi minus setelah Surat Jalan ini diterbitkan.\nApakah Anda yakin ingin tetap menerbitkan Surat Jalan (DO) ini?`
      );
      if (!confirmProceed) return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        soId: currentSO.id,
        deliveryOrderId: doNumber.trim(),
        date,
        customer: currentSO.customer,
        items: itemsToShip
      });
    } catch (err: any) {
      console.error('Error in CreateDOFromSOModal:', err);
      alert('Gagal menerbitkan Surat Jalan: ' + (err.message || err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[210] flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto">
      <div className="bg-white rounded-3xl md:rounded-[2.5rem] w-full max-w-3xl shadow-2xl border border-slate-100 flex flex-col max-h-[94vh] overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-5 py-4 md:px-7 md:py-4 border-b border-slate-100 flex items-center justify-between bg-emerald-50/70">
          <div className="flex items-center gap-3">
            <div className="p-2 md:p-2.5 bg-emerald-600 text-white rounded-2xl shadow-md shadow-emerald-500/20">
              <TruckIcon className="h-5 w-5" />
            </div>
            <div>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800">
                Penerbitan Surat Jalan (DO)
              </span>
              <h2 className="text-base md:text-lg font-black text-slate-800 tracking-tight leading-tight">
                + Delivery Order
              </h2>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5">

          {/* 1. Tanggal Kirim, Nomor SJ, & Dropdown Dinamis Pilih SO */}
          <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-600 mb-1">
                  Tanggal Kirim (SJ) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => {
                    setDate(e.target.value);
                    setFilterByDeliveryDate(true);
                  }}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
                {availableSODates.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1 mt-1.5">
                    <span className="text-[9px] font-bold text-slate-400">Tgl SO Aktif:</span>
                    {availableSODates.slice(0, 4).map(([dStr, count]) => (
                      <button
                        key={dStr}
                        type="button"
                        onClick={() => {
                          setDate(dStr);
                          setFilterByDeliveryDate(true);
                        }}
                        className={`px-2 py-0.5 rounded-md text-[9px] font-black transition-all ${
                          date === dStr && filterByDeliveryDate
                            ? 'bg-emerald-600 text-white'
                            : 'bg-white border border-slate-200 text-slate-600 hover:border-emerald-400'
                        }`}
                      >
                        {new Date(dStr).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })} ({count})
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-600 mb-1">
                  Nomor Surat Jalan (DO) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={doNumber}
                  onChange={(e) => {
                    setIsManualDONumber(true);
                    setDoNumber(e.target.value);
                  }}
                  placeholder="Contoh: DO/260924/001"
                  className={`w-full px-3.5 py-2.5 bg-white border rounded-xl text-xs font-black text-slate-800 outline-none focus:ring-2 uppercase ${
                    isDuplicateDONumber
                      ? 'border-rose-400 focus:ring-rose-500 text-rose-700'
                      : 'border-slate-200 focus:ring-emerald-500'
                  }`}
                  required
                />
                {isDuplicateDONumber && (
                  <span className="text-[10px] font-bold text-rose-600 mt-1 block">
                    ⚠ Nomor SJ ini sudah ada di sistem! Gunakan nomor lain agar tidak double.
                  </span>
                )}
              </div>
            </div>

            {/* Dropdown Pilih SO Dinamis Berdasarkan Tanggal Kirim */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-700">
                  Pilih Sales Order (SO) <span className="text-rose-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setFilterByDeliveryDate(prev => !prev)}
                  className="text-[9px] font-black text-emerald-700 hover:text-emerald-900 uppercase underline"
                >
                  {filterByDeliveryDate
                    ? `Tampilkan Semua Tanggal (${activeSalesOrders.length} SO)`
                    : `Filter Sesuai Tanggal Kirim (${dateMatchedSalesOrders.length} SO)`}
                </button>
              </div>

              <select
                value={selectedSOId}
                onChange={(e) => setSelectedSOId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">
                  {dropdownSalesOrders.length === 0
                    ? `-- Tidak ada SO pada tanggal kirim ${new Date(date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })} --`
                    : '-- Pilih Sales Order (SO) --'}
                </option>
                {dropdownSalesOrders.map((so) => {
                  const totalOrdered = so.totalQty || 0;
                  const totalShipped = so.items.reduce((acc, it) => acc + (it.fulfilledQty || 0), 0);
                  const remaining = Math.max(0, totalOrdered - totalShipped);
                  const lockedBy = lockedSOs[so.id];
                  const tglStr = new Date(so.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });

                  return (
                    <option key={so.id} value={so.id} disabled={!!lockedBy}>
                      {!filterByDeliveryDate ? `[${tglStr}] ` : ''}
                      {so.id} — {so.customer} (Sisa: {remaining} kg)
                      {lockedBy ? ` [Diproses: ${lockedBy}]` : ''}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          {/* 2. Form Input Surat Jalan (DO) */}
          {currentSO && (
            <form onSubmit={handleSubmit} className="space-y-5">

              {/* Tabel Alokasi Item Pengiriman */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                      Alokasi Item Pengiriman
                    </h3>
                    <p className="text-[10px] text-slate-400 font-bold">
                      Tentukan jumlah kg barang yang dikirim. Pengiriman tetap diizinkan walau stok kosong/minus.
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={setAllToMax}
                      className="px-2.5 py-1 text-[9px] font-black uppercase tracking-wider bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
                    >
                      Kirim Semua Sisa
                    </button>
                    <button
                      type="button"
                      onClick={setAllToZero}
                      className="px-2.5 py-1 text-[9px] font-black uppercase tracking-wider bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
                    >
                      Reset 0
                    </button>
                  </div>
                </div>

                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm bg-white">
                  <div className="bg-slate-50 px-4 py-2.5 grid grid-cols-12 gap-2 text-[10px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-200">
                    <div className="col-span-4">Nama Item</div>
                    <div className="col-span-2 text-right">Pesanan SO</div>
                    <div className="col-span-2 text-right">Sisa SO</div>
                    <div className="col-span-2 text-right">Stok Gudang</div>
                    <div className="col-span-2 text-right">Kirim Sekarang</div>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {currentSO.items.map((it) => {
                      const fulfilled = it.fulfilledQty || 0;
                      const remaining = Math.max(0, it.quantity - fulfilled);
                      const stockAvailable = stockLookup[it.name.toUpperCase()] ?? stockLookup[it.name] ?? 0;
                      const currentShip = shipQuantities[it.name] ?? 0;
                      const isShortage = currentShip > stockAvailable;

                      return (
                        <div key={it.name} className="p-3 grid grid-cols-12 gap-2 items-center hover:bg-slate-50/50 transition-colors">
                          <div className="col-span-4">
                            <span className="font-black text-slate-800 text-xs block">{it.name}</span>
                            {it.notes && <span className="text-[10px] text-slate-400">{it.notes}</span>}
                          </div>

                          <div className="col-span-2 text-right text-xs font-bold text-slate-600">
                            {it.quantity} kg
                          </div>

                          <div className="col-span-2 text-right">
                            <span className={`text-xs font-black ${remaining === 0 ? 'text-slate-400' : 'text-blue-600'}`}>
                              {remaining} kg
                            </span>
                            {fulfilled > 0 && (
                              <span className="text-[8px] text-slate-400 block">({fulfilled} kg terkirim)</span>
                            )}
                          </div>

                          <div className="col-span-2 text-right">
                            <span className={`text-[11px] font-black px-2 py-0.5 rounded-lg inline-block ${
                              stockAvailable <= 0
                                ? 'bg-rose-50 text-rose-600 ring-1 ring-rose-200'
                                : stockAvailable < remaining
                                ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
                                : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                            }`}>
                              {stockAvailable.toLocaleString('id-ID')} kg
                            </span>
                            {stockAvailable <= 0 && (
                              <span className="text-[8px] font-bold text-rose-500 block mt-0.5">
                                {stockAvailable === 0 ? 'Kosong' : 'Minus'}
                              </span>
                            )}
                          </div>

                          <div className="col-span-2">
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                step="any"
                                min="0"
                                value={shipQuantities[it.name] ?? ''}
                                onChange={(e) => handleQtyChange(it.name, e.target.value)}
                                className={`w-full px-2.5 py-1.5 text-right border rounded-xl text-xs font-black outline-none transition-all ${
                                  isShortage
                                    ? 'border-amber-300 bg-amber-50/60 text-amber-900 focus:ring-2 focus:ring-amber-400'
                                    : 'border-slate-200 bg-slate-50 text-slate-800 focus:ring-2 focus:ring-emerald-500'
                                }`}
                              />
                              <span className="text-[10px] font-bold text-slate-400">kg</span>
                            </div>
                            {isShortage && (
                              <span className="text-[8px] font-black text-amber-600 block text-right mt-0.5">
                                ⚠ Melebihi stok ({stockAvailable - currentShip} kg)
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {/* Extra items (Di Luar Sales Order) */}
                    {extraItems.length > 0 && (
                      <div className="bg-amber-50/40 px-4 py-2 border-t border-amber-200/60">
                        <span className="text-[9px] font-black uppercase text-amber-800 tracking-wider">
                          Barang Tambahan (Di Luar Sales Order)
                        </span>
                      </div>
                    )}
                    {extraItems.map((it) => {
                      const stockAvailable = stockLookup[it.name.toUpperCase()] ?? stockLookup[it.name] ?? 0;
                      const currentShip = it.quantity || 0;
                      const isShortage = currentShip > stockAvailable;

                      return (
                        <div key={it.name} className="p-3 grid grid-cols-12 gap-2 items-center bg-amber-50/20 hover:bg-amber-50/40 transition-colors border-t border-slate-100">
                          <div className="col-span-4 flex items-center justify-between pr-2">
                            <div>
                              <span className="font-black text-slate-800 text-xs block">{it.name}</span>
                              <span className="text-[8px] font-black text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">Di Luar SO</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveExtraItem(it.name)}
                              className="text-slate-300 hover:text-rose-600 p-1 rounded-lg transition-colors"
                              title="Hapus barang tambahan ini"
                            >
                              <TrashIcon className="h-3.5 w-3.5" />
                            </button>
                          </div>

                          <div className="col-span-2 text-right text-xs font-bold text-slate-400">
                            -
                          </div>

                          <div className="col-span-2 text-right text-xs font-bold text-slate-400">
                            -
                          </div>

                          <div className="col-span-2 text-right">
                            <span className={`text-[11px] font-black px-2 py-0.5 rounded-lg inline-block ${
                              stockAvailable <= 0
                                ? 'bg-rose-50 text-rose-600 ring-1 ring-rose-200'
                                : stockAvailable < currentShip
                                ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
                                : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                            }`}>
                              {stockAvailable.toLocaleString('id-ID')} kg
                            </span>
                            {stockAvailable <= 0 && (
                              <span className="text-[8px] font-bold text-rose-500 block mt-0.5">
                                {stockAvailable === 0 ? 'Kosong' : 'Minus'}
                              </span>
                            )}
                          </div>

                          <div className="col-span-2">
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                step="any"
                                min="0"
                                value={it.quantity || ''}
                                onChange={(e) => handleExtraQtyChange(it.name, e.target.value)}
                                className={`w-full px-2.5 py-1.5 text-right border rounded-xl text-xs font-black outline-none transition-all ${
                                  isShortage
                                    ? 'border-amber-300 bg-amber-50/60 text-amber-900 focus:ring-2 focus:ring-amber-400'
                                    : 'border-slate-200 bg-slate-50 text-slate-800 focus:ring-2 focus:ring-emerald-500'
                                }`}
                              />
                              <span className="text-[10px] font-bold text-slate-400">kg</span>
                            </div>
                            {isShortage && (
                              <span className="text-[8px] font-black text-amber-600 block text-right mt-0.5">
                                ⚠ Melebihi stok ({stockAvailable - currentShip} kg)
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Button & Form Tambah Barang Di Luar SO */}
                {!showAddExtraForm ? (
                  <button
                    type="button"
                    onClick={() => setShowAddExtraForm(true)}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border border-slate-200 active:scale-95"
                  >
                    <PlusIcon className="h-3.5 w-3.5" />
                    + Tambah Item Barang di Luar Sales Order
                  </button>
                ) : (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-700">
                        Tambah Barang Tambahan ke Surat Jalan
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowAddExtraForm(false)}
                        className="text-slate-400 hover:text-slate-600 text-xs font-bold"
                      >
                        Batal
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                      <div className="sm:col-span-7">
                        <label className="block text-[8px] font-black uppercase tracking-wider text-slate-500 mb-1">
                          Nama Barang
                        </label>
                        <input
                          list="master-items-do-list"
                          type="text"
                          value={newExtraName}
                          onChange={(e) => setNewExtraName(e.target.value.toUpperCase())}
                          placeholder="Pilih atau ketik nama barang..."
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-black uppercase outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                        <datalist id="master-items-do-list">
                          {masterItems.map(m => (
                            <option key={m.id || m.name} value={m.name} />
                          ))}
                        </datalist>
                      </div>
                      <div className="sm:col-span-3">
                        <label className="block text-[8px] font-black uppercase tracking-wider text-slate-500 mb-1">
                          Kuantitas (kg)
                        </label>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={newExtraQty}
                          onChange={(e) => setNewExtraQty(e.target.value)}
                          placeholder="0"
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-black text-right outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <button
                          type="button"
                          onClick={handleAddExtraItem}
                          className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm transition-all"
                        >
                          + Tambah
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Total Delivery Summary Banner */}
              <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 block">
                    Total Muatan Kirim DO Ini
                  </span>
                  <span className="text-xs text-emerald-700 font-bold">
                    Untuk Pelanggan: <strong>{currentSO.customer}</strong>
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-black text-emerald-900">
                    {totalShipQty.toLocaleString('id-ID')}
                  </span>
                  <span className="text-xs font-bold text-emerald-700 ml-1">kg</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={onCancel}
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-slate-500 hover:bg-slate-100 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || totalShipQty <= 0 || isDuplicateDONumber || !!currentSOLockedBy}
                  className="px-7 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-emerald-500/20 active:scale-95 transition-all flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Menerbitkan DO...
                    </>
                  ) : (
                    <>
                      <CheckCircleIcon className="h-4 w-4" />
                      Terbitkan Surat Jalan (DO)
                    </>
                  )}
                </button>
              </div>

            </form>
          )}

        </div>

      </div>
    </div>
  );
};

export default CreateDOFromSOModal;
