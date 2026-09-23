import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  initAuth, 
  subscribeAuth, 
  signIn, 
  signOut, 
  refreshSession, 
  getCurrentUser, 
  isAuthenticated as checkIsAuthenticated,
  resetPasswordForEmail,
  updatePassword as updateAuthPassword,
  signInWithOtp as sendAuthMagicLink,
  verifyOtp as verifyAuthOtp,
  getIsRecoveryMode,
  setRecoveryMode as setAuthRecoveryMode,
  getRecoveryError,
  clearRecoveryError as clearAuthRecoveryError
} from '../services/authService';
import { AuthSessionState } from '../types';

export interface AuthContextType extends AuthSessionState {
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<{ success: boolean; error?: string }>;
  refreshSession: () => Promise<any>;
  sendPasswordReset: (email: string) => Promise<{ success: boolean; error?: string }>;
  updatePassword: (newPassword: string) => Promise<{ success: boolean; error?: string }>;
  sendMagicLink: (email: string) => Promise<{ success: boolean; error?: string }>;
  verifyOtp: (email: string, token: string) => Promise<{ success: boolean; error?: string }>;
  isRecoveryMode: boolean;
  setRecoveryMode: (active: boolean) => void;
  clearRecoveryError: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  error: null,
  isAuthenticated: false,
  isRecoveryMode: false,
  recoveryError: null,
  signIn: async () => ({ success: false }),
  signOut: async () => ({ success: false }),
  refreshSession: async () => null,
  sendPasswordReset: async () => ({ success: false }),
  updatePassword: async () => ({ success: false }),
  sendMagicLink: async () => ({ success: false }),
  verifyOtp: async () => ({ success: false }),
  setRecoveryMode: () => {},
  clearRecoveryError: () => {}
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthSessionState>({
    user: getCurrentUser(),
    loading: true,
    error: null,
    isAuthenticated: checkIsAuthenticated(),
    isRecoveryMode: getIsRecoveryMode(),
    recoveryError: getRecoveryError()
  });

  useEffect(() => {
    // 1. Subscribe to auth changes
    const unsubscribe = subscribeAuth((state) => {
      setAuthState(state);
    });

    // 2. Initialize auth session and inspect URL
    initAuth();

    return () => {
      unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        ...authState,
        isRecoveryMode: Boolean(authState.isRecoveryMode),
        recoveryError: authState.recoveryError || null,
        signIn,
        signOut,
        refreshSession,
        sendPasswordReset: resetPasswordForEmail,
        updatePassword: updateAuthPassword,
        sendMagicLink: sendAuthMagicLink,
        verifyOtp: verifyAuthOtp,
        setRecoveryMode: setAuthRecoveryMode,
        clearRecoveryError: clearAuthRecoveryError
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
