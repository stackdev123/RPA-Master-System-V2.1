import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://furhsxcsfrdxjphgedcv.supabase.co';
const supabaseAnonKey = 'sb_publishable_6kUcNFpB5u8AnxSkL0fuNw_QD4l5JcD';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  const { error } = await supabase.from('production_logs').select('coop_id').limit(1);
  console.log("production_logs coop_id:", error ? error.message : "EXISTS!");
  
  const { error: e2 } = await supabase.from('delivery_orders').select('customer_id').limit(1);
  console.log("delivery_orders customer_id:", e2 ? e2.message : "EXISTS!");
}

check();
