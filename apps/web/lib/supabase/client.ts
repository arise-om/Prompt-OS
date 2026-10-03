"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@prompt-os/db-types";

let client: ReturnType<typeof createBrowserClient> | undefined;

export function createClient() {
  client ??= createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );
  return client;
}
