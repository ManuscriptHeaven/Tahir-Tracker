import { getSupabaseClient } from '../lib/supabase';

export const TRACKER_MODULES = [
  { id: 'finance', label: 'Personal Finance', description: 'Income, expenses, budgets' },
  { id: 'utility', label: 'Utility Tracker', description: 'Electricity, gas and water' },
  { id: 'loans', label: 'Lease & Loans', description: 'Borrowing and lending' },
  { id: 'milk', label: 'Milk Tracker', description: 'Daily milk and monthly settlement' },
  { id: 'petrol', label: 'Petrol Tracker', description: 'Fuel expenses and mileage' },
  { id: 'rent', label: 'Rent Tracker', description: 'Rent, tenants and properties' },
] as const;

export type TrackerModule = typeof TRACKER_MODULES[number]['id'];
export type ApprovalStatus = 'pending' | 'approved' | 'suspended' | 'rejected';

export interface PlatformProfile {
  user_id: string;
  email: string;
  role: 'owner' | 'member';
  status: ApprovalStatus;
  allowed_modules: TrackerModule[];
  enabled_modules: TrackerModule[];
  created_at: string;
  updated_at: string;
}

const cacheKey = (uid: string) => `tahir_platform_profile_${uid}`;

export function getCachedPlatformProfile(uid: string): PlatformProfile | null {
  try {
    const saved = localStorage.getItem(cacheKey(uid));
    if (!saved) return null;
    const parsed = JSON.parse(saved) as PlatformProfile;
    return parsed.user_id === uid ? parsed : null;
  } catch { return null; }
}

function cacheProfile(profile: PlatformProfile) {
  try { localStorage.setItem(cacheKey(profile.user_id), JSON.stringify(profile)); } catch { /* storage unavailable */ }
}

function clientOrThrow() {
  const client = getSupabaseClient();
  if (!client) throw new Error('Unable to connect to Tahir Tracker. Try again online.');
  return client;
}

/** The server is authoritative. A last-known profile only keeps existing offline work usable. */
export async function loadPlatformProfile(uid: string): Promise<PlatformProfile> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    const cached = getCachedPlatformProfile(uid);
    if (cached) return cached;
    throw new Error('Connect to the internet to verify your access.');
  }
  const { data, error } = await clientOrThrow()
    .from('platform_profiles')
    .select('user_id,email,role,status,allowed_modules,enabled_modules,created_at,updated_at')
    .eq('user_id', uid)
    .single();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Your account profile has not been set up. Contact the owner.');
  const profile = data as PlatformProfile;
  cacheProfile(profile);
  return profile;
}

export async function updateMyTrackers(modules: TrackerModule[]): Promise<PlatformProfile> {
  const { data, error } = await clientOrThrow().rpc('tahir_set_my_modules', { requested_modules: modules });
  if (error || !data) throw new Error(error?.message || 'Unable to save tracker choices');
  const profile = data as PlatformProfile;
  cacheProfile(profile);
  return profile;
}

export async function listPlatformMembers(): Promise<PlatformProfile[]> {
  const { data, error } = await clientOrThrow()
    .from('platform_profiles')
    .select('user_id,email,role,status,allowed_modules,enabled_modules,created_at,updated_at')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []) as PlatformProfile[];
}

export async function managePlatformMember(
  userId: string, status: ApprovalStatus | null, allowedModules: TrackerModule[] | null
): Promise<PlatformProfile> {
  const { data, error } = await clientOrThrow().rpc('tahir_manage_member', {
    target_user_id: userId,
    requested_status: status,
    requested_allowed_modules: allowedModules
  });
  if (error || !data) throw new Error(error?.message || 'Could not update user');
  return data as PlatformProfile;
}
