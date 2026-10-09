import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://furhsxcsfrdxjphgedcv.supabase.co';
const supabaseAnonKey = 'sb_publishable_6kUcNFpB5u8AnxSkL0fuNw_QD4l5JcD';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  const tables = ['master_items', 'current_stock', 'stock_logs', 'production_logs', 'trading_purchases', 'stock_disposals', 'delivery_orders', 'invoices', 'expenses', 'salaries', 'ledger_entries', 'users'];
  for (const table of tables) {
    const { data } = await supabase.from(table).select('*').limit(1);
    if (data && data.length > 0) {
      console.log(table, "HAS DATA:", data.length);
    } else {
      console.log(table, "is empty or error");
    }
  }
}

check();
