import { useState } from 'react';
import { TRACKER_MODULES, type PlatformProfile, type TrackerModule } from '../../services/platformAccess';

export function TrackerPicker({
  profile, onSave, firstRun = false
}: { profile: PlatformProfile; onSave: (modules: TrackerModule[]) => Promise<void>; firstRun?: boolean }) {
  const [selection, setSelection] = useState<TrackerModule[]>(profile.enabled_modules);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const available = TRACKER_MODULES.filter(module => profile.allowed_modules.includes(module.id));
  const toggle = (module: TrackerModule) => setSelection(old => old.includes(module) ? old.filter(id => id !== module) : [...old, module]);

  return <section className={firstRun ? 'min-h-screen bg-[#071724] text-white grid place-items-center p-4' : 'text-white'}>
    <div className="w-full max-w-xl bg-[#0B1D2C] rounded-3xl border border-teal-500/20 p-5 sm:p-6 space-y-4">
      <div>
        <h2 className="text-xl font-black">{firstRun ? 'Set Up Your Private Workspace' : 'Manage My Trackers'}</h2>
        <p className="mt-1 text-xs text-slate-400">
          {firstRun ? 'You are approved! Select the trackers you want to use.' : 'Turn any permitted tracker on or off. Your records are never deleted.'}
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {available.map(module => <label key={module.id} className="flex cursor-pointer gap-3 p-3 rounded-xl bg-[#071724] border border-slate-700">
          <input type="checkbox" checked={selection.includes(module.id)} onChange={() => toggle(module.id)} className="accent-teal-400"/>
          <span><strong className="block text-sm">{module.label}</strong><small className="text-slate-400">{module.description}</small></span>
        </label>)}
      </div>
      {available.length === 0 && <p className="text-amber-300 text-sm">The owner has not allowed any modules for this account.</p>}
      {error && <p className="text-rose-300 text-sm">{error}</p>}
      <button disabled={!selection.length || busy} onClick={async () => {
        setBusy(true); setError('');
        try { await onSave(selection); } catch (err) { setError(err instanceof Error ? err.message : 'Unable to save selection'); }
        finally { setBusy(false); }
      }} className="w-full bg-[#18E6BE] text-[#06131F] rounded-xl py-3 font-bold disabled:opacity-40">
        {busy ? 'Saving...' : firstRun ? 'Open My Workspace' : 'Save Tracker Selection'}
      </button>
    </div>
  </section>;
}
