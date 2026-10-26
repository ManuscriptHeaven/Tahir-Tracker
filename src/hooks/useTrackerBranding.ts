import { useLiveQuery } from 'dexie-react-hooks';
import { useAuth } from '../context/AuthContext';
import { getActiveDb, getCurrentDbUserId } from '../db/db';
import { getTrackerName, getTrackerInitials } from '../utils/trackerBranding';

export function useTrackerBranding() {
  const { user } = useAuth();
  const isRentMode = (import.meta as any).env?.VITE_APP_MODE === 'rent';
  const result = useLiveQuery(async () => {
    if (!user || getCurrentDbUserId() !== user.id) return undefined;
    const settings = await getActiveDb().settings.toCollection().first();
    return { userId: user.id, name: settings?.trackerName };
  }, [user?.id]);
  // Never show the previous account's name while a user switch is loading.
  const trackerName = getTrackerName(result?.userId === user?.id ? result?.name : undefined, isRentMode);
  return { trackerName, trackerInitials: getTrackerInitials(trackerName) };
}
