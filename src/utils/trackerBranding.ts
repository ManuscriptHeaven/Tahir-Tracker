export const DEFAULT_TRACKER_NAME = 'My Tracker';
export const MAX_TRACKER_NAME_LENGTH = 60;

export function normalizeTrackerName(value: string): string {
  return value.trim().replace(/\s+/gu, ' ');
}

export function validateTrackerName(value: string): string | null {
  const name = normalizeTrackerName(value);
  if (!name) return 'Please enter a tracker name.';
  if (name.length > MAX_TRACKER_NAME_LENGTH) return 'Use 60 characters or fewer.';
  if (/[\u0000-\u001f\u007f]/u.test(name)) return 'Please use a name without control characters.';
  return null;
}

export function getTrackerName(value?: string | null, isRentMode = false): string {
  return value && !validateTrackerName(value)
    ? normalizeTrackerName(value)
    : isRentMode ? 'Rent Tracking' : DEFAULT_TRACKER_NAME;
}

export function getTrackerInitials(name: string): string {
  const words = normalizeTrackerName(name).split(' ');
  return (words.length > 1
    ? Array.from(words[0])[0] + Array.from(words[words.length - 1])[0]
    : Array.from(words[0]).slice(0, 2).join('')).toLocaleUpperCase();
}

export function getTrackerFilename(name: string): string {
  return normalizeTrackerName(name).replace(/[^\p{L}\p{N} _-]/gu, '').replace(/\s+/gu, '_') || 'My_Tracker';
}
