import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { type PlatformProfile, type TrackerModule, loadPlatformProfile, updateMyTrackers } from '../../services/platformAccess';
import { TrackerPicker } from '../settings/TrackerPicker';
import { setSyncAllowedModules } from '../../services/syncPolicy';

type PlatformState = {
  profile: PlatformProfile;
  setModules: (modules: TrackerModule[]) => Promise<void>;
};
const PlatformContext = createContext<PlatformState | null>(null);
export function usePlatform(): PlatformState {
  const state = useContext(PlatformContext);
  if (!state) throw new Error('Missing platform access context');
  return state;
}

export function PlatformAccessGate({ userId, children }: { userId: string; children: React.ReactNode }) {
  const { signOut } = useAuth();
  const [profile, setProfile] = useState<PlatformProfile | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let live = true;
    const refresh = async () => {
      try {
        const result = await loadPlatformProfile(userId);
        if (live) { setSyncAllowedModules(result.status === 'approved' ? result.allowed_modules : []); setProfile(result); setError(''); }
      } catch (err) {
        if (live) { setError(err instanceof Error ? err.message : 'Could not check account'); setProfile(null); }
      }
    };
    void refresh();
    const timer = window.setInterval(refresh, 30000);
    window.addEventListener('online', refresh);
    const onVisible = () => { if (document.visibilityState === 'visible') void refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      live = false; setSyncAllowedModules(null); clearInterval(timer);
      window.removeEventListener('online', refresh);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [userId, retry]);
  const setModules = async (modules: TrackerModule[]) => { setProfile(await updateMyTrackers(modules)); };
  if (!profile || error) return <div className="min-h-screen bg-[#071724] text-white grid place-content-center p-6 gap-4">
    <p>{error || 'Checking account approval...'}</p>
    {error && <button onClick={() => setRetry(value => value + 1)} className="bg-teal-400 text-slate-950 p-3 rounded-xl">Retry</button>}
    {error && <button onClick={() => void signOut()} className="border border-slate-500 p-3 rounded-xl">Sign out</button>}
  </div>;
  if (profile.status !== 'approved') return <div className="min-h-screen bg-[#071724] text-white grid place-content-center p-6 gap-4 text-center">
    <h1 className="text-2xl font-bold">{profile.status === 'pending' ? 'Waiting for Owner Approval' : 'Account Access Restricted'}</h1>
    <p>{profile.status === 'pending' ? 'Your account request is received. The owner must approve it before you can use trackers.' : 'Please contact the Tahir Tracker owner about your access.'}</p>
    <button onClick={() => void signOut()} className="border border-slate-500 p-3 rounded-xl">Sign out</button>
  </div>;
  if (!profile.enabled_modules.length && profile.role !== 'owner')
    return <TrackerPicker profile={profile} onSave={setModules} firstRun />;
  return <PlatformContext.Provider value={{ profile, setModules }}>{children}</PlatformContext.Provider>;
}
