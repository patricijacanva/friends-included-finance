import { createClient } from "@supabase/supabase-js";
import { getSupabaseServerEnvironment } from "@/lib/env";

/**
 * This client is for server-side route handlers and server code only.
 * Never import it into a Client Component or expose its key to the browser.
 */
export function createSupabaseServerClient() {
  const { url, secretKey } = getSupabaseServerEnvironment();

  return createClient(url, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
