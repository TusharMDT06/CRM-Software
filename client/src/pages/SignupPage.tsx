import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { Building2, User, Mail, Lock, ArrowRight, CheckCircle2, Globe } from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { useToast } from '../context/ToastContext.js';
import { Button } from '../components/ui/Button.js';
import { api } from '../api/client.js';

export const SignupPage: React.FC = () => {
  const [orgName, setOrgName] = useState('');
  const [slug, setSlug] = useState('');
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const { login } = useAuth();
  const { success } = useToast();
  const navigate = useNavigate();

  const handleOrgNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setOrgName(val);
    if (!isSlugManuallyEdited) {
      const generatedSlug = val
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^\w\-]+/g, '')
        .replace(/\-\-+/g, '-')
        .replace(/^-+/, '')
        .replace(/-+$/, '');
      setSlug(generatedSlug);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

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
      const res = await api.post('/auth/signup', {
        orgName,
        name,
        email,
        password,
      });

      login(res.data.token, res.data.user, res.data.tenant);
      setIsSuccess(true);
      success('Workspace created! Please verify your email.');
    } catch (err: any) {
      setErrorMessage(err.message || 'Signup failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md bg-card rounded-container border border-border shadow-md p-8 text-center"
        >
          <div className="w-14 h-14 bg-emerald-500/10 text-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-emerald-500/20">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <h2 className="text-xl font-bold text-foreground">Workspace Created!</h2>
          <p className="text-xs text-muted mt-2 leading-relaxed">
            We’ve sent a verification email to <strong className="text-foreground">{email}</strong>.
            Please check your inbox and verify your email address to unlock record creation.
          </p>

          <div className="mt-6 p-3.5 bg-card-subtle rounded-xl border border-border text-left">
            <p className="text-[11px] font-semibold text-foreground uppercase tracking-wider mb-1">
              Your Workspace
            </p>
            <p className="text-xs text-foreground font-medium">{orgName}</p>
            <p className="text-[11px] text-muted font-mono mt-0.5">slug: {slug || 'org'}</p>
          </div>

          <div className="mt-6 flex flex-col gap-2.5">
            <Button
              variant="primary"
              size="lg"
              className="w-full"
              onClick={() => navigate('/dashboard')}
            >
              <span>Go to Dashboard</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-lg bg-card rounded-container border border-border shadow-md p-8"
      >
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-black dark:bg-white flex items-center justify-center text-white dark:text-black font-bold text-xl mb-3 shadow-sm">
            <span className="text-[#F07B2A] mr-0.5 font-extrabold">F</span>D
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Create Flowdesk Workspace</h1>
          <p className="text-xs text-muted mt-1">
            Start your multi-tenant sales CRM with team isolation
          </p>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mb-5 p-3.5 rounded-xl bg-[#FDE4E4] border border-[#FDE4E4] text-[#B42318] text-xs font-medium dark:bg-[#B42318]/20 dark:text-[#F87171] leading-relaxed">
            {errorMessage}
          </div>
        )}

        {/* Signup Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                Company / Organization
              </label>
              <div className="relative">
                <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
                <input
                  type="text"
                  required
                  value={orgName}
                  onChange={handleOrgNameChange}
                  placeholder="Acme Corp"
                  className="w-full pl-10 pr-3 py-2 text-sm bg-card border border-border rounded-xl text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                Workspace Slug
              </label>
              <div className="relative">
                <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
                <input
                  type="text"
                  required
                  value={slug}
                  onChange={(e) => {
                    setIsSlugManuallyEdited(true);
                    setSlug(e.target.value.toLowerCase().replace(/[^\w\-]/g, ''));
                  }}
                  placeholder="acme-corp"
                  className="w-full pl-10 pr-3 py-2 text-sm font-mono bg-card border border-border rounded-xl text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-1">
              Admin Full Name
            </label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Alex Mercer"
                className="w-full pl-10 pr-3 py-2 text-sm bg-card border border-border rounded-xl text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-1">
              Work Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="alex@acme.com"
                className="w-full pl-10 pr-3 py-2 text-sm bg-card border border-border rounded-xl text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                Password
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
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            isLoading={isLoading}
            className="w-full mt-2"
          >
            <span>Create Workspace</span>
            <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </form>

        <div className="mt-6 text-center text-xs text-muted">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-foreground hover:underline">
            Sign In
          </Link>
        </div>
      </motion.div>
    </div>
  );
};
