import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, User, Lock, Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useConsumerAuth } from '@/contexts/ConsumerAuthContext';
import { useToast } from '@/hooks/use-toast';

export default function ConsumerLogin() {
  const { login, token, isInitializing } = useConsumerAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isInitializing && token) {
      navigate('/consumer/dashboard');
    }
  }, [isInitializing, token, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      toast({ title: 'Missing fields', description: 'Please enter your Consumer ID and password.', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      await login(username.trim(), password);
      navigate('/consumer/dashboard');
    } catch (err: any) {
      toast({
        title: 'Login Failed',
        description: err.message || 'Invalid Consumer ID or password.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left: Blue Branding Panel */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden items-center justify-center bg-blue-700">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-blue-700 to-blue-800" />
        {/* Decorative circles */}
        <div className="absolute -bottom-20 -left-20 w-64 h-64 rounded-full bg-white/5" />
        <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-white/5" />
        <div className="absolute top-1/3 left-1/4 w-32 h-32 rounded-full bg-white/5" />

        <div className="relative z-10 text-center px-12">
          {/* Logo */}
          <div className="w-24 h-24 rounded-full bg-white overflow-hidden flex items-center justify-center mx-auto mb-8 shadow-xl border-4 border-white/20 p-2">
            <img src="/assets/logo.png" alt="eMeter AMU Logo" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-3">Consumer Portal</h1>
          <p className="text-lg text-blue-100/80 max-w-md">
            AMU eMeter Service — View your electricity bills, meter readings, and account details online.
          </p>

          {/* Feature pills */}
          <div className="flex flex-wrap justify-center gap-2 mt-8">
            {['View Readings', 'Download Bills', 'Secure Access'].map(f => (
              <span key={f} className="px-3 py-1.5 rounded-full bg-white/10 text-white/90 text-sm font-medium border border-white/10">
                {f}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Right: Login Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-white overflow-hidden flex items-center justify-center border border-blue-200/20 p-1">
              <img src="/assets/logo.png" alt="Logo" className="w-full h-full object-contain" />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-bold text-foreground leading-none">Consumer Portal</span>
              <span className="text-[10px] text-blue-400 font-bold uppercase tracking-wider mt-1">eMeter AMU</span>
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-foreground">Welcome, Consumer</h2>
            <p className="text-muted-foreground mt-1">Sign in to view your meter account</p>
          </div>

          {/* Hint box */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-600/10 border border-blue-600/20 text-sm text-blue-400">
            <span className="text-base"></span>
            <span>First time? Your default password is your <strong>Consumer Number</strong>.</span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Consumer Number field */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Consumer Number</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="consumer-id"
                  type="text"
                  placeholder="e.g. 12345"
                  className="pl-10 h-11"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  autoComplete="username"
                  required
                />
              </div>
            </div>

            {/* Password field */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="consumer-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  className="pl-10 pr-10 h-11"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button
              id="consumer-login-btn"
              type="submit"
              className="w-full h-11 font-semibold bg-blue-600 hover:bg-blue-700 text-white"
              disabled={loading}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            Forgot your password? Contact your <strong className="text-foreground">Administrator</strong>.
          </p>

          {/* Link to admin portal */}
          <p className="text-center text-xs text-muted-foreground border-t border-border pt-4">
            Are you an Admin?{' '}
            <a href="/login" className="text-primary hover:underline font-medium">
              Admin Login →
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
