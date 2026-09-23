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
  if (lower.includes('password should be at least') || lower.includes('at least 6 characters')) {
    return 'Password must be at least 6 characters long.';
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
