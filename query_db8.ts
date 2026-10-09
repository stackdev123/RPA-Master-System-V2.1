import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://furhsxcsfrdxjphgedcv.supabase.co';
const supabaseAnonKey = 'sb_publishable_6kUcNFpB5u8AnxSkL0fuNw_QD4l5JcD';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  for (const col of ['nama_barang', 'name', 'barang', 'item_id', 'master_item_id', 'product_name', 'product']) {
    const { error } = await supabase.from('current_stock').select(col).limit(1);
    console.log("current_stock", col, ":", error ? error.message : "EXISTS!");
  }
}

check();
