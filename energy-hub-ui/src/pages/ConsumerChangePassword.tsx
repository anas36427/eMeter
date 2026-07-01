import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useConsumerAuth, consumerFetch } from '@/contexts/ConsumerAuthContext';
import { KeyRound, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

export default function ConsumerChangePassword() {
  const { token } = useConsumerAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) { navigate('/consumer/login'); return; }
    if (newPassword !== confirmPassword) {
      toast({ title: 'Passwords do not match', description: 'New password and confirm password must be the same.', variant: 'destructive' });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: 'Password too short', description: 'Password must be at least 6 characters.', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      await consumerFetch('/api/consumer/portal/change-password/', token, {
        method: 'POST',
        body: JSON.stringify({ 
          old_password: currentPassword, 
          new_password: newPassword,
          confirm_password: confirmPassword
        }),
      });
      toast({ title: 'Password Updated', description: 'Your password has been changed successfully.' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      toast({ title: 'Failed to update password', description: err.message || 'Please check your current password.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Change Password</h1>
        <p className="text-muted-foreground text-sm mt-1">Update your account password securely</p>
      </div>

      <div className="max-w-md">
        {/* Security info card */}
        <div className="stat-card p-4 flex items-start gap-3 bg-blue-600/5 border-blue-600/20 mb-6">
          <ShieldCheck className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-muted-foreground">
            Choose a strong password with at least <strong className="text-foreground">6 characters</strong>.
            Do not share your password with anyone.
          </div>
        </div>

        <form onSubmit={handleSubmit} className="stat-card p-6 space-y-5">
          {/* Current password */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-muted-foreground" /> Current Password
            </label>
            <div className="relative">
              <Input
                id="current-password"
                type={showCurrent ? 'text' : 'password'}
                placeholder="Enter current password"
                className="pr-10 h-11"
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                required
              />
              <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* New password */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-muted-foreground" /> New Password
            </label>
            <div className="relative">
              <Input
                id="new-password"
                type={showNew ? 'text' : 'password'}
                placeholder="Enter new password"
                className="pr-10 h-11"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                required
              />
              <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Confirm password */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Confirm New Password</label>
            <Input
              id="confirm-password"
              type="password"
              placeholder="Re-enter new password"
              className="h-11"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              required
            />
            {confirmPassword && newPassword !== confirmPassword && (
              <p className="text-xs text-red-400 mt-1">Passwords do not match.</p>
            )}
          </div>

          <Button
            id="change-password-btn"
            type="submit"
            className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-semibold"
            disabled={loading}
          >
            {loading ? 'Updating…' : 'Update Password'}
          </Button>
        </form>
      </div>
    </div>
  );
}
