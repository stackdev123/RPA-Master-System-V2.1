import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://furhsxcsfrdxjphgedcv.supabase.co';
const supabaseAnonKey = 'sb_publishable_6kUcNFpB5u8AnxSkL0fuNw_QD4l5JcD';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  const { data, error } = await supabase.from('production_logs').select('tanggal_produksi, item_id, qty, ekor, kg, mobil, harga_beli_kg, kematian_ekor, kematian_kg, nama_kandang, driver, is_applied').limit(1);
  console.log("production_logs error:", error?.message);
}

check();
