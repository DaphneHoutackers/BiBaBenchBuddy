import { useEffect, useRef, useState } from 'react';
import { LogIn, UserPlus } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { isSyncEnabled, supabase } from '@/lib/supabase';
import { makeId } from '@/utils/makeId';

const STATE_TOOL_PREFIX = '__account_state__:';

function accountKey(key, userId) {
  return userId ? `${key}__user_${userId}` : null;
}

export function useStoredState(key, initialValue) {
  const { user } = useAuth();
  const scopedKey = accountKey(key, user?.id);
  const hydratedUserRef = useRef(null);
  const [value, setValue] = useState(() => {
    try { const raw = scopedKey ? localStorage.getItem(scopedKey) : null; return raw ? JSON.parse(raw) : initialValue; }
    catch { return initialValue; }
  });

  useEffect(() => {
    let cancelled = false;
    hydratedUserRef.current = null;
    if (!user) { setValue(initialValue); return undefined; }
    try {
      const raw = localStorage.getItem(scopedKey);
      setValue(raw ? JSON.parse(raw) : initialValue);
    } catch { setValue(initialValue); }
    if (isSyncEnabled()) {
      supabase.from('tool_history').select('data').eq('user_id', user.id)
        .eq('toolid', `${STATE_TOOL_PREFIX}${key}`).order('timestamp', { ascending: false }).limit(1).maybeSingle()
        .then(({ data, error }) => {
          if (cancelled || error || data?.data?.value === undefined) return;
          setValue(data.data.value);
          try { localStorage.setItem(scopedKey, JSON.stringify(data.data.value)); } catch {}
        })
        .finally(() => { if (!cancelled) hydratedUserRef.current = user.id; });
    } else hydratedUserRef.current = user.id;
    return () => { cancelled = true; };
  }, [key, scopedKey, user?.id]);

  useEffect(() => {
    if (!user || !isSyncEnabled()) return undefined;
    const toolid = `${STATE_TOOL_PREFIX}${key}`;
    const applyRemote = payload => {
      const row = payload.new;
      if (row?.toolid !== toolid || row?.data?.value === undefined) return;
      setValue(previous => JSON.stringify(previous) === JSON.stringify(row.data.value) ? previous : row.data.value);
    };
    const channel = supabase.channel(`account-state-${user.id}-${key}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tool_history', filter: `user_id=eq.${user.id}` }, applyRemote)
      .subscribe();
    const refresh = async () => {
      const { data } = await supabase.from('tool_history').select('data').eq('user_id', user.id).eq('toolid', toolid).order('timestamp', { ascending: false }).limit(1).maybeSingle();
      if (data?.data?.value !== undefined) setValue(previous => JSON.stringify(previous) === JSON.stringify(data.data.value) ? previous : data.data.value);
    };
    const onVisibility = () => { if (document.visibilityState === 'visible') refresh(); };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', onVisibility);
      supabase.removeChannel(channel);
    };
  }, [key, user?.id]);

  useEffect(() => {
    if (!user || !scopedKey) return undefined;
    try { localStorage.setItem(scopedKey, JSON.stringify(value)); } catch { /* storage may be unavailable */ }
    if (!isSyncEnabled() || hydratedUserRef.current !== user.id) return undefined;
    const timer = setTimeout(async () => {
      const toolid = `${STATE_TOOL_PREFIX}${key}`;
      const { data: existing } = await supabase.from('tool_history').select('id').eq('user_id', user.id).eq('toolid', toolid).limit(1).maybeSingle();
      const row = { user_id: user.id, toolid, toolname: 'Account app data', timestamp: Date.now(), data: { value, key } };
      if (existing?.id) await supabase.from('tool_history').update(row).eq('id', existing.id).eq('user_id', user.id);
      else await supabase.from('tool_history').insert({ ...row, id: makeId() });
    }, 700);
    return () => clearTimeout(timer);
  }, [key, scopedKey, user?.id, value]);
  return [value, setValue];
}

export function AccountRequired({ toolName, children }) {
  const { user } = useAuth();
  if (user) return children;
  const openAuth = mode => window.dispatchEvent(new CustomEvent('bibabench:open-auth', { detail: { mode } }));
  return <div className="mx-auto mt-10 max-w-lg rounded-2xl border border-teal-200 bg-teal-50/70 p-6 text-center shadow-sm">
    <h2 className="text-lg font-bold text-slate-800">Log eerst in om {toolName} te gebruiken</h2>
    <p className="mt-2 text-sm leading-6 text-slate-600">Je gegevens worden dan veilig aan jouw account gekoppeld en automatisch gesynchroniseerd op je andere apparaten.</p>
    <div className="mt-5 flex justify-center gap-2">
      <button type="button" onClick={() => openAuth('login')} className={secondaryButton}><LogIn className="h-4 w-4" />Log in</button>
      <button type="button" onClick={() => openAuth('signup')} className={primaryButton}><UserPlus className="h-4 w-4" />Sign up</button>
    </div>
  </div>;
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
