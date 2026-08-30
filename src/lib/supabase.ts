import { createClient, SupabaseClient } from '@supabase/supabase-js';

const STORAGE_KEY_URL = 'tahir_tracker_supabase_url';
const STORAGE_KEY_KEY = 'tahir_tracker_supabase_key';

let cachedClient: SupabaseClient | null = null;
let lastConfigUrl = '';
let lastConfigKey = '';

const DEFAULT_SUPABASE_URL = 'https://weomrqzammqldszitgcf.supabase.co';
const DEFAULT_SUPABASE_KEY = 'sb_publishable_cHnZ3ogxeByHrA-gDfjZ5g_Yq-_tKHD';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

/**
 * Get current Supabase credentials (from localStorage, Vite env, or defaults)
 */
export function getSupabaseConfig(): SupabaseConfig {
  const envUrl = (import.meta as any).env?.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const envKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_KEY;

  const storedUrl = localStorage.getItem(STORAGE_KEY_URL) || envUrl;
  const storedKey = localStorage.getItem(STORAGE_KEY_KEY) || envKey;

  return {
    url: (storedUrl || DEFAULT_SUPABASE_URL).trim(),
    anonKey: (storedKey || DEFAULT_SUPABASE_KEY).trim()
  };
}

/**
 * Save Supabase credentials to localStorage
 */
export function saveSupabaseConfig(url: string, anonKey: string): void {
  const cleanUrl = url.trim();
  const cleanKey = anonKey.trim();

  if (cleanUrl) {
    localStorage.setItem(STORAGE_KEY_URL, cleanUrl);
  } else {
    localStorage.removeItem(STORAGE_KEY_URL);
  }

  if (cleanKey) {
    localStorage.setItem(STORAGE_KEY_KEY, cleanKey);
  } else {
    localStorage.removeItem(STORAGE_KEY_KEY);
  }

  // Invalidate cached client
  cachedClient = null;
  lastConfigUrl = '';
  lastConfigKey = '';
}

/**
 * Check if Supabase credentials are configured
 */
export function isSupabaseConfigured(): boolean {
  const { url, anonKey } = getSupabaseConfig();
  return Boolean(url && anonKey && url.startsWith('http'));
}

/**
 * Get or create Supabase client instance
 */
export function getSupabaseClient(): SupabaseClient | null {
  const { url, anonKey } = getSupabaseConfig();

  if (!url || !anonKey || !url.startsWith('http')) {
    return null;
  }

  if (cachedClient && lastConfigUrl === url && lastConfigKey === anonKey) {
    return cachedClient;
  }

  try {
    cachedClient = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true
      }
    });
    lastConfigUrl = url;
    lastConfigKey = anonKey;
    return cachedClient;
  } catch (err) {
    console.error('Failed to initialize Supabase client:', err);
    return null;
  }
}

/**
 * Test connectivity with Supabase
 */
export async function testSupabaseConnection(): Promise<{ success: boolean; message: string }> {
  const client = getSupabaseClient();
  if (!client) {
    return {
      success: false,
      message: 'Supabase URL and Anon Key are missing or invalid.'
    };
  }

  try {
    // Try to query settings or utility_persons table
    const { error } = await client.from('settings').select('id').limit(1);

    if (error) {
      // If table does not exist, hint user to run SQL schema script
      if (error.code === '42P01' || error.message.includes('relation') || error.message.includes('does not exist')) {
        return {
          success: false,
          message: 'Connected to Supabase, but database tables are not created yet. Please execute the SQL Schema Script in Supabase SQL Editor.'
        };
      }
      return {
        success: false,
        message: `Supabase Error: ${error.message} (Code: ${error.code || 'N/A'})`
      };
    }

    return {
      success: true,
      message: 'Successfully connected to Supabase Database!'
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Connection failed: ${err?.message || 'Network error or invalid URL'}`
    };
  }
}
