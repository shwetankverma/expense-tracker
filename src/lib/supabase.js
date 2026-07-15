import { createClient } from '@supabase/supabase-js';

// Paste your project's values here (Supabase dashboard → Settings → API).
// The anon key is safe to ship in the client; RLS is the security boundary.
export const supabase = createClient(
  'https://xytalbhcdccydckmbvvi.supabase.co',
  'sb_publishable_WGl6PoGw_FReSK5RUqMe3A_ERuqdjNN'
);
