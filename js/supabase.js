const SUPABASE_URL =
"https://vwlevkuhenymqrlhlwdf.supabase.co";

const SUPABASE_ANON_KEY =
"sb_publishable_xt00-kBah5vzNhpUNsz1vw_gXzgmL9e";

const { createClient } = supabase;

const supabaseClient = createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);