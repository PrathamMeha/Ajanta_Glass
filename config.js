// PUBLIC configuration only. Never put secrets here (no service_role key, no Gemini/OpenAI key, no passwords).
// The Supabase *publishable* key is designed to be public; security comes from RLS + RPC rules in supabase/schema.sql.
window.AJANTA_CONFIG = Object.freeze({
    SUPABASE_URL: 'https://mxvtpdlrewqqmjcgvhkc.supabase.co',
    SUPABASE_KEY: 'sb_publishable_eavuDqsez3bZal_vy0xvdw_q6Fb2bgv',
    // After deploying supabase/functions/ajanta-ai, set it to:
    //   https://mxvtpdlrewqqmjcgvhkc.supabase.co/functions/v1/ajanta-ai
    // While empty, the chat answers from the built-in offline knowledge base (safe, no external calls).
    AI_ENDPOINT: '',
    // Same cloud store your admin site already writes to (read-only here; every value is validated before display).
    KVDB_BASE: 'https://kvdb.io/T2p78Krq12XcfWn1vNiw9G',
    CATALOG_KEY: 'ajanta_products_catalog',
    REVIEWS_KEY: 'ajanta_client_reviews',
    WHATSAPP: '919215400355',
    OWNER_ACCOUNT: 'ajnatafenestration@gmail.com'
});
