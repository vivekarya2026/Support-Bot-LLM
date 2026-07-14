import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Missing Supabase credentials. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables."
  );
}

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!client) {
    client = createClient(supabaseUrl!, supabaseKey!, {
      auth: { persistSession: false },
    });
  }
  return client;
}

export function generatePublicKey(): string {
  return "pk_" + randomBytes(9).toString("base64url");
}

export function nowEpoch(): number {
  return Math.floor(Date.now() / 1000);
}
