import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  initAuth, 
  subscribeAuth, 
  signIn, 
  signOut, 
  refreshSession, 
  getCurrentUser, 
  isAuthenticated as checkIsAuthenticated 
} from '../services/authService';
import { AuthSessionState } from '../types';

interface AuthContextType extends AuthSessionState {
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<{ success: boolean; error?: string }>;
  refreshSession: () => Promise<any>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  error: null,
  isAuthenticated: false,
  signIn: async () => ({ success: false }),
  signOut: async () => ({ success: false }),
  refreshSession: async () => null
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthSessionState>({
    user: getCurrentUser(),
    loading: true,
    error: null,
    isAuthenticated: checkIsAuthenticated()
  });

  useEffect(() => {
    // 1. Subscribe to auth changes
    const unsubscribe = subscribeAuth((state) => {
      setAuthState(state);
    });

    // 2. Initialize auth session
    initAuth();

    return () => {
      unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        ...authState,
        signIn,
        signOut,
        refreshSession
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
