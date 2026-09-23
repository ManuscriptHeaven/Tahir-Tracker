import { User, Session, AuthChangeEvent } from '@supabase/supabase-js';
import { getSupabaseClient } from '../lib/supabase';
import { AuthUser, AuthSessionState } from '../types';

let currentSession: Session | null = null;
let currentUser: AuthUser | null = null;
let isLoading = true;
let authError: string | null = null;
let isRecoveryMode = false;
let recoveryError: string | null = null;

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
    isAuthenticated: Boolean(currentUser && currentSession),
    isRecoveryMode,
    recoveryError
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

import { formatAuthError, getAuthRedirectUrl } from '../utils/authUtils';
export { formatAuthError, getAuthRedirectUrl };

let authInitialized = false;

/**
 * Initialize Supabase Auth listener, inspect URL for recovery tokens, and restore existing session from storage
 */
export async function initAuth(): Promise<void> {
  if (authInitialized) return;
  authInitialized = true;

  // Inspect URL hash / search for password recovery or expired link error
  if (typeof window !== 'undefined') {
    const hash = window.location.hash || '';
    const search = window.location.search || '';

    if (
      hash.includes('error_code=otp_expired') || 
      hash.includes('Email+link+is+invalid+or+has+expired') ||
      search.includes('error_code=otp_expired')
    ) {
      recoveryError = 'Your reset link has expired. Request a new one.';
      authError = recoveryError;
      window.history.replaceState(null, '', window.location.pathname);
    } else if (hash.includes('type=recovery')) {
      isRecoveryMode = true;
    }
  }

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
      authError = formatAuthError(error);
      currentSession = null;
      currentUser = null;
    } else {
      currentSession = data.session;
      currentUser = mapSupabaseUser(data.session?.user);
      authError = null;
    }
  } catch (err: any) {
    console.error('[AuthService] Failed to restore auth session:', err);
    authError = formatAuthError(err);
    currentSession = null;
    currentUser = null;
  } finally {
    isLoading = false;
    notifyListeners();
  }

  // Subscribe to auth state transitions (SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED, USER_UPDATED, PASSWORD_RECOVERY)
  try {
    client.auth.onAuthStateChange(async (event: AuthChangeEvent, session: Session | null) => {
      console.log(`[AuthService] Auth event: ${event}`);
      currentSession = session;
      currentUser = mapSupabaseUser(session?.user);
      isLoading = false;

      if (event === 'PASSWORD_RECOVERY') {
        isRecoveryMode = true;
        authError = null;
        recoveryError = null;
        if (typeof window !== 'undefined' && window.location.hash.includes('access_token')) {
          window.history.replaceState(null, '', window.location.pathname);
        }
      } else if (event === 'SIGNED_IN') {
        authError = null;
        if (typeof window !== 'undefined' && window.location.hash.includes('access_token')) {
          window.history.replaceState(null, '', window.location.pathname);
        }
      } else if (event === 'SIGNED_OUT') {
        currentSession = null;
        currentUser = null;
        authError = null;
        isRecoveryMode = false;
        recoveryError = null;
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
 * Check if recovery mode is currently active
 */
export function getIsRecoveryMode(): boolean {
  return isRecoveryMode;
}

/**
 * Manually toggle or clear recovery mode
 */
export function setRecoveryMode(active: boolean): void {
  isRecoveryMode = active;
  notifyListeners();
}

/**
 * Get active recovery error if any
 */
export function getRecoveryError(): string | null {
  return recoveryError;
}

/**
 * Clear recovery error
 */
export function clearRecoveryError(): void {
  recoveryError = null;
  notifyListeners();
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
      const friendly = formatAuthError(error);
      authError = friendly;
      return { success: false, error: friendly };
    }

    currentSession = data.session;
    currentUser = mapSupabaseUser(data.user);
    authError = null;
    isRecoveryMode = false;
    recoveryError = null;
    return { success: true };
  } catch (err: any) {
    const friendly = formatAuthError(err);
    authError = friendly;
    return { success: false, error: friendly };
  } finally {
    isLoading = false;
    notifyListeners();
  }
}

/**
 * Send password reset email using Supabase Auth
 */
export async function resetPasswordForEmail(email: string): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseClient();
  if (!client) {
    return { success: false, error: 'Supabase client is not configured' };
  }

  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail) {
    return { success: false, error: 'Please enter your email address' };
  }

  try {
    isLoading = true;
    authError = null;
    notifyListeners();

    const redirectUrl = getAuthRedirectUrl();
    const { error } = await client.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo: redirectUrl
    });

    if (error) {
      const friendly = formatAuthError(error);
      authError = friendly;
      return { success: false, error: friendly };
    }

    return { success: true };
  } catch (err: any) {
    const friendly = formatAuthError(err);
    authError = friendly;
    return { success: false, error: friendly };
  } finally {
    isLoading = false;
    notifyListeners();
  }
}

