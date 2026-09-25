import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AuthUser, AuthStatus } from '../types/auth';

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  allowedEmail: string;
  isConfigured: boolean;
  authError: string | null;
  loginWithGoogle: () => Promise<void>;
  verifyOwnerDirect: (email?: string) => Promise<boolean>;
  logout: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [allowedEmail, setAllowedEmail] = useState<string>('pavan.boggarapu10@gmail.com');
  const [isConfigured, setIsConfigured] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Check initial authentication state from server
  const checkAuthStatus = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/auth/status');
      if (res.ok) {
        const data: AuthStatus = await res.json();
        setIsAuthenticated(data.authenticated);
        setUser(data.user);
        if (data.allowedEmail) {
          setAllowedEmail(data.allowedEmail);
        }
        setIsConfigured(data.isConfigured);
      }
    } catch (err: any) {
      console.warn('Auth status check error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);

  // Listen for message from OAuth popup window
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Validate origin if available
      const origin = event.origin;
      if (origin && !origin.endsWith('.run.app') && !origin.includes('localhost')) {
        return;
      }

      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        setAuthError(null);
        if (event.data.user) {
          setUser(event.data.user);
          setIsAuthenticated(true);
        } else {
          checkAuthStatus();
        }
      } else if (event.data?.type === 'OAUTH_AUTH_ERROR') {
        setAuthError(event.data.error || 'Authentication failed or access was denied.');
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [checkAuthStatus]);

  // Initiate popup Google OAuth flow
  const loginWithGoogle = async () => {
    setAuthError(null);
    try {
      const res = await fetch('/api/auth/google/url');
      const data = await res.json();

      if (!data.url) {
        if (!data.isConfigured) {
          setAuthError('Google Client ID is not configured yet in environment variables. You can sign in using owner verification below or set GOOGLE_CLIENT_ID.');
          return;
        }
        throw new Error(data.message || 'Failed to generate Google OAuth URL.');
      }

      // Open OAuth provider URL directly in popup
      const width = 520;
      const height = 650;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2.5;

      const popup = window.open(
        data.url,
        'google_oauth_popup',
        `width=${width},height=${height},left=${left},top=${top},status=no,resizable=yes`
      );

      if (!popup) {
        setAuthError('Popup blocked by browser. Please allow popups for this site to sign in with Google.');
      }
    } catch (err: any) {
      console.error('Google login error:', err);
      setAuthError(err.message || 'Failed to initiate Google sign-in.');
    }
  };

  // Direct owner verification
  const verifyOwnerDirect = async (emailOverride?: string): Promise<boolean> => {
    setAuthError(null);
    try {
      const targetEmail = emailOverride || allowedEmail;
      const res = await fetch('/api/auth/verify-owner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: targetEmail }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to verify owner credentials');
      }

      setUser(data.user);
      setIsAuthenticated(true);
      return true;
    } catch (err: any) {
      setAuthError(err.message || 'Verification failed');
      return false;
    }
  };

  // Logout
  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      console.error(e);
    } finally {
      setUser(null);
      setIsAuthenticated(false);
      setAuthError(null);
    }
  };

  const clearError = () => setAuthError(null);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoading,
        allowedEmail,
        isConfigured,
        authError,
        loginWithGoogle,
        verifyOwnerDirect,
        logout,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
