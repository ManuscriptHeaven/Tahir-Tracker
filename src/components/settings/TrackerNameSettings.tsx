import React, { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { CheckCircle2, Loader2, Pencil } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getActiveDb, getCurrentDbUserId } from '../../db/db';
import { getWorkspaceSettingsId } from '../../services/tenantWorkspace';
import { DEFAULT_TRACKER_NAME, MAX_TRACKER_NAME_LENGTH, normalizeTrackerName, validateTrackerName } from '../../utils/trackerBranding';

export const TrackerNameSettings: React.FC = () => {
  const { user } = useAuth();
  const settings = useLiveQuery(() => getActiveDb().settings.toCollection().first(), [user?.id]);
  const [name, setName] = useState('');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ error?: string; saved?: boolean }>({});

  useEffect(() => {
    if (!dirty) setName(settings?.trackerName || '');
  }, [settings?.trackerName, dirty]);

  useEffect(() => {
    if (feedback.saved && settings?.trackerName === name) setDirty(false);
  }, [feedback.saved, settings?.trackerName, name]);

  const saveName = async (event: React.FormEvent) => {
    event.preventDefault();
    const error = validateTrackerName(name);
    if (error) { setFeedback({ error }); return; }
    if (!user || getCurrentDbUserId() !== user.id) {
      setFeedback({ error: 'Please sign in to your workspace again.' });
      return;
    }
    const userDb = getActiveDb();
    const ownerId = user.id;
    setSaving(true);
    setFeedback({});
    try {
      // Capture this account's DB before awaiting; never write through a switched proxy.
      const existing = await userDb.settings.toCollection().first();
      if (getCurrentDbUserId() !== ownerId) return;
      const changes = { trackerName: normalizeTrackerName(name), updatedAt: new Date().toISOString() };
      if (existing?.id) {
        await userDb.settings.update(existing.id, changes);
      } else {
        await userDb.settings.add({
          id: getWorkspaceSettingsId(ownerId), currency: 'PKR', milkDefaultRate: 260,
          rentDueDayDefault: 10, theme: 'dark', ...changes
        });
      }
      setName(changes.trackerName);
      // Keep the draft until the live query observes this write.
      setFeedback({ saved: true });
    } catch {
      setFeedback({ error: 'Your tracker name could not be saved. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section aria-labelledby="tracker-name-heading" className="bg-[#0B1D2C] rounded-3xl p-5 sm:p-6 border border-cyan-500/20 shadow-xl space-y-4">
      <div className="flex items-center gap-2.5">
        <Pencil className="w-5 h-5 text-[#18E6BE] shrink-0" />
        <div>
          <h3 id="tracker-name-heading" className="font-bold text-white text-base">Your tracker</h3>
          <p id="tracker-name-help" className="text-xs text-slate-400 mt-1">Choose a name for your private workspace. Shown in the header, browser tab, reports and backups.</p>
        </div>
      </div>
      <form onSubmit={saveName} className="space-y-3">
        <label htmlFor="tracker-name" className="block text-xs font-bold text-slate-300">Tracker name</label>
        <input id="tracker-name" type="text" value={name} placeholder={DEFAULT_TRACKER_NAME}
          maxLength={MAX_TRACKER_NAME_LENGTH} required disabled={saving || !settings}
          aria-describedby="tracker-name-help tracker-name-feedback" aria-invalid={!!feedback.error}
          onChange={event => { setName(event.target.value); setDirty(true); setFeedback({}); }}
          className="w-full px-3.5 py-3 rounded-xl bg-[#071724] border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#18E6BE] focus:ring-1 focus:ring-[#18E6BE] disabled:opacity-50" />
        <div id="tracker-name-feedback" aria-live="polite" className="text-xs min-h-4">
          {feedback.error && <p role="alert" className="text-rose-300">{feedback.error}</p>}
          {feedback.saved && <p className="text-[#18E6BE] flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" />Name saved. Cloud sync will keep it available on your other devices.</p>}
        </div>
        <button type="submit" disabled={saving || !settings || !dirty}
          className="px-4 py-2.5 rounded-xl bg-[#18E6BE] text-[#06131F] text-xs font-bold flex items-center gap-2 disabled:opacity-50">
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {saving ? 'Saving...' : 'Save tracker name'}
        </button>
      </form>
    </section>
  );
};
