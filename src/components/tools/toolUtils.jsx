import { useEffect, useState } from 'react';

export function useStoredState(key, initialValue) {
  const [value, setValue] = useState(() => {
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : initialValue; }
    catch { return initialValue; }
  });
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage may be unavailable */ } }, [key, value]);
  return [value, setValue];
}

export const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
export const PALETTE = ['#db2777', '#f97316', '#eab308', '#22c55e', '#0ea5e9', '#8b5cf6', '#64748b'];

export function ToolShell({ icon: Icon, title, description, actions, children }) {
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-pink-50 text-pink-600 dark:bg-pink-950/40"><Icon className="h-5 w-5" /></span>
        <div><h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">{title}</h2><p className="text-sm text-slate-500 dark:text-slate-400">{description}</p></div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
    {children}
  </div>;
}

export const primaryButton = 'inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-pink-600 px-3 text-sm font-semibold text-white transition hover:bg-pink-700 disabled:opacity-50';
export const secondaryButton = 'inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200';
export const fieldClass = 'h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';
export const panelClass = 'rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-white/10';
