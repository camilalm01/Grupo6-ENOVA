// lib/services/supabaseClient.ts
import { createClient } from "@supabase/supabase-js";

// Fallback values to prevent build crashes if env vars are missing
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ||
    "https://placeholder.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "placeholder-key";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
