/**
 * Maps technical Supabase error strings into user-friendly messages
 */
export function formatAuthError(err: any): string {
  if (!err) return 'An unexpected error occurred. Please try again.';
  const message = typeof err === 'string' ? err : err?.message || err?.error_description || String(err);
  const lower = message.toLowerCase();

  if (lower.includes('invalid login credentials') || lower.includes('invalid_grant')) {
    return 'Incorrect email or password.';
  }
  if (lower.includes('email rate limit exceeded') || lower.includes('rate limit') || lower.includes('over_email_send_rate_limit')) {
    return 'Too many requests. Please wait a minute before requesting another email.';
  }
  if (lower.includes('user not found')) {
    return 'No account found with this email address.';
  }
  if (lower.includes('email not confirmed')) {
    return 'Please confirm your email address before signing in.';
  }
  if (lower.includes('password should be at least') || lower.includes('password is too short')) {
    return 'Please choose a stronger password that meets the account requirements.';
  }
  if (lower.includes('user already registered') || lower.includes('already been registered')) {
    return 'This account could not be created. Try signing in or use Forgot password.';
  }
  if (
    lower.includes('otp_expired') || 
    lower.includes('token has expired') || 
    lower.includes('token is expired') || 
    lower.includes('email link is invalid or has expired')
  ) {
    return 'Your reset link has expired. Request a new one.';
  }
  if (lower.includes('session') && (lower.includes('expired') || lower.includes('missing'))) {
    return 'Your session has expired. Please sign in again.';
  }
  if (lower.includes('failed to fetch') || lower.includes('network') || lower.includes('networkerror')) {
    return 'Unable to connect. Please check your internet connection.';
  }
  if (lower.includes('signup disabled') || lower.includes('signups not allowed')) {
    return 'Public registrations are disabled. Contact the administrator.';
  }
  if (lower.includes('access_denied') || lower.includes('access denied')) {
    return 'Google sign in was cancelled or access was denied. Please try again.';
  }
  if (lower.includes('unsupported_provider') || lower.includes('provider is not enabled') || lower.includes('provider disabled')) {
    return 'Google sign in is not enabled in your Supabase project. Please configure Google OAuth in the Supabase Dashboard.';
  }
  if (lower.includes('redirect_uri_mismatch')) {
    return 'Google OAuth redirect URI mismatch. Please verify your Google Cloud Console and Supabase dashboard settings.';
  }
  if (lower.includes('popup') && (lower.includes('closed') || lower.includes('blocked'))) {
    return 'Sign-in popup was closed or blocked by browser. Please allow popups or retry.';
  }

  return message.replace(/^AuthApiError:\s*/i, '').trim();
}

/**
 * Returns dynamic callback / redirect URL for current deployment
 * Uses window.location.origin on mobile/web browsers and avoids defaulting to localhost in production.
 */
export function getAuthRedirectUrl(): string {
  if (typeof window !== 'undefined' && window.location) {
    const origin = window.location.origin;
    if (origin && !origin.includes('localhost') && !origin.includes('127.0.0.1')) {
      return origin;
    }
  }
  return typeof window !== 'undefined' && window.location?.origin 
    ? window.location.origin 
    : 'https://tahir-tracker.pages.dev';
}
