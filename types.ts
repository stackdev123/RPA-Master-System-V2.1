export interface StockItem {
  name: string;
  quantity: number;
}

export interface MasterItem {
  id?: string;
  name: string;
}

export type ProductionItems = {
  [key: string]: number;
};

export interface Coop {
  id?: string;
  name: string;
  address: string;
}

export interface Customer {
  id?: string;
  name: string;
  address: string;
}

export interface TradingPurchaseRecord {
  supplier_name: string;
  nama_barang: string;
  kategori: string;
  catatan: string;
  id: string;
  tanggal: string;
  timestamp?: string;
  item_name: string;
  kg: number;
  harga_per_kg: number;
  total_harga: number;
}

export interface StockDisposalRecord {
  nama_barang: string;
  catatan: string;
  id: string;
  tanggal: string;
  timestamp?: string;
  item_name: string;
  kg: number;
  harga_valuasi_kg: number;
  total_kerugian: number;
  keterangan: string;
}

// Database: production_logs
export interface SupabaseProductionLog {
  id: string;
  tanggal_produksi: string;
  item_name: string;
  qty: number;
  timestamp: string;
  ekor: number;
  kg: number;
  mobil: string;
  plat: string;
  harga_beli_kg: number;
  kematian_ekor: number;
  kematian_kg: number;
  nama_kandang: string;
  driver: string;
  is_applied: boolean;
}

// Database: delivery_orders
export interface SupabaseDeliveryOrder {
  id: string;
  tanggal: string;
  nomor_sj: string;
  customer: string;
  nama_item: string;
  qty_kirim: number;
  qty_kirim2?: number;
  qty_diterima: number;
  qty_diterima2?: number;
  retur: number;
  susut_selisih: number;
  timestamp: string;
}

// Database: invoices
export interface SupabaseInvoice {
  id: string;
  tanggal: string;
  nomor_sj: string;
  timestamp: string;
  nomor_invoice: string;
  harga: number;
  total: number;
  transfer: number;
  cash: number;
  qty_diterima: number;
  keterangan: string;
  invoice_status: string;
  item_name: string; 
  customer: string;
}

export interface StockLog {
  id: string;
  timestamp: Date;
  type: 'Produksi' | 'Alokasi' | 'Opname' | 'Pembelian' | 'Pemusnahan';
  itemName: string;
  stockBefore: number;
  change: number;
  stockAfter: number;
  notes?: string;
}

export interface AllocationItem {
  name: string;
  quantity: number;
}

export interface DeliveryOrder {
  id: string; 
  date: Date;
  customer: string;
  customerAddress?: string;
  items: AllocationItem[];
  receivedItems?: AllocationItem[];
  rejectedItems?: AllocationItem[];
  status: 'pending' | 'received' | 'revised';
  invoiceId?: string;
  salesOrderId?: string;
}

export interface ProductionRecord {
  plateNumber: string;
  driverName: string;
  failedChickenCount: number;
  successChickenCount: number;
  estimatedChickenCount: number;
  id: string;
  date: Date;
  dateStr?: string;
  truckNumber: number;
  coopName: string;
  driver: string;
  licensePlate: string;
  initialEkor: number;
  initialKg: number;
  mortality: number;
  mortalityKg: number;
  pricePerKg?: number;
  items: ProductionItems;
  isApplied?: boolean;
}

export interface ProductionLog {
  id: string;
  timestamp: Date;
  action: string;
  record: ProductionRecord;
}

export interface InvoiceItem {
  name: string;
  quantity: number;
  price: number;
  total: number;
}

export interface InvoiceExtraCost {
  id: string;
  label: string;
  amount: number;
  type?: 'ppn' | 'shipping' | 'other';
  rate?: number;
}

export const serializeInvoiceExtraCosts = (cleanKeterangan: string, extraCosts?: InvoiceExtraCost[], billingAddress?: string): string => {
  const base = (cleanKeterangan || '')
    .replace(/\[BIAYA_LAIN:\[[\s\S]*?\]\]/g, '')
    .replace(/\[ALAMAT_TAGIHAN:[\s\S]*?\]/g, '')
    .replace('[REKAMAN]', '')
    .trim();
  const validCosts = (extraCosts || []).filter(c => Number(c.amount) > 0);
  let result = base;
  if (validCosts.length > 0) {
    result = `${result}${result ? ' ' : ''}[BIAYA_LAIN:${JSON.stringify(validCosts)}]`.trim();
  }
  if (billingAddress !== undefined && billingAddress.trim() !== '') {
    result = `${result}${result ? ' ' : ''}[ALAMAT_TAGIHAN:${JSON.stringify(billingAddress.trim())}]`.trim();
  }
  return result.trim();
};

