import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://furhsxcsfrdxjphgedcv.supabase.co';
const supabaseAnonKey = 'sb_publishable_6kUcNFpB5u8AnxSkL0fuNw_QD4l5JcD';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  const { data, error } = await supabase.from('early_stock').select('*').limit(1);
  console.log("early_stock:", data, error);
}
check();
