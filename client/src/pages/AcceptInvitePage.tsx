import React, { useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { Lock, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Button } from '../components/ui/Button.js';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.js';
import { useToast } from '../context/ToastContext.js';

export const AcceptInvitePage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const navigate = useNavigate();
  const { login } = useAuth();
  const { success } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!token) {
      setErrorMessage('Invitation token is missing from URL.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setErrorMessage('Password must be at least 8 characters');
      return;
    }

    setIsLoading(true);

    try {
      const res = await api.post('/auth/accept-invite', {
        token,
        password,
      });

      login(res.data.token, res.data.user);
      setIsSuccess(true);
      success('Invitation accepted! Welcome to Flowdesk.');
      setTimeout(() => {
        navigate('/dashboard');
      }, 1500);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to accept invitation. The link may have expired or was already used.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-card rounded-container border border-border p-8 text-center">
          <h2 className="text-lg font-bold text-foreground">Invalid Invitation</h2>
          <p className="text-xs text-muted mt-2">
            This invitation link is missing a valid token. Please contact your organization administrator.
          </p>
          <div className="mt-4">
            <Link to="/login">
              <Button variant="primary" size="md">
                Back to Login
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-card rounded-container border border-border shadow-md p-8"
      >
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-black dark:bg-white flex items-center justify-center text-white dark:text-black font-bold text-xl mb-3 shadow-sm">
            <span className="text-[#F07B2A] mr-0.5 font-extrabold">F</span>D
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Accept Team Invitation</h1>
          <p className="text-xs text-muted mt-1">
            Set your password to join your organization on Flowdesk CRM
          </p>
        </div>

        {errorMessage && (
          <div className="mb-5 p-3.5 rounded-xl bg-[#FDE4E4] border border-[#FDE4E4] text-[#B42318] text-xs font-medium dark:bg-[#B42318]/20 dark:text-[#F87171] leading-relaxed">
            {errorMessage}
          </div>
        )}

        {isSuccess ? (
          <div className="text-center py-6 space-y-3">
            <div className="w-12 h-12 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-foreground">Account Activated!</h3>
            <p className="text-xs text-muted">Redirecting to your workspace dashboard...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                Choose Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-10 pr-3 py-2 text-sm bg-card border border-border rounded-xl text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-10 pr-3 py-2 text-sm bg-card border border-border rounded-xl text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
                />
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              isLoading={isLoading}
              className="w-full mt-2"
            >
              <span>Activate Account & Sign In</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </form>
        )}
      </motion.div>
    </div>
  );
};