export const parseInvoiceExtraCosts = (rawKeterangan?: string): { cleanKeterangan: string; extraCosts: InvoiceExtraCost[]; billingAddress?: string } => {
  const raw = rawKeterangan || '';
  const match = raw.match(/\[BIAYA_LAIN:(\[[\s\S]*?\])\]/);
  let extraCosts: InvoiceExtraCost[] = [];
  if (match && match[1]) {
    try {
      const parsed = JSON.parse(match[1]);
      if (Array.isArray(parsed)) {
        extraCosts = parsed.filter(c => c && Number(c.amount) > 0).map(c => ({
          id: String(c.id || Math.random()),
          label: String(c.label || 'Biaya Lainnya'),
          amount: Number(c.amount) || 0,
          type: c.type,
          rate: c.rate !== undefined ? Number(c.rate) : undefined
        }));
      }
    } catch {
      extraCosts = [];
    }
  }

  let billingAddress: string | undefined = undefined;
  const addrMatch = raw.match(/\[ALAMAT_TAGIHAN:("[\s\S]*?")\]/);
  if (addrMatch && addrMatch[1]) {
    try {
      const parsedAddr = JSON.parse(addrMatch[1]);
      if (typeof parsedAddr === 'string') {
        billingAddress = parsedAddr;
      }
    } catch {
      billingAddress = undefined;
    }
  }

  const cleanKeterangan = raw
    .replace(/\[BIAYA_LAIN:\[[\s\S]*?\]\]/g, '')
    .replace(/\[ALAMAT_TAGIHAN:"[\s\S]*?"\]/g, '')
    .trim();
  return { cleanKeterangan, extraCosts, billingAddress };
};

export interface Invoice {
  id: string; 
  date: Date;
  timestamp: string;
  deliveryOrderId: string;
  customer: string;
  customerAddress: string;
  itemName: string; 
  items: InvoiceItem[]; 
  subtotal: number;
  itemsSubtotal?: number;
  extraCosts?: InvoiceExtraCost[];
  previousDebt: number;
  totalAmount: number;
  transfer: number;
  cash: number;
  amountPaid: number;
  newDebt: number;
  qtyDiterima: number;
  keterangan: string;
  status: string;
  paymentMethod: string;
  editInvoiceId?: string;
  invoiceNumber?: string;
  customerName?: string;
  harga?: number;
  total?: number;
  nomor_invoice?: string;
}

export interface LedgerEntry {
  id: string;
  customerId: string;
  date: Date;
  timestamp: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  paymentMethod?: 'Transfer' | 'Cash';
  paymentProof?: string;
}

export interface ExpenseRecord {
  id: string;
  date: Date;
  category: string;
  amount: number;
  description: string;
  proofImage?: string;
}

export interface SalaryRecord {
  role: string;
  id: string;
  date: Date;
  employeeName: string;
  dailyRate: number;
  daysWorked: number;
  cashBon: number;
  totalSalary: number;
  notes?: string;
}

// Fixed: Added missing PlasticItem and PlasticLog interfaces
export interface PlasticItem {
  name: string;
  quantity: number;
  unit: 'Pcs' | 'Kg';
}

export interface PlasticLog {
  id: string;
  date: Date;
  type: 'Pembelian' | 'Pengeluaran';
  itemName: string;
  quantity: number;
  unit: 'Pcs' | 'Kg';
  pricePerUnit?: number;
  totalCost?: number;
  notes?: string;
}

export interface ActivityLog {
  created_at: string;
  id: string;
  username: string;
  action: string;
  target_table: string;
  target_id?: string;
  details?: any;
  timestamp: string;
}

export interface SalesOrderItem {
  name: string;
  quantity: number; // in kg
  price: number; // harga per kg
  total: number; // quantity * price
  fulfilledQty?: number; // qty yang sudah terbit menjadi DO
  notes?: string;
}

export type SalesOrderStatus = 'pending' | 'partial' | 'completed' | 'cancelled';

export interface SalesOrder {
  id: string; // e.g. "SO/260923/001"
  date: string; // YYYY-MM-DD
  customer: string;
  customerAddress?: string;
  paymentMethod: string; // Cash, Transfer, Tempo 7 Hari, Tempo 14 Hari, Tempo 30 Hari, etc.
  items: SalesOrderItem[];
  totalAmount: number;
  totalQty: number;
  status: SalesOrderStatus;
  notes?: string;
  deliveryOrderIds?: string[];
  timestamp: string;
  createdBy?: string;
}

export interface DOReturnRecord {
  id: string;
  date: string; // YYYY-MM-DD
  deliveryOrderId: string; // nomor_sj
  customer: string;
  itemName: string;
  quantity: number; // kg
  reason: string;
  action: 'restock' | 'disposal'; // 'restock' = kembali ke gudang, 'disposal' = dimusnahkan/afkir
  notes?: string;
  timestamp: string;
  createdBy?: string;
}

export type AppModuleId = 'reports' | 'production' | 'sales_orders' | 'logistics' | 'finance' | 'database' | 'dataLogger';
export type AccessLevel = 'none' | 'viewer' | 'edit';
export type UserPermissions = Record<string, AccessLevel>;

export interface AppSubModule {
  id: string; // e.g. 'logistics.stock', 'finance.invoices_list'
  key: string; // e.g. 'stock', 'invoices_list'
  label: string;
  description: string;
  category?: string; // Grouping category within the module
}

export interface AppModuleConfig {
  id: AppModuleId;
  label: string;
  description: string;
  subModules: AppSubModule[];
}

export interface UserAccount {
  id?: number;
  user: string;
  password?: string;
  role: string;
  permissions?: UserPermissions;
  created_at?: string;
}
