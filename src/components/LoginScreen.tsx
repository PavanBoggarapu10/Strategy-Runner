import React, { useState } from 'react';
import {
  ShieldCheck,
  Lock,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Key,
  Layers,
  Sparkles,
  UserCheck,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const LoginScreen: React.FC = () => {
  const {
    loginWithGoogle,
    verifyOwnerDirect,
    authError,
    allowedEmail,
    isConfigured,
    clearError,
  } = useAuth();

  const [isSigningIn, setIsSigningIn] = useState(false);
  const [showConfigGuide, setShowConfigGuide] = useState(false);
  const [typedEmail, setTypedEmail] = useState(allowedEmail);

  const handleGoogleClick = async () => {
    setIsSigningIn(true);
    try {
      await loginWithGoogle();
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleOwnerDirectClick = async () => {
    setIsSigningIn(true);
    try {
      await verifyOwnerDirect(typedEmail);
    } finally {
      setIsSigningIn(false);
    }
  };

  // Compute exact callback & origin URLs for Google Cloud configuration
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const callbackUrl = `${currentOrigin}/auth/callback`;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between font-sans relative overflow-hidden selection:bg-purple-500 selection:text-white">
      {/* Background ambient lighting */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-purple-900/15 blur-[120px] pointer-events-none rounded-full" />
      <div className="absolute bottom-0 right-10 w-[500px] h-[300px] bg-emerald-900/10 blur-[100px] pointer-events-none rounded-full" />

      {/* Header bar */}
      <header className="border-b border-slate-900/80 px-6 py-4 flex items-center justify-between relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-purple-600 flex items-center justify-center shadow-md shadow-purple-900/20">
            <Lock className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-white flex items-center gap-2">
              Crypto Strategy Tester
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-mono font-medium border border-purple-500/30">
                PRIVATE
              </span>
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-400">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Access Restricted to Owner</span>
        </div>
      </header>

      {/* Main Login Card */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 relative z-10">
        <div className="w-full max-w-md bg-slate-900/90 border border-slate-800/80 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative">
          {/* Top lock badge */}
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-b from-purple-500/20 to-slate-900 border border-purple-500/30 flex items-center justify-center shadow-lg shadow-purple-500/10">
                <Lock className="w-8 h-8 text-purple-400" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 border-2 border-slate-950 flex items-center justify-center">
                <ShieldCheck className="w-3.5 h-3.5 text-slate-950" />
              </div>
            </div>
          </div>

          <div className="text-center space-y-1.5 mb-6">
            <h2 className="text-xl font-bold tracking-tight text-white">
              Private Terminal Sign In
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed max-w-sm mx-auto">
              This application is published privately and protected. Only the verified owner Google Account has authorization to access strategy controls and execution.
            </p>
          </div>

          {/* Authorized email callout */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 mb-6 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <UserCheck className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase font-semibold tracking-wider text-slate-500">
                Authorized Whitelist
              </p>
              <p className="text-xs font-mono font-medium text-emerald-300 truncate">
                {allowedEmail}
              </p>
            </div>
          </div>

          {/* Error Banner */}
          {authError && (
            <div className="mb-6 p-3.5 rounded-xl bg-red-950/40 border border-red-500/40 text-red-300 text-xs flex items-start gap-2.5 animate-in fade-in duration-150">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1 text-[11px] leading-relaxed">
                {authError}
              </div>
              <button
                onClick={clearError}
                className="text-red-400 hover:text-red-200 text-xs font-bold px-1"
                aria-label="Dismiss error"
              >
                ×
              </button>
            </div>
          )}

          {/* Primary Action Buttons */}
          <div className="space-y-3">
            {/* Google Sign In Button */}
            <button
              id="btn-google-login"
              type="button"
              onClick={handleGoogleClick}
              disabled={isSigningIn}
              className="w-full py-3 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-900 text-xs font-bold transition-all flex items-center justify-center gap-3 cursor-pointer shadow-lg shadow-white/5 active:scale-[0.99] disabled:opacity-50"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>{isSigningIn ? 'Signing in...' : 'Sign in with Google Account'}</span>
            </button>

            {/* Direct One-Click Owner Verification Button */}
            <div className="pt-2">
              <button
                id="btn-owner-verify-direct"
                type="button"
                onClick={handleOwnerDirectClick}
                disabled={isSigningIn}
                className="w-full py-2.5 px-4 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 text-purple-200 text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
              >
                <Key className="w-3.5 h-3.5 text-purple-400" />
                <span>Verify & Enter as Owner ({allowedEmail.split('@')[0]})</span>
                <ArrowRight className="w-3.5 h-3.5 text-purple-400" />
              </button>
            </div>
          </div>

          {/* Configuration Status / Help Accordion */}
          <div className="mt-6 pt-4 border-t border-slate-800/80">
            <button
              type="button"
              onClick={() => setShowConfigGuide(!showConfigGuide)}
              className="w-full flex items-center justify-between text-[11px] text-slate-400 hover:text-slate-300 font-medium transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${isConfigured ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                <span>OAuth Configuration Details</span>
              </span>
              {showConfigGuide ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {showConfigGuide && (
              <div className="mt-3 p-3 bg-slate-950 rounded-xl border border-slate-800 text-[11px] text-slate-400 space-y-2.5 animate-in fade-in duration-150">
                <div className="flex items-center justify-between text-slate-300 font-semibold">
                  <span>Google Cloud Console Settings</span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] ${isConfigured ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/30' : 'bg-amber-950 text-amber-300 border border-amber-500/30'}`}>
                    {isConfigured ? 'GOOGLE_CLIENT_ID Active' : 'Setup Optional / Direct Access Ready'}
                  </span>
                </div>

                <p className="text-[10px] leading-relaxed text-slate-400">
                  To authenticate via your custom Google Cloud OAuth project, add these URLs to your Google Cloud Console OAuth 2.0 Client credentials:
                </p>

                <div className="space-y-1.5 font-mono text-[10px]">
                  <div>
                    <span className="text-slate-500 block">Authorized JavaScript Origin:</span>
                    <span className="text-slate-300 bg-slate-900 px-2 py-1 rounded block truncate select-all border border-slate-800">
                      {currentOrigin}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Authorized Redirect URI:</span>
                    <span className="text-slate-300 bg-slate-900 px-2 py-1 rounded block truncate select-all border border-slate-800">
                      {callbackUrl}
                    </span>
                  </div>
                </div>

                <p className="text-[10px] text-slate-500">
                  Then set <code className="text-purple-300">GOOGLE_CLIENT_ID</code> and <code className="text-purple-300">GOOGLE_CLIENT_SECRET</code> in the project Settings &gt; Secrets menu.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900/80 px-6 py-3 text-center text-[11px] text-slate-600 relative z-10">
        Crypto Strategy Tester & Backtesting Engine • Single-User Restricted Environment
      </footer>
    </div>
  );
};
