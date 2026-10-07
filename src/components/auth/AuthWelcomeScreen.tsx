import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { 
  Lock, 
  Mail, 
  Eye, 
  EyeOff, 
  AlertCircle, 
  CheckCircle2, 
  Loader2, 
  ShieldCheck, 
  Sparkles, 
  ArrowLeft,
  KeyRound,
  Check,
  Zap,
  CheckCircle
} from 'lucide-react';

interface AuthWelcomeScreenProps {
  isRentMode?: boolean;
}

export const AuthWelcomeScreen: React.FC<AuthWelcomeScreenProps> = ({ isRentMode = false }) => {
  const { 
    signInWithGoogle, 
    signIn,
    signUp,
    sendPasswordReset, 
    sendMagicLink, 
    verifyOtp,
    error: authGlobalError 
  } = useAuth();

  const [mode, setMode] = useState<'welcome' | 'signup' | 'forgot' | 'magic-link'>('welcome');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [showOtpInput, setShowOtpInput] = useState(false);

  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(authGlobalError || null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setLoadingGoogle(true);
    setErrorMessage(null);
    try {
      const res = await signInWithGoogle();
      if (!res.success && res.error) {
        setErrorMessage(res.error);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to initiate Google sign-in.');
    } finally {
      setLoadingGoogle(false);
    }
  };

  const handlePasswordSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setErrorMessage('Please enter both email and password.');
      return;
    }

    setLoading(true);
    try {
      const res = await signIn(cleanEmail, password);
      if (!res.success && res.error) {
        setErrorMessage(res.error);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Sign in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setErrorMessage('Please enter your email address.');
      return;
    }
    if (password.length < 8) {
      setErrorMessage('Password must be at least 8 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await signUp(cleanEmail, password);
      if (!res.success) {
        setErrorMessage(res.error || 'Account could not be created. Please try again.');
        return;
      }
      if (res.requiresConfirmation) {
        setSuccessMessage('Account created. Check your email to verify the address, then Tahir Tracker will open your private workspace automatically.');
        setPassword('');
        setConfirmPassword('');
      } else {
        setSuccessMessage('Account created. Opening your private workspace...');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Account could not be created. Please try again.');
    } finally {
      setLoading(false);
    }
  };

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
        setSuccessMessage('Password reset link sent! Check your email inbox.');
      } else {
        setErrorMessage(res.error || 'Failed to send reset link.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to send reset link.');
    } finally {
      setLoading(false);
    }
  };

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
        setSuccessMessage('Login link sent! Check your email inbox.');
        setShowOtpInput(true);
      } else {
        setErrorMessage(res.error || 'Failed to send magic link.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to send magic link.');
    } finally {
      setLoading(false);
    }
  };

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
      if (!res.success && res.error) {
        setErrorMessage(res.error);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#071724] text-[#F4F8FB] flex flex-col justify-center items-center p-4 sm:p-6 selection:bg-[#18E6BE] selection:text-[#06131F]">
      {/* Background glow effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md bg-[#0B1D2C] rounded-3xl border border-cyan-500/25 shadow-2xl p-6 sm:p-8 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#059669] to-[#18E6BE] text-[#06131F] font-black text-2xl flex items-center justify-center mx-auto shadow-[0_0_30px_rgba(24,230,190,0.35)] animate-in zoom-in duration-300">
            {isRentMode ? '🏠' : 'TT'}
          </div>
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight">
              {isRentMode ? 'Rent Tracking SaaS' : 'Tahir Tracker'}
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Personal & Household Wealth Management Platform
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-teal-500/10 text-[#18E6BE] border border-teal-500/20">
              <ShieldCheck className="w-3 h-3" /> Private Workspace
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
              <Zap className="w-3 h-3" /> Offline-First PWA
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-purple-500/10 text-purple-300 border border-purple-500/20">
              <CheckCircle className="w-3 h-3" /> Row Level Security
            </span>
          </div>
        </div>

        {/* Error / Success Feedback */}
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

        {/* Primary Action: Continue with Google */}
        <div className="space-y-4">
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loadingGoogle || loading}
            className="w-full py-3.5 px-4 rounded-2xl text-xs sm:text-sm font-bold text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 shadow-md active:scale-[0.99] transition-all flex items-center justify-center gap-3 cursor-pointer disabled:opacity-50"
          >
            {loadingGoogle ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-slate-700" />
                <span>Connecting to Google...</span>
              </>
            ) : (
              <>
                {/* Official Google 'G' logo SVG */}
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.02h3.87c2.26-2.09 3.675-5.17 3.675-9.12z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.87-3.02c-1.08.72-2.45 1.16-4.06 1.16-3.13 0-5.78-2.11-6.73-4.96H1.27v3.12C3.26 21.36 7.35 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.27 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.61H1.27C.46 8.23 0 10.06 0 12s.46 3.77 1.27 5.39l4-3.12z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.26 2.64 1.27 6.61l4 3.12c.95-2.85 3.6-4.98 6.73-4.98z"
                  />
                </svg>
                <span>Continue with Google</span>
              </>
            )}
          </button>

          {/* Divider */}
          <div className="relative flex py-1 items-center">
            <div className="grow border-t border-slate-700/60" />
            <span className="shrink mx-4 text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
              or continue with email
            </span>
            <div className="grow border-t border-slate-700/60" />
          </div>

          {/* VIEW: Welcome / Password Form */}
          {mode === 'welcome' && (
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
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    disabled={loading}
                    className="w-full pl-10 pr-3.5 py-3 text-xs sm:text-sm rounded-xl bg-[#071724] border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-[#18E6BE] focus:ring-1 focus:ring-[#18E6BE] transition-all"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-300">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot');
                      setErrorMessage(null);
                      setSuccessMessage(null);
                    }}
                    className="text-[11px] font-semibold text-[#18E6BE] hover:underline cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your account password"
                    disabled={loading}
                    className="w-full pl-10 pr-11 py-3 text-xs sm:text-sm rounded-xl bg-[#071724] border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-[#18E6BE] focus:ring-1 focus:ring-[#18E6BE] transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-4 rounded-xl text-xs sm:text-sm font-bold text-[#06131F] bg-gradient-to-r from-teal-500 to-[#18E6BE] hover:from-teal-400 hover:to-[#23F2CB] shadow-[0_0_15px_rgba(24,230,190,0.25)] active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-[#06131F]" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Sign In with Password</span>
                  </>
                )}
              </button>

              <div className="pt-2 text-center space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    setMode('signup');
                    setErrorMessage(null);
                    setSuccessMessage(null);
                    setPassword('');
                    setConfirmPassword('');
                  }}
                  className="block w-full text-xs font-bold text-[#18E6BE] hover:underline cursor-pointer py-1"
                >
                  New to Tahir Tracker? Create your private account
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('magic-link');
                    setErrorMessage(null);
                    setSuccessMessage(null);
                  }}
                  className="text-xs font-semibold text-slate-400 hover:text-[#18E6BE] inline-flex items-center gap-1.5 cursor-pointer py-1"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#18E6BE]" />
                  <span>Send me a passwordless login link</span>
                </button>
              </div>
            </form>
          )}

          {/* VIEW: Create Account */}
          {mode === 'signup' && (
            <form onSubmit={handleSignUp} className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#18E6BE]" />
                  <span>Create Private Workspace</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Use your email and a password. After verification, your isolated Tahir Tracker workspace is created automatically.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">Email Address</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    disabled={loading}
                    className="w-full pl-10 pr-3.5 py-3 text-xs sm:text-sm rounded-xl bg-[#071724] border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-[#18E6BE] focus:ring-1 focus:ring-[#18E6BE] transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">Create Password</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  disabled={loading}
                  className="w-full px-3.5 py-3 text-xs sm:text-sm rounded-xl bg-[#071724] border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-[#18E6BE] focus:ring-1 focus:ring-[#18E6BE] transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">Confirm Password</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your password"
                  disabled={loading}
                  className="w-full px-3.5 py-3 text-xs sm:text-sm rounded-xl bg-[#071724] border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-[#18E6BE] focus:ring-1 focus:ring-[#18E6BE] transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-4 rounded-xl text-xs sm:text-sm font-bold text-[#06131F] bg-gradient-to-r from-teal-500 to-[#18E6BE] hover:from-teal-400 hover:to-[#23F2CB] shadow-[0_0_15px_rgba(24,230,190,0.25)] active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin text-[#06131F]" /> : <CheckCircle2 className="w-4 h-4" />}
                <span>{loading ? 'Creating account...' : 'Create Account'}</span>
              </button>

              <div className="pt-1 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setMode('welcome');
                    setErrorMessage(null);
                    setSuccessMessage(null);
                    setPassword('');
                    setConfirmPassword('');
                  }}
                  className="text-xs font-semibold text-slate-400 hover:text-white inline-flex items-center gap-1.5 cursor-pointer py-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Already have an account? Sign in</span>
                </button>
              </div>
            </form>
          )}

          {/* VIEW: Forgot Password */}
          {mode === 'forgot' && (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-[#18E6BE]" />
                  <span>Reset Password</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Enter your registered email address. We'll send you a secure link to create a new password.
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
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    disabled={loading}
                    className="w-full pl-10 pr-3.5 py-3 text-xs sm:text-sm rounded-xl bg-[#071724] border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-[#18E6BE] focus:ring-1 focus:ring-[#18E6BE] transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-4 rounded-xl text-xs sm:text-sm font-bold text-[#06131F] bg-gradient-to-r from-teal-500 to-[#18E6BE] hover:from-teal-400 hover:to-[#23F2CB] shadow-[0_0_15px_rgba(24,230,190,0.25)] active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin text-[#06131F]" /> : <Mail className="w-4 h-4" />}
                <span>Send Reset Link</span>
              </button>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => setMode('welcome')}
                  className="text-xs font-semibold text-slate-400 hover:text-white inline-flex items-center gap-1.5 cursor-pointer py-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Sign In</span>
                </button>
              </div>
            </form>
          )}

          {/* VIEW: Magic Link / OTP */}
          {mode === 'magic-link' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#18E6BE]" />
                  <span>Passwordless Sign In</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Enter your email address to receive a secure login link or code.
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
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@example.com"
                        disabled={loading}
                        className="w-full pl-10 pr-3.5 py-3 text-xs sm:text-sm rounded-xl bg-[#071724] border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-[#18E6BE] focus:ring-1 focus:ring-[#18E6BE] transition-all"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 px-4 rounded-xl text-xs sm:text-sm font-bold text-[#06131F] bg-gradient-to-r from-teal-500 to-[#18E6BE] hover:from-teal-400 hover:to-[#23F2CB] shadow-[0_0_15px_rgba(24,230,190,0.25)] active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin text-[#06131F]" /> : <Mail className="w-4 h-4" />}
                    <span>Email Me Login Link</span>
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtp} className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">
                      6-Digit Email Code
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
                  </div>

                  <button
                    type="submit"
                    disabled={loading || otpCode.trim().length < 6}
                    className="w-full py-3.5 px-4 rounded-xl text-xs sm:text-sm font-bold text-[#06131F] bg-gradient-to-r from-teal-500 to-[#18E6BE] hover:from-teal-400 hover:to-[#23F2CB] shadow-[0_0_15px_rgba(24,230,190,0.25)] active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin text-[#06131F]" /> : <Check className="w-4 h-4" />}
                    <span>Verify Code & Sign In</span>
                  </button>
                </form>
              )}

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => setMode('welcome')}
                  className="text-xs font-semibold text-slate-400 hover:text-white inline-flex items-center gap-1.5 cursor-pointer py-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Sign In</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Note */}
        <div className="pt-3 border-t border-slate-800 text-center">
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Each verified account receives its own isolated cloud workspace. Your records are protected by per-user database policies and never shared with other Tahir Tracker accounts.
          </p>
        </div>
      </div>
    </div>
  );
};