/**
 * Set a new password for the currently authenticated or recovery session
 */
export async function updatePassword(newPassword: string): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseClient();
  if (!client) {
    return { success: false, error: 'Supabase client is not configured' };
  }

  if (!newPassword || newPassword.length < 6) {
    return { success: false, error: 'Password must be at least 6 characters long.' };
  }

  try {
    isLoading = true;
    authError = null;
    notifyListeners();

    const { data, error } = await client.auth.updateUser({
      password: newPassword
    });

    if (error) {
      const friendly = formatAuthError(error);
      authError = friendly;
      return { success: false, error: friendly };
    }

    if (data.user) {
      currentUser = mapSupabaseUser(data.user);
    }
    isRecoveryMode = false;
    recoveryError = null;
    authError = null;
    return { success: true };
  } catch (err: any) {
    const friendly = formatAuthError(err);
    authError = friendly;
    return { success: false, error: friendly };
  } finally {
    isLoading = false;
    notifyListeners();
  }
}

/**
 * Send passwordless Magic Link via email
 */
export async function signInWithOtp(email: string): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseClient();
  if (!client) {
    return { success: false, error: 'Supabase client is not configured' };
  }

  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail) {
    return { success: false, error: 'Please enter your email address' };
  }

  try {
    isLoading = true;
    authError = null;
    notifyListeners();

    const redirectUrl = getAuthRedirectUrl();
    const { error } = await client.auth.signInWithOtp({
      email: cleanEmail,
      options: {
        emailRedirectTo: redirectUrl,
        shouldCreateUser: false
      }
    });

    if (error) {
      const friendly = formatAuthError(error);
      authError = friendly;
      return { success: false, error: friendly };
    }

    return { success: true };
  } catch (err: any) {
    const friendly = formatAuthError(err);
    authError = friendly;
    return { success: false, error: friendly };
  } finally {
    isLoading = false;
    notifyListeners();
  }
}

/**
 * Verify 6-digit OTP code received via email
 */
export async function verifyOtp(email: string, token: string): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseClient();
  if (!client) {
    return { success: false, error: 'Supabase client is not configured' };
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanToken = token.trim();
  if (!cleanEmail || !cleanToken) {
    return { success: false, error: 'Email and verification code are required' };
  }

  try {
    isLoading = true;
    authError = null;
    notifyListeners();

    const { data, error } = await client.auth.verifyOtp({
      email: cleanEmail,
      token: cleanToken,
      type: 'email'
    });

    if (error) {
      const friendly = formatAuthError(error);
      authError = friendly;
      return { success: false, error: friendly };
    }

    currentSession = data.session;
    currentUser = mapSupabaseUser(data.user);
    authError = null;
    return { success: true };
  } catch (err: any) {
    const friendly = formatAuthError(err);
    authError = friendly;
    return { success: false, error: friendly };
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
    isRecoveryMode = false;
    recoveryError = null;
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
    isRecoveryMode = false;
    recoveryError = null;

    if (error) {
      console.warn('[AuthService] Supabase signOut returned error:', error.message);
    }
    return { success: true };
  } catch (err: any) {
    console.error('[AuthService] signOut caught exception:', err);
    currentSession = null;
    currentUser = null;
    isRecoveryMode = false;
    recoveryError = null;
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
