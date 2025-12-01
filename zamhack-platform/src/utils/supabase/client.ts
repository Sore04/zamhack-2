import { createBrowserClient } from "@supabase/ssr";
// FIX: Update this path to match where your types folder actually is
import { Database } from "@/types/supabase"; 

export const createClient = () => {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
};
