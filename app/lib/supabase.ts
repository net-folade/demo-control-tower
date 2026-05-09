import { createClient, SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
      "Copy app/.env.example to app/.env.local and fill in your Supabase values.",
  );
}

let _client: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (_client === null) {
    _client = createClient(url!, anonKey!, {
      auth: { persistSession: false },
    });
  }
  return _client;
}
