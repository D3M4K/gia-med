/* PUBLIC client configuration. The anon/publishable key is safe to include in a static app.
   Never put service_role or other secret keys here. See README.md and supabase.sql. */
window.GIA_CLOUD = {
  url: '',     // e.g. https://YOUR-PROJECT.supabase.co
  anonKey: ''  // e.g. eyJ... (publishable / anon key ONLY)
};
