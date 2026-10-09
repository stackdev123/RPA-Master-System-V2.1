import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://furhsxcsfrdxjphgedcv.supabase.co';
const supabaseAnonKey = 'sb_publishable_6kUcNFpB5u8AnxSkL0fuNw_QD4l5JcD';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  const { data, error } = await supabase.from('current_stock').select('*').limit(1);
  console.log("current_stock:", data, error);

  const { data: d2, error: e2 } = await supabase.from('stock_logs').select('*').limit(1);
  console.log("stock_logs:", d2, e2);
}

check();
