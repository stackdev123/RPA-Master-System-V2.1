
export const CHICKEN_PARTS = [
  'KRK',
  'SAYAP A',
  'SAYAP R',
  'PALA',
  'CEKER',
  'HATI AMPELA',
  'P.PENTUNG',
  'P.UTUH',
  'P.ATAS',
  'BLD',
  'BLD.K',
  'BLP LEBAR',
  'BLP ATAS',
  'BLP.K LEBAR',
  'BLPK ATAS',
  'KULIT',
  'USUS',
  'TLP I',
  'TLP L',
  'KARKAS',
  'AYAM PC',
  'AYAM TB',
  'TUNGGIR'
];

export const sortChickenParts = (a: string, b: string) => {
  const indexA = CHICKEN_PARTS.indexOf(a);
  const indexB = CHICKEN_PARTS.indexOf(b);
  if (indexA !== -1 && indexB !== -1) return indexA - indexB;
  if (indexA !== -1) return -1;
  if (indexB !== -1) return 1;
  return a.localeCompare(b);
};

import type { AppModuleId, AccessLevel, UserPermissions, AppModuleConfig } from './types';

export const APP_MODULES: AppModuleConfig[] = [
  { 
    id: 'reports', 
    label: 'Dashboard', 
    description: 'Dashboard Ringkasan PnL, Omzet & Metrik Bisnis',
    subModules: [
      { id: 'reports.dashboard', key: 'dashboard', label: 'Dashboard Ringkasan', category: 'Ringkasan & Metrik', description: 'Metrik ringkasan omzet, estimasi laba rugi, dan performa bisnis' },
    ]
  },
  { 
    id: 'production', 
    label: 'Produksi & Laporan RPA', 
    description: 'Input produksi harian, antrian produksi, dan Laporan Rekap Produksi',
    subModules: [
      { id: 'production.input', key: 'input', label: 'Input Pemotongan Ayam Hidup', category: 'Operasional RPA', description: 'Input data ayam datang dari kandang, timbang hidup, dan hasil karkas' },
      { id: 'production.queue', key: 'queue', label: 'Antrian & Approval Produksi', category: 'Operasional RPA', description: 'Monitoring antrian hasil pemotongan dan persetujuan supervisor' },
      { id: 'production.history', key: 'history', label: 'Laporan Rekap & Riwayat Produksi', category: 'Laporan RPA', description: 'Rekap harian pemotongan ayam hidup, persentase karkas, konversi, serta izin edit/hapus catatan produksi' },
    ]
  },
  { 
    id: 'sales_orders', 
    label: 'Sales Order & Riwayat Penjualan', 
    description: 'Pemesanan penjualan, pemenuhan DO, dan Riwayat Penjualan selesai',
    subModules: [
      { id: 'sales_orders.list', key: 'list', label: 'Sales Order', category: 'Order Pelanggan', description: 'Monitoring daftar pesanan customer, status pembayaran, dan progres DO' },
      { id: 'sales_orders.create', key: 'create', label: 'Buat Sales Order Baru', category: 'Order Pelanggan', description: 'Input order penjualan baru dengan partisi karkas dan kesepakatan tempo' },
      { id: 'sales_orders.create_do', key: 'create_do', label: 'Buat Surat Jalan', category: 'Eksekusi Pengiriman', description: 'Aksi memproses pesanan Sales Order menjadi Surat Jalan resmi' },
      { id: 'sales_orders.sales_history', key: 'sales_history', label: 'Riwayat Penjualan Selesai', category: 'Laporan Penjualan', description: 'Arsip riwayat pengiriman DO selesai dan faktur penjualan' },
    ]
  },
  { 
    id: 'logistics', 
    label: 'Logistik & Gudang', 
    description: 'Surat Jalan (DO), Stok fisik, Opname, Retur & Tolakan DO',
    subModules: [
      { id: 'logistics.stock', key: 'stock', label: 'Inventaris & Monitoring Stok Gudang', category: 'Stok & Gudang Fisik', description: 'Monitoring stok fisik karkas/ayam real-time di cold storage / gudang' },
      { id: 'logistics.stock_allocation', key: 'stock_allocation', label: 'Alokasi Stok / Pengeluaran SJ', category: 'Stok & Gudang Fisik', description: 'Otorisasi pengeluaran dan alokasi stok karkas untuk dimuat ke armada truk' },
      { id: 'logistics.stock_opname', key: 'stock_opname', label: 'Stock Opname Fisik', category: 'Stok & Gudang Fisik', description: 'Input opname fisik, pencatatan selisih susut/lebih, dan penyesuaian timbangan' },
      { id: 'logistics.trading', key: 'trading', label: 'Pembelian Trading Karkas', category: 'Stok & Gudang Fisik', description: 'Pencatatan pembelian karkas/ayam dari supplier luar dan histori transaksi' },
      { id: 'logistics.disposal', key: 'disposal', label: 'Pemusnahan Stok (Afkir / Rusak)', category: 'Stok & Gudang Fisik', description: 'Pemusnahan atau afkir barang busuk/rusak dan riwayat pemusnahan' },
      { id: 'logistics.stock_history', key: 'stock_history', label: 'Log Riwayat Mutasi Stok', category: 'Stok & Gudang Fisik', description: 'Melihat seluruh jejak pergerakan masuk, keluar, dan penyesuaian stok' },
      { id: 'logistics.delivery_orders', key: 'delivery_orders', label: 'Daftar Surat Jalan (DO)', category: 'Surat Jalan (DO)', description: 'Melihat seluruh dokumen Surat Jalan, cetak ulang, filter status, dan detail SJ' },
      { id: 'logistics.create_do_so', key: 'create_do_so', label: 'Tarik DO dari Sales Order (SO)', category: 'Surat Jalan (DO)', description: 'Menerbitkan Surat Jalan resmi berdasarkan pesanan Sales Order pelanggan' },
      { id: 'logistics.manual_sj', key: 'manual_sj', label: 'Surat Jalan Manual (Quick Print)', category: 'Surat Jalan (DO)', description: 'Membuat dan mencetak Surat Jalan darurat langsung tanpa alur Sales Order' },
      { id: 'logistics.do_receiving', key: 'do_receiving', label: 'Konfirmasi Timbangan Tiba (DO)', category: 'Surat Jalan (DO)', description: 'Input realisasi timbangan barang tiba di pelanggan dan pencatatan susut pengiriman' },
      { id: 'logistics.returns', key: 'returns', label: 'Retur & Tolakan DO', category: 'Retur & Rekapitulasi', description: 'Pencatatan barang ditolak / retur pelanggan untuk restock gudang atau disposal' },
      { id: 'logistics.daily_recap', key: 'daily_recap', label: 'Daily Recap Logistik', category: 'Retur & Rekapitulasi', description: 'Rekapitulasi pergerakan barang logistik masuk dan keluar per hari' },
    ]
  },
  { 
    id: 'finance', 
    label: 'Keuangan & Akuntansi', 
    description: 'Faktur Invoice, Buku Kas/Ledger, Biaya Operasional, Penggajian',
    subModules: [
      { id: 'finance.invoices_list', key: 'invoices_list', label: 'Invoices', category: 'Faktur & Piutang', description: 'Penerbitan faktur tagihan, daftar DO siap invoice, dan penutupan SO' },
      { id: 'finance.manual_invoice', key: 'manual_invoice', label: 'Invoice Manual (Quick Print)', category: 'Faktur & Piutang', description: 'Pembuatan faktur invoice darurat langsung tanpa alur Surat Jalan' },
      { id: 'finance.ledger', key: 'ledger', label: 'Buku Kas / Ledger Transaksi', category: 'Buku Kas & Pembayaran', description: 'Pencatatan penerimaan kas, pembayaran piutang customer, dan mutasi saldo' },
      { id: 'finance.chicken_prices', key: 'chicken_prices', label: 'Harga Beli Ayam (Kandang)', category: 'Harga & Biaya Pokok', description: 'Setting harga beli ayam hidup per kg untuk kalkulasi HPP' },
      { id: 'finance.expenses', key: 'expenses', label: 'Biaya Operasional', category: 'Beban Operasional', description: 'Pencatatan pengeluaran operasional dan bukti upload transaksi' },
      { id: 'finance.salaries', key: 'salaries', label: 'Penggajian Karyawan & Kasbon', category: 'Beban Operasional', description: 'Perhitungan gaji harian, kasbon karyawan, dan total penggajian' },
      { id: 'finance.stock_value', key: 'stock_value', label: 'Saldo Awal & Valuasi Stok', category: 'Valuasi & Keuangan', description: 'Setting saldo awal persediaan dan nilai valuasi persediaan cold storage' },
      { id: 'finance.profit_loss', key: 'profit_loss', label: 'Laporan Laba Rugi (PnL)', category: 'Valuasi & Keuangan', description: 'Kalkulasi laba kotor, laba bersih, beban operasional, dan margin usaha' },
      { id: 'finance.belanja_lb', key: 'belanja_lb', label: 'Laporan Belanja Live Bird', category: 'Valuasi & Keuangan', description: 'Rekapitulasi realisasi belanja ayam hidup dari peternak / kandang harian' },
      { id: 'finance.hpp', key: 'hpp', label: 'Analisis HPP Produksi', category: 'Valuasi & Keuangan', description: 'Analisis harga pokok produksi karkas ayam per kilogram' },
    ]
  },
  { 
    id: 'database', 
    label: 'Basis Data (Master Data)', 
    description: 'Master Kandang, Plat Truk, Customer, Item Produk, dan Backup',
    subModules: [
      { id: 'database.coops', key: 'coops', label: 'Master Nama Kandang', category: 'Master Operasional', description: 'Daftar peternak, kandang rekanan, dan lokasi' },
      { id: 'database.plates', key: 'plates', label: 'Master Armada Plat Truk', category: 'Master Operasional', description: 'Daftar armada kendaraan operasional dan supir' },
      { id: 'database.customers', key: 'customers', label: 'Master Customer & Plafon', category: 'Master Bisnis', description: 'Data pelanggan, alamat kirim, nomor kontak, dan limit piutang' },
      { id: 'database.items', key: 'items', label: 'Master Item Partisi Karkas', category: 'Master Bisnis', description: 'Daftar nama partisi karkas ayam, berat standar, dan satuan' },
      { id: 'database.backup', key: 'backup', label: 'Backup & Restore Database', category: 'Sistem & Keamanan', description: 'Ekspor database dan pencadangan data sistem' },
    ]
  },
];

