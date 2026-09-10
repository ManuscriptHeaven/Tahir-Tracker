import { User, Session, AuthChangeEvent } from '@supabase/supabase-js';
import { getSupabaseClient } from '../lib/supabase';
import { AuthUser, AuthSessionState } from '../types';

let currentSession: Session | null = null;
let currentUser: AuthUser | null = null;
let isLoading = true;
let authError: string | null = null;

type AuthListener = (state: AuthSessionState) => void;
const authListeners = new Set<AuthListener>();

function mapSupabaseUser(user: User | null | undefined): AuthUser | null {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email || '',
    created_at: user.created_at,
    last_sign_in_at: user.last_sign_in_at
  };
}

function getAuthState(): AuthSessionState {
  return {
    user: currentUser,
    loading: isLoading,
    error: authError,
    isAuthenticated: Boolean(currentUser && currentSession)
  };
}

function notifyListeners() {
  const state = getAuthState();
  authListeners.forEach((listener) => {
    try {
      listener(state);
    } catch (err) {
      console.error('[AuthService] Error in auth listener:', err);
    }
  });
}

let authInitialized = false;

/**
 * Initialize Supabase Auth listener and restore existing session from storage
 */
export async function initAuth(): Promise<void> {
  if (authInitialized) return;
  authInitialized = true;

  const client = getSupabaseClient();
  if (!client) {
    isLoading = false;
    notifyListeners();
    return;
  }

  try {
    isLoading = true;
    const { data, error } = await client.auth.getSession();
    if (error) {
      console.warn('[AuthService] Error getting initial session:', error.message);
      authError = error.message;
      currentSession = null;
      currentUser = null;
    } else {
      currentSession = data.session;
      currentUser = mapSupabaseUser(data.session?.user);
      authError = null;
    }
  } catch (err: any) {
    console.error('[AuthService] Failed to restore auth session:', err);
    authError = err?.message || 'Failed to restore authentication session';
    currentSession = null;
    currentUser = null;
  } finally {
    isLoading = false;
    notifyListeners();
  }

  // Subscribe to auth state transitions (SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED, USER_UPDATED)
  try {
    client.auth.onAuthStateChange(async (event: AuthChangeEvent, session: Session | null) => {
      console.log(`[AuthService] Auth event: ${event}`);
      currentSession = session;
      currentUser = mapSupabaseUser(session?.user);
      isLoading = false;

      if (event === 'SIGNED_OUT') {
        currentSession = null;
        currentUser = null;
        authError = null;
      } else if (event === 'TOKEN_REFRESHED') {
        authError = null;
      }

      notifyListeners();
    });
  } catch (err) {
    console.error('[AuthService] Error setting up onAuthStateChange:', err);
  }
}

/**
 * Get current authenticated user
 */
export function getCurrentUser(): AuthUser | null {
  return currentUser;
}

/**
 * Get current authenticated user UUID
 */
export function getCurrentUserId(): string | null {
  return currentUser?.id || null;
}

/**
 * Check if a valid authenticated session is active
 */
export function isAuthenticated(): boolean {
  return Boolean(currentUser && currentSession);
}

/**
 * Get current active Supabase Session
 */
export async function getSession(): Promise<Session | null> {
  if (currentSession) return currentSession;
  const client = getSupabaseClient();
  if (!client) return null;
  try {
    const { data } = await client.auth.getSession();
    currentSession = data.session;
    currentUser = mapSupabaseUser(data.session?.user);
    return currentSession;
  } catch {
    return null;
  }
}

/**
 * Subscribe to authentication state updates
 */
export function subscribeAuth(listener: AuthListener): () => void {
  authListeners.add(listener);
  listener(getAuthState());
  return () => {
    authListeners.delete(listener);
  };
}

/**
 * Sign in with Email and Password
 */
export async function signIn(email: string, password: string): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseClient();
  if (!client) {
    return { success: false, error: 'Supabase client is not configured' };
  }

  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !password) {
    return { success: false, error: 'Email and password are required' };
  }

  try {
    isLoading = true;
    authError = null;
    notifyListeners();

    const { data, error } = await client.auth.signInWithPassword({
      email: cleanEmail,
      password
    });

    if (error) {
      authError = error.message;
      return { success: false, error: error.message };
    }

    currentSession = data.session;
    currentUser = mapSupabaseUser(data.user);
    authError = null;
    return { success: true };
  } catch (err: any) {
    const msg = err?.message || 'Authentication failed. Please check network connection.';
    authError = msg;
    return { success: false, error: msg };
  } finally {
    isLoading = false;
    notifyListeners();
  }
}

/**
 * Sign out of current session and invalidate cached credentials
 */
export async function signOut(): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseClient();
  if (!client) {
    currentSession = null;
    currentUser = null;
    notifyListeners();
    return { success: true };
  }

  try {
    isLoading = true;
    notifyListeners();

    const { error } = await client.auth.signOut();
    currentSession = null;
    currentUser = null;
    authError = null;

    if (error) {
      console.warn('[AuthService] Supabase signOut returned error:', error.message);
    }
    return { success: true };
  } catch (err: any) {
    console.error('[AuthService] signOut caught exception:', err);
    currentSession = null;
    currentUser = null;
    return { success: true };
  } finally {
    isLoading = false;
    notifyListeners();
  }
}

/**
 * Force token / session refresh
 */
export async function refreshSession(): Promise<Session | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const { data, error } = await client.auth.refreshSession();
    if (error) {
      console.warn('[AuthService] Token refresh error:', error.message);
      return null;
    }
    currentSession = data.session;
    currentUser = mapSupabaseUser(data.session?.user);
    notifyListeners();
    return currentSession;
  } catch (err) {
    console.error('[AuthService] Failed to refresh session:', err);
    return null;
  }
}
