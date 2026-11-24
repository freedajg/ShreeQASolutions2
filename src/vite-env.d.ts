/// <reference types="vite/client" />

// The only variables the browser may read (CLAUDE.md rule 1). Set them in .env.local, which is
// git-ignored; server secrets never go here.
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_SENTRY_DSN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
