import { createClient } from "@/lib/supabase/client";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "";
const AGENT_URL = process.env.NEXT_PUBLIC_AGENT_URL ?? BACKEND_URL;

const AGENT_PATHS = ["/api/insights", "/api/chat", "/api/agent"];

function resolveUrl(path: string): string {
  const isAgent = AGENT_PATHS.some((p) => path.startsWith(p));
  return `${isAgent ? AGENT_URL : BACKEND_URL}${path}`;
}

async function authHeader(): Promise<Record<string, string>> {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token
    ? { Authorization: `Bearer ${session.access_token}` }
    : {};
}

/** Authenticated fetch — attaches the Supabase JWT and routes to the correct service URL. */
export async function apiFetch(path: string, options?: RequestInit): Promise<Response> {
  const headers = await authHeader();
  return fetch(resolveUrl(path), {
    ...options,
    headers: { ...headers, ...options?.headers },
  });
}

/** Public fetch — no JWT, still routes to the correct service URL when set. */
export function apiPublicFetch(path: string, options?: RequestInit): Promise<Response> {
  return fetch(resolveUrl(path), options ?? {});
}
