import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ShieldCheck, UserCheck, Briefcase, ArrowRight, Lock, Mail } from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { useToast } from '../context/ToastContext.js';
import { Button } from '../components/ui/Button.js';
import { api } from '../api/client.js';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const { login } = useAuth();
  const { success } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsLoading(true);

    try {
      const res = await api.post('/auth/login', { email, password });
      login(res.data.token, res.data.user);
      success(`Welcome back, ${res.data.user.name}`);
      navigate('/dashboard');
    } catch (err: any) {
      setErrorMessage(err.message || 'Login failed. Please verify credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const fillCredentials = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('Password@123');
    setErrorMessage('');
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md bg-card rounded-container border border-border shadow-md p-8"
      >
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-black dark:bg-white flex items-center justify-center text-white dark:text-black font-bold text-xl mb-4 shadow-sm">
            <span className="text-[#F07B2A] mr-0.5 font-extrabold">F</span>D
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Sign in to Flowdesk</h1>
          <p className="text-xs text-muted mt-1.5">
            Enterprise Sales & Pipeline CRM platform
          </p>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mb-5 p-3.5 rounded-xl bg-[#FDE4E4] border border-[#FDE4E4] text-[#B42318] text-xs font-medium dark:bg-[#B42318]/20 dark:text-[#F87171] leading-relaxed">
            {errorMessage}
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full pl-10 pr-4 py-2.5 text-sm bg-card border border-border rounded-xl text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white transition-all"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-medium text-foreground">
                Password
              </label>
            </div>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pl-10 pr-4 py-2.5 text-sm bg-card border border-border rounded-xl text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white transition-all"
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
            <span>Sign In</span>
            <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </form>

        {/* Demo Accounts Quick-Fill Section */}
        <div className="mt-8 pt-6 border-t border-border">
          <p className="text-[11px] font-medium text-muted uppercase tracking-wider text-center mb-3">
            Quick-Fill Demo Roles
          </p>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => fillCredentials('admin@crm.test')}
              className="flex flex-col items-center p-2.5 rounded-xl border border-border hover:bg-[#F4F4F5] dark:hover:bg-[#202025] transition-colors text-center group"
            >
              <ShieldCheck className="w-4 h-4 text-brand mb-1 group-hover:scale-110 transition-transform" />
              <span className="text-xs font-semibold text-foreground">Admin</span>
              <span className="text-[10px] text-muted">Full access</span>
            </button>

            <button
              type="button"
              onClick={() => fillCredentials('manager@crm.test')}
              className="flex flex-col items-center p-2.5 rounded-xl border border-border hover:bg-[#F4F4F5] dark:hover:bg-[#202025] transition-colors text-center group"
            >
              <Briefcase className="w-4 h-4 text-[#3FCB8A] mb-1 group-hover:scale-110 transition-transform" />
              <span className="text-xs font-semibold text-foreground">Manager</span>
              <span className="text-[10px] text-muted">All deals</span>
            </button>

            <button
              type="button"
              onClick={() => fillCredentials('sales@crm.test')}
              className="flex flex-col items-center p-2.5 rounded-xl border border-border hover:bg-[#F4F4F5] dark:hover:bg-[#202025] transition-colors text-center group"
            >
              <UserCheck className="w-4 h-4 text-[#6F8BE8] mb-1 group-hover:scale-110 transition-transform" />
              <span className="text-xs font-semibold text-foreground">Sales</span>
              <span className="text-[10px] text-muted">Own deals</span>
            </button>
          </div>
          <p className="text-center text-[11px] text-muted mt-3">
            Password: <code className="bg-[#F4F4F5] dark:bg-[#202025] px-1.5 py-0.5 rounded text-foreground font-mono">Password@123</code>
          </p>
        </div>
      </motion.div>
    </div>
  );
};
