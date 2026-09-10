import React, { useState } from 'react';
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
  Cloud
} from 'lucide-react';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  isRentMode?: boolean;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  isRentMode = false
}) => {
  const { signIn, isAuthenticated, user, signOut } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!email.trim()) {
      setErrorMessage('Please enter your email address.');
      return;
    }
    if (!password) {
      setErrorMessage('Please enter your password.');
      return;
    }

    setLoading(true);
    try {
      const res = await signIn(email, password);
      if (res.success) {
        setSuccessMessage('Successfully signed in! Cloud sync is now active.');
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        setErrorMessage(res.error || 'Authentication failed. Please verify credentials.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Network error during sign in.');
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
      <div 
        className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="relative bg-slate-900 px-6 pt-6 pb-5 text-white">
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute top-5 right-5 p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-emerald-500/30">
              {isRentMode ? '🏠' : 'TT'}
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight text-white">
                {isRentMode ? 'Rent Tracking Cloud' : 'Tahir Tracker Cloud'}
              </h2>
              <p className="text-xs text-slate-300 flex items-center gap-1 mt-0.5">
                <Cloud className="w-3 h-3 text-emerald-400" />
                <span>Supabase Secure Authentication</span>
              </p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-6">
          {isAuthenticated && user ? (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900">
                <div className="flex items-center gap-2 font-bold text-sm">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Authenticated & Connected</span>
                </div>
                <p className="text-xs text-emerald-700 mt-1">
                  Signed in as <strong className="font-semibold">{user.email}</strong>
                </p>
                <p className="text-[11px] text-slate-500 mt-2 font-mono break-all">
                  User ID: {user.id}
                </p>
              </div>

              <p className="text-xs text-slate-500 leading-relaxed">
                Cloud synchronization is active. All your local mutations automatically sync to your private cloud database.
              </p>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleSignOut}
                  disabled={loading}
                  className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-all"
                >
                  {loading ? 'Signing out...' : 'Sign Out'}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-all"
                >
                  Close
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {errorMessage && (
                <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div className="leading-snug">{errorMessage}</div>
                </div>
              )}

              {successMessage && (
                <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="leading-snug">{successMessage}</div>
                </div>
              )}

              {/* Email Field */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
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
                    placeholder="tahir@tracker.internal"
                    disabled={loading}
                    className="w-full pl-10 pr-3.5 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>

              {/* Password Field */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your account password"
                    disabled={loading}
                    className="w-full pl-10 pr-10 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-3 px-4 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-md shadow-emerald-600/20 active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Sign In to Cloud Sync</span>
                  </>
                )}
              </button>

              {/* Offline & Security Note */}
              <div className="pt-2 text-center">
                <p className="text-[11px] text-slate-500 leading-normal">
                  <strong>Single-Owner Private Application:</strong> Public registration is disabled. You can continue using all features completely offline without logging in.
                </p>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
