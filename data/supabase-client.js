// Remplace par TES valeurs Supabase
const SUPABASE_URL = "https://dfactzpzoyrfmhmwmdgj.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_AOpBdmAhYEbq1iFkheM24w_dbpKtCa6";

// Client Supabase global
window.supabaseClient = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);
