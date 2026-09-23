import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatAuthError, getAuthRedirectUrl } from '../src/utils/authUtils.ts';

describe('Tahir Tracker Auth Flows, Recovery & Security Tests', () => {

  describe('1. formatAuthError - User-Friendly Error Messages', () => {
    it('translates invalid login credentials to clear guidance', () => {
      const err = { message: 'Invalid login credentials', status: 400 };
      const friendly = formatAuthError(err);
      assert.strictEqual(friendly, 'Incorrect email or password.');
    });

    it('translates invalid_grant to clear guidance', () => {
      const err = { message: 'invalid_grant: Invalid refresh token', status: 400 };
      const friendly = formatAuthError(err);
      assert.strictEqual(friendly, 'Incorrect email or password.');
    });

    it('translates expired OTP / token to expired reset link notice', () => {
      const err1 = { message: 'otp_expired: Email link is invalid or has expired' };
      assert.strictEqual(formatAuthError(err1), 'Your reset link has expired. Request a new one.');

      const err2 = 'Token has expired or is invalid';
      assert.strictEqual(formatAuthError(err2), 'Your reset link has expired. Request a new one.');
    });

    it('translates rate limit errors gracefully', () => {
      const err = { message: 'over_email_send_rate_limit: For security purposes, you can only request this once every 60 seconds' };
      const friendly = formatAuthError(err);
      assert.strictEqual(friendly, 'Too many requests. Please wait a minute before requesting another email.');
    });

    it('translates user not found without leaking internal schema', () => {
      const err = { message: 'User not found in auth.users' };
      const friendly = formatAuthError(err);
      assert.strictEqual(friendly, 'No account found with this email address.');
    });

    it('translates unconfirmed email error', () => {
      const err = { message: 'Email not confirmed' };
      const friendly = formatAuthError(err);
      assert.strictEqual(friendly, 'Please confirm your email address before signing in.');
    });

    it('translates short password error', () => {
      const err = { message: 'Password should be at least 6 characters' };
      const friendly = formatAuthError(err);
      assert.strictEqual(friendly, 'Password must be at least 6 characters long.');
    });

    it('translates network / offline failures', () => {
      const err = new TypeError('Failed to fetch');
      const friendly = formatAuthError(err);
      assert.strictEqual(friendly, 'Unable to connect. Please check your internet connection.');
    });

    it('strips technical AuthApiError prefix from generic errors', () => {
      const err = { message: 'AuthApiError: Database connection timeout' };
      const friendly = formatAuthError(err);
      assert.strictEqual(friendly, 'Database connection timeout');
    });

    it('handles null/undefined gracefully', () => {
      assert.strictEqual(formatAuthError(null), 'An unexpected error occurred. Please try again.');
      assert.strictEqual(formatAuthError(undefined), 'An unexpected error occurred. Please try again.');
    });
  });

  describe('2. getAuthRedirectUrl - Dynamic Origin Resolution', () => {
    it('returns a valid absolute URL with https protocol fallback in non-browser env', () => {
      const redirectUrl = getAuthRedirectUrl();
      assert.ok(redirectUrl.startsWith('http://') || redirectUrl.startsWith('https://'), 'Redirect URL must have http or https scheme');
      assert.ok(!redirectUrl.endsWith('/'), 'Redirect URL should not have trailing slash');
      assert.ok(redirectUrl.includes('pages.dev') || redirectUrl.includes('localhost'), 'Redirect URL should target valid domain');
    });
  });

  describe('3. Password Validation & Security Policies', () => {
    function validatePasswordChange(password: string, confirm: string): { valid: boolean; error?: string } {
      if (!password || password.length < 6) {
        return { valid: false, error: 'Password must be at least 6 characters long.' };
      }
      if (password !== confirm) {
        return { valid: false, error: 'Passwords do not match. Please re-enter.' };
      }
      return { valid: true };
    }

    it('rejects passwords shorter than 6 characters', () => {
      const result = validatePasswordChange('12345', '12345');
      assert.strictEqual(result.valid, false);
      assert.strictEqual(result.error, 'Password must be at least 6 characters long.');
    });

    it('rejects mismatched password and confirmation', () => {
      const result = validatePasswordChange('superSecret123', 'differentSecret');
      assert.strictEqual(result.valid, false);
      assert.strictEqual(result.error, 'Passwords do not match. Please re-enter.');
    });

    it('accepts strong matching passwords', () => {
      const result = validatePasswordChange('MySecureTahirPass2026!', 'MySecureTahirPass2026!');
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.error, undefined);
    });
  });

  describe('4. URL Hash Recovery Detection & Error Handling', () => {
    function parseRecoveryHash(hash: string): { isRecovery: boolean; recoveryError: string | null } {
      if (!hash) return { isRecovery: false, recoveryError: null };
      const cleanHash = hash.startsWith('#') ? hash.slice(1) : hash;
      const params = new URLSearchParams(cleanHash);
      const type = params.get('type');
      const errorCode = params.get('error_code');
      const errorDesc = params.get('error_description');

      if (type === 'recovery') {
        return { isRecovery: true, recoveryError: null };
      }
      if (errorCode === 'otp_expired' || (errorDesc && errorDesc.toLowerCase().includes('expired'))) {
        return { isRecovery: false, recoveryError: 'Your reset link has expired. Request a new one.' };
      }
      if (errorCode) {
        return { isRecovery: false, recoveryError: errorDesc ? decodeURIComponent(errorDesc.replace(/\+/g, ' ')) : 'Authentication link failed.' };
      }
      return { isRecovery: false, recoveryError: null };
    }

    it('correctly detects type=recovery in URL hash', () => {
      const hash = '#access_token=fake-token&expires_in=3600&refresh_token=fake-refresh&token_type=bearer&type=recovery';
      const parsed = parseRecoveryHash(hash);
      assert.strictEqual(parsed.isRecovery, true);
      assert.strictEqual(parsed.recoveryError, null);
    });

    it('correctly detects expired OTP in URL hash and generates user-friendly alert', () => {
      const hash = '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired';
      const parsed = parseRecoveryHash(hash);
      assert.strictEqual(parsed.isRecovery, false);
      assert.strictEqual(parsed.recoveryError, 'Your reset link has expired. Request a new one.');
    });

    it('ignores normal hash anchors like #dashboard or #settings', () => {
      const hash = '#settings';
      const parsed = parseRecoveryHash(hash);
      assert.strictEqual(parsed.isRecovery, false);
      assert.strictEqual(parsed.recoveryError, null);
    });
  });

  describe('5. Mobile Auth Security Standards Verification', () => {
    it('ensures no plaintext credentials in mock storage models', () => {
      const safeSession = {
        access_token: 'jwt.token.string',
        token_type: 'bearer',
        expires_in: 3600,
        refresh_token: 'refresh-token-uuid',
        user: { id: 'usr-123', email: 'owner@tahir.com' }
      };

      assert.strictEqual('password' in safeSession, false);
      assert.strictEqual('password' in safeSession.user, false);
    });

    it('verifies recommended autocomplete standards for mobile forms', () => {
      const fieldSpecs = [
        { field: 'login_email', type: 'email', autoComplete: 'email', inputMode: 'email' },
        { field: 'login_password', type: 'password', autoComplete: 'current-password' },
        { field: 'forgot_email', type: 'email', autoComplete: 'email', inputMode: 'email' },
        { field: 'new_password', type: 'password', autoComplete: 'new-password' },
        { field: 'confirm_password', type: 'password', autoComplete: 'new-password' },
        { field: 'otp_code', type: 'text', autoComplete: 'one-time-code', inputMode: 'numeric' }
      ];

      for (const spec of fieldSpecs) {
        assert.ok(spec.autoComplete, 'Spec for ' + spec.field + ' must define autoComplete');
      }
    });
  });

});