export const checkIsSuperAdmin = (username?: string, roleStr?: string): boolean => {
  const u = (username || '').trim().toLowerCase();
  const r = (roleStr || '').trim().toLowerCase();
  if (u === 'superadmin' || u === 'superadmin2' || r === 'superadmin' || r === 'superadmin2') {
    return true;
  }
  if (roleStr && roleStr.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(roleStr);
      const pr = (parsed?.role || '').trim().toLowerCase();
      if (pr === 'superadmin' || pr === 'superadmin2') return true;
    } catch { }
  }
  return false;
};

export const getDefaultPermissions = (level: AccessLevel = 'edit', isSuperAdmin: boolean = false): UserPermissions => {
  const perms: UserPermissions = {};
  APP_MODULES.forEach(mod => {
    perms[mod.id] = level;
    if (mod.subModules) {
      mod.subModules.forEach(sub => {
        perms[sub.id] = level;
      });
    }
  });
  perms.dataLogger = isSuperAdmin ? 'edit' : 'none';
  perms['dataLogger.logs'] = isSuperAdmin ? 'edit' : 'none';
  return perms;
};

export const getSubModulePermission = (
  permissions: UserPermissions | undefined,
  moduleId: string,
  subKey?: string,
  isSuperAdmin: boolean = false
): AccessLevel => {
  if (moduleId === 'dataLogger') {
    return isSuperAdmin ? 'edit' : 'none';
  }
  if (isSuperAdmin) return 'edit';
  if (!permissions) return 'edit';
  if (subKey) {
    const fullKey = subKey.includes('.') ? subKey : `${moduleId}.${subKey}`;
    if (permissions[fullKey] !== undefined) return permissions[fullKey];
    if (permissions[subKey] !== undefined) return permissions[subKey];
  }
  return permissions[moduleId] || 'none';
};

