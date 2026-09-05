import { reconcileHistory, sameHistoryRevision, retainHistory } from '@/lib/historySync';
import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase, isSyncEnabled } from '@/lib/supabase';
import { makeId } from '@/utils/makeId';
import { useAuth } from '@/lib/AuthContext';

const HistoryContext = createContext(null);
const LOCAL_STORAGE_KEY = 'bibabenchbuddy_tool_history';
const HIDDEN_HISTORY_TOOL_IDS = new Set(['__seq_analyzer_library__']);


function normalizeRemoteItem(row) {
  const ts = row.timestamp || Date.now();
  return {
    id: row.id,
    toolId: row.toolid,
    toolName: row.toolname,
    timestamp: ts,
    createdAt: new Date(ts).toISOString(),
    data: row.data,
    synced: true,
  };
}

function buildRemoteRow(item, userId) {
  const ts = item.timestamp || (item.createdAt ? new Date(item.createdAt).getTime() : Date.now());

  return {
    id: item.id || makeId(),
    user_id: userId,
    toolid: item.toolId,
    toolname: item.toolName,
    timestamp: ts,
    data: item.data,
  };
}

function deduplicateHistory(items) {
  if (!Array.isArray(items)) return [];
  const seen = new Set();
  return items.filter((item) => {
    if (!item) return false;
    if (HIDDEN_HISTORY_TOOL_IDS.has(item.toolId)) return true;

    // Deduplicate identical preview + tool content
    const preview = item.data?.preview || '';
    const key = `${item.toolId}_${preview}_${JSON.stringify(item.data || {})}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function HistoryProvider({ children }) {
  const { user } = useAuth();
  const [isRemoteLoading, setIsRemoteLoading] = useState(false);

  const getStorageKey = useCallback(() => {
    return user ? `${LOCAL_STORAGE_KEY}_${user.id}` : LOCAL_STORAGE_KEY;
  }, [user?.id]);

  const [history, setHistory] = useState([]);
  const accountRef = useRef(user?.id);
  accountRef.current = user?.id;

  const uploadQueueRef = useRef(Promise.resolve());
  const [syncError, setSyncError] = useState(null);
  const uploadRows = useCallback((rows) => {
    const accountId = user?.id;
    const task = uploadQueueRef.current.catch(() => {}).then(async () => {
      if (!accountId || accountRef.current !== accountId) throw new Error('Account changed; sign in and save again.');
      const controller = new AbortController();
      let timer;
      try {
        const response = await Promise.race([
          supabase.from('tool_history').upsert(rows, { onConflict: 'id' }).abortSignal(controller.signal),
          new Promise((_, reject) => { timer = setTimeout(() => {
            controller.abort();
            reject(new Error('Saving timed out. Your edits are kept on this device; try Save again.'));
          }, 12000); }),
        ]);
        if (response.error) throw response.error;
      } finally { clearTimeout(timer); }
    });
    uploadQueueRef.current = task;
    return task;
  }, [user?.id]);

  // Load history whenever user changes
  useEffect(() => {
    if (!user) {
      setHistory([]);
      setIsRemoteLoading(false);
      return;
    }
    const key = getStorageKey();
    try {
      const saved = localStorage.getItem(key);
      const parsed = saved ? JSON.parse(saved) : [];
      setHistory(deduplicateHistory(parsed));
    } catch {
      setHistory([]);
    }
    
    setIsRemoteLoading(true);
    loadRemoteHistory([]).finally(() => setIsRemoteLoading(false)); // pass empty to avoid syncing guest history to new user accidentally unless intended
  }, [user?.id, getStorageKey]);

  // Keep a ref of history for reliable access in async callbacks
  const historyRef = useRef(history);
  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  const loadRemoteHistory = useCallback(async (currentLocalHistory = []) => {
    if (!isSyncEnabled() || !user) return;

    // 1. If there's local unsynced history, upload it to the account
    const unsynced = Array.isArray(currentLocalHistory)
      ? currentLocalHistory.filter(item => !item.synced)
      : [];

    if (unsynced.length > 0) {
      const rows = unsynced.map(item => buildRemoteRow(item, user.id));
      await supabase.from('tool_history').upsert(rows, { onConflict: 'id' });
    }

    // 2. Fetch visible history plus hidden app-state records for this account.
    const { data, error } = await supabase
      .from('tool_history')
      .select('*')
      .eq('user_id', user.id)
      .neq('toolid', '__seq_analyzer_library__')
      .not('toolid', 'like', '__account_state__:%')
      .order('timestamp', { ascending: false })
      .limit(100);

    const { data: hiddenData, error: hiddenError } = await supabase
      .from('tool_history')
      .select('*')
      .eq('user_id', user.id)
      .eq('toolid', '__seq_analyzer_library__');

    if (error || !data || accountRef.current !== user.id) return;

    const normalized = deduplicateHistory(
      [...data, ...(!hiddenError && hiddenData ? hiddenData : [])]
        .map(normalizeRemoteItem)
        .sort((a, b) => b.timestamp - a.timestamp)
    );

    setHistory(prev => reconcileHistory(prev, normalized));

  }, [user, getStorageKey]);

  // Keep already-open devices current and refresh again when a mobile/desktop
  // app returns to the foreground. The user_id filter is backed by RLS.
  useEffect(() => {
    if (!user || !isSyncEnabled()) return undefined;
    const refresh = () => loadRemoteHistory([]);
    const channel = supabase.channel(`tool-history-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tool_history', filter: `user_id=eq.${user.id}` }, refresh)
      .subscribe();
    const onVisibility = () => { if (document.visibilityState === 'visible') refresh(); };
    const poll = window.setInterval(refresh, 5000);
    window.addEventListener('online', refresh);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(poll);
      window.removeEventListener('online', refresh);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', onVisibility);
      supabase.removeChannel(channel);
    };
  }, [user?.id, loadRemoteHistory]);

  useEffect(() => {
    if (!history || history.length === 0 && !user) return;

    try {
      localStorage.setItem(getStorageKey(), JSON.stringify(history));
    } catch (err) {
      console.warn('Failed to persist history locally:', err);
    }

    const syncTimeout = setTimeout(async () => {
      if (!isSyncEnabled() || !user) return;

      const unsynced = history.filter((item) => !item.synced);
      if (unsynced.length === 0) return;

      const rows = unsynced.map((item) => buildRemoteRow(item, user.id));

      try {
        await uploadRows(rows);
        if (accountRef.current !== user.id) return;
        setSyncError(null);
        setHistory((prev) =>
          prev.map((item) => {
            if (!unsynced.some((u) => sameHistoryRevision(u, item))) return item;
            const createdAt = item.createdAt
              ? item.createdAt
              : item.timestamp
                ? new Date(item.timestamp).toISOString()
                : new Date().toISOString();

            return {
              ...item,
              createdAt,
              timestamp: item.timestamp,
              synced: true,
            };
          })
        );
      } catch (error) { setSyncError(error.message || 'Sync failed'); }
    }, 150);

    return () => clearTimeout(syncTimeout);
  }, [history, user, getStorageKey, uploadRows]);

  const addHistoryItem = useCallback((item) => {
    setHistory((prev) => {
      const now = Date.now();
      const nowIso = new Date(now).toISOString();
      const normalizedItem = {
        id: item.id || makeId(),
        toolId: item.toolId,
        toolName: item.toolName,
        data: item.data,
        createdAt: item.createdAt || nowIso,
        timestamp: now,
        synced: false,
      };

      // Find matching item by ID, or by identical tool and data payload
      const existingIndex = prev.findIndex((entry) => {
        if (entry.id === normalizedItem.id) return true;
        if (
          !HIDDEN_HISTORY_TOOL_IDS.has(entry.toolId) &&
          entry.toolId === normalizedItem.toolId &&
          (entry.data?.preview === normalizedItem.data?.preview || !entry.data?.preview) &&
          JSON.stringify(entry.data) === JSON.stringify(normalizedItem.data)
        ) {
          return true;
        }
        return false;
      });

      if (existingIndex !== -1) {
        const updated = [...prev];
        const existing = updated[existingIndex];
        updated[existingIndex] = {
          ...existing,
          ...normalizedItem,
          id: existing.id,
          createdAt: existing.createdAt,
          timestamp: now,
          synced: false,
        };

        return retainHistory(updated.sort((a, b) => b.timestamp - a.timestamp));
      }

      return retainHistory([normalizedItem, ...prev].sort((a, b) => b.timestamp - a.timestamp));
    });
  }, []);

  const saveHistoryItems = useCallback(async (items) => {
    const accountId = user?.id;
    const now = Date.now();
    const revisions = items.map(item => ({ ...item, id: item.id || makeId(), timestamp: now, createdAt: new Date(now).toISOString(), synced: false }));
    const ids = new Set(revisions.map(item => item.id));
    const next = retainHistory([...revisions, ...historyRef.current.filter(item => !ids.has(item.id))].sort((a, b) => b.timestamp - a.timestamp));
    historyRef.current = next;
    setHistory(next);
    localStorage.setItem(getStorageKey(), JSON.stringify(next));
    if (!accountId || !isSyncEnabled()) throw new Error('Account sync is unavailable. Your edits are saved on this device.');
    try {
      await uploadRows(revisions.map(item => buildRemoteRow(item, accountId)));
      if (accountRef.current !== accountId) throw new Error('Account changed during save.');
      setHistory(prev => prev.map(item => revisions.some(sent => sameHistoryRevision(sent, item)) ? { ...item, synced: true } : item));
      setSyncError(null);
    } catch (error) {
      setSyncError(error.message || 'Save failed');
      throw error;
    }
  }, [user?.id, getStorageKey, uploadRows]);

  const deleteHistoryItem = useCallback(async (id) => {
    setHistory((prev) => prev.filter((item) => item.id !== id));

    if (!isSyncEnabled()) return;

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) return;

    await supabase
      .from('tool_history')
      .delete()
      .eq('id', id)
      .eq('user_id', session.user.id);
  }, []);

  const clearHistory = useCallback(async () => {
    setHistory((prev) => prev.filter((item) => HIDDEN_HISTORY_TOOL_IDS.has(item.toolId)));
    try {
      const hiddenItems = historyRef.current.filter((item) => HIDDEN_HISTORY_TOOL_IDS.has(item.toolId));
      if (hiddenItems.length > 0) {
        localStorage.setItem(getStorageKey(), JSON.stringify(hiddenItems));
      } else {
        localStorage.removeItem(getStorageKey());
      }
    } catch {
      localStorage.removeItem(getStorageKey());
    }

    if (!isSyncEnabled()) return;

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) return;

    await supabase
      .from('tool_history')
      .delete()
      .eq('user_id', session.user.id)
      .neq('toolid', '__seq_analyzer_library__');
  }, [getStorageKey]);

  return (
    <HistoryContext.Provider
      value={{
        history,
        user,
        isRemoteLoading,
        addHistoryItem,
        saveHistoryItems,
        syncError,
        deleteHistoryItem,
        clearHistory,
        reloadHistory: loadRemoteHistory,
      }}
    >
      {children}
    </HistoryContext.Provider>
  );
}

export function useHistory() {
  const context = useContext(HistoryContext);
  if (!context) {
    throw new Error('useHistory must be used within a HistoryProvider');
  }
  return context;
}
