import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import {
  authSlice,
  useLoginMutation,
  useSignUpMutation,
  useDevLoginMutation,
} from '../app/store.js';
import {
  BookOpen,
  Lock,
  Mail,
  ArrowRight,
  Sparkles,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

export const LoginView: React.FC = () => {
  const dispatch = useDispatch();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('testuser@notebooklm.local');
  const [password, setPassword] = useState('TestPassword123!');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [login, { isLoading: isLoggingIn }] = useLoginMutation();
  const [signUp, { isLoading: isSigningUp }] = useSignUpMutation();
  const [devLogin, { isLoading: isDevLoggingIn }] = useDevLoginMutation();

  const isSubmitting = isLoggingIn || isSigningUp || isDevLoggingIn;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!email.trim() || !password.trim()) {
      setErrorMessage('Please enter both email and password.');
      return;
    }

    try {
      if (mode === 'signin') {
        const res = await login({ email: email.trim(), password }).unwrap();
        dispatch(
          authSlice.actions.setAuth({
            token: res.token,
            userId: res.user.userId,
            email: res.user.email,
          }),
        );
      } else {
        const res = await signUp({ email: email.trim(), password }).unwrap();
        if (res.userConfirmed) {
          // If auto-confirmed, sign in immediately
          const loginRes = await login({ email: email.trim(), password }).unwrap();
          dispatch(
            authSlice.actions.setAuth({
              token: loginRes.token,
              userId: loginRes.user.userId,
              email: loginRes.user.email,
            }),
          );
        } else {
          setSuccessMessage(res.message);
          setMode('signin');
        }
      }
    } catch (err: any) {
      const msg =
        err?.data?.message ||
        err?.error ||
        'Authentication failed. Please verify your credentials and try again.';
      setErrorMessage(msg);
    }
  };

  const handleDevLogin = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const res = await devLogin().unwrap();
      dispatch(
        authSlice.actions.setAuth({
          token: res.token,
          userId: res.user.userId,
          email: res.user.email,
        }),
      );
    } catch {
      // Offline fallback: set dev token directly
      dispatch(
        authSlice.actions.setAuth({
          token: 'dev-token-default-user',
          userId: '00000000-0000-7000-8000-000000000001',
          email: 'dev@notebooklm.local',
        }),
      );
    }
  };

  return (
    <div className="min-h-screen w-screen flex flex-col items-center justify-center bg-background text-foreground p-4">
      <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-lg p-6 sm:p-8 space-y-6">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-secondary border border-border flex items-center justify-center text-accent shadow-xs mb-1">
            <BookOpen className="w-6 h-6" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            NotebookLM Enterprise
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            {mode === 'signin'
              ? 'Sign in to access your research notebooks & citations'
              : 'Create an account to start synthesizing documents'}
          </p>
        </div>

        {/* Tab Toggle */}
        <div className="grid grid-cols-2 p-1 bg-secondary rounded-xl border border-border text-xs font-medium">
          <button
            type="button"
            onClick={() => {
              setMode('signin');
              setErrorMessage(null);
              setSuccessMessage(null);
            }}
            className={`py-1.5 rounded-lg transition-all cursor-pointer ${
              mode === 'signin'
                ? 'bg-card text-foreground shadow-xs font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('signup');
              setErrorMessage(null);
              setSuccessMessage(null);
            }}
            className={`py-1.5 rounded-lg transition-all cursor-pointer ${
              mode === 'signup'
                ? 'bg-card text-foreground shadow-xs font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Feedback Alerts */}
        {errorMessage && (
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs leading-relaxed">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs leading-relaxed">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Auth Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Email</label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                required
                className="w-full pl-9 pr-3 py-2 text-xs bg-secondary/40 border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-foreground">Password</label>
              {mode === 'signup' && (
                <span className="text-[10px] text-muted-foreground">Min. 8 characters</span>
              )}
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full pl-9 pr-3 py-2 text-xs bg-secondary/40 border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-2 py-2.5 px-4 text-xs font-semibold text-primary-foreground bg-primary hover:opacity-90 rounded-xl disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"
          >
            {isSubmitting ? (
              <span>Processing...</span>
            ) : mode === 'signin' ? (
              <>
                <span>Sign In</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            ) : (
              <>
                <span>Create Account</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-[11px] uppercase tracking-wider">
            <span className="bg-card px-2 text-muted-foreground">Or Local Dev Mode</span>
          </div>
        </div>

        {/* Quick Dev Login Button */}
        <button
          type="button"
          onClick={handleDevLogin}
          disabled={isSubmitting}
          className="w-full py-2 px-3 text-xs font-medium text-foreground bg-secondary/60 hover:bg-secondary border border-border rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5 text-accent" />
          <span>Quick Dev Login (1-Click)</span>
        </button>
      </div>
    </div>
  );
};
