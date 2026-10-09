import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://furhsxcsfrdxjphgedcv.supabase.co';
const supabaseAnonKey = 'sb_publishable_6kUcNFpB5u8AnxSkL0fuNw_QD4l5JcD';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  for (const col of ['item_id', 'item_name', 'tipe', 'type', 'stok_awal', 'stock_before', 'perubahan', 'change', 'stok_akhir', 'stock_after', 'keterangan', 'notes']) {
    const { error } = await supabase.from('stock_logs').select(col).limit(1);
    console.log("stock_logs", col, ":", error ? error.message : "EXISTS!");
  }
}

check();
