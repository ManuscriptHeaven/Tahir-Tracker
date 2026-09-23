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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div 
        className="w-full max-w-md bg-[#0B1D2C] rounded-3xl shadow-2xl border border-cyan-500/30 overflow-hidden transform transition-all animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="relative bg-[#071724] px-6 pt-6 pb-5 text-white border-b border-slate-800">
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute top-5 right-5 p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-teal-500 to-[#18E6BE] flex items-center justify-center text-[#06131F] font-black text-xl shadow-[0_0_20px_rgba(24,230,190,0.3)]">
              {isRentMode ? '🏠' : 'TT'}
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight text-white">
                {isRentMode ? 'Rent Tracking Cloud' : 'Tahir Tracker Cloud'}
              </h2>
              <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                <Cloud className="w-3.5 h-3.5 text-[#18E6BE]" />
                <span>Supabase Secure Authentication</span>
              </p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-6">
          {isAuthenticated && user ? (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-[#071724] border border-teal-500/30 text-slate-200">
                <div className="flex items-center gap-2 font-bold text-sm text-[#18E6BE]">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Authenticated & Connected</span>
                </div>
                <p className="text-xs text-slate-300 mt-1.5">
                  Signed in as <strong className="font-semibold text-white">{user.email}</strong>
                </p>
                <p className="text-[11px] text-slate-400 mt-2 font-mono break-all">
                  User ID: {user.id}
                </p>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed">
                Cloud synchronization is active. All your local mutations automatically sync to your private cloud database.
              </p>

              <div className="flex gap-2 pt-2">
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
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {errorMessage && (
                <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div className="leading-snug">{errorMessage}</div>
                </div>
              )}

              {successMessage && (
                <div className="p-3.5 rounded-2xl bg-teal-500/10 border border-teal-500/30 text-[#18E6BE] text-xs flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-[#18E6BE] shrink-0 mt-0.5" />
                  <div className="leading-snug">{successMessage}</div>
                </div>
              )}

              {/* Email Field */}
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
                    placeholder="tahir@tracker.internal"
                    disabled={loading}
                    className="w-full pl-10 pr-3.5 py-2.5 text-xs rounded-xl bg-[#071724] border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-[#18E6BE] focus:ring-1 focus:ring-[#18E6BE] transition-all"
                  />
                </div>
              </div>

              {/* Password Field */}
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
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your account password"
                    disabled={loading}
                    className="w-full pl-10 pr-10 py-2.5 text-xs rounded-xl bg-[#071724] border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-[#18E6BE] focus:ring-1 focus:ring-[#18E6BE] transition-all"
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
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-3 px-4 rounded-xl text-xs font-bold text-[#06131F] bg-gradient-to-r from-teal-500 to-[#18E6BE] hover:from-teal-400 hover:to-[#23F2CB] shadow-[0_0_15px_rgba(24,230,190,0.25)] active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-[#06131F]" />
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
                <p className="text-[11px] text-slate-400 leading-normal">
                  <strong className="text-slate-300">Single-Owner Private Application:</strong> Public registration is disabled. You can continue using all features completely offline without logging in.
                </p>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
