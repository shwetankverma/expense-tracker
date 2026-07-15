import { createClient } from '@supabase/supabase-js';

// Paste your project's values here (Supabase dashboard → Settings → API).
// The anon key is safe to ship in the client; RLS is the security boundary.
export const supabase = createClient(
  'https://YOUR-PROJECT.supabase.co',
  'YOUR-ANON-KEY'
);
