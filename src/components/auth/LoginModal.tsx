import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { 
  Lock, 
  Mail, 
  Eye, 
  EyeOff, 
  AlertCircle, 
  CheckCircle2, 
  X, 
  Loader2,
  ShieldCheck,
  Cloud,
  ArrowLeft,
  KeyRound,
  Sparkles,
  Check
} from 'lucide-react';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  isRentMode?: boolean;
}

type AuthModalMode = 'password' | 'forgot-password' | 'magic-link' | 'set-new-password';

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  isRentMode = false
}) => {
  const { 
    signIn, 
    isAuthenticated, 
    user, 
    signOut, 
    sendPasswordReset, 
    updatePassword, 
    sendMagicLink,
    verifyOtp,
    isRecoveryMode,
    setRecoveryMode,
    recoveryError,
    clearRecoveryError
  } = useAuth();

  const [mode, setMode] = useState<AuthModalMode>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showOtpInput, setShowOtpInput] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Automatically activate recovery mode if a recovery link was detected
  useEffect(() => {
    if (isRecoveryMode) {
      setMode('set-new-password');
      setErrorMessage(null);
      setSuccessMessage(null);
    } else if (recoveryError) {
      setMode('forgot-password');
      setErrorMessage(recoveryError);
      setSuccessMessage(null);
    }
  }, [isRecoveryMode, recoveryError]);

  if (!isOpen) return null;

  const resetFormState = (newMode: AuthModalMode) => {
    setMode(newMode);
    setErrorMessage(null);
    setSuccessMessage(null);
    setShowOtpInput(false);
    setPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setOtpCode('');
    if (recoveryError) clearRecoveryError();
  };

  // 1. Password Login
  const handlePasswordSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setErrorMessage('Please enter your email address.');
      return;
    }
    if (!password) {
      setErrorMessage('Please enter your password.');
      return;
    }

    setLoading(true);
    try {
      const res = await signIn(cleanEmail, password);
      if (res.success) {
        setSuccessMessage('Successfully signed in! Cloud sync is now active.');
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        setErrorMessage(res.error || 'Incorrect email or password.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Network error during sign in. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // 2. Forgot Password Flow
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setErrorMessage('Please enter your email address.');
      return;
    }

    setLoading(true);
    try {
      const res = await sendPasswordReset(cleanEmail);
      if (res.success) {
        setSuccessMessage('Password reset email sent. Check your inbox.');
      } else {
        setErrorMessage(res.error || 'Unable to send reset email. Please try again.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Unable to send reset email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // 3. Magic Link Flow
  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setErrorMessage('Please enter your email address.');
      return;
    }

    setLoading(true);
    try {
      const res = await sendMagicLink(cleanEmail);
      if (res.success) {
        setSuccessMessage('Login link sent! Check your inbox and tap the link on your phone to sign in.');
        setShowOtpInput(true);
      } else {
        setErrorMessage(res.error || 'Unable to send login link. Please try again.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Unable to send login link. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // 3b. Verify OTP from email
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanEmail = email.trim();
    const cleanToken = otpCode.trim();
    if (!cleanEmail || !cleanToken) {
      setErrorMessage('Please enter the 6-digit code received in your email.');
      return;
    }

    setLoading(true);
    try {
      const res = await verifyOtp(cleanEmail, cleanToken);
      if (res.success) {
        setSuccessMessage('Successfully authenticated! Welcome back.');
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        setErrorMessage(res.error || 'Invalid or expired code. Please request a new one.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // 4. Set New Password Flow (Recovery)
  const handleSetNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!newPassword || newPassword.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please re-enter.');
      return;
    }

    setLoading(true);
    try {
      const res = await updatePassword(newPassword);
      if (res.success) {
        setSuccessMessage('Password updated successfully! Welcome back to Tahir Tracker.');
        setRecoveryMode(false);
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        setErrorMessage(res.error || 'Unable to update password. Your reset link may have expired.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Unable to update password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    setLoading(true);
    try {
      await signOut();
      setSuccessMessage('Signed out successfully. Offline local data remains intact.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in overflow-y-auto">
      <div 
        className="w-full max-w-sm sm:max-w-md bg-[#0B1D2C] rounded-3xl shadow-2xl border border-cyan-500/30 overflow-hidden my-auto transform transition-all animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="relative bg-[#071724] px-5 sm:px-6 pt-5 pb-4 text-white border-b border-slate-800">
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-tr from-[#059669] to-[#18E6BE] flex items-center justify-center text-[#06131F] font-black text-lg sm:text-xl shadow-[0_0_20px_rgba(24,230,190,0.3)] shrink-0">
              {isRentMode ? '🏠' : 'TT'}
            </div>
            <div className="min-w-0 pr-6">
              <h2 className="text-base sm:text-lg font-bold tracking-tight text-white truncate">
                {isRentMode ? 'Rent Tracking' : 'Tahir Tracker'}
              </h2>
              <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                <Cloud className="w-3.5 h-3.5 text-[#18E6BE] shrink-0" />
                <span className="truncate">Supabase Secure Cloud Sync</span>
              </p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6">
          {/* Authenticated View */}
          {isAuthenticated && user && mode !== 'set-new-password' ? (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-[#071724] border border-teal-500/30 text-slate-200">
                <div className="flex items-center gap-2 font-bold text-sm text-[#18E6BE]">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Authenticated & Connected</span>
                </div>
                <p className="text-xs text-slate-300 mt-2 break-all">
                  Signed in as <strong className="font-semibold text-white">{user.email}</strong>
                </p>
                <p className="text-[10px] text-slate-400 mt-1 font-mono break-all">
                  User ID: {user.id}
                </p>
              </div>

              <div className="flex flex-col gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => resetFormState('set-new-password')}
                  className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-[#18E6BE] bg-[#102638] hover:bg-[#122B3E] border border-[rgba(24,230,190,0.25)] transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Change Password</span>
                </button>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleSignOut}
                    disabled={loading}
                    className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 transition-all cursor-pointer"
                  >
                    {loading ? 'Signing out...' : 'Sign Out'}
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold text-slate-200 bg-[#102638] hover:bg-slate-700 border border-slate-700 transition-all cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Alert Feedback Messages */}
              {errorMessage && (
                <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div className="leading-snug flex-1">{errorMessage}</div>
                </div>
              )}

              {successMessage && (
                <div className="p-3.5 rounded-2xl bg-teal-500/10 border border-teal-500/30 text-[#18E6BE] text-xs flex items-start gap-2.5 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 text-[#18E6BE] shrink-0 mt-0.5" />
                  <div className="leading-snug flex-1">{successMessage}</div>
                </div>
              )}

              {/* 1. STANDARD PASSWORD SIGN IN */}
              {mode === 'password' && (
                <form onSubmit={handlePasswordSignIn} className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">
                      Email Address
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Mail className="w-4 h-4" />
                      </div>
                      <input
                        type="email"
                        required
                        autoComplete="email"
                        inputMode="email"
                        autoCapitalize="none"
                        autoCorrect="off"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="your-email@example.com"
                        disabled={loading}
                        className="w-full pl-10 pr-3.5 py-3 text-xs sm:text-sm rounded-xl bg-[#071724] border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-[#18E6BE] focus:ring-1 focus:ring-[#18E6BE] transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">
                      Password
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        autoComplete="current-password"
                        autoCapitalize="none"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter your account password"
                        disabled={loading}
                        className="w-full pl-10 pr-11 py-3 text-xs sm:text-sm rounded-xl bg-[#071724] border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-[#18E6BE] focus:ring-1 focus:ring-[#18E6BE] transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        tabIndex={-1}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-white"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>

                    {/* Forgot password link below password field */}
                    <div className="flex items-center justify-end pt-1.5">
                      <button
                        type="button"
                        onClick={() => resetFormState('forgot-password')}
                        className="text-xs font-semibold text-[#18E6BE] hover:underline cursor-pointer focus:outline-none"
                      >
                        Forgot password?
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full mt-2 py-3 px-4 rounded-xl text-xs sm:text-sm font-bold text-[#06131F] bg-gradient-to-r from-teal-500 to-[#18E6BE] hover:from-teal-400 hover:to-[#23F2CB] shadow-[0_0_15px_rgba(24,230,190,0.25)] active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer min-h-[44px]"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-[#06131F]" />
                        <span>Signing in...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" />
                        <span>Sign In</span>
                      </>
                    )}
                  </button>

                  {/* Passwordless secondary option */}
                  <div className="pt-2 border-t border-slate-800 space-y-2">
                    <button
                      type="button"
                      onClick={() => resetFormState('magic-link')}
                      className="w-full py-2.5 px-3 rounded-xl text-xs font-bold text-slate-300 hover:text-[#18E6BE] bg-[#071724] hover:bg-[#102638] border border-slate-700 transition-all flex items-center justify-center gap-2 cursor-pointer min-h-[42px]"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-[#18E6BE]" />
                      <span>Email me a login link (Passwordless)</span>
                    </button>
                  </div>
                </form>
              )}

              {/* 2. FORGOT PASSWORD FLOW */}
              {mode === 'forgot-password' && (
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <KeyRound className="w-4 h-4 text-[#18E6BE]" />
                      <span>Reset Your Password</span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      Enter the email address registered with your Tahir Tracker account. We'll send you a secure link to set a new password.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">
                      Email Address
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Mail className="w-4 h-4" />
                      </div>
                      <input
                        type="email"
                        required
                        autoComplete="email"
                        inputMode="email"
                        autoCapitalize="none"
                        autoCorrect="off"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="your-email@example.com"
                        disabled={loading}
                        className="w-full pl-10 pr-3.5 py-3 text-xs sm:text-sm rounded-xl bg-[#071724] border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-[#18E6BE] focus:ring-1 focus:ring-[#18E6BE] transition-all"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 px-4 rounded-xl text-xs sm:text-sm font-bold text-[#06131F] bg-gradient-to-r from-teal-500 to-[#18E6BE] hover:from-teal-400 hover:to-[#23F2CB] shadow-[0_0_15px_rgba(24,230,190,0.25)] active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer min-h-[44px]"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-[#06131F]" />
                        <span>Sending reset link...</span>
                      </>
                    ) : (
                      <>
                        <Mail className="w-4 h-4" />
                        <span>Send Reset Link</span>
                      </>
                    )}
                  </button>

                  <div className="pt-2 text-center">
                    <button
                      type="button"
                      onClick={() => resetFormState('password')}
                      className="text-xs font-bold text-slate-400 hover:text-white inline-flex items-center gap-1.5 cursor-pointer py-1"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Back to Sign In</span>
                    </button>
                  </div>
                </form>
              )}

              {/* 3. PASSWORDLESS MAGIC LINK FLOW */}
              {mode === 'magic-link' && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-[#18E6BE]" />
                      <span>Passwordless Sign In</span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      Enter your email to receive an instant login link. Tap it on your phone or enter the 6-digit code to log in without a password.
                    </p>
                  </div>

                  {!showOtpInput ? (
                    <form onSubmit={handleMagicLink} className="space-y-3.5">
                      <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1.5">
                          Email Address
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                            <Mail className="w-4 h-4" />
                          </div>
                          <input
                            type="email"
                            required
                            autoComplete="email"
                            inputMode="email"
                            autoCapitalize="none"
                            autoCorrect="off"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="your-email@example.com"
                            disabled={loading}
                            className="w-full pl-10 pr-3.5 py-3 text-xs sm:text-sm rounded-xl bg-[#071724] border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-[#18E6BE] focus:ring-1 focus:ring-[#18E6BE] transition-all"
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3 px-4 rounded-xl text-xs sm:text-sm font-bold text-[#06131F] bg-gradient-to-r from-teal-500 to-[#18E6BE] hover:from-teal-400 hover:to-[#23F2CB] shadow-[0_0_15px_rgba(24,230,190,0.25)] active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer min-h-[44px]"
                      >
                        {loading ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin text-[#06131F]" />
                            <span>Sending login link...</span>
                          </>
                        ) : (
                          <>
                            <Mail className="w-4 h-4" />
                            <span>Email me a login link</span>
                          </>
                        )}
                      </button>
                    </form>
                  ) : (
                    <form onSubmit={handleVerifyOtp} className="space-y-3.5">
                      <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1.5">
                          Enter 6-Digit Email Code
                        </label>
                        <input
                          type="text"
                          required
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={6}
                          autoFocus
                          value={otpCode}
                          onChange={(e) => setOtpCode(e.target.value)}
                          placeholder="123456"
                          disabled={loading}
                          className="w-full px-3.5 py-3 text-center text-lg font-mono tracking-widest font-bold rounded-xl bg-[#071724] border border-slate-700 text-white placeholder-slate-600 focus:outline-none focus:border-[#18E6BE] focus:ring-1 focus:ring-[#18E6BE] transition-all"
                        />
                        <p className="text-[11px] text-slate-400 mt-1.5 text-center">
                          Or just tap the link in the email from this device.
                        </p>
                      </div>

                      <button
                        type="submit"
                        disabled={loading || otpCode.trim().length < 6}
                        className="w-full py-3 px-4 rounded-xl text-xs sm:text-sm font-bold text-[#06131F] bg-gradient-to-r from-teal-500 to-[#18E6BE] hover:from-teal-400 hover:to-[#23F2CB] shadow-[0_0_15px_rgba(24,230,190,0.25)] active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer min-h-[44px]"
                      >
                        {loading ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin text-[#06131F]" />
                            <span>Verifying...</span>
                          </>
                        ) : (
                          <>
                            <Check className="w-4 h-4" />
                            <span>Verify Code & Sign In</span>
                          </>
                        )}
                      </button>
                    </form>
                  )}

                  <div className="pt-2 text-center">
                    <button
                      type="button"
                      onClick={() => resetFormState('password')}
                      className="text-xs font-bold text-slate-400 hover:text-white inline-flex items-center gap-1.5 cursor-pointer py-1"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Back to Password Sign In</span>
                    </button>
                  </div>
                </div>
              )}

              {/* 4. SET NEW PASSWORD FLOW (Recovery Destination) */}
              {mode === 'set-new-password' && (
                <form onSubmit={handleSetNewPassword} className="space-y-3.5">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-[#18E6BE]" />
                      <span>Set New Password</span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      Choose a new password for your Tahir Tracker account (at least 6 characters).
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">
                      New Password
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        required
                        autoComplete="new-password"
                        autoCapitalize="none"
                        minLength={6}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="At least 6 characters"
                        disabled={loading}
                        className="w-full pl-10 pr-11 py-3 text-xs sm:text-sm rounded-xl bg-[#071724] border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-[#18E6BE] focus:ring-1 focus:ring-[#18E6BE] transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        tabIndex={-1}
                        aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-white"
                      >
                        {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">
                      Confirm New Password
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        required
                        autoComplete="new-password"
                        autoCapitalize="none"
                        minLength={6}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter your new password"
                        disabled={loading}
                        className="w-full pl-10 pr-11 py-3 text-xs sm:text-sm rounded-xl bg-[#071724] border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-[#18E6BE] focus:ring-1 focus:ring-[#18E6BE] transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        tabIndex={-1}
                        aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-white"
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || newPassword.length < 6 || newPassword !== confirmPassword}
                    className="w-full py-3 px-4 rounded-xl text-xs sm:text-sm font-bold text-[#06131F] bg-gradient-to-r from-teal-500 to-[#18E6BE] hover:from-teal-400 hover:to-[#23F2CB] shadow-[0_0_15px_rgba(24,230,190,0.25)] active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer min-h-[44px]"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-[#06131F]" />
                        <span>Updating password...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Save New Password</span>
                      </>
                    )}
                  </button>

                  {!isRecoveryMode && (
                    <div className="pt-2 text-center">
                      <button
                        type="button"
                        onClick={() => resetFormState('password')}
                        className="text-xs font-bold text-slate-400 hover:text-white inline-flex items-center gap-1.5 cursor-pointer py-1"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>Cancel</span>
                      </button>
                    </div>
                  )}
                </form>
              )}

              {/* Offline & Security Note */}
              <div className="pt-2 text-center">
                <p className="text-[11px] text-slate-400 leading-normal">
                  <strong className="text-slate-300">Single-Owner Private Application:</strong> You can continue using all features completely offline without logging in.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