export const canEditSubModule = (
  permissions: UserPermissions | undefined,
  moduleId: string,
  subKey?: string,
  isSuperAdmin: boolean = false
): boolean => {
  return getSubModulePermission(permissions, moduleId, subKey, isSuperAdmin) === 'edit';
};

export const canViewSubModule = (
  permissions: UserPermissions | undefined,
  moduleId: string,
  subKey?: string,
  isSuperAdmin: boolean = false
): boolean => {
  const perm = getSubModulePermission(permissions, moduleId, subKey, isSuperAdmin);
  return perm === 'edit' || perm === 'viewer';
};

export const parseUserPermissions = (roleStr: string): { isSuperAdmin: boolean; roleName: string; permissions: UserPermissions } => {
  const cleanRole = (roleStr || '').trim().toLowerCase();
  if (!roleStr || cleanRole === 'superadmin' || cleanRole === 'superadmin2') {
    return { isSuperAdmin: true, roleName: 'Superadmin', permissions: getDefaultPermissions('edit', true) };
  }
  try {
    const parsed = JSON.parse(roleStr);
    if (parsed && typeof parsed === 'object') {
      const parsedRole = (parsed.role || '').trim().toLowerCase();
      const isSuper = parsedRole === 'superadmin' || parsedRole === 'superadmin2';
      const perms = getDefaultPermissions(isSuper ? 'edit' : 'viewer', isSuper);
      if (parsed.permissions && typeof parsed.permissions === 'object') {
        APP_MODULES.forEach(m => {
          if (parsed.permissions[m.id] !== undefined) {
            perms[m.id] = parsed.permissions[m.id];
          }
          if (m.subModules) {
            m.subModules.forEach(sub => {
              if (parsed.permissions[sub.id] !== undefined) {
                perms[sub.id] = parsed.permissions[sub.id];
              } else if (sub.id === 'sales_orders.sales_history' && parsed.permissions['reports.sales_history'] !== undefined) {
                perms[sub.id] = parsed.permissions['reports.sales_history'];
              } else if (sub.id === 'production.history' && parsed.permissions['reports.production'] !== undefined) {
                perms[sub.id] = parsed.permissions['reports.production'];
              } else if (parsed.permissions[m.id] !== undefined) {
                perms[sub.id] = parsed.permissions[m.id];
              }
            });
            // Update parent module access based on submodules
            const anyAccessible = m.subModules.some(sub => perms[sub.id] !== 'none');
            const anyEditable = m.subModules.some(sub => perms[sub.id] === 'edit');
            perms[m.id] = anyEditable ? 'edit' : anyAccessible ? 'viewer' : 'none';
          }
        });
      }
      // Riwayat Aktivitas (dataLogger) hanya untuk Superadmin
      perms.dataLogger = isSuper ? 'edit' : 'none';
      perms['dataLogger.logs'] = isSuper ? 'edit' : 'none';
      return {
        isSuperAdmin: isSuper,
        roleName: parsed.name || (isSuper ? 'Superadmin' : 'Staff'),
        permissions: isSuper ? getDefaultPermissions('edit', true) : perms
      };
    }
  } catch {
    const isSuper = cleanRole === 'superadmin' || cleanRole === 'superadmin2';
    return {
      isSuperAdmin: isSuper,
      roleName: roleStr,
      permissions: getDefaultPermissions('edit', isSuper)
    };
  }
  return { isSuperAdmin: false, roleName: 'Staff', permissions: getDefaultPermissions('edit', false) };
};

export const INITIAL_STOCK_OCT_18: { [key: string]: number } = {
    'KRK': 0,
    'SAYAP A': 0,
    'SAYAP R': 0,
    'PALA': 0,
    'CEKER': 0,
    'HATI AMPELA': 0,
    'P.PENTUNG': 0,
    'P.UTUH': 0,
    'P.ATAS': 0,
    'BLD': 0,
    'BLD.K': 0,
    'BLP LEBAR': 0,
    'BLP ATAS': 0,
    'BLP.K LEBAR': 0,
    'BLPK ATAS': 0,
    'KULIT': 0,
    'USUS': 0,
    'TLP I': 0,
    'TLP L': 0,
    'KARKAS': 0,
    'AYAM PC': 0,
    'AYAM TB': 0,
    'TUNGGIR': 0
};

export const INITIAL_VALUATION_OCT_18 = 0;
