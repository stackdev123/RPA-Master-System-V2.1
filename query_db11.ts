import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://furhsxcsfrdxjphgedcv.supabase.co';
const supabaseAnonKey = 'sb_publishable_6kUcNFpB5u8AnxSkL0fuNw_QD4l5JcD';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  for (const table of ['production_logs', 'trading_purchases', 'stock_disposals', 'delivery_orders', 'invoices']) {
    for (const col of ['item_id', 'item_name', 'nama_barang', 'nama_item']) {
      const { error } = await supabase.from(table).select(col).limit(1);
      if (!error) console.log(table, "has column:", col);
    }
  }
}

check();
