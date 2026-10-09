import { createClient } from '@supabase/supabase-js';
import type { SalesOrder, DOReturnRecord, UserAccount } from './types';
import {
  saveCachedGroupData,
  getCachedGroupData,
  enqueueOfflineMutation,
  getOfflineQueue,
  removeOfflineMutation,
  isNetworkError
} from './offlineSync';

const getSafeEnv = (key: string): string => {
  try {
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
      return process.env[key] || '';
    }
    if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
      return (import.meta as any).env[key] || '';
    }
  } catch (e) { }
  return '';
};

const supabaseUrl = getSafeEnv('VITE_SUPABASE_URL') || 'https://furhsxcsfrdxjphgedcv.supabase.co';
const supabaseAnonKey = getSafeEnv('VITE_SUPABASE_ANON_KEY') || 'sb_publishable_6kUcNFpB5u8AnxSkL0fuNw_QD4l5JcD';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

const formatError = (error: any): string => {
  if (!error) return 'Terjadi kesalahan yang tidak diketahui';
  return error.message || JSON.stringify(error);
};

const itemLocks = new Map<string, Promise<any>>();
let doMutationLock: Promise<any> = Promise.resolve();
let invoiceMutationLock: Promise<any> = Promise.resolve();

export const db = {
  verifyUser: async (user: string, pass: string) => {
    const { data, error } = await supabase
      .from('users')
      .select('user, role')
      .eq('user', user)
      .eq('password', pass)
      .maybeSingle();

    if (error) throw new Error(formatError(error));
    return data;
  },

  getUsers: async (): Promise<UserAccount[]> => {
    const { data, error } = await supabase
      .from('users')
      .select('id, user, role, created_at')
      .order('id', { ascending: true });

    if (error) throw new Error(formatError(error));
    return (data || []).map((u: any) => {
      let permissions = undefined;
      try {
        if (u.role && u.role.startsWith('{')) {
          const parsed = JSON.parse(u.role);
          permissions = parsed.permissions;
        }
      } catch { }
      return {
        id: u.id,
        user: u.user,
        role: u.role,
        permissions,
        created_at: u.created_at
      };
    });
  },

  addUser: async (userData: { user: string; password: string; role: string; permissions?: any }, loggedInUser: string) => {
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('user', userData.user.trim())
      .maybeSingle();

    if (existing) {
      throw new Error(`Username "${userData.user}" sudah digunakan. Silakan gunakan username lain.`);
    }

    let rolePayload = userData.role;
    if (userData.role !== 'superadmin' && userData.permissions) {
      rolePayload = JSON.stringify({
        role: userData.role || 'staff',
        permissions: userData.permissions
      });
    }

    const { data, error } = await supabase
      .from('users')
      .insert({
        user: userData.user.trim(),
        password: userData.password,
        role: rolePayload
      })
      .select();

    if (error) throw new Error(formatError(error));
    await db.addActivityLog(loggedInUser, 'TAMBAH_USER', 'users', userData.user.trim(), { role: userData.role });
    return data;
  },

  updateUser: async (id: number, userData: { user: string; password?: string; role: string; permissions?: any }, loggedInUser: string) => {
    let rolePayload = userData.role;
    if (userData.role !== 'superadmin' && userData.permissions) {
      rolePayload = JSON.stringify({
        role: userData.role || 'staff',
        permissions: userData.permissions
      });
    }

    const updatePayload: any = {
      user: userData.user.trim(),
      role: rolePayload
    };
    if (userData.password && userData.password.trim() !== '') {
      updatePayload.password = userData.password.trim();
    }

    const { data, error } = await supabase
      .from('users')
      .update(updatePayload)
      .eq('id', id)
      .select();

    if (error) throw new Error(formatError(error));
    await db.addActivityLog(loggedInUser, 'UPDATE_USER', 'users', userData.user.trim(), { role: userData.role });
    return data;
  },

  deleteUser: async (id: number, username: string, loggedInUser: string) => {
    if (username === loggedInUser) {
      throw new Error('Anda tidak dapat menghapus akun yang sedang Anda gunakan.');
    }
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', id);

    if (error) throw new Error(formatError(error));
    await db.addActivityLog(loggedInUser, 'HAPUS_USER', 'users', username);
  },

  addActivityLog: async (username: string, action: string, targetTable: string, targetId?: string, details?: any) => {
    try {
      const payload: any = {
        username,
        action,
        target_table: targetTable,
        target_id: targetId || null,
        details: details || null
      };

      const { error } = await supabase.from('activity_logs').insert(payload);

      if (error) {
        if (error.code === '401' || error.message?.includes('401') || error.message?.includes('JWT')) {
          console.error('SUPABASE 401 UNAUTHORIZED ERROR: Kunci API (Anon Key) Anda mungkin salah, kedaluwarsa, atau RLS (Row Level Security) di tabel activity_logs masih aktif dan memblokir akses.');
        } else {
          console.error('Supabase insert error:', error);
        }
      }
    } catch (e) {
      console.error('Error adding activity log:', e);
    }
  },

  getInitialData: async () => {
    const sleepMs = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    // Menjalankan satu query Supabase dengan retry otomatis (dengan backoff bertahap).
    // Kalau tetap gagal setelah beberapa kali percobaan, LEMPAR error (bukan diam-diam
    // mengembalikan data kosong). Ini penting: kalau dibiarkan return [] begitu saja,
    // fetchInitialData() di App.tsx akan tetap lanjut menyimpan data yang tidak lengkap
    // (misal ledger_entries kosong padahal invoices lengkap), sehingga hasil hitungan
    // tagihan/utang customer jadi salah (membengkak) sampai user refresh manual.
    // Dengan melempar error di sini, Promise.all di bawah akan reject, dan App.tsx
    // akan masuk ke blok catch-nya (tidak menimpa state lama yang masih benar).
    const runWithRetry = async (queryBuilderFactory: () => PromiseLike<{ data: any; error: any; count?: number | null }>, label: string, attempts: number = 3) => {
      let lastError: any = null;
      for (let i = 0; i < attempts; i++) {
        const { data, error, count } = await queryBuilderFactory();
        if (!error) return { data, count };
        lastError = error;
        console.warn(`Percobaan ke-${i + 1} gagal mengambil data "${label}":`, error.message || error);
        if (i < attempts - 1) await sleepMs(500 * (i + 1));
      }
      throw new Error(`Gagal mengambil data "${label}" setelah ${attempts} percobaan: ${formatError(lastError)}`);
    };

    const fetchAll = async (
      table: string,
      columns: string = '*',
      orderByColumn?: string,
      ascending: boolean = false,
      maxRows: number = 300000
    ) => {
      const buildQuery = (from: number, to: number) => {
        let q = supabase.from(table).select(columns).range(from, to);
        if (orderByColumn) {
          q = q.order(orderByColumn, { ascending });
        }
        return q;
      };

      const { data } = await runWithRetry(() => buildQuery(0, 999), table);
      if (!data) return [];
      if (data.length < 1000 || data.length >= maxRows) return data.slice(0, maxRows);

      const allRows = [...data];
      let from = 1000;
      const batchSize = 6; // High-throughput concurrent requests per batch up to 300,000 rows
      const step = 1000;

      while (allRows.length < maxRows) {
        const promises = [];
        for (let i = 0; i < batchSize; i++) {
          const pageFrom = from + i * step;
          if (pageFrom >= maxRows) break;
          const pageTo = Math.min(pageFrom + step - 1, maxRows - 1);
          promises.push(
            runWithRetry(() => buildQuery(pageFrom, pageTo), `${table} (baris ${pageFrom}-${pageTo})`)
              .then(res => ({ data: res.data || [], pageFrom }))
          );
        }

        if (promises.length === 0) break;

        const results = await Promise.all(promises);
        results.sort((a, b) => a.pageFrom - b.pageFrom);

        let hitEnd = false;
        for (const res of results) {
          allRows.push(...res.data);
          if (res.data.length < step) {
            hitEnd = true;
          }
        }

        if (hitEnd || allRows.length >= maxRows) {
          break;
        }
        from += batchSize * step;
      }

      // Deduplikasi baris jika id ada (untuk menghindari isu pagination postgres dengan timestamp yang identik)
      const uniqueRows = [];
      const seen = new Set();
      for (const row of allRows) {
        const key = row.id ? row.id : JSON.stringify(row);
        if (!seen.has(key)) {
          seen.add(key);
          uniqueRows.push(row);
          if (uniqueRows.length >= maxRows) break;
        }
      }
      return uniqueRows;
    };

    const [coops, customers, items, plates, stock, do_res, inv_res, exp_res, sal_res, ledger_res, stocklogs_res, prod_res, trad_res, disp_res, early_res] = await Promise.all([
      runWithRetry(() => supabase.from('master_coops').select('name, address').limit(300000), 'master_coops'),
      runWithRetry(() => supabase.from('master_customers').select('name, address').limit(300000), 'master_customers'),
      runWithRetry(() => supabase.from('master_items').select('name').limit(300000), 'master_items'),
      runWithRetry(() => supabase.from('master_plates').select('plat').limit(300000), 'master_plates'),
      runWithRetry(() => supabase.from('current_stock').select('item_name, quantity').limit(300000), 'current_stock'),
      fetchAll('delivery_orders', 'id, nomor_sj, tanggal, customer, nama_item, qty_kirim, qty_diterima, retur', 'timestamp', false, 300000),
      fetchAll('invoices', 'id, nomor_invoice, tanggal, timestamp, nomor_sj, customer, item_name, total, qty_diterima, harga, transfer, cash, keterangan, invoice_status', 'timestamp', false, 300000),
      fetchAll('expenses', 'id, tanggal, kategori, jumlah, description, proof_image_url', 'tanggal', false, 300000),
      fetchAll('salaries', 'id, tanggal, nama_karyawan, gaji_harian, hari_kerja, kasbon, total_gaji, catatan', 'tanggal', false, 300000),
      fetchAll('ledger_entries', 'id, tanggal, timestamp, debit, credit, balance, customer_id, metode_bayar, keterangan', 'timestamp', false, 300000),
      fetchAll('stock_logs', 'id, timestamp, tipe, item_name, stok_awal, perubahan, stok_akhir, keterangan', 'timestamp', false, 300000),
      fetchAll('production_logs', 'id, tanggal_produksi, mobil, nama_kandang, driver, ekor, kg, harga_beli_kg, kematian_ekor, kematian_kg, is_applied, plat, item_name, qty', 'tanggal_produksi', false, 300000),
      fetchAll('trading_purchases', 'id, tanggal, timestamp, item_name, kg, harga_per_kg', 'tanggal', false, 300000),
      fetchAll('stock_disposals', 'id, tanggal, timestamp, item_name, kg, harga_valuasi_kg, keterangan', 'tanggal', false, 300000),
      fetchAll('early_stock', 'tanggal, item_name, ending_stock', 'tanggal', false, 300000)
    ]);

    return {
      coops: coops.data || [],
      customers: customers.data || [],
      masterItems: items.data || [],
      plates: (plates.data || []).map((p: any) => p.plat),
      currentStock: stock.data || [],
      deliveryOrders: do_res || [],
      invoices: inv_res || [],
      expenses: exp_res || [],
      salaries: sal_res || [],
      ledger: ledger_res || [],
      stockLogs: stocklogs_res || [],
      productionLogs: prod_res || [],
      tradingPurchases: trad_res || [],
      stockDisposals: disp_res || [],
      earlyStock: early_res || [],
      activityLogs: []
    };
  },

  fetchTableGroup: async (groups: string[], maxRows: number = 300000) => {
    const sleepMs = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    const runWithRetry = async (queryBuilderFactory: () => PromiseLike<{ data: any; error: any; count?: number | null }>, label: string, attempts: number = 3) => {
      let lastError: any = null;
      for (let i = 0; i < attempts; i++) {
        const { data, error, count } = await queryBuilderFactory();
        if (!error) return { data, count };
        lastError = error;
        if (i < attempts - 1) await sleepMs(400 * (i + 1));
      }
      throw new Error(`Gagal mengambil data "${label}": ${formatError(lastError)}`);
    };

    const fetchAll = async (table: string, columns: string = '*', orderByColumn?: string, ascending: boolean = false) => {
      const buildQuery = (from: number, to: number) => {
        let q = supabase.from(table).select(columns).range(from, to);
        if (orderByColumn) {
          q = q.order(orderByColumn, { ascending });
        }
        return q;
      };

      const { data } = await runWithRetry(() => buildQuery(0, 999), table);
      if (!data) return [];
      if (data.length < 1000 || data.length >= maxRows) return data.slice(0, maxRows);

      const allRows = [...data];
      let from = 1000;
      const batchSize = 6;
      const step = 1000;

      while (allRows.length < maxRows) {
        const promises = [];
        for (let i = 0; i < batchSize; i++) {
          const pageFrom = from + i * step;
          if (pageFrom >= maxRows) break;
          const pageTo = Math.min(pageFrom + step - 1, maxRows - 1);
          promises.push(
            runWithRetry(() => buildQuery(pageFrom, pageTo), `${table} (${pageFrom}-${pageTo})`)
              .then(res => ({ data: res.data || [], pageFrom }))
          );
        }

        if (promises.length === 0) break;

        const results = await Promise.all(promises);
        results.sort((a, b) => a.pageFrom - b.pageFrom);

        let hitEnd = false;
        for (const res of results) {
          allRows.push(...res.data);
          if (res.data.length < step) {
            hitEnd = true;
          }
        }

        if (hitEnd || allRows.length >= maxRows) {
          break;
        }
        from += batchSize * step;
      }

      const uniqueRows = [];
      const seen = new Set();
      for (const row of allRows) {
        const key = row.id ? row.id : JSON.stringify(row);
        if (!seen.has(key)) {
          seen.add(key);
          uniqueRows.push(row);
          if (uniqueRows.length >= maxRows) break;
        }
      }
      return uniqueRows;
    };

    const result: Record<string, any> = {};
    const tasks: Promise<void>[] = [];
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

    const fetchGroupWithCache = async (groupKey: string, resultKey: string, fetcher: () => Promise<any[]>) => {
      if (isOffline) {
        const cached = await getCachedGroupData(groupKey);
        result[resultKey] = Array.isArray(cached) ? cached : [];
        return;
      }
      try {
        const rows = await fetcher();
        const validRows = rows || [];
        result[resultKey] = validRows;
        void saveCachedGroupData(groupKey, validRows);
      } catch (err) {
        console.warn(`[Offline Cache Fallback] Using cached data for ${groupKey}:`, err);
        const cached = await getCachedGroupData(groupKey);
        if (cached !== null) {
          result[resultKey] = Array.isArray(cached) ? cached : [];
        } else {
          throw err;
        }
      }
    };

    if (groups.includes('master')) {
      tasks.push(
        (async () => {
          if (isOffline) {
            const cachedMaster = await getCachedGroupData('master');
            if (cachedMaster) {
              result.coops = cachedMaster.coops || [];
              result.customers = cachedMaster.customers || [];
              result.masterItems = cachedMaster.masterItems || [];
              result.plates = cachedMaster.plates || [];
              result.currentStock = cachedMaster.currentStock || [];
              return;
            }
          }
          try {
            const [coops, customers, items, plates, stock] = await Promise.all([
              runWithRetry(() => supabase.from('master_coops').select('name, address').limit(maxRows), 'master_coops'),
              runWithRetry(() => supabase.from('master_customers').select('name, address').limit(maxRows), 'master_customers'),
              runWithRetry(() => supabase.from('master_items').select('name').limit(maxRows), 'master_items'),
              runWithRetry(() => supabase.from('master_plates').select('plat').limit(maxRows), 'master_plates'),
              runWithRetry(() => supabase.from('current_stock').select('item_name, quantity').limit(maxRows), 'current_stock')
            ]);
            const masterBundle = {
              coops: coops.data || [],
              customers: customers.data || [],
              masterItems: items.data || [],
              plates: (plates.data || []).map((p: any) => p.plat),
              currentStock: stock.data || []
            };
            Object.assign(result, masterBundle);
            void saveCachedGroupData('master', masterBundle);
          } catch (err) {
            const cachedMaster = await getCachedGroupData('master');
            if (cachedMaster) {
              Object.assign(result, cachedMaster);
            } else {
              throw err;
            }
          }
        })()
      );
    }

    if (groups.includes('production_logs')) {
      tasks.push(
        fetchGroupWithCache('production_logs', 'productionLogs', () =>
          fetchAll('production_logs', 'id, tanggal_produksi, mobil, nama_kandang, driver, ekor, kg, harga_beli_kg, kematian_ekor, kematian_kg, is_applied, plat, item_name, qty', 'tanggal_produksi', false)
        )
      );
    }

    if (groups.includes('delivery_orders')) {
      tasks.push(
        fetchGroupWithCache('delivery_orders', 'deliveryOrders', () =>
          fetchAll('delivery_orders', 'id, nomor_sj, tanggal, customer, nama_item, qty_kirim, qty_diterima, retur', 'timestamp', false)
        )
      );
    }

    if (groups.includes('invoices')) {
      tasks.push(
        fetchGroupWithCache('invoices', 'invoices', () =>
          fetchAll('invoices', 'id, nomor_invoice, tanggal, timestamp, nomor_sj, customer, item_name, total, qty_diterima, harga, transfer, cash, keterangan, invoice_status', 'timestamp', false)
        )
      );
    }

    if (groups.includes('expenses')) {
      tasks.push(
        fetchGroupWithCache('expenses', 'expenses', () =>
          fetchAll('expenses', 'id, tanggal, kategori, jumlah, description, proof_image_url', 'tanggal', false)
        )
      );
    }

    if (groups.includes('salaries')) {
      tasks.push(
        fetchGroupWithCache('salaries', 'salaries', () =>
          fetchAll('salaries', 'id, tanggal, nama_karyawan, gaji_harian, hari_kerja, kasbon, total_gaji, catatan', 'tanggal', false)
        )
      );
    }

    if (groups.includes('ledger')) {
      tasks.push(
        fetchGroupWithCache('ledger', 'ledger', () =>
          fetchAll('ledger_entries', 'id, tanggal, timestamp, debit, credit, balance, customer_id, metode_bayar, keterangan', 'timestamp', false)
        )
      );
    }

    if (groups.includes('stock_logs')) {
      tasks.push(
        fetchGroupWithCache('stock_logs', 'stockLogs', () =>
          fetchAll('stock_logs', 'id, timestamp, tipe, item_name, stok_awal, perubahan, stok_akhir, keterangan', 'timestamp', false)
        )
      );
    }

    if (groups.includes('trading_purchases')) {
      tasks.push(
        fetchGroupWithCache('trading_purchases', 'tradingPurchases', () =>
          fetchAll('trading_purchases', 'id, tanggal, timestamp, item_name, kg, harga_per_kg', 'tanggal', false)
        )
      );
    }

    if (groups.includes('stock_disposals')) {
      tasks.push(
        fetchGroupWithCache('stock_disposals', 'stockDisposals', () =>
          fetchAll('stock_disposals', 'id, tanggal, timestamp, item_name, kg, harga_valuasi_kg, keterangan', 'tanggal', false)
        )
      );
    }

    if (groups.includes('early_stock')) {
      tasks.push(
        fetchGroupWithCache('early_stock', 'earlyStock', () =>
          fetchAll('early_stock', 'tanggal, item_name, ending_stock', 'tanggal', false)
        )
      );
    }

    if (groups.includes('sales_orders')) {
      tasks.push(
        fetchGroupWithCache('sales_orders', 'salesOrders', () => db.getSalesOrders())
      );
    }

    if (groups.includes('do_returns')) {
      tasks.push(
        fetchGroupWithCache('do_returns', 'doReturns', () => db.getDOReturns())
      );
    }

    await Promise.all(tasks);
    return result;
  },

  getLedgerPaymentProof: async (id: string): Promise<string | null> => {
    try {
      const { data, error } = await supabase
        .from('ledger_entries')
        .select('bukti_bayar')
        .eq('id', id)
        .single();
      if (error) {
        console.error("Gagal mengambil bukti_bayar:", error);
        return null;
      }
      return data?.bukti_bayar || null;
    } catch (e) {
      console.error("Error in getLedgerPaymentProof:", e);
      return null;
    }
  },

  addMasterData: async (type: string, data: any, username: string) => {
    const tableMap: any = { coops: 'master_coops', licensePlates: 'master_plates', customers: 'master_customers', items: 'master_items' };
    const table = tableMap[type];
    if (!table) return;

    let payload: any = {};
    if (type === 'licensePlates') {
      payload = { plat: data.trim().toUpperCase() };
    } else if (type === 'items') {
      payload = { name: data.name.trim().toUpperCase() };
    } else {
      payload = { name: data.name.trim().toUpperCase(), address: (data.address || '').trim() };
    }

    const { error } = await supabase.from(table).insert(payload);
    if (error) throw new Error(formatError(error));
    await db.addActivityLog(username, 'ADD_MASTER', table, payload.name || payload.plat, payload);
  },

  deleteMasterData: async (type: string, identifier: string, username: string) => {
    const tableMap: any = { coops: 'master_coops', licensePlates: 'master_plates', customers: 'master_customers', items: 'master_items' };
    const table = tableMap[type];
    if (!table) return;

    const column = type === 'licensePlates' ? 'plat' : 'name';
    const { error } = await supabase.from(table).delete().eq(column, identifier);
    if (error) throw new Error(formatError(error));
    await db.addActivityLog(username, 'DELETE_MASTER', table, identifier, { identifier });
  },

  updateCustomerName: async (oldName: string, newName: string, newAddress: string, username: string) => {
    const cleanNewName = newName.trim().toUpperCase();
    const cleanOldName = oldName.trim().toUpperCase();

    // 1. Update master_customers
    const { error: masterError } = await supabase
      .from('master_customers')
      .update({ name: cleanNewName, address: newAddress.trim() })
      .eq('name', cleanOldName);

    if (masterError) throw new Error(formatError(masterError));

    // 2. Update delivery_orders
    await supabase
      .from('delivery_orders')
      .update({ customer: cleanNewName })
      .eq('customer', cleanOldName);

    // 3. Update invoices
    await supabase
      .from('invoices')
      .update({ customer: cleanNewName })
      .eq('customer', cleanOldName);

    // 4. Update ledger_entries
    await supabase
      .from('ledger_entries')
      .update({ customer_id: cleanNewName })
      .eq('customer_id', cleanOldName);

    await db.addActivityLog(username, 'UPDATE_CUSTOMER_NAME', 'master_customers', cleanOldName, { oldName: cleanOldName, newName: cleanNewName });
  },

  fetchActivityLogs: async (startDate?: string, endDate?: string, action?: string) => {
    let query = supabase.from('activity_logs').select('*').order('timestamp', { ascending: false }).limit(1000);
    if (startDate) query = query.gte('timestamp', startDate + 'T00:00:00Z');
    if (endDate) query = query.lte('timestamp', endDate + 'T23:59:59Z');
    if (action && action !== 'ALL') query = query.eq('action', action);

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching activity logs:', error);
      return [];
    }
    return data || [];
  },

  adjustStock: async (itemName: string, change: number, type: string, notes: string, username?: string, skipLog: boolean = false, customDate?: string) => {
    const normName = itemName.trim().toUpperCase();
    const existingLock = itemLocks.get(normName) || Promise.resolve();

    const currentAdjustment = (async () => {
      try {
        await existingLock;
        let effectiveItemName = itemName.trim();

        // 1. Dapatkan data stok saat ini (Real-time) dengan ilike untuk fleksibilitas
        const { data: matches, error: fetchError } = await supabase
          .from('current_stock')
          .select('quantity, item_name')
          .ilike('item_name', effectiveItemName);

        if (fetchError) throw fetchError;

        let currentItem = (matches || []).find(s => s.item_name.trim().toUpperCase() === normName);
        if (currentItem) {
          effectiveItemName = currentItem.item_name;
        }

        const initialStock = currentItem ? Number(currentItem.quantity) : 0;
        const finalStock = initialStock + change;

        console.log(`[db.adjustStock] ${effectiveItemName}: ${initialStock} -> ${finalStock} (perubahan: ${change})`);

        if (currentItem) {
          const { error: updateError } = await supabase
            .from('current_stock')
            .update({ quantity: finalStock, updated_at: new Date().toISOString() })
            .eq('item_name', effectiveItemName);
          if (updateError) throw updateError;
        } else {
          const { error: insertError } = await supabase
            .from('current_stock')
            .insert({ item_name: effectiveItemName, quantity: finalStock });
          if (insertError) throw insertError;
        }

        // If customDate is provided, use it (set to end of day to represent end state of that day)
        let logTimestamp = new Date().toISOString();
        if (customDate) {
          const d = new Date(customDate);
          d.setHours(23, 59, 59, 999);
          logTimestamp = d.toISOString();
        }

        const { error: logError } = await supabase.from('stock_logs').insert({
          item_name: effectiveItemName,
          tipe: type,
          stok_awal: initialStock,
          perubahan: change,
          stok_akhir: finalStock,
          keterangan: notes,
          timestamp: logTimestamp
        });
        if (logError) throw logError;

        if (username && !skipLog && type !== 'Produksi') {
          await db.addActivityLog(username, 'UPDATE', 'current_stock', effectiveItemName, { change, type, notes, customDate });
        }
      } catch (err) {
        console.error(`[db.adjustStock] FAILED for ${itemName}:`, err);
        throw err;
      }
    })();

    itemLocks.set(normName, currentAdjustment);
    return currentAdjustment;
  },

  syncStockOpname: async (itemName: string, targetQty: number, date: string, isToday: boolean, username: string) => {
    const normName = itemName.trim().toUpperCase();
    const existingLock = itemLocks.get(normName) || Promise.resolve();

    const currentAdjustment = (async () => {
      try {
        await existingLock;
        let effectiveItemName = itemName.trim();

        // 1. Get real-time live stock
        const { data: matches } = await supabase.from('current_stock').select('quantity, item_name').ilike('item_name', effectiveItemName);
        let currentItem = (matches || []).find(s => s.item_name.trim().toUpperCase() === normName);
        if (currentItem) effectiveItemName = currentItem.item_name;
        const liveStockNow = currentItem ? Number(currentItem.quantity) : 0;

        let systemQtyAtRefPoint = liveStockNow;

        // 2. If for past date, we need history
        if (!isToday) {
          const filterDate = new Date(date);
          filterDate.setHours(23, 59, 59, 999);

          const { data: logs } = await supabase.from('stock_logs')
            .select('stok_akhir, stok_awal')
            .ilike('item_name', effectiveItemName)
            .lte('timestamp', filterDate.toISOString())
            .order('timestamp', { ascending: false })
            .limit(1);

          if (logs && logs.length > 0) {
            systemQtyAtRefPoint = Number(logs[0].stok_akhir);
          } else {
            const { data: futureLogs } = await supabase.from('stock_logs')
              .select('stok_awal')
              .ilike('item_name', effectiveItemName)
              .gt('timestamp', filterDate.toISOString())
              .order('timestamp', { ascending: true })
              .limit(1);

            if (futureLogs && futureLogs.length > 0) {
              systemQtyAtRefPoint = Number(futureLogs[0].stok_awal);
            } else {
              systemQtyAtRefPoint = liveStockNow;
            }
          }
        }

        const variance = targetQty - systemQtyAtRefPoint;
        const newLiveStock = liveStockNow + variance;

        console.log(`[db.syncStockOpname] ${effectiveItemName}: RefSystem=${systemQtyAtRefPoint}, Target=${targetQty}, Var=${variance}, LiveNow=${liveStockNow} -> ${newLiveStock}`);

        if (Math.abs(variance) < 0.000001) return false;

        if (currentItem) {
          await supabase.from('current_stock').update({ quantity: newLiveStock, updated_at: new Date().toISOString() }).eq('item_name', effectiveItemName);
        } else {
          await supabase.from('current_stock').insert({ item_name: effectiveItemName, quantity: newLiveStock });
        }

        let logTimestamp = new Date().toISOString();
        if (!isToday) {
          const d = new Date(date);
          d.setHours(23, 59, 59, 999);
          logTimestamp = d.toISOString();
        }

        await supabase.from('stock_logs').insert({
          item_name: effectiveItemName,
          tipe: 'Opname',
          stok_awal: systemQtyAtRefPoint,
          perubahan: variance,
          stok_akhir: targetQty,
          keterangan: `Opname tanggal ${date}`,
          timestamp: logTimestamp
        });

        await db.addActivityLog(username, 'SYNC_OPNAME', 'current_stock', effectiveItemName, { targetQty, systemQtyAtRefPoint, variance, date });
        return true;
      } catch (err) {
        console.error(`[db.syncStockOpname] Error for ${itemName}:`, err);
        throw err;
      }
    })();

    itemLocks.set(normName, currentAdjustment);
    return currentAdjustment;
  },

  addProductionLogs: async (logs: any[], autoApply: boolean, username: string) => {
    const rowsToInsert = logs.map(l => ({ ...l, is_applied: autoApply }));
    try {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        throw new Error('Offline mode');
      }
      const { error } = await supabase.from('production_logs').insert(rowsToInsert);
      if (error) throw new Error(formatError(error));
      if (autoApply) {
        for (const log of logs) {
          await db.adjustStock(log.item_name, Number(log.qty), 'Produksi', `Mobil ${log.mobil} (${log.tanggal_produksi})`, username);
        }
      }
      await db.addActivityLog(username, 'CREATE', 'production_logs', 'multiple', { count: logs.length, autoApply });
    } catch (err: any) {
      if (isNetworkError(err)) {
        enqueueOfflineMutation('addProductionLogs', [logs, autoApply, username], `Input Produksi (${logs[0]?.nama_kandang || 'Batch'})`, username);
        const existing = (await getCachedGroupData('production_logs')) || [];
        const tempRows = rowsToInsert.map((r, idx) => ({ id: `offline_${Date.now()}_${idx}`, ...r }));
        await saveCachedGroupData('production_logs', [...tempRows, ...existing]);
        return;
      }
      throw err;
    }
  },

  applyProductionBatch: async (date: string, truckNumber: string, username: string) => {
    const { data: logs } = await supabase.from('production_logs').select('*').eq('tanggal_produksi', date).eq('mobil', truckNumber).eq('is_applied', false);
    if (!logs || logs.length === 0) return;
    for (const log of logs) {
      await db.adjustStock(log.item_name, Number(log.qty), 'Produksi', `Apply Stok: Mobil ${truckNumber} (${date})`, username);
    }
    await supabase.from('production_logs').update({ is_applied: true }).eq('tanggal_produksi', date).eq('mobil', truckNumber);
  },

  deleteProductionBatch: async (date: string, truckNumber: string, username: string) => {
    const { data: logs } = await supabase.from('production_logs').select('*').eq('tanggal_produksi', date).eq('mobil', truckNumber);
    if (logs && logs.length > 0) {
      for (const log of logs) {
        if (log.is_applied) {
          await db.adjustStock(log.item_name, -Number(log.qty), 'Produksi', `REVERSAL: Hapus Batch Mobil ${truckNumber} (${date})`, username);
        }
      }
      await supabase.from('production_logs').delete().eq('tanggal_produksi', date).eq('mobil', truckNumber);
    }
  },

  addDeliveryOrders: async (items: any[], username: string) => {
    const preparedItems = items.map(it => ({
      ...it,
      nomor_sj: String(it.nomor_sj || '').trim(),
      customer: String(it.customer || '').trim(),
      nama_item: String(it.nama_item || '').trim(),
      qty_diterima: it.qty_diterima !== undefined ? Number(it.qty_diterima) : 0,
      retur: it.retur !== undefined ? Number(it.retur) : 0,
      susut_selisih: it.susut_selisih !== undefined ? Number(it.susut_selisih) : 0,
      timestamp: it.timestamp || new Date().toISOString()
    }));

    const prevLock = doMutationLock;
    let releaseLock!: () => void;
    doMutationLock = new Promise<void>(resolve => { releaseLock = resolve; });

    try {
      await prevLock;
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        throw new Error('Offline mode');
      }

      const targetSJ = preparedItems[0]?.nomor_sj;
      const targetCustomer = preparedItems[0]?.customer;
      const targetDate = preparedItems[0]?.tanggal;

      if (targetSJ) {
        // Cek apakah Nomor SJ sudah pernah dibuat di database (mencegah double nomor SJ / klik ganda / 2 user bersamaan)
        const { data: existingSJRows, error: checkErr } = await supabase
          .from('delivery_orders')
          .select('nomor_sj, customer')
          .ilike('nomor_sj', targetSJ)
          .limit(1);

        if (!checkErr && existingSJRows && existingSJRows.length > 0) {
          throw new Error(`Nomor Surat Jalan "${targetSJ}" sudah terdaftar di sistem (Pelanggan: ${existingSJRows[0].customer}). Pembuatan dibatalkan untuk mencegah double Surat Jalan.`);
        }
      }

      const { error } = await supabase.from('delivery_orders').insert(preparedItems);
      if (error) {
        console.error('Supabase delivery_orders insert error:', error);
        throw new Error(formatError(error));
      }

      // Kurangi stok untuk setiap item yang dikirim secara sekuensial
      for (const item of preparedItems) {
        const qtyToUpdate = item.qty_kirim2 !== undefined ? Number(item.qty_kirim2) : Number(item.qty_kirim);
        if (qtyToUpdate > 0) {
          await db.adjustStock(item.nama_item, -qtyToUpdate, 'Alokasi', `SJ ${item.nomor_sj} untuk ${item.customer}`, username);
        }
      }

      await db.addActivityLog(username, 'CREATE', 'delivery_orders', preparedItems[0]?.nomor_sj, { count: preparedItems.length });
    } catch (err: any) {
      if (isNetworkError(err)) {
        enqueueOfflineMutation('addDeliveryOrders', [items, username], `Surat Jalan ${preparedItems[0]?.nomor_sj || ''}`, username);
        const existing = (await getCachedGroupData('delivery_orders')) || [];
        const tempRows = preparedItems.map((r, idx) => ({ id: `offline_${Date.now()}_${idx}`, ...r }));
        await saveCachedGroupData('delivery_orders', [...tempRows, ...existing]);
        return;
      }
      throw err;
    } finally {
      releaseLock();
    }
  },

  deleteDeliveryOrder: async (sjNumber: string, username: string) => {
    const { data: orders } = await supabase.from('delivery_orders').select('*').eq('nomor_sj', sjNumber);
    if (orders && orders.length > 0) {
      for (const order of orders) {
        // Kembalikan stok yang dikirim
        if (Number(order.qty_kirim) > 0) {
          await db.adjustStock(order.nama_item, Number(order.qty_kirim), 'Alokasi', `REVERSAL: Hapus SJ ${sjNumber}`, username);
        }
        // Jika ada retur, kurangi lagi (karena retur menambah stok, jadi reversal retur mengurangi stok)
        if (Number(order.retur) > 0) {
          await db.adjustStock(order.nama_item, -Number(order.retur), 'Alokasi', `REVERSAL RETUR: Hapus SJ ${sjNumber}`, username);
        }
      }
      await supabase.from('delivery_orders').delete().eq('nomor_sj', sjNumber);
      await supabase.from('invoices').delete().eq('nomor_sj', sjNumber);
      await db.addActivityLog(username, 'DELETE', 'delivery_orders', sjNumber, `${username} Menghapus DO No ${sjNumber} customer ${orders[0].customer}`);
    }
  },

  addInvoices: async (entries: any[], username: string): Promise<string> => {
    const prevLock = invoiceMutationLock;
    let releaseLock!: () => void;
    invoiceMutationLock = new Promise<void>(resolve => { releaseLock = resolve; });

    try {
      await prevLock;
      let finalInvoiceId = String(entries[0]?.nomor_invoice || '').trim();
      const rawSJStr = String(entries[0]?.nomor_sj || '').trim();
      const targetSJs = rawSJStr
        .split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.toUpperCase().startsWith('MANUAL-'));

      // 1. Cek langsung ke Supabase apakah salah satu SJ ini sudah dibuatkan Invoice oleh orang Finance lain
      for (const sj of targetSJs) {
        const { data: existingInvRows, error: checkErr } = await supabase
          .from('invoices')
          .select('nomor_invoice, nomor_sj, customer')
          .ilike('nomor_sj', `%${sj}%`);

        if (!checkErr && existingInvRows && existingInvRows.length > 0) {
          const matched = existingInvRows.find(row =>
            String(row.nomor_sj || '')
              .split(',')
              .map(x => x.trim().toLowerCase())
              .includes(sj.toLowerCase())
          );
          if (matched) {
            throw new Error(
              `Surat Jalan "${sj}" sudah memiliki Faktur Invoice (${matched.nomor_invoice}) yang baru saja diterbitkan! Pembuatan dibatalkan untuk mencegah double invoice.`
            );
          }
        }
      }

      // 2. Pastikan nomor_invoice tidak bentrok jika 2 orang Finance membuat invoice untuk SJ yang BERBEDA di detik yang sama
      if (finalInvoiceId) {
        const { data: collisionRows } = await supabase
          .from('invoices')
          .select('nomor_invoice')
          .eq('nomor_invoice', finalInvoiceId)
          .limit(1);

        if (collisionRows && collisionRows.length > 0) {
          const parts = finalInvoiceId.split('/');
          if (parts.length === 3) {
            const prefix = `${parts[0]}/${parts[1]}/`;
            const { data: sameDayRows } = await supabase
              .from('invoices')
              .select('nomor_invoice')
              .ilike('nomor_invoice', `${prefix}%`);
            const seqs = (sameDayRows || [])
              .map(r => parseInt(String(r.nomor_invoice || '').split('/').pop() || '0', 10))
              .filter(n => !isNaN(n));
            const nextSeq = (seqs.length > 0 ? Math.max(...seqs) : 0) + 1;
            finalInvoiceId = `${prefix}${nextSeq.toString().padStart(3, '0')}`;
          }
        }
      }

      const finalEntries = entries.map(e => ({
        ...e,
        nomor_invoice: finalInvoiceId
      }));

      const { error } = await supabase.from('invoices').insert(finalEntries);
      if (error) throw new Error(formatError(error));
      await db.addActivityLog(username, 'CREATE', 'invoices', finalInvoiceId, { count: finalEntries.length, nomor_sj: rawSJStr });
      return finalInvoiceId;
    } finally {
      releaseLock();
    }
  },

  updateInvoice: async (invoiceId: string, entries: any[], username: string) => {
    const prevLock = invoiceMutationLock;
    let releaseLock!: () => void;
    invoiceMutationLock = new Promise<void>(resolve => { releaseLock = resolve; });

    try {
      await prevLock;
      const rawSJStr = String(entries[0]?.nomor_sj || '').trim();
      const targetSJs = rawSJStr
        .split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.toUpperCase().startsWith('MANUAL-'));

      // Pastikan SJ yang digabungkan belum masuk ke Invoice lain milik Finance lain
      for (const sj of targetSJs) {
        const { data: existingInvRows, error: checkErr } = await supabase
          .from('invoices')
          .select('nomor_invoice, nomor_sj')
          .ilike('nomor_sj', `%${sj}%`);

        if (!checkErr && existingInvRows && existingInvRows.length > 0) {
          const matchedOther = existingInvRows.find(row =>
            String(row.nomor_invoice || '').trim().toLowerCase() !== invoiceId.trim().toLowerCase() &&
            String(row.nomor_sj || '')
              .split(',')
              .map(x => x.trim().toLowerCase())
              .includes(sj.toLowerCase())
          );
          if (matchedOther) {
            throw new Error(
              `Surat Jalan "${sj}" sudah terdaftar pada Faktur Invoice lain (${matchedOther.nomor_invoice})! Penggabungan dibatalkan untuk mencegah double invoice.`
            );
          }
        }
      }

      await supabase.from('invoices').delete().eq('nomor_invoice', invoiceId);
      const { error } = await supabase.from('invoices').insert(entries);
      if (error) throw new Error(formatError(error));
      await db.addActivityLog(username, 'UPDATE', 'invoices', invoiceId, { count: entries.length, nomor_sj: rawSJStr });
    } finally {
      releaseLock();
    }
  },

  deleteInvoice: async (id: string, username: string) => {
    const { error } = await supabase.from('invoices').delete().eq('nomor_invoice', id);
    if (error) throw new Error(formatError(error));
    await db.addActivityLog(username, 'DELETE', 'invoices', id);
  },

  addLedgerEntry: async (entry: any, username: string) => {
    try {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        throw new Error('Offline mode');
      }
      const { error } = await supabase.from('ledger_entries').insert(entry);
      if (error) throw new Error(formatError(error));
      await db.addActivityLog(username, 'CREATE', 'ledger_entries', entry.id, { amount: entry.credit || entry.debit });
    } catch (err: any) {
      if (isNetworkError(err)) {
        enqueueOfflineMutation('addLedgerEntry', [entry, username], `Ledger (${entry.customer_id || 'Kas'})`, username);
        const existing = (await getCachedGroupData('ledger')) || [];
        await saveCachedGroupData('ledger', [{ id: `offline_${Date.now()}`, timestamp: new Date().toISOString(), ...entry }, ...existing]);
        return;
      }
      throw err;
    }
  },

  deleteLedgerEntry: async (id: string, username: string) => {
    const { error } = await supabase.from('ledger_entries').delete().eq('id', id);
    if (error) throw new Error(formatError(error));
    await db.addActivityLog(username, 'DELETE', 'ledger_entries', id);
  },

  addExpense: async (data: any, username: string) => {
    const row = { tanggal: data.date instanceof Date ? data.date.toISOString().slice(0, 10) : String(data.date).slice(0, 10), kategori: data.category, jumlah: data.amount, description: data.description, proof_image_url: data.proofImage };
    try {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        throw new Error('Offline mode');
      }
      const { error } = await supabase.from('expenses').insert(row);
      if (error) throw new Error(formatError(error));
      await db.addActivityLog(username, 'CREATE', 'expenses', 'new', { category: data.category, amount: data.amount });
    } catch (err: any) {
      if (isNetworkError(err)) {
        enqueueOfflineMutation('addExpense', [{ ...data, date: row.tanggal }, username], `Biaya (${data.category})`, username);
        const existing = (await getCachedGroupData('expenses')) || [];
        await saveCachedGroupData('expenses', [{ id: `offline_${Date.now()}`, ...row }, ...existing]);
        return;
      }
      throw err;
    }
  },

  addExpenses: async (batch: any[], username: string) => {
    const entries = batch.map(data => ({
      tanggal: data.date instanceof Date ? data.date.toISOString().slice(0, 10) : String(data.date).slice(0, 10),
      kategori: data.category,
      jumlah: data.amount,
      description: data.description,
      proof_image_url: data.proofImage
    }));
    try {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        throw new Error('Offline mode');
      }
      const { error } = await supabase.from('expenses').insert(entries);
      if (error) throw new Error(formatError(error));
      for (const data of batch) {
        await db.addActivityLog(username, 'CREATE', 'expenses', 'batch', { category: data.category, amount: data.amount });
      }
    } catch (err: any) {
      if (isNetworkError(err)) {
        const serializableBatch = batch.map(d => ({ ...d, date: d.date instanceof Date ? d.date.toISOString().slice(0, 10) : String(d.date).slice(0, 10) }));
        enqueueOfflineMutation('addExpenses', [serializableBatch, username], `Batch Biaya (${batch.length} item)`, username);
        const existing = (await getCachedGroupData('expenses')) || [];
        const tempRows = entries.map((r, i) => ({ id: `offline_${Date.now()}_${i}`, ...r }));
        await saveCachedGroupData('expenses', [...tempRows, ...existing]);
        return;
      }
      throw err;
    }
  },

  addSalaries: async (batch: any[], username: string) => {
    const entries = batch.map(s => ({ tanggal: s.date instanceof Date ? s.date.toISOString().slice(0, 10) : String(s.date).slice(0, 10), nama_karyawan: s.employeeName, gaji_harian: s.dailyRate, hari_kerja: s.daysWorked, kasbon: s.cashBon, total_gaji: s.totalSalary, catatan: s.notes }));
    try {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        throw new Error('Offline mode');
      }
      const { error } = await supabase.from('salaries').insert(entries);
      if (error) throw new Error(formatError(error));
      await db.addActivityLog(username, 'CREATE', 'salaries', 'batch', { count: batch.length });
    } catch (err: any) {
      if (isNetworkError(err)) {
        const serializableBatch = batch.map(s => ({ ...s, date: s.date instanceof Date ? s.date.toISOString().slice(0, 10) : String(s.date).slice(0, 10) }));
        enqueueOfflineMutation('addSalaries', [serializableBatch, username], `Penggajian (${batch.length} orang)`, username);
        const existing = (await getCachedGroupData('salaries')) || [];
        const tempRows = entries.map((r, i) => ({ id: `offline_${Date.now()}_${i}`, ...r }));
        await saveCachedGroupData('salaries', [...tempRows, ...existing]);
        return;
      }
      throw err;
    }
  },

  deleteExpense: async (id: string, username: string) => {
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (error) throw new Error(formatError(error));
    await db.addActivityLog(username, 'DELETE', 'expenses', id);
  },

  deleteSalary: async (id: string, username: string) => {
    const { error } = await supabase.from('salaries').delete().eq('id', id);
    if (error) throw new Error(formatError(error));
    await db.addActivityLog(username, 'DELETE', 'salaries', id);
  },

  updateProductionPrices: async (updates: { recordId: string, pricePerKg: number }[], _username: string) => {
    for (const u of updates) {
      // First, get the date and truck number for this record to update the entire batch
      const { data: record } = await supabase
        .from('production_logs')
        .select('tanggal_produksi, mobil')
        .eq('id', u.recordId)
        .maybeSingle();

      if (record) {
        const { error } = await supabase
          .from('production_logs')
          .update({ harga_beli_kg: u.pricePerKg })
          .eq('tanggal_produksi', record.tanggal_produksi)
          .eq('mobil', record.mobil);

        if (error) throw new Error(formatError(error));
      }
    }
  },

  addTradingPurchase: async (data: any, username: string) => {
    const { error } = await supabase.from('trading_purchases').insert(data);
    if (error) throw new Error(formatError(error));
    await db.adjustStock(data.item_name, Number(data.kg), 'Pembelian', `Trading Purchase (${data.tanggal})`, username);
    await db.addActivityLog(username, 'CREATE', 'trading_purchases', 'new', { item: data.item_name, kg: data.kg });
  },

  editTradingPurchase: async (id: string, data: any, username: string) => {
    const { data: original } = await supabase.from('trading_purchases').select('*').eq('id', id).single();
    if (!original) throw new Error("Original record not found");

    // Reverse original stock
    await db.adjustStock(original.item_name, -Number(original.kg), 'Edit Pembelian', `Reversal Edit Trading Purchase (${original.tanggal})`, username);

    // Apply new stock
    await db.adjustStock(data.item_name, Number(data.kg), 'Edit Pembelian', `Apply Edit Trading Purchase (${data.tanggal})`, username);

    const { error } = await supabase.from('trading_purchases').update(data).eq('id', id);
    if (error) throw new Error(formatError(error));

    await db.addActivityLog(username, 'UPDATE', 'trading_purchases', id, { new_data: data, old_data: original });
  },

  deleteTradingPurchase: async (id: string, username: string) => {
    const { data: original } = await supabase.from('trading_purchases').select('*').eq('id', id).single();
    if (original) {
      await db.adjustStock(original.item_name, -Number(original.kg), 'Hapus Pembelian', `Reversal Hapus Trading Purchase (${original.tanggal})`, username);
    }
    const { error } = await supabase.from('trading_purchases').delete().eq('id', id);
    if (error) throw new Error(formatError(error));
    await db.addActivityLog(username, 'DELETE', 'trading_purchases', id);
  },

  addStockDisposal: async (data: any, username: string) => {
    const { error } = await supabase.from('stock_disposals').insert(data);
    if (error) throw new Error(formatError(error));
    await db.adjustStock(data.item_name, -Number(data.kg), 'Pemusnahan', `Pemusnahan: ${data.keterangan}`, username, false);
    await db.addActivityLog(username, 'CREATE', 'stock_disposals', 'new', { item: data.item_name, kg: data.kg });
  },

  editStockDisposal: async (id: string, data: any, username: string) => {
    const { data: original } = await supabase.from('stock_disposals').select('*').eq('id', id).single();
    if (!original) throw new Error("Original record not found");

    // Reverse original stock (disposal reduces stock, so reversal adds it)
    await db.adjustStock(original.item_name, Number(original.kg), 'Edit Pemusnahan', `Reversal Edit Pemusnahan (${original.tanggal})`, username, false);

    // Apply new stock
    await db.adjustStock(data.item_name, -Number(data.kg), 'Edit Pemusnahan', `Apply Edit Pemusnahan (${data.tanggal})`, username, false);

    const { error } = await supabase.from('stock_disposals').update(data).eq('id', id);
    if (error) throw new Error(formatError(error));
    await db.addActivityLog(username, 'UPDATE', 'stock_disposals', id, { new_data: data, old_data: original });
  },

  deleteStockDisposal: async (id: string, username: string) => {
    const { data: original } = await supabase.from('stock_disposals').select('*').eq('id', id).single();
    if (original) {
      await db.adjustStock(original.item_name, Number(original.kg), 'Hapus Pemusnahan', `Reversal Hapus Pemusnahan (${original.tanggal})`, username, false);
    }
    const { error } = await supabase.from('stock_disposals').delete().eq('id', id);
    if (error) throw new Error(formatError(error));
    await db.addActivityLog(username, 'DELETE', 'stock_disposals', id);
  },

  upsertEarlyStock: async (tanggal: string, amount: number, username: string) => {
    // Memberikan prioritas pada input manual dengan menghapus data stok per-item (jika ada) 
    // untuk tanggal tersebut dan menggantinya dengan satu record total snapshot.

    // 1. Hapus semua data existing untuk tanggal tersebut
    await supabase
      .from('early_stock')
      .delete()
      .eq('tanggal', tanggal);

    // 2. Insert record baru sebagai representasi total
    const { error } = await supabase
      .from('early_stock')
      .insert({
        tanggal,
        item_name: 'TOTAL_SNAPSHOT',
        ending_stock: amount
      });

    if (error) throw new Error(formatError(error));

    await db.addActivityLog(username, 'UPSERT_ENDING_INVENTORY', 'early_stock', tanggal, { amount });
  },

  deleteEarlyStock: async (tanggal: string, username: string) => {
    const { error } = await supabase
      .from('early_stock')
      .delete()
      .eq('tanggal', tanggal);
    if (error) throw new Error(formatError(error));
    await db.addActivityLog(username, 'DELETE_ENDING_INVENTORY', 'early_stock', tanggal);
  },
  executeCutoff: async (cutoffDateStr: string, cutoffDebts: Record<string, number>, cutoffStocks: Record<string, number>, username: string) => {
    const cutoffTimestamp = cutoffDateStr + 'T00:00:00.000Z';
    const tablesWithTanggal = ['delivery_orders', 'invoices', 'expenses', 'salaries', 'ledger_entries', 'trading_purchases', 'stock_disposals'];
    for (const table of tablesWithTanggal) {
      await supabase.from(table).delete().lt('tanggal', cutoffDateStr);
    }
    await supabase.from('production_logs').delete().lt('tanggal_produksi', cutoffDateStr);
    await supabase.from('stock_logs').delete().lt('timestamp', cutoffTimestamp);

    const ledgerPromises = Object.entries(cutoffDebts).map(([customerId, balance]) => {
      if (balance > 0) {
        return supabase.from('ledger_entries').insert({
          customer_id: customerId,
          tanggal: cutoffDateStr,
          keterangan: 'Saldo Awal Cutoff',
          debit: balance,
          credit: 0
        });
      }
    });
    await Promise.all(ledgerPromises);

    const stockPromises = Object.entries(cutoffStocks).map(([itemName, qty]) => {
      if (qty !== 0) {
        return supabase.from('stock_logs').insert({
          item_name: itemName,
          timestamp: cutoffTimestamp,
          tipe: 'CUTOFF',
          stok_awal: 0,
          perubahan: qty,
          stok_akhir: qty,
          keterangan: 'Stok Awal Cutoff'
        });
      }
    });
    await Promise.all(stockPromises);

    await db.addActivityLog(username, 'CUTOFF', 'system', 'all', { cutoff_date: cutoffDateStr });
  },

  getSalesOrders: async (): Promise<SalesOrder[]> => {
    // 1. Coba ambil langsung dari Supabase tabel sales_orders
    try {
      const { data, error } = await supabase
        .from('sales_orders')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(300000);

      if (!error && Array.isArray(data)) {
        if (data.length > 0) {
          const mapped: SalesOrder[] = data.map((row: any) => ({
            id: row.id,
            date: row.date ? String(row.date).split('T')[0] : '',
            customer: row.customer || '',
            customerAddress: row.customer_address || '',
            paymentMethod: row.payment_method || 'Cash',
            items: Array.isArray(row.items) ? row.items : (typeof row.items === 'string' ? JSON.parse(row.items || '[]') : []),
            totalAmount: Number(row.total_amount || 0),
            totalQty: Number(row.total_qty || 0),
            status: row.status || 'pending',
            notes: row.notes || '',
            deliveryOrderIds: Array.isArray(row.delivery_order_ids) ? row.delivery_order_ids : (typeof row.delivery_order_ids === 'string' ? JSON.parse(row.delivery_order_ids || '[]') : []),
            timestamp: row.timestamp || row.created_at || new Date().toISOString(),
            createdBy: row.created_by || ''
          }));
          localStorage.setItem('rpa_sales_orders', JSON.stringify(mapped));
          return mapped;
        } else {
          // Jika tabel Supabase masih kosong, cek apakah ada data lama di localStorage/API untuk dimigrasikan
          const cached = localStorage.getItem('rpa_sales_orders');
          if (cached) {
            try {
              const localOrders: SalesOrder[] = JSON.parse(cached);
              if (localOrders.length > 0) {
                const rows = localOrders.map(order => ({
                  id: order.id,
                  date: order.date,
                  customer: order.customer,
                  customer_address: order.customerAddress || null,
                  payment_method: order.paymentMethod || 'Cash',
                  items: order.items || [],
                  total_amount: Number(order.totalAmount || 0),
                  total_qty: Number(order.totalQty || 0),
                  status: order.status || 'pending',
                  notes: order.notes || null,
                  delivery_order_ids: order.deliveryOrderIds || [],
                  created_by: order.createdBy || 'system',
                  timestamp: order.timestamp || new Date().toISOString()
                }));
                await supabase.from('sales_orders').upsert(rows, { onConflict: 'id' });
                return localOrders;
              }
            } catch (syncErr) {
              console.warn('Gagal migrasi otomatis local sales orders ke Supabase:', syncErr);
            }
          }
        }
      } else if (error) {
        console.warn('Supabase sales_orders query error:', error.message || error);
      }
    } catch (e) {
      console.warn('Failed to fetch sales_orders from Supabase:', e);
    }

    // 2. Fallback ke API server lokal
    try {
      const res = await fetch('/api/sales-orders');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          localStorage.setItem('rpa_sales_orders', JSON.stringify(data));
          return data;
        }
      }
    } catch (e) {
      console.warn('API /api/sales-orders unavailable, reading local storage:', e);
    }

    // 3. Fallback ke localStorage
    const cached = localStorage.getItem('rpa_sales_orders');
    return cached ? JSON.parse(cached) : [];
  },

  saveSalesOrder: async (order: SalesOrder, username: string): Promise<void> => {
    // 1. Simpan langsung ke Supabase tabel sales_orders
    try {
      const payload: any = {
        id: order.id,
        date: order.date,
        customer: order.customer,
        customer_address: order.customerAddress || null,
        payment_method: order.paymentMethod || 'Cash',
        items: order.items || [],
        total_amount: Number(order.totalAmount || 0),
        total_qty: Number(order.totalQty || 0),
        status: order.status || 'pending',
        notes: order.notes || null,
        delivery_order_ids: order.deliveryOrderIds || [],
        created_by: order.createdBy || username,
        timestamp: order.timestamp || new Date().toISOString()
      };

      const { error } = await supabase
        .from('sales_orders')
        .upsert(payload, { onConflict: 'id' });

      if (error) {
        console.error('Gagal menyimpan Sales Order ke Supabase:', error.message || error);
        throw new Error(`Supabase Error: ${error.message}`);
      }
    } catch (err: any) {
      console.warn('Simpan ke Supabase gagal atau offline, fallback ke backup lokal:', err);
      // Jika throw error karena Supabase bermasalah, lemparkan jika itu fatal, atau lanjutkan jika ingin offline backup
      if (err.message?.includes('Supabase Error')) {
        throw err;
      }
    }

    // 2. Simpan ke cache localStorage
    const cached = localStorage.getItem('rpa_sales_orders');
    const orders: SalesOrder[] = cached ? JSON.parse(cached) : [];
    const idx = orders.findIndex(o => o.id === order.id);
    if (idx >= 0) {
      orders[idx] = { ...orders[idx], ...order };
    } else {
      orders.unshift(order);
    }
    localStorage.setItem('rpa_sales_orders', JSON.stringify(orders));

    // 3. Simpan ke API lokal file backup
    try {
      await fetch('/api/sales-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(order)
      });
    } catch (e) {
      console.warn('Failed to post to /api/sales-orders backup:', e);
    }

    // 4. Catat riwayat aktivitas di database
    await db.addActivityLog(username, 'SAVE_SALES_ORDER', 'sales_orders', order.id, {
      customer: order.customer,
      totalAmount: order.totalAmount,
      totalQty: order.totalQty,
      status: order.status
    });
  },

  deleteSalesOrder: async (id: string, username: string): Promise<void> => {
    // 1. Hapus dari Supabase tabel sales_orders
    try {
      const { error } = await supabase
        .from('sales_orders')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Gagal menghapus Sales Order di Supabase:', error.message || error);
        throw new Error(`Supabase Error: ${error.message}`);
      }
    } catch (err: any) {
      console.warn('Delete dari Supabase gagal, fallback:', err);
      if (err.message?.includes('Supabase Error')) {
        throw err;
      }
    }

    // 2. Hapus dari localStorage
    const cached = localStorage.getItem('rpa_sales_orders');
    if (cached) {
      const orders: SalesOrder[] = JSON.parse(cached);
      const filtered = orders.filter(o => o.id !== id);
      localStorage.setItem('rpa_sales_orders', JSON.stringify(filtered));
    }

    // 3. Hapus dari API lokal file backup
    try {
      await fetch(`/api/sales-orders/${encodeURIComponent(id)}`, { method: 'DELETE' });
    } catch (e) {
      console.warn('Failed to delete from /api/sales-orders backup:', e);
    }

    // 4. Catat riwayat aktivitas
    await db.addActivityLog(username, 'DELETE_SALES_ORDER', 'sales_orders', id);
  },

  getDOReturns: async (): Promise<DOReturnRecord[]> => {
    // 1. Coba ambil dari Supabase tabel do_returns
    try {
      const { data, error } = await supabase
        .from('do_returns')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(300000);

      if (!error && Array.isArray(data)) {
        if (data.length > 0) {
          const mapped: DOReturnRecord[] = data.map((row: any) => ({
            id: row.id,
            date: row.date ? String(row.date).split('T')[0] : '',
            deliveryOrderId: row.delivery_order_id,
            customer: row.customer,
            itemName: row.item_name,
            quantity: Number(row.quantity || 0),
            reason: row.reason || '',
            action: row.action,
            notes: row.notes || '',
            timestamp: row.timestamp || row.created_at || new Date().toISOString(),
            createdBy: row.created_by || ''
          }));
          localStorage.setItem('rpa_do_returns', JSON.stringify(mapped));
          return mapped;
        } else {
          // Migrasi data lokal jika ada
          const cached = localStorage.getItem('rpa_do_returns');
          if (cached) {
            try {
              const localReturns: DOReturnRecord[] = JSON.parse(cached);
              if (localReturns.length > 0) {
                const rows = localReturns.map(r => ({
                  id: r.id,
                  date: r.date,
                  delivery_order_id: r.deliveryOrderId,
                  customer: r.customer,
                  item_name: r.itemName,
                  quantity: Number(r.quantity),
                  reason: r.reason || null,
                  action: r.action,
                  notes: r.notes || null,
                  created_by: r.createdBy || 'system',
                  timestamp: r.timestamp || new Date().toISOString()
                }));
                await supabase.from('do_returns').upsert(rows, { onConflict: 'id' });
                return localReturns;
              }
            } catch (syncErr) {
              console.warn('Gagal migrasi lokal DO returns ke Supabase:', syncErr);
            }
          }
        }
      }
    } catch (e) {
      console.warn('Failed to fetch do_returns from Supabase:', e);
    }

    // 2. Fallback ke API server lokal
    try {
      const res = await fetch('/api/do-returns');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          localStorage.setItem('rpa_do_returns', JSON.stringify(data));
          return data;
        }
      }
    } catch (e) {
      console.warn('API /api/do-returns unavailable, reading local storage:', e);
    }

    // 3. Fallback ke localStorage
    const cached = localStorage.getItem('rpa_do_returns');
    return cached ? JSON.parse(cached) : [];
  },

  saveDOReturn: async (record: DOReturnRecord, username: string): Promise<void> => {
    // 1. Simpan ke Supabase tabel do_returns
    try {
      const returnPayload = {
        id: record.id,
        date: record.date,
        delivery_order_id: record.deliveryOrderId,
        customer: record.customer,
        item_name: record.itemName,
        quantity: Number(record.quantity),
        reason: record.reason || null,
        action: record.action,
        notes: record.notes || null,
        created_by: record.createdBy || username,
        timestamp: record.timestamp || new Date().toISOString()
      };
      const { error: retErr } = await supabase
        .from('do_returns')
        .upsert(returnPayload, { onConflict: 'id' });
      if (retErr) {
        console.warn('Gagal simpan ke Supabase do_returns:', retErr.message || retErr);
      }
    } catch (err) {
      console.warn('Error saat menyimpan do_return ke Supabase:', err);
    }

    // 2. Update delivery_orders table in Supabase
    const { data: existingRows } = await supabase
      .from('delivery_orders')
      .select('*')
      .eq('nomor_sj', record.deliveryOrderId)
      .eq('nama_item', record.itemName);

    if (existingRows && existingRows.length > 0) {
      const row = existingRows[0];
      const prevRetur = Number(row.retur || 0);
      const newRetur = prevRetur + Number(record.quantity);
      const qtyKirim = Number(row.qty_kirim || 0);
      const newDiterima = Math.max(0, qtyKirim - newRetur);

      await supabase.from('delivery_orders').update({
        retur: newRetur,
        qty_diterima: newDiterima,
        qty_diterima2: newDiterima
      }).eq('id', row.id);
    }

    // 3. Adjust Stock based on action
    if (record.action === 'restock') {
      await db.adjustStock(
        record.itemName,
        Number(record.quantity),
        'Alokasi',
        `Retur DO ${record.deliveryOrderId}: ${record.reason} (Masuk Stok Gudang)`,
        username
      );
    } else if (record.action === 'disposal') {
      try {
        await supabase.from('stock_disposals').insert({
          tanggal: record.date,
          item_name: record.itemName,
          kg: Number(record.quantity),
          harga_valuasi_kg: 0,
          keterangan: `Afkir/Tolakan DO ${record.deliveryOrderId}: ${record.reason}`
        });
      } catch (err) {
        console.warn('Could not insert to stock_disposals:', err);
      }
    }

    // 4. Save to local storage & API
    const cached = localStorage.getItem('rpa_do_returns');
    const returns: DOReturnRecord[] = cached ? JSON.parse(cached) : [];
    returns.unshift(record);
    localStorage.setItem('rpa_do_returns', JSON.stringify(returns));

    try {
      await fetch('/api/do-returns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record)
      });
    } catch (e) {
      console.warn('Failed to post to /api/do-returns:', e);
    }

    // 5. Activity Log
    await db.addActivityLog(username, 'ADD_DO_RETURN', 'delivery_orders', record.deliveryOrderId, {
      item: record.itemName,
      qty: record.quantity,
      action: record.action,
      reason: record.reason
    });
  },

  deleteDOReturn: async (id: string, username: string): Promise<void> => {
    // 1. Delete from Supabase
    try {
      const { error } = await supabase
        .from('do_returns')
        .delete()
        .eq('id', id);
      if (error) console.warn('Gagal delete di Supabase do_returns:', error.message || error);
    } catch (e) {
      console.warn('Error delete do_return:', e);
    }

    const cached = localStorage.getItem('rpa_do_returns');
    if (cached) {
      const returns: DOReturnRecord[] = JSON.parse(cached);
      const filtered = returns.filter(r => r.id !== id);
      localStorage.setItem('rpa_do_returns', JSON.stringify(filtered));
    }
    try {
      await fetch(`/api/do-returns/${encodeURIComponent(id)}`, { method: 'DELETE' });
    } catch (e) {
      console.warn('Failed to delete from /api/do-returns:', e);
    }
    await db.addActivityLog(username, 'DELETE_DO_RETURN', 'delivery_orders', id);
  },

  syncOfflineQueue: async (): Promise<{ syncedCount: number; remainingCount: number }> => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return { syncedCount: 0, remainingCount: getOfflineQueue().length };
    }
    const queue = getOfflineQueue();
    if (queue.length === 0) {
      return { syncedCount: 0, remainingCount: 0 };
    }
    let syncedCount = 0;
    for (const item of queue) {
      try {
        const fn = (db as any)[item.method];
        if (typeof fn === 'function') {
          await fn(...item.args);
        }
        removeOfflineMutation(item.id);
        syncedCount++;
      } catch (err) {
        if (isNetworkError(err)) {
          break;
        }
        console.error(`[Offline Sync] Failed to replay mutation ${item.id} (${item.method}):`, err);
        removeOfflineMutation(item.id);
      }
    }
    return { syncedCount, remainingCount: getOfflineQueue().length };
  }
};