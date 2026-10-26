import { useEffect, useState } from 'react';
import { type PlatformProfile, type ApprovalStatus, type TrackerModule, TRACKER_MODULES, listPlatformMembers, managePlatformMember } from '../../services/platformAccess';

function MemberCard({ member, reload }: { member: PlatformProfile; reload: () => Promise<void> }) {
  const [allowed, setAllowed] = useState<TrackerModule[]>(member.allowed_modules);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => setAllowed(member.allowed_modules), [member.allowed_modules]);
  const change = async (status: ApprovalStatus | null) => {
    setBusy(true); setError('');
    try { await managePlatformMember(member.user_id, status, allowed); await reload(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to save'); }
    finally { setBusy(false); }
  };
  return <div className="border border-slate-700 rounded-2xl bg-[#071724] p-4 space-y-3">
    <div><p className="text-white font-bold text-sm break-all">{member.email}</p>
      <p className="text-slate-400 text-xs">{member.status.toUpperCase()}</p></div>
    <p className="text-xs text-slate-300">Allowed modules</p>
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {TRACKER_MODULES.map(m => <label key={m.id} className="flex gap-2 text-xs text-slate-300">
        <input type="checkbox" className="accent-teal-400" checked={allowed.includes(m.id)}
          onChange={() => setAllowed(old => old.includes(m.id) ? old.filter(id => id !== m.id) : [...old, m.id])} />{m.label}
      </label>)}
    </div>
    {error && <p className="text-rose-300 text-xs">{error}</p>}
    <div className="flex gap-2 flex-wrap">
      {member.status !== 'approved' && <button disabled={busy || !allowed.length} onClick={() => void change('approved')} className="px-3 py-2 rounded-lg bg-teal-400 text-slate-950 text-xs font-bold disabled:opacity-50">Approve</button>}
      {member.status === 'approved' && <button disabled={busy} onClick={() => void change('suspended')} className="px-3 py-2 rounded-lg border border-amber-400 text-amber-300 text-xs">Suspend</button>}
      {member.status === 'pending' && <button disabled={busy} onClick={() => void change('rejected')} className="px-3 py-2 rounded-lg border border-rose-400 text-rose-300 text-xs">Reject</button>}
      <button disabled={busy} onClick={() => void change(null)} className="px-3 py-2 rounded-lg bg-[#102638] text-white border border-slate-600 text-xs">{busy ? 'Saving...' : 'Save Permissions'}</button>
    </div>
  </div>;
}

export function OwnerUserManagement() {
  const [members, setMembers] = useState<PlatformProfile[]>([]);
  const [error, setError] = useState('');
  const reload = async () => {
    try { setMembers(await listPlatformMembers()); setError(''); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to load user list'); }
  };
  useEffect(() => { void reload(); const interval = window.setInterval(() => void reload(), 30000); return () => clearInterval(interval); }, []);
  const users = members.filter(m => m.role !== 'owner').sort((a,b) => (a.status === 'pending' ? 0 : 1) - (b.status === 'pending' ? 0 : 1));
  return <section className="rounded-3xl bg-[#0B1D2C] border border-teal-500/25 p-5 space-y-4">
    <div className="flex justify-between items-center">
      <div><h2 className="text-xl font-black text-white">User Management</h2><p className="text-slate-400 text-xs">Owner only · {users.filter(m => m.status === 'pending').length} awaiting approval</p></div>
      <button onClick={() => void reload()} className="px-3 py-2 bg-[#102638] text-teal-300 rounded-xl text-xs">Refresh</button>
    </div>
    {error && <p className="text-rose-300 text-sm">{error}</p>}
    {users.map(member => <MemberCard key={member.user_id} member={member} reload={reload}/>)}
  </section>;
}
