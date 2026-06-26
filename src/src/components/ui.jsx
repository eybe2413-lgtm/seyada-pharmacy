import React from 'react';
import { X, Loader2 } from 'lucide-react';

export function Button({ variant = 'primary', className = '', children, ...props }) {
  const base = 'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition disabled:opacity-50 disabled:cursor-not-allowed';
  const variants = {
    primary: 'bg-primary text-white hover:bg-primary-dark',
    secondary: 'bg-primary-soft text-primary-dark hover:bg-primary/10',
    danger: 'bg-danger text-white hover:bg-danger/90',
    ghost: 'bg-transparent text-ink hover:bg-bg border border-line',
    outline: 'bg-white text-primary border-2 border-primary hover:bg-primary-soft',
  };
  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function Card({ className = '', children, ...props }) {
  return (
    <div className={`bg-white border border-line rounded-xl2 shadow-sm ${className}`} {...props}>
      {children}
    </div>
  );
}

export function Field({ label, children, hint }) {
  return (
    <label className="block mb-4">
      {label && <span className="block text-xs font-semibold text-sub mb-1.5">{label}</span>}
      {children}
      {hint && <span className="block text-[11px] text-sub mt-1">{hint}</span>}
    </label>
  );
}

export const Input = React.forwardRef(function Input({ className = '', ...props }, ref) {
  return (
    <input
      ref={ref}
      className={`w-full rounded-lg border border-line px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary ${className}`}
      {...props}
    />
  );
});

export function Select({ className = '', children, ...props }) {
  return (
    <select
      className={`w-full rounded-lg border border-line px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}

export function Badge({ tone = 'default', children }) {
  const tones = {
    default: 'bg-bg text-sub',
    primary: 'bg-primary-soft text-primary-dark',
    danger: 'bg-danger-soft text-danger',
    accent: 'bg-accent-soft text-accent',
  };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${tones[tone]}`}>{children}</span>;
}

export function Spinner({ className = '' }) {
  return <Loader2 className={`animate-spin text-primary ${className}`} size={20} />;
}

export function EmptyState({ children }) {
  return <div className="text-center text-sm text-sub py-16">{children}</div>;
}

export function Modal({ open, onClose, title, children, wide = false }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className={`bg-white rounded-xl2 shadow-xl w-full ${wide ? 'max-w-2xl' : 'max-w-md'} max-h-[90vh] overflow-y-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-line sticky top-0 bg-white">
          <h3 className="font-bold text-ink">{title}</h3>
          <button onClick={onClose} className="text-sub hover:text-ink">
            <X size={20} />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

export function LoadMoreButton({ hasMore, loadingMore, onClick }) {
  if (!hasMore) return null;
  return (
    <div className="flex justify-center py-4">
      <Button variant="ghost" onClick={onClick} disabled={loadingMore}>
        {loadingMore ? <Spinner className="text-ink" /> : 'تحميل المزيد'}
      </Button>
    </div>
  );
}
