import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { CheckCircle2, AlertCircle, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '../components/ui/Button.js';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.js';

export const VerifyEmailPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  const navigate = useNavigate();
  const { refreshMe } = useAuth();

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('No verification token provided in URL.');
      return;
    }

    const verify = async () => {
      try {
        const res = await api.get(`/auth/verify-email?token=${encodeURIComponent(token)}`);
        setStatus('success');
        setMessage(res.data.message || 'Email verified successfully!');
        // Refresh local user state so isVerified updates immediately
        await refreshMe();
      } catch (err: any) {
        setStatus('error');
        setMessage(err.message || 'Verification failed or token has expired.');
      }
    };

    verify();
  }, [token, refreshMe]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-card rounded-container border border-border shadow-md p-8 text-center"
      >
        <div className="w-12 h-12 rounded-2xl bg-black dark:bg-white flex items-center justify-center text-white dark:text-black font-bold text-xl mb-6 shadow-sm mx-auto">
          <span className="text-[#F07B2A] mr-0.5 font-extrabold">F</span>D
        </div>

        {status === 'loading' && (
          <div className="py-8 space-y-4">
            <Loader2 className="w-10 h-10 animate-spin text-muted mx-auto" />
            <h2 className="text-lg font-bold text-foreground">Verifying your email...</h2>
            <p className="text-xs text-muted">Please hold on while we confirm your account token.</p>
          </div>
        )}

        {status === 'success' && (
          <div className="py-4 space-y-4">
            <div className="w-14 h-14 bg-emerald-500/10 text-emerald-500 rounded-2xl flex items-center justify-center mx-auto border border-emerald-500/20">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-foreground">Email Verified!</h2>
            <p className="text-xs text-muted leading-relaxed">{message}</p>
            <div className="pt-4">
              <Button
                variant="primary"
                size="lg"
                className="w-full"
                onClick={() => navigate('/dashboard')}
              >
                <span>Continue to Flowdesk</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="py-4 space-y-4">
            <div className="w-14 h-14 bg-[#FDE4E4] text-[#B42318] dark:bg-[#B42318]/20 dark:text-[#F87171] rounded-2xl flex items-center justify-center mx-auto border border-[#FDE4E4]">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-foreground">Verification Failed</h2>
            <p className="text-xs text-muted leading-relaxed">{message}</p>
            <div className="pt-4 flex flex-col gap-2">
              <Link to="/login">
                <Button variant="primary" size="lg" className="w-full">
                  Back to Sign In
                </Button>
              </Link>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};
