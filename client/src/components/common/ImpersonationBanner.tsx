import React from 'react';
import { LogOut, ShieldAlert } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';

export const ImpersonationBanner: React.FC = () => {
  const { isImpersonating, tenant, stopImpersonating } = useAuth();

  if (!isImpersonating) return null;

  return (
    <div className="bg-amber-500 text-black px-4 py-2 text-xs font-medium flex items-center justify-between shadow-md relative z-50 animate-fadeIn">
      <div className="flex items-center gap-2">
        <ShieldAlert className="w-4 h-4 shrink-0 text-amber-950" />
        <span className="font-semibold text-amber-950">Platform Impersonation Mode:</span>
        <span>
          Viewing as <strong className="underline">{tenant?.name || tenant?.slug || 'Tenant'}</strong>
        </span>
        <span className="hidden sm:inline bg-amber-600/20 text-amber-950 px-2 py-0.5 rounded text-[11px] font-mono">
          READ-ONLY (Expires in &lt; 30 mins)
        </span>
      </div>

      <button
        onClick={stopImpersonating}
        className="flex items-center gap-1.5 bg-black hover:bg-neutral-800 text-white px-3 py-1 rounded-md text-xs font-semibold transition-all shadow-sm shrink-0"
      >
        <LogOut className="w-3.5 h-3.5" />
        Exit Impersonation
      </button>
    </div>
  );
};
